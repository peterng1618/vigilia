// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { act } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import {
  createNewObjectPanel,
  type InsertGroup,
  insertGroups,
} from "../new-object-panel.js";
import { arrangeActions } from "../object-actions.js";
import {
  resolveShortcuts,
  setActiveShortcuts,
} from "../shortcut-manager/bindings.js";
import { shortcutLabel } from "../shortcut-manager/display.js";
import {
  PRODUCT_SHORTCUTS,
  type ProductShortcutId,
  type ShortcutBinding,
} from "../shortcut-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import type { ViewportManager } from "../viewport-manager/index.js";
import type { EditorShellBridge } from "./bridge.js";
import type { RailSlot } from "./rail.js";
import type {
  EditorActionFacade,
  EditorViewControls,
} from "./session-facade.js";
import { createShellLayout } from "./shell-layout.js";

// Base UI's popup needs two browser APIs jsdom has none of: floating-ui observes
// its anchor, and the popup waits for its own open transition before reporting
// itself open. Without them a menu never mounts, which is what the View and Edit
// tests below read.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];

// jsdom's selector engine cannot answer `:modal`/`:popover-open`, and
// floating-ui asks for both on every position. Each unanswerable call costs
// ~0.5s of selector parsing, which turns one open into tens of seconds — this
// stub is the cure for the `vg-135` stall (measured at HEAD: the file is 23
// passed in ~8s with it, and one 20s timeout plus three 17-52s stalls without).
// Real browsers answer both. The sibling `publish-control.dom.test.tsx` carries
// the same patch.
beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

function facade(): EditorActionFacade {
  return {
    newDocument: vi.fn(async () => undefined),
    newFromStarter: vi.fn(async () => undefined),
    openPackage: vi.fn(),
    savePackage: vi.fn(async () => undefined),
    releasePackage: vi.fn(async () => undefined),
    openLibrary: vi.fn(async () => undefined),
    saveLibrary: vi.fn(async () => undefined),
    addText: vi.fn(),
    addShape: vi.fn(),
    addChart: vi.fn(),
    insertCard: vi.fn(),
    arrange: vi.fn(() => true),
    canArrange: vi.fn(() => true),
    undo: vi.fn(),
    redo: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    deleteActive: vi.fn(),
    duplicate: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    isDirty: vi.fn(() => false),
    publishableDocument: vi.fn(() => undefined),
    subscribeDocumentChange: vi.fn(() => () => undefined),
  };
}

/** The live binding table is module state, so it is put back after every test.
 *
 *  The menu check is the ordering guard (`vg-186`), inverted: each test's own
 *  `layout.destroy()` is what unmounts the menu it opened, so a menu still in
 *  `body` here means one outlived its test — which is what made this file's
 *  tests depend on where they sit. It fails at the test that leaked rather than
 *  as a stall in whichever test runs next. */
afterEach(() => {
  expect(document.querySelectorAll(".editor-shell-menu-popup")).toHaveLength(0);
  setActiveShortcuts(PRODUCT_SHORTCUTS);
});

/** The View menu's controls. The shell only reads and writes these three, so a
 *  stub with every member is the whole of what the menu can reach. */
function viewStub(
  overrides: Partial<EditorViewControls> = {},
): EditorViewControls {
  return {
    sourceMode: () => "preview",
    setSourceMode: vi.fn(),
    chartRefreshRate: () => 30,
    setChartRefreshRate: vi.fn(),
    runDisplay: () => "values",
    setRunDisplay: vi.fn(),
    ...overrides,
  };
}

function bridgeStub(
  overrides: Partial<EditorShellBridge> = {},
): EditorShellBridge {
  return {
    snapshot: () => ({
      selectedCount: 0,
      locked: false,
      activeKind: "none",
      documentName: undefined,
      selectionPresetId: undefined,
    }),
    capture: () => undefined,
    target: () => ({
      kind: "none",
      locked: false,
      memberCount: 0,
      isGroup: false,
    }),
    can: () => false,
    canArrange: () => false,
    layers: () => [],
    groupContext: () => [],
    selectLayer: vi.fn(),
    enterGroup: vi.fn(),
    exitGroup: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    setCollapsed: vi.fn(),
    renameLayer: vi.fn(),
    canMoveLayer: () => false,
    moveLayer: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: facade(),
    // Only the camera is stubbed: the switch subscribes to it, so an empty
    // object here would throw rather than exercise the shell. The shell only
    // reaches `viewport`, so the double cast is the partial stub's whole point;
    // the `satisfies` is what checks the members inside it, which the cast
    // alone would erase — and a member the control reads but this stub omits
    // throws inside the render, taking the whole shell down with it rather
    // than failing the one assertion about the camera.
    editor: {
      // Read by the display switch for the group of previews that leads.
      artboard: () => ({ width: 1920, height: 1080 }),
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: () => () => undefined,
      } satisfies Pick<
        ViewportManager,
        "zoom" | "display" | "isFitted" | "onChange"
      >,
    } as unknown as EditorShellBridge["editor"],
    destroy: vi.fn(),
    ...overrides,
  };
}

/**
 * First in the file because it is the case `vg-186` is proved by.
 *
 * The row recorded that an earlier menu stalls this test's close, so it only
 * passed because of where it sat. Re-measured at HEAD neither half holds: the
 * stall was jsdom's `:modal`/`:popover-open` selector cost — the stub at the
 * top of this file — and this test now passes wherever it sits (0.17 s here,
 * 0.1 s last), so no case in the file depends on the order. It stays first
 * because that is the position the row's ruling named as its proof.
 */
