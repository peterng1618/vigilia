// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { createNewObjectPanel } from "../new-object-panel.js";
import { arrangeActions } from "../object-actions.js";
import { uiCopy } from "../ui-copy.js";
import type { ViewportManager } from "../viewport-manager/index.js";
import type { EditorShellBridge } from "./bridge.js";
import { createShellLayout } from "./shell-layout.js";
import type { EditorActionFacade, EditorViewControls } from "./session-facade.js";

// Base UI's popup needs two browser APIs jsdom has none of: floating-ui observes
// its anchor, and the popup waits for its own open transition before reporting
// itself open. Without them the Insert menu never mounts, which is the one
// surface this file's last test reads.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];

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
    subscribeDocumentChange: vi.fn(() => () => undefined),
  };
}

/** Base UI portals a menu to `body` and unmounts it on the next frame, so an
 *  open menu from one test is still in the document for the next one and
 *  `openPopup()` would read it. Escape is the gesture that closes it. */
afterEach(() => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
});

/** The View menu's controls. The shell only reads and writes these three, so a
 *  stub with every member is the whole of what the menu can reach. */
function viewStub(overrides: Partial<EditorViewControls> = {}): EditorViewControls {
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
    snapshot: () => ({ selectedCount: 0, locked: false, activeKind: "none" }),
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
    sameLayerParent: () => false,
    reorderLayer: () => false,
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

it("mounts the editorial palette, menus, pane bar, inspector and dock hosts", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // Fresh profile: editorial is the default and marks the document element,
  // which is what the portalled popups inherit from.
  expect(document.documentElement.dataset["shellPalette"]).toBe("editorial");
  expect(root.querySelector("#stage")).not.toBeNull();
  expect(root.querySelector("#status")).not.toBeNull();
  expect(root.querySelector("#canvas-host")).not.toBeNull();
  expect(root.querySelector(".editor-shell-dock")?.parentElement).toBe(
    root.querySelector("#stage"),
  );
  // Four segments and the `+`. The rail's fourth entry went with the Settings
  // pane it held, and a segment with nothing in it is the defect this plan
  // exists to fix — so the count is a claim about the left column, not a
  // snapshot of how many icons happen to be there. The Document segment is the
  // fifth button because the `+` is a `button` too and is not a pane.
  expect(root.querySelectorAll(".editor-shell-pane-bar button")).toHaveLength(5);
  expect(root.querySelector(".editor-shell-rail")).toBeNull();
  expect(root.textContent).toContain("File");
  // The Arrange menu is gone: the arrange toolbar above the canvas already
  // carries all eight actions, and the menu offered two of them with nothing
  // saying the rest existed. Asserting its absence is the point — a test that
  // only checked the toolbar would not have noticed it return.
  expect(root.textContent).not.toContain("Arrange");
  // The palette moved from the Settings pane to the header, and is a trigger
  // rather than a select now; it is still reachable and still named.
  expect(
    root.querySelector(".editor-shell-header [data-vigilia-palette]"),
  ).not.toBeNull();

  layout.destroy();
});

/** The pane bar's segment for a pane, found by the label it shows. */
function segment(root: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".editor-shell-pane-bar button"),
  ).find((button) => button.textContent?.trim() === label);
  if (found === undefined) throw new Error(`No "${label}" pane.`);
  return found;
}

/** The menubar trigger for a menu, found by the text it carries. */
function menubarEntry(root: HTMLElement, label: string): HTMLButtonElement {
  const entry = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".editor-shell-menubar button"),
  ).find((button) => button.textContent === label);
  if (entry === undefined) throw new Error(`No "${label}" menu.`);
  return entry;
}

/** The open menu's own groups, as the headings and labels an author reads.
    `data-open` rather than the class: the zoom readout's popup is kept mounted
    and closed, so the class alone is not the menu an author has open. */
function insertMenuGroups(): readonly (readonly [string | null, readonly string[]])[] {
  return [
    [
      null,
      menuItems()
        .filter((item) => item.closest("[role=group]") === null)
        .map((item) => item.textContent ?? ""),
    ],
    ...Array.from(openPopup().querySelectorAll<HTMLElement>("[role=group]")).map(
      (group): readonly [string | null, readonly string[]] => [
        document.getElementById(group.getAttribute("aria-labelledby") ?? "")
          ?.textContent ?? null,
        menuItems()
          .filter((item) => item.closest("[role=group]") === group)
          .map((item) => item.textContent ?? ""),
      ],
    ),
  ];
}

/** The Add pane's own groups, read the same way: the lone button, then each
    fieldset with its legend. */
function paneGroups(pane: HTMLElement): readonly (readonly [string | null, readonly string[]])[] {
  return [
    [
      null,
      Array.from(pane.children)
        .filter((child) => child.tagName === "BUTTON")
        .map((button) => button.textContent ?? ""),
    ],
    ...Array.from(pane.querySelectorAll<HTMLElement>("fieldset")).map(
      (group): readonly [string | null, readonly string[]] => [
        group.querySelector("legend")?.textContent ?? null,
        Array.from(group.querySelectorAll("button")).map(
          (button) => button.textContent ?? "",
        ),
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
  return Array.from(openPopup().querySelectorAll<HTMLElement>("[role=menuitem]"));
}

/** Every popup an author currently has open. A submenu is a second one, so the
 *  View menu's own items are the first — its submenu opens after it. */
function openPopups(): readonly HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".editor-shell-menu-popup[data-open]"),
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

/** The item's label inside a named group. */
function insertMenuEntry(
  group: string,
  label: string,
): HTMLElement | undefined {
  return menuItems().find(
    (item) =>
      item.textContent === label &&
      document.getElementById(
        item.closest("[role=group]")?.getAttribute("aria-labelledby") ?? "",
      )?.textContent === group,
  );
}

it("collapses the panel when the segment for the visible pane is clicked again", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;
  const body = root.querySelector<HTMLElement>(".editor-shell-body")!;
  const layers = segment(root, uiCopy.rail.layers);

  expect(panel.hidden).toBe(false);
  expect(layers.getAttribute("aria-pressed")).toBe("true");
  expect(layers.getAttribute("aria-expanded")).toBe("true");

  await act(async () => layers.click());

  // Both halves matter: a hidden panel takes no pixels, and a collapsed one
  // leaves the accessibility tree, because a pane an author cannot reach is
  // worse than one that is merely narrow. The bar keeps saying which pane it
  // is, and `aria-expanded` is how the closed state is announced.
  expect(panel.hidden).toBe(true);
  expect(body.dataset["collapsed"]).toBe("true");
  expect(layers.getAttribute("aria-expanded")).toBe("false");
  expect(layers.getAttribute("aria-pressed")).toBe("true");

  await act(async () => layers.click());

  expect(panel.hidden).toBe(false);
  expect(body.dataset["collapsed"]).toBe("false");
  expect(layers.getAttribute("aria-expanded")).toBe("true");

  layout.destroy();
});

it("brings the collapsed panel back on whichever pane is asked for", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;

  await act(async () => segment(root, uiCopy.rail.layers).click());
  expect(panel.hidden).toBe(true);

  await act(async () => segment(root, uiCopy.rail.assets).click());

  // Reopening brings the pane that was asked for, not the one it closed on.
  expect(panel.hidden).toBe(false);
  expect(layout.hosts.assets.parentElement?.hidden).toBe(false);
  expect(layout.hosts.add.parentElement?.hidden).toBe(true);

  layout.destroy();
});