it("opens the shortcut sheet from the shell's own surface, and closes it again", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  // No wait before the read: `flushSync` inside `showShortcuts` settles the
  // external store synchronously, so the result is observable without a poll —
  // the same reason `setBridge` uses it. The wait after the close is real:
  // neither library takes a popup out of the document synchronously, and Base
  // UI holds it behind `hidden` until the close settles.
  layout.showShortcuts();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  // The words are the sample's, not the document's: a sheet that printed an
  // authored theme's tokens would be shell copy owned by a theme.
  expect(dialog?.textContent).toContain(uiCopy.shortcuts.reference);

  const close = [...(dialog?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === uiCopy.shortcuts.close,
  );
  close?.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="dialog"]')).toBeNull(),
  );
  layout.destroy();
});

it("mounts the OS-resolved palette, menus, rail, inspector and dock hosts", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // Fresh profile: jsdom has no `matchMedia`, so the OS reads as light and the
  // shell resolves `light`. The attribute marks the document element, which is
  // what the portalled popups inherit from.
  expect(document.documentElement.dataset["shellPalette"]).toBe("light");
  expect(root.querySelector("#stage")).not.toBeNull();
  expect(root.querySelector("#status")).not.toBeNull();
  expect(root.querySelector("#canvas-host")).not.toBeNull();
  expect(root.querySelector(".editor-shell-dock")?.closest("#stage")).toBe(
    root.querySelector("#stage"),
  );
  // Four slots, and no `+`: the insert chooser went with the pane bar, and the
  // Add pane is the one surface the insertable list is reached from now that
  // the Insert menu has gone with it. A slot with nothing behind it is the
  // defect this plan exists to fix, so the count is a claim about the left
  // column, not a snapshot of how many icons happen to be there. Scoped to
  // `[data-rail-slot]`: the foot's settings gear is a button on the rail too,
  // and it is deliberately not a slot.
  expect(root.querySelectorAll(".editor-shell-rail-slot")).toHaveLength(4);
  expect(root.querySelector(".editor-shell-rail-settings")).not.toBeNull();
  // The rail's whole button count, not only its slots: five is the four slots
  // plus the foot's gear, and a sixth control arriving on the rail where it
  // should not fails here rather than hiding behind the slot count.
  expect(root.querySelectorAll(".editor-shell-rail button")).toHaveLength(5);
  // The horizontal bar is gone, not merely hidden.
  expect(root.querySelector(".editor-shell-pane-bar")).toBeNull();
  expect(root.textContent).toContain("File");
  // The Arrange menu is gone: the arrange toolbar above the canvas already
  // carries all eight actions, and the menu offered two of them with nothing
  // saying the rest existed. Asserting its absence is the point — a test that
  // only checked the toolbar would not have noticed it return.
  expect(root.textContent).not.toContain("Arrange");
  // The palette chip left the header for Settings (§7), and the header is not
  // allowed to grow a second route back to it: the gear is the only one. The
  // attribute it used to write is still what paints the shell, asserted above.
  expect(
    root.querySelector(".editor-shell-header [data-vigilia-palette]"),
    "a palette control is back in the header",
  ).toBeNull();

  layout.destroy();
});

it("opens the slot a reveal names before scrolling to the row inside it", async () => {
  // A pane that is not showing has no scroll target, so the reveal is two steps
  // and one owner: the slot opens, then the row is brought into view. Both are
  // asserted because a reveal that only scrolled would land on a hidden box.
  const root = document.createElement("div");
  document.body.append(root);
  const layout = createShellLayout(root);

  // A row of the shape presets carry, standing in for the Tokens pane's list.
  const row = document.createElement("div");
  row.dataset["vigiliaTypePresetRow"] = "24-400";
  layout.hosts.tokens.append(row);
  const scrolled = vi.fn();
  row.scrollIntoView = scrolled;

  const pane = root.querySelector<HTMLElement>('[data-vigilia-panel="tokens"]');
  expect(pane?.contains(row)).toBe(true);
  expect(pane?.hidden).toBe(true);
  expect(segment(root, "tokens").getAttribute("aria-pressed")).toBe("false");

  await act(async () => {
    layout.reveal("tokens", '[data-vigilia-type-preset-row="24-400"]');
  });
  await frame();

  expect(segment(root, "tokens").getAttribute("aria-pressed")).toBe("true");
  expect(pane?.hidden).toBe(false);
  expect(scrolled).toHaveBeenCalledTimes(1);

  // Asking again is not a close: the reveal brings an author to a pane, and it
  // is not the rail's toggle.
  await act(async () => {
    layout.reveal("tokens", '[data-vigilia-type-preset-row="24-400"]');
  });
  await frame();
  expect(pane?.hidden).toBe(false);

  layout.destroy();
  root.remove();
});

it("gives every pane DESIGN.md's chrome, named by the section the specs browse", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // One pane per rail slot, each wearing a title bar, its own `data-vigilia-panel`
  // name and `hidden` unless its slot is chosen. The Composition pane's DOM name
  // is the `layers` the browser specs and the panel CSS already browse by, so
  // the chrome moved around the contract rather than the contract moving; its
  // visible title, like the other three, is the slot's own word.
  const panes = root.querySelectorAll(".editor-shell-pane");
  expect(panes).toHaveLength(4);
  expect(
    [...panes].map((pane) => pane.getAttribute("data-vigilia-panel")).sort(),
  ).toEqual(["add", "document", "layers", "tokens"]);
  for (const pane of panes) {
    expect(pane.querySelector(".editor-shell-pane-title")).not.toBeNull();
  }
  const layers = root.querySelector('[data-vigilia-panel="layers"]');
  expect(layers).not.toBeNull();
  expect(layers?.classList.contains("editor-shell-pane")).toBe(true);
  expect(layers?.querySelector(".editor-shell-pane-name")?.textContent).toBe(
    uiCopy.rail.slots.composition,
  );
  // The object actions are the pane's footer toolbar — a Pane footer, so it is
  // not a row of the tree — and there is exactly one of them.
  expect(layers?.querySelector("[data-vigilia-layer-actions]")).not.toBeNull();
  expect(
    root.querySelectorAll(
      '[data-vigilia-panel="layers"] [data-vigilia-layer-actions]',
    ),
  ).toHaveLength(1);

  layout.destroy();
});

/**
 * The chord's shell door, driven directly.
 *
 * F1 on this branch: the header's `⌘⇧P` called `hosting.toggle()`, so a press
 * beside a control that opens a surface silently started the LAN — the exact
 * defect `publish-control.tsx`'s docstring exists to prevent, in the worse
 * direction. This drives the door the session's `publish.surface` handler
 * calls and reads both halves: the surface is up, and the host was asked
 * nothing. Revert the door to moving the host and the popover never opens;
 * leave the popover and write the host too, and `puts` catches it.
 *
 * Placed beside the sheet test rather than with the menus: both drive a surface
 * the header owns, and neither reads the menu group's markup.
 */
it("opens the publish surface from the shell's own door, and moves no host state", async () => {
  const token = "t".repeat(43);
  let puts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/pairing/sessions")) {
        return new Response(
          JSON.stringify({
            session: { token, expiresAt: "2026-10-08T00:00:00.000Z" },
          }),
          { status: 201 },
        );
      }
      if (init?.method === "PUT") puts += 1;
      return new Response(
        JSON.stringify({
          lan: true,
          address: "192.168.1.42",
          port: 5227,
          refusal: null,
          sessions: [],
        }),
        { status: 200 },
      );
    }),
  );

  const root = document.createElement("div");
  const layout = createShellLayout(root);
  // The host is asked once, when the store is built, and the control is drawn
  // only once it has answered — so the wait is for the control, not for a frame.
  await vi.waitFor(() =>
    expect(root.querySelector("[data-vigilia-publish]")).not.toBeNull(),
  );
  const trigger = (): string | null =>
    root
      .querySelector("[data-vigilia-publish]")
      ?.getAttribute("aria-expanded") ?? null;
  expect(trigger()).toBe("false");

  await act(async () => layout.showPublishing());

  expect(trigger()).toBe("true");
  // The surface itself, not merely the flag behind it: the popup is portalled
  // to `body`, so the mount point holds none of it.
  expect(document.querySelector(".editor-shell-publish-popup")).not.toBeNull();
  expect(puts).toBe(0);

  layout.destroy();
  vi.unstubAllGlobals();
  for (const stray of document.querySelectorAll(".editor-shell-positioner")) {
    stray.remove();
  }
});

/** The rail's slot for a pane, found by the id it carries rather than by text:
 *  a slot draws a glyph and has no label a reader could match on. */
function segment(root: HTMLElement, id: RailSlot): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    `.editor-shell-rail button[data-rail-slot="${id}"]`,
  );
  if (found === null) throw new Error(`No "${id}" slot.`);
  return found;
}

/** One frame, which is when a reveal scrolls: the pane is laid out only after
 *  the render that opens it. */
async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
}

/** The menubar trigger for a menu, found by the text it carries. */
function menubarEntry(root: HTMLElement, label: string): HTMLButtonElement {
  const entry = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".editor-shell-menubar button"),
  ).find((button) => button.textContent === label);
  if (entry === undefined) throw new Error(`No "${label}" menu.`);
  return entry;
}

/** The Add pane's own groups, read the same way: the lone button, then each
    fieldset with its legend. */
/** What the pane drew, read the way a reader is told it: the entries that stand
 *  alone, then each named group. A tile's name is its accessible one, because
 *  the shapes and the chart families are glyph-led — their own text is empty —
 *  and the accessible name is what a screen reader announces either way. */
function paneGroups(
  pane: HTMLElement,
): readonly (readonly [string | null, readonly string[]])[] {
  const name = (control: HTMLElement): string =>
    control.getAttribute("aria-label") ?? control.textContent ?? "";
  return [
    [
      null,
      Array.from(pane.children)
        .filter((child) => child.tagName === "BUTTON")
        .map((button) => name(button as HTMLElement)),
    ],
    ...Array.from(pane.querySelectorAll<HTMLElement>("fieldset")).map(
      (group): readonly [string | null, readonly string[]] => [
        group.querySelector("legend")?.textContent ?? null,
        Array.from(group.querySelectorAll<HTMLElement>("button")).map(name),
      ],
    ),
  ];
}

function openPopup(): HTMLElement {
  const popup = document.querySelector<HTMLElement>(
    ".editor-shell-menu-popup[data-open]",
  );
  if (popup === null) throw new Error("No menu is open.");
  return popup;
}

function menuItems(): readonly HTMLElement[] {
  return Array.from(
    openPopup().querySelectorAll<HTMLElement>("[role=menuitem]"),
  );
}

/** Every popup an author currently has open. A submenu is a second one, so the
 *  View menu's own items are the first — its submenu opens after it. */
function openPopups(): readonly HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      ".editor-shell-menu-popup[data-open]",
    ),
  );
}

/** The radio entries of the submenu that is open, as `[value, checked]` pairs —
 *  what a screen reader is actually told, rather than what the label reads. */