it("switches panes without closing when the panel is already open", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;

  await act(async () => segment(root, uiCopy.rail.insert).click());

  expect(panel.hidden).toBe(false);
  expect(layout.hosts.add.parentElement?.hidden).toBe(false);
  expect(segment(root, uiCopy.rail.insert).getAttribute("aria-pressed")).toBe(
    "true",
  );

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

  await act(async () => segment(root, uiCopy.rail.document).click());

  // Reachable: the panel under the segment is the visible one and holds the
  // document's own controls, with nothing above them `hidden`.
  expect(panel.hidden).toBe(false);
  expect(slot?.hidden).toBe(false);
  expect(slot?.closest("[hidden]")).toBeNull();
  expect(segment(root, uiCopy.rail.document).getAttribute("aria-pressed")).toBe(
    "true",
  );

  // Swapping to another pane must not close the panel, and coming back must
  // not have torn the document panels' slot down.
  await act(async () => segment(root, uiCopy.rail.assets).click());
  expect(panel.hidden).toBe(false);
  expect(slot?.hidden).toBe(true);
  await act(async () => segment(root, uiCopy.rail.document).click());
  expect(panel.hidden).toBe(false);
  expect(slot?.hidden).toBe(false);

  // Pressed again, closed: the pane toggle rule is the shell's, not a branch
  // added for Document.
  await act(async () => segment(root, uiCopy.rail.document).click());
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
  // handing the canvas 288px on purpose — the 280px column and the 8px gap the
  // panel no longer separates. Delete this and the camera stays where the
  // author left it while 288px of workspace goes unused.
  await act(async () => segment(root, uiCopy.rail.layers).click());
  expect(zoomToFit, "the toggle waits for the viewport, not the frame").not
    .toHaveBeenCalled();

  for (const listener of listeners) listener();

  expect(zoomToFit, "the viewport has resized, so the theme is re-framed").toHaveBeenCalledTimes(1);
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

  await act(async () => segment(root, uiCopy.rail.insert).click());

  // A swap changes which pane is showing, not how wide the panel is, so the host
  // does not resize and the viewport never notifies. Anything armed here sits
  // until the author's next pan or zoom — and that gesture is the one it eats,
  // snapping the view back to fit. Measured on canvas: one ctrl-wheel notch
  // after a swap left the badge on 57%.
  for (const listener of listeners) listener();
  expect(zoomToFit, "no refit was waiting on a camera that will not move")
    .not.toHaveBeenCalled();

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
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    for (const listener of listeners) listener();
    await Promise.resolve();
  };

  await act(async () => segment(root, uiCopy.rail.layers).click());
  await resized();
  expect(zoomToFit, "the collapse re-framed").toHaveBeenCalledTimes(1);

  // The other half of the guard in the test above: this reopen *does* take the
  // canvas 288px back, so the refit is the point and skipping it would strand
  // the theme at the collapsed zoom.
  await act(async () => segment(root, uiCopy.rail.layers).click());
  await resized();

  expect(zoomToFit, "and so does the reopen").toHaveBeenCalledTimes(2);

  layout.destroy();
});

it("keeps panel hosts mounted outside React's control", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // Panel owners hold these nodes; React only positions them. The Layers pane
  // is the exception: React renders that tree, so it owns no host node.
  expect(layout.hosts.add).toBeInstanceOf(HTMLElement);
  expect(layout.hosts.assets).toBeInstanceOf(HTMLElement);
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

it("puts a diagnostic surface in the status line, and it reports a refusal", async () => {
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
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
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
  expect(dock.querySelector('[aria-label="Align left"]')).toBeNull();

  duplicate?.click();
  expect(run).toHaveBeenCalledWith("duplicate");

  layout.destroy();
});

it("puts arrange on the canvas toolbar, disabled without a multi-selection", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const toolbar = root.querySelector("[data-vigilia-arrange-toolbar]");
  expect(toolbar).not.toBeNull();
  // Derived, not a literal: `ARRANGE_ICONS` holds eight today, and a ninth
  // added to the registry must fail here rather than be silently dropped by
  // the toolbar. Same rule as Task 9's context menu.
  expect(toolbar?.querySelectorAll("button")).toHaveLength(arrangeActions().length);
  for (const button of toolbar?.querySelectorAll("button") ?? [])
    expect(button.disabled).toBe(true);

  layout.destroy();
});