function openRadioItems(
  popup: HTMLElement,
): readonly (readonly [string, string | null])[] {
  return Array.from(
    popup.querySelectorAll<HTMLElement>("[role=menuitemradio]"),
  ).map((item) => [
    (item.textContent ?? "").trim(),
    item.getAttribute("aria-checked"),
  ]);
}

it("collapses the panel when the segment for the visible pane is clicked again", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;
  const body = root.querySelector<HTMLElement>(".editor-shell-body")!;
  const rail = root.querySelector<HTMLElement>(".editor-shell-rail")!;
  const layers = segment(root, "composition");

  expect(panel.hidden).toBe(false);
  expect(layers.getAttribute("aria-pressed")).toBe("true");
  expect(rail.dataset["collapsed"]).toBe("false");

  await act(async () => layers.click());

  // Both halves matter: a hidden panel takes no pixels, and a collapsed one
  // leaves the accessibility tree, because a pane an author cannot reach is
  // worse than one that is merely narrow. The rail keeps saying which pane is
  // chosen — `aria-pressed` outlives the collapse, so reopening restores it —
  // and the column's own state is stated once, on the rail, rather than
  // repeated on all four slots.
  expect(panel.hidden).toBe(true);
  expect(body.dataset["collapsed"]).toBe("true");
  expect(rail.dataset["collapsed"]).toBe("true");
  expect(layers.getAttribute("aria-pressed")).toBe("true");

  await act(async () => layers.click());

  expect(panel.hidden).toBe(false);
  expect(body.dataset["collapsed"]).toBe("false");
  expect(rail.dataset["collapsed"]).toBe("false");

  layout.destroy();
});

it("brings the collapsed panel back on whichever pane is asked for", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;

  await act(async () => segment(root, "composition").click());
  expect(panel.hidden).toBe(true);

  await act(async () => segment(root, "add").click());

  // Reopening brings the pane that was asked for, not the one it closed on.
  // The Add pane is one host now — the insert list and, at its foot, the
  // declared-asset library render in one React tree.
  expect(panel.hidden).toBe(false);
  expect(layout.hosts.add.parentElement?.hidden).toBe(false);

  layout.destroy();
});

it("switches panes without closing when the panel is already open", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;

  await act(async () => segment(root, "add").click());

  expect(panel.hidden).toBe(false);
  expect(layout.hosts.add.parentElement?.hidden).toBe(false);
  expect(segment(root, "add").getAttribute("aria-pressed")).toBe("true");

  layout.destroy();
});

it("shows the theme's own panels in the left column, and toggles them like a pane", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;
  const inspector = root.querySelector<HTMLElement>(".editor-shell-inspector")!;
  const slot = layout.hosts.document.parentElement;

  // The move, asserted as a place rather than a count: the host is the left
  // column's, and the inspector's Design tab is not where it lives any more.
  // `Host` reparents one node, so the tab left holding a copy would leave one
  // of the two slots empty and the panel gone from whichever mounted second.
  expect(slot?.closest(".editor-shell-panel")).toBe(panel);
  expect(inspector.contains(layout.hosts.document)).toBe(false);
  expect(
    Array.from(root.querySelectorAll("*")).filter(
      (node) => node === layout.hosts.document,
    ),
  ).toHaveLength(1);
  // Closed to begin with: Layers is the pane the shell starts on.
  expect(slot?.hidden).toBe(true);

  await act(async () => segment(root, "document").click());

  // Reachable: the panel under the segment is the visible one and holds the
  // document's own controls, with nothing above them `hidden`.
  expect(panel.hidden).toBe(false);
  expect(slot?.hidden).toBe(false);
  expect(slot?.closest("[hidden]")).toBeNull();
  expect(segment(root, "document").getAttribute("aria-pressed")).toBe("true");

  // Swapping to another pane must not close the panel, and coming back must
  // not have torn the document panels' slot down.
  await act(async () => segment(root, "add").click());
  expect(panel.hidden).toBe(false);
  expect(slot?.hidden).toBe(true);
  await act(async () => segment(root, "document").click());
  expect(panel.hidden).toBe(false);
  expect(slot?.hidden).toBe(false);

  // Pressed again, closed: the pane toggle rule is the shell's, not a branch
  // added for Document.
  await act(async () => segment(root, "document").click());
  expect(panel.hidden).toBe(true);

  layout.destroy();
});

it("re-frames on the panel toggle even for a camera the author has moved", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const zoomToFit = vi.fn();
  const listeners = new Set<() => void>();
  const bridge = bridgeStub({
    editor: {
      canvas: new Canvas(document.createElement("canvas")),
      artboard: () => ({ width: 1920, height: 1080 }),
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        zoomToFit,
      },
    } as unknown as EditorShellBridge["editor"],
  });
  layout.setBridge(bridge, undefined);
  await Promise.resolve();

  // The viewport refits a fitted camera on a resize by itself, so this looks
  // like the leftover it was once assumed to be. It is not: `resize()` holds a
  // camera the author has zoomed or panned, and a panel collapse is the author
  // handing the canvas 288px on purpose — the 276px column and the 8px gap the
  // panel no longer separates. Delete this and the camera stays where the
  // author left it while 284px of workspace goes unused.
  await act(async () => segment(root, "composition").click());
  expect(
    zoomToFit,
    "the toggle waits for the viewport, not the frame",
  ).not.toHaveBeenCalled();

  for (const listener of listeners) listener();

  expect(
    zoomToFit,
    "the viewport has resized, so the theme is re-framed",
  ).toHaveBeenCalledTimes(1);
  // And it unsubscribes, so a later pan does not drag the view back to fit.
  for (const listener of listeners) listener();
  expect(zoomToFit).toHaveBeenCalledTimes(1);

  layout.destroy();
});

it("leaves the camera alone after a swap between two open panes", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const zoomToFit = vi.fn();
  const listeners = new Set<() => void>();
  const bridge = bridgeStub({
    editor: {
      canvas: new Canvas(document.createElement("canvas")),
      artboard: () => ({ width: 1920, height: 1080 }),
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        zoomToFit,
      },
    } as unknown as EditorShellBridge["editor"],
  });
  layout.setBridge(bridge, undefined);
  await Promise.resolve();

  await act(async () => segment(root, "add").click());

  // A swap changes which pane is showing, not how wide the panel is, so the host
  // does not resize and the viewport never notifies. Anything armed here sits
  // until the author's next pan or zoom — and that gesture is the one it eats,
  // snapping the view back to fit. Measured on canvas: one ctrl-wheel notch
  // after a swap left the badge on 57%.
  for (const listener of listeners) listener();
  expect(
    zoomToFit,
    "no refit was waiting on a camera that will not move",
  ).not.toHaveBeenCalled();

  layout.destroy();
});

it("re-frames when a collapsed panel is reopened by asking for a pane", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const zoomToFit = vi.fn();
  const listeners = new Set<() => void>();
  const bridge = bridgeStub({
    editor: {
      canvas: new Canvas(document.createElement("canvas")),
      artboard: () => ({ width: 1920, height: 1080 }),
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        zoomToFit,
      },
    } as unknown as EditorShellBridge["editor"],
  });
  layout.setBridge(bridge, undefined);
  await Promise.resolve();
  // The viewport's own notify, which a real host resize produces on its own.
  // A swap arms inside a `requestAnimationFrame`, so the frame has to have run
  // before the notify is faked, or the test reads an arm that has not happened.
  const resized = async (): Promise<void> => {
    await act(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(null)),
      );
    });
    for (const listener of listeners) listener();
    await Promise.resolve();
  };

  await act(async () => segment(root, "composition").click());
  await resized();
  expect(zoomToFit, "the collapse re-framed").toHaveBeenCalledTimes(1);

  // The other half of the guard in the test above: this reopen *does* take the
  // canvas 288px back, so the refit is the point and skipping it would strand
  // the theme at the collapsed zoom.
  await act(async () => segment(root, "composition").click());
  await resized();

  expect(zoomToFit, "and so does the reopen").toHaveBeenCalledTimes(2);

  layout.destroy();
});

it("keeps panel hosts mounted outside React's control", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // Panel owners hold these nodes; React only positions them. The Composition
  // pane is the exception: React renders that tree, so it owns no host node.
  expect(layout.hosts.add).toBeInstanceOf(HTMLElement);
  expect(layout.hosts.document.parentElement).not.toBeNull();
  expect(layout.hosts.status.parentElement).not.toBeNull();
  // The selection column holds a panel, not a sentence: its appearance section
  // needs a host the same way the panes do. And it is the right column that
  // holds it — the theme's own panels are the left one's.
  expect(layout.hosts.selection.parentElement).not.toBeNull();
  expect(
    root
      .querySelector(".editor-shell-inspector")
      ?.contains(layout.hosts.selection),
  ).toBe(true);
  expect(
    root.querySelector(".editor-shell-panel")?.contains(layout.hosts.document),
  ).toBe(true);

  layout.destroy();
});

it("keeps the diagnostic surface in the footer, and it still reports a refusal", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const canvas = new Canvas(document.createElement("canvas"));
  const bridge = bridgeStub({
    editor: {
      canvas,
      artboard: () => ({ width: 1920, height: 1080 }),
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: () => () => undefined,
      },
    } as unknown as EditorShellBridge["editor"],
  });
  const manager = createErrorManager(canvas);
  const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

  layout.setBridge(bridge, undefined);
  await Promise.resolve();
  const line = root.querySelector("#status");
  // The footer keeps its three readings — the counts span the status host is
  // handed, the diagnostic and the save state — and the live mark joins them
  // only when the host reports the LAN on. No host is behind this shell, so no
  // mark is drawn rather than "not live" (§9).
  expect(line?.contains(layout.hosts.status)).toBe(true);
  expect(line?.querySelector(".editor-shell-save-state")).not.toBeNull();
  expect(line?.querySelector(".editor-shell-live")).toBeNull();
  // The footer already carries the free-running status text, so the refusal has
  // to be its own element — the same node would be overwritten by either writer.
  expect(line?.querySelector('[aria-label="Editor message"]')).not.toBeNull();
  expect(line?.textContent).not.toContain("cannot be applied");

  await act(async () => {
    manager.warn("controls", "That value cannot be applied to the selection.");
  });
  expect(line?.textContent).toContain(
    "Warning: That value cannot be applied to the selection.",
  );

  layout.destroy();
  logged.mockRestore();
});