it("enables only the arrange actions a two-object selection can run", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  // `canArrange` refuses distribute below three objects, so the toolbar must
  // grey those two out rather than advertise a click that silently does nothing.
  const bridge = bridgeStub({
    snapshot: () => ({ selectedCount: 2, locked: false, activeKind: "group" }),
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

  const toolbar = root.querySelector("[data-vigilia-arrange-toolbar]");
  const button = (label: string) =>
    toolbar?.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  expect(button("Align left")?.disabled).toBe(false);
  expect(button("Distribute horizontally")?.disabled).toBe(true);
  expect(button("Distribute vertically")?.disabled).toBe(true);

  layout.destroy();
});

it("keeps arrange off the dock even when a multi-selection is eligible", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  // Arrange is the top toolbar's job; a two-object selection that `canArrange`
  // would happily accept must still not put arrange buttons in the dock.
  const bridge = bridgeStub({
    snapshot: () => ({ selectedCount: 2, locked: false, activeKind: "group" }),
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

  const dock = layout.dock;
  expect(dock.querySelector('[aria-label="Group"]')).not.toBeNull();
  expect(dock.querySelector('[aria-label="Align left"]')).toBeNull();
  expect(dock.querySelector('[aria-label="Distribute horizontally"]')).toBeNull();

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
    root
      .querySelector(".editor-shell-panel")
      ?.contains(layout.hosts.document),
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

  // `act` is not used, for the Insert menu's reason: Base UI's popup store
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
  const submenu = openPopups().find((popup) =>
    popup.querySelector("[role=menuitemradio]") !== null,
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

it("inserts the same objects from the Insert menu as the Add pane offers", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const session = facade();
  layout.setBridge(bridgeStub({ session }), undefined);
  const pane = createNewObjectPanel(
    layout.hosts.add,
    {
      canvas: { add: vi.fn(), setActiveObject: vi.fn(), requestRenderAll: vi.fn() },
      textManager: { addText: vi.fn() },
      historyManager: { saveState: vi.fn() },
      errorManager: { warn: vi.fn(), error: vi.fn() },
    } as never,
    undefined,
  );
  await Promise.resolve();

  // `act` is not used around the menu: Base UI's popup store keeps re-rendering
  // itself in jsdom, and awaiting its effects never settles. The click is the
  // same one an author makes, and the popup is read straight after.
  menubarEntry(root, uiCopy.menus.insert).click();
  await Promise.resolve();
  expect(document.querySelector(".editor-shell-menu-popup[data-open]")).not.toBeNull();

  // Read from both surfaces' own DOM: two lists that must agree and did not is
  // what left a panel — the object this composition is mostly made of — out of
  // the menu entirely.
  expect(insertMenuGroups()).toEqual(paneGroups(pane.root));

  // "Line" is both a primitive and a chart family. The group is what tells them
  // apart, in the menu as it already did in the pane.
  const shape = insertMenuEntry(uiCopy.panels.shapes, uiCopy.shapeKinds.line);
  const chart = insertMenuEntry(uiCopy.panels.charts, uiCopy.chartFamilies.line);
  expect(shape).not.toBeUndefined();
  expect(chart).not.toBeUndefined();
  expect(shape?.closest("[role=group]")).not.toBe(chart?.closest("[role=group]"));

  // And the menu runs the same construction rather than a second one.
  insertMenuEntry(uiCopy.panels.shapes, uiCopy.shapeKinds.rect)?.click();
  expect(session.addShape).toHaveBeenCalledWith("rect");

  // The card arm, which the suite did not exercise at all: removing
  // `case "card"` from `insertItem` left 216 tests passing, because every
  // façade here stubs `insertCard`. The unit is one click, so a menu that
  // quietly dropped it would offer six shapes, four charts and no card.
  insertMenuEntry(uiCopy.panels.cards, uiCopy.cardLibrary.cpu)?.click();
  expect(session.insertCard).toHaveBeenCalledWith("group-cpu-card");

  layout.destroy();
});