it("puts the document's identity in the stage's top-left corner", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  let name = "System dashboard";
  const listeners = new Set<() => void>();
  const bridge = bridgeStub({
    snapshot: () => ({
      selectedCount: 0,
      locked: false,
      activeKind: "none",
      documentName: name,
      selectionPresetId: undefined,
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  // No document is open until `setBridge`, so the corner is empty rather than
  // holding a chip for a theme nobody opened (§9).
  expect(root.querySelector(".editor-shell-identity")).toBeNull();

  layout.setBridge(bridge, undefined);
  await Promise.resolve();
  const stage = root.querySelector("#stage");
  const chip = stage?.querySelector(".editor-shell-identity");
  expect(chip?.querySelector(".editor-shell-identity-name")?.textContent).toBe(
    "System dashboard",
  );

  // A rename moves no object, so the snapshot is re-read from the bridge's own
  // notification; a chip holding the name it mounted with would show the old
  // one until the next unrelated repaint.
  name = "Kitchen";
  await act(async () => {
    for (const listener of listeners) listener();
  });
  expect(chip?.querySelector(".editor-shell-identity-name")?.textContent).toBe(
    "Kitchen",
  );

  layout.destroy();
});

it("has no tab strip, and nothing in the copy names one", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // One panel is not a choice: a strip with a single tab is a control that
  // cannot choose, and the second tab's surface moved to the left column.
  expect(root.querySelectorAll('[role="tab"]')).toHaveLength(0);
  expect(root.querySelector('[role="tablist"]')).toBeNull();

  // Asserted on the copy object rather than the render: a leftover `inspector`
  // key is a string promising a place that no longer exists, and an unrendered
  // string is exactly the kind a render assertion cannot catch.
  expect(uiCopy).not.toHaveProperty("inspector");

  layout.destroy();
});

it("shows one pane at a time and routes the dock through the bridge", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const run = vi.fn();
  // The dock renders the registry's answer, so eligibility comes from `target`.
  const bridge = bridgeStub({
    snapshot: () => ({
      selectedCount: 1,
      locked: false,
      activeKind: "object",
      documentName: undefined,
      selectionPresetId: undefined,
    }),
    target: () => ({
      kind: "object",
      locked: false,
      memberCount: 1,
      isGroup: false,
    }),
    run,
  });

  layout.setBridge(bridge, undefined);
  await Promise.resolve();

  const dock = layout.dock;
  expect(dock.dataset["visible"]).toBe("true");
  const duplicate = dock.querySelector<HTMLButtonElement>(
    '[aria-label="Duplicate"]',
  );
  expect(duplicate).not.toBeNull();
  // Ineligible actions must not be advertised: a single object cannot group,
  // and `canArrange` refuses one too.
  expect(dock.querySelector('[aria-label="Group"]')).toBeNull();
  // **Arrange is not here at all** (`vg-463`). The dock used to share this one
  // surface with the eight and grey them; they belong to the selection
  // inspector's lead now, which is the surface that names the selection they act
  // on, so the toolbar carries the object half alone and greys nothing.
  expect(dock.querySelector("[data-vigilia-arrange-action]")).toBeNull();

  duplicate?.click();
  expect(run).toHaveBeenCalledWith("duplicate");

  layout.destroy();
});

it("draws one toolbar holding the object actions, and no arrange action at all", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const toolbar = root.querySelector("[data-vigilia-canvas-toolbar]");
  expect(toolbar).not.toBeNull();
  // The other surface is gone, not hidden: a `null` here is the assertion that
  // the second toolbar was deleted rather than left drawing somewhere.
  expect(root.querySelector("[data-vigilia-arrange-toolbar]")).toBeNull();
  // Derived, not a literal — a ninth arrange action added to `ARRANGE_ICONS`
  // must fail here rather than be silently dropped. It fails by being **absent**
  // now: `vg-463` moved the whole set to the inspector's lead, so the registry
  // is still the list this surface is measured against, and the measurement is
  // that it draws none of it.
  for (const action of arrangeActions())
    expect(
      toolbar?.querySelector(`[aria-label="${action.label}"]`),
      `${action.label} is the inspector's, not the dock's`,
    ).toBeNull();
  layout.destroy();
});

it("draws no arrange action for a multi-selection either, whatever the bridge says", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  // The bridge is told every arrange action is runnable, which is the case that
  // would make a surviving arrange half draw them all live. The dock must draw
  // none: eligibility for these is the inspector's question (`canArrange` is
  // read there), and a toolbar that grew its half back would fail here.
  const bridge = bridgeStub({
    snapshot: () => ({
      selectedCount: 2,
      locked: false,
      activeKind: "group",
      documentName: undefined,
      selectionPresetId: undefined,
    }),
    target: () => ({
      kind: "group",
      locked: false,
      memberCount: 2,
      isGroup: false,
    }),
    canArrange: () => true,
  });

  layout.setBridge(bridge, undefined);
  await Promise.resolve();

  const toolbar = root.querySelector("[data-vigilia-canvas-toolbar]");
  expect(
    toolbar?.querySelectorAll("[data-vigilia-arrange-action]").length,
  ).toBe(0);
  // And the surface is still the object half's, so that absence is the arrange
  // half's alone: a group of two can duplicate.
  expect(toolbar?.querySelector('[aria-label="Duplicate"]')).not.toBeNull();

  layout.destroy();
});

it("keeps a chart's fields in the Design column, with no Data tab to reach for", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  let kind: "none" | "object" | "chart" = "none";
  const listeners = new Set<() => void>();
  const bridge = bridgeStub({
    snapshot: () => ({
      selectedCount: kind === "none" ? 0 : 1,
      locked: false,
      activeKind: kind,
      documentName: undefined,
      selectionPresetId: undefined,
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  layout.setBridge(bridge, undefined);
  await Promise.resolve();
  // The theme's own panels are the left column's now, and the pane is what
  // reaches them: the inspector's Design column holds the selection's fields
  // and no longer carries the document host at all.
  expect(
    root
      .querySelector(".editor-shell-inspector")
      ?.contains(layout.hosts.document),
  ).toBe(false);
  expect(
    root.querySelector(".editor-shell-panel")?.contains(layout.hosts.document),
  ).toBe(true);
  // No tab: a chart's own fields are in the selection's column, so a Data tab
  // would be a second door to one room, and the column itself is the only door.
  expect(root.querySelectorAll('[role="tab"]')).toHaveLength(0);

  kind = "chart";
  for (const listener of listeners) listener();
  await Promise.resolve();

  // Selecting a chart changes nothing about where its fields live — the
  // selection's column was and is the only door.
  expect(root.querySelectorAll('[role="tab"]')).toHaveLength(0);
  expect(
    root
      .querySelector(".editor-shell-inspector")
      ?.contains(layout.hosts.selection),
  ).toBe(true);

  layout.destroy();
});

it("opens every View setting's choices instead of toggling on a bare click", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const view = viewStub();
  layout.setBridge(bridgeStub(), view);
  await Promise.resolve();

  // `act` is not used, for the menus' reason: Base UI's popup store
  // never settles under jsdom's await, and every read here is straight after
  // the gesture that caused it.
  menubarEntry(root, uiCopy.menus.view).click();
  await Promise.resolve();

  const triggers = menuItems().filter(
    (item) => item.getAttribute("aria-haspopup") === "menu",
  );
  // Each setting must say it opens something. A row that toggles on click while
  // claiming to be a setting is what left `Chart refresh` one mis-click from a
  // 1 FPS preview that reads as a hung editor.
  expect(triggers.map((item) => item.textContent)).toEqual([
    `${uiCopy.view.dataSource}: ${uiCopy.view.preview}`,
    `${uiCopy.view.chartRefresh}: ${uiCopy.view.fps30}`,
    `${uiCopy.view.valueRuns}: ${uiCopy.view.values}`,
  ]);

  // The trigger keeps naming the current value, so the state is legible without
  // opening anything — the zoom badge's idiom, which shows `100 %` on the badge
  // and the three commands inside.
  for (const trigger of triggers)
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

  // Open the refresh submenu and read the choices as the accessibility tree
  // does. `aria-checked` is the half no sighted reader needs and every screen
  // reader does: without it the two states are indistinguishable announcements.
  const refresh = triggers[1];
  if (refresh === undefined) throw new Error("No chart refresh setting.");
  refresh.click();
  await Promise.resolve();
  const submenu = openPopups().find(
    (popup) => popup.querySelector("[role=menuitemradio]") !== null,
  );
  expect(submenu).not.toBeUndefined();
  expect(openRadioItems(submenu!)).toEqual([
    [uiCopy.view.fps30, "true"],
    [uiCopy.view.fps1, "false"],
  ]);

  // Picking is explicit: only the chosen value reaches the owner, so the
  // thirty-fold step is a decision rather than a mis-click.
  const items = Array.from(
    submenu!.querySelectorAll<HTMLElement>("[role=menuitemradio]"),
  );
  items.find((item) => item.textContent?.trim() === uiCopy.view.fps1)?.click();
  await Promise.resolve();
  expect(view.setChartRefreshRate).toHaveBeenCalledWith(1);

  layout.destroy();
});

/** Opens the View menu and the submenu whose trigger prints `label`, read the
 *  way the chart-refresh case does: a submenu is a second popup, found by the
 *  radios it holds rather than by position. */
async function openViewSetting(
  root: HTMLElement,
  label: string,
): Promise<HTMLElement> {
  menubarEntry(root, uiCopy.menus.view).click();
  await Promise.resolve();
  const trigger = menuItems().find(
    (item) =>
      item.getAttribute("aria-haspopup") === "menu" &&
      (item.textContent ?? "").startsWith(label),
  );
  if (trigger === undefined) throw new Error(`No "${label}" View setting.`);
  trigger.click();
  await Promise.resolve();
  const submenu = openPopups().find(
    (popup) => popup.querySelector("[role=menuitemradio]") !== null,
  );
  if (submenu === undefined) throw new Error(`No "${label}" submenu.`);
  return submenu;
}

/** Picks the radio whose own words are `text`, as an author does. */
function pickRadio(submenu: HTMLElement, text: string): void {
  const item = Array.from(
    submenu.querySelectorAll<HTMLElement>("[role=menuitemradio]"),
  ).find((candidate) => candidate.textContent?.trim() === text);
  if (item === undefined) throw new Error(`No "${text}" radio.`);
  item.click();
}

/** The other two readings answer for the theme's sensors and for what this
 *  machine reports (§6), and each is proven by picking it: the refresh case
 *  above only ever opened the third setting, so `setSourceMode` and
 *  `setRunDisplay` reached their owners with nothing asserting it (`vg-339`). */
it("routes the readings submenu's choice to setSourceMode", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const view = viewStub();
  layout.setBridge(bridgeStub(), view);
  await Promise.resolve();

  const submenu = await openViewSetting(root, uiCopy.view.dataSource);
  // Which reading is current is the half a screen reader hears and a sighted
  // reader sees as a tick, so it is asserted before the pick moves it.
  expect(openRadioItems(submenu)).toEqual([
    [uiCopy.view.preview, "true"],
    [uiCopy.view.live, "false"],
  ]);

  pickRadio(submenu, uiCopy.view.live);
  await Promise.resolve();
  expect(view.setSourceMode).toHaveBeenCalledWith("live");

  layout.destroy();
});

it("routes the value-runs submenu's choice to setRunDisplay", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const view = viewStub();
  layout.setBridge(bridgeStub(), view);
  await Promise.resolve();

  const submenu = await openViewSetting(root, uiCopy.view.valueRuns);
  expect(openRadioItems(submenu)).toEqual([
    [uiCopy.view.values, "true"],
    [uiCopy.view.tokens, "false"],
  ]);

  pickRadio(submenu, uiCopy.view.tokens);
  await Promise.resolve();
  expect(view.setRunDisplay).toHaveBeenCalledWith("tokens");

  layout.destroy();
});

it("has no Insert menu, and every insertable group is still reachable from the Add pane", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  layout.setBridge(bridgeStub({ session: facade() }), undefined);
  const pane = createNewObjectPanel(
    layout.hosts.add,
    {
      canvas: {
        add: vi.fn(),
        setActiveObject: vi.fn(),
        requestRenderAll: vi.fn(),
      },
      textManager: { addText: vi.fn() },
      historyManager: { saveState: vi.fn() },
      errorManager: { warn: vi.fn(), error: vi.fn() },
    } as never,
    undefined,
  );
  await Promise.resolve();

  // §7.1: Insert lives in the Add pane, so the header has no Insert menu. The
  // three that remain are the three DESIGN.md names — a fourth coming back is
  // the second rendering this plan exists to prevent.
  expect(
    [...root.querySelectorAll(".editor-shell-menubar button")].map(
      (button) => button.textContent,
    ),
  ).toEqual([uiCopy.menus.file, uiCopy.menus.edit, uiCopy.menus.view]);

  // And the menu's removal cost no capability: walking `insertGroups()` — the
  // one owner of what an author can insert — must find every label in the
  // pane. A group the pane dropped, or a label renamed on one side, fails here
  // rather than three tasks later; the pane is the only rendering left, so
  // comparing it to the owner is the whole assertion.
  expect(paneGroups(pane.root)).toEqual(groupsOf(insertGroups()));

  layout.destroy();
});

/** `insertGroups()` in the shape the two readers above return: the entries that
    stand alone first, then each labelled group. Same shape because the one
    assertion below is what keeps the popover from growing a list of its own. */
function groupsOf(
  groups: readonly InsertGroup[],
): readonly (readonly [string | null, readonly string[]])[] {
  return [
    [
      null,
      groups
        .filter((group) => group.label === undefined)
        .flatMap((group) => group.objects.map((object) => object.label)),
    ],
    ...groups
      .filter((group) => group.label !== undefined)
      .map((group): readonly [string | null, readonly string[]] => [
        group.label ?? null,
        group.objects.map((object) => object.label),
      ]),
  ];
}

it("prints the chord on the menu rows the shortcut table binds", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  // Open it, assert, and close it — do not add a second one. Read straight
  // after the gesture, as the View and Insert tests do, so the assertion names
  // the menu this click opened rather than whichever poll settles first.
  menubarEntry(root, uiCopy.menus.edit).click();
  await Promise.resolve();
  // `openPopup()` reads the open menu rather than the bare class: the display
  // switch's popup is kept mounted and closed, so the class alone is not
  // necessarily the menu an author has open.
  const popup = openPopup();
  // The first `kbd` is Undo's, and the assertion is against `shortcutLabel`
  // rather than a literal so it reads the same chord the row does.
  expect(popup.querySelector("kbd")?.textContent).toBe(
    shortcutLabel("edit.undo"),
  );

  // **And it re-reads the live table.** Review Focus 3 on this surface: a menu
  // row that held a render-time copy would keep printing the chord the author
  // replaced, so the mark would name a key that runs something else. The rebind
  // is written the way the shell writes it — resolve first, then publish — and
  // asserted on the same open menu rather than by opening a second one, which
  // would be a second gesture for the same fact.
  const moved: ShortcutBinding = {
    key: "j",
    modifier: true,
    shift: false,
    action: "edit.undo",
  };
  act(() => {
    setActiveShortcuts(resolveShortcuts({ "edit.undo": moved }));
  });
  expect(openPopup().querySelector("kbd")?.textContent).toBe("Ctrl+J");

  layout.destroy();
});

it("teaches a File row exactly the chord whose id runs the call that row runs", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  menubarEntry(root, uiCopy.menus.file).click();
  await Promise.resolve();

  // Each row's own id, and the pairing is the ruled one (vg-185): a chord is
  // taught where the `PRODUCT_SHORTCUTS` id reaches the same call the row
  // reaches, which for these three is one method on the same receiver —
  // `file.save`/`savePackage` both end at `#document.save()`, and the same for
  // `open` and `newDocument`. The four rows with no id stay chordless; the
  // menu does not pair a chord by eye, which is how a menu starts teaching a
  // key that runs something else.
  const keyed = new Map<string, ProductShortcutId | undefined>([
    [uiCopy.file.newDocument, "file.new"],
    [uiCopy.file.newFromStarter, undefined],
    [uiCopy.file.openPackage, "file.open"],
    [uiCopy.file.savePackage, "file.save"],
    [uiCopy.file.releasePackage, undefined],
    [uiCopy.file.openLibrary, undefined],
    [uiCopy.file.saveLibrary, undefined],
  ]);

  const rows = menuItems();
  expect(rows.length, "every File row is read").toBe(keyed.size);
  for (const row of rows) {
    const text = row.textContent ?? "";
    const label = [...keyed.keys()].find((candidate) =>
      text.startsWith(candidate),
    );
    if (label === undefined) throw new Error(`No File row for "${text}".`);
    const id = keyed.get(label);
    expect(row.querySelector("kbd")?.textContent ?? undefined, label).toBe(
      id === undefined ? undefined : shortcutLabel(id),
    );
  }

  layout.destroy();
});
