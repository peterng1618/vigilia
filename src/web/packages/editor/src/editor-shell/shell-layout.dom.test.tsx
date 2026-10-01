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
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    setCollapsed: vi.fn(),
    renameLayer: vi.fn(),
    sameLayerParent: () => false,
    reorderLayer: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: facade(),
    // Only the camera is stubbed: the readout subscribes to it, so an empty
    // object here would throw rather than exercise the shell. The shell only
    // reaches `viewport`, so the double cast is the partial stub's whole point;
    // the `satisfies` is what checks the two members inside it, which the cast
    // alone would erase.
    editor: {
      viewport: {
        zoom: () => 1,
        onChange: () => () => undefined,
      } satisfies Pick<ViewportManager, "zoom" | "onChange">,
    } as unknown as EditorShellBridge["editor"],
    destroy: vi.fn(),
    ...overrides,
  };
}

it("mounts the editorial palette, menus, rail, inspector and dock hosts", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // Fresh profile: editorial is the default and marks the shell root.
  expect(root.dataset["shellPalette"]).toBe("editorial");
  expect(root.querySelector("#stage")).not.toBeNull();
  expect(root.querySelector("#status")).not.toBeNull();
  expect(root.querySelector("#canvas-host")).not.toBeNull();
  expect(root.querySelector(".editor-shell-dock")?.parentElement).toBe(
    root.querySelector("#stage"),
  );
  expect(
    root.querySelector('[aria-label="Editor areas"]')?.children.length,
  ).toBe(4);
  expect(root.textContent).toContain("File");
  // The Arrange menu is gone: the arrange toolbar above the canvas already
  // carries all eight actions, and the menu offered two of them with nothing
  // saying the rest existed. Asserting its absence is the point — a test that
  // only checked the toolbar would not have noticed it return.
  expect(root.textContent).not.toContain("Arrange");
  expect(root.querySelector('select[aria-label="Shell palette"]')).not.toBeNull();

  layout.destroy();
});

/** The rail entry for a pane, found by the accessible name it carries. */
function railEntry(root: HTMLElement, label: string): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>(
    `.editor-shell-rail button[aria-label="${label}"]`,
  )!;
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

it("names every rail entry by its label and draws an icon, not a glyph", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const entries = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".editor-shell-rail button"),
  );
  expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual([
    "Layers",
    "Add",
    "Assets",
    "Settings",
  ]);

  for (const entry of entries) {
    // The name is `aria-label` and never the content, so swapping a stored
    // glyph for a Lucide icon cannot strip it.
    expect(entry.textContent?.trim()).toBe("");
    expect(entry.querySelector("svg")).not.toBeNull();
  }

  layout.destroy();
});

it("collapses the panel when the rail entry for the visible pane is clicked again", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;
  const body = root.querySelector<HTMLElement>(".editor-shell-body")!;
  const layers = railEntry(root, "Layers");

  expect(panel.hidden).toBe(false);
  expect(layers.getAttribute("aria-pressed")).toBe("true");
  expect(layers.getAttribute("aria-expanded")).toBe("true");

  await act(async () => layers.click());

  // Both halves matter: a hidden panel takes no pixels, and a collapsed one
  // leaves the accessibility tree, because a pane an author cannot reach is
  // worse than one that is merely narrow. The rail keeps saying which pane it
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

  await act(async () => railEntry(root, "Layers").click());
  expect(panel.hidden).toBe(true);

  await act(async () => railEntry(root, "Assets").click());

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

  await act(async () => railEntry(root, "Add").click());

  expect(panel.hidden).toBe(false);
  expect(layout.hosts.add.parentElement?.hidden).toBe(false);
  expect(railEntry(root, "Add").getAttribute("aria-pressed")).toBe("true");

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
      viewport: {
        zoom: () => 1,
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
  // handing the canvas 288px on purpose. Delete this and the camera stays where
  // the author left it while 288px of workspace goes unused.
  await act(async () => railEntry(root, "Layers").click());
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
      viewport: {
        zoom: () => 1,
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

  await act(async () => railEntry(root, "Add").click());

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
      viewport: {
        zoom: () => 1,
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

  await act(async () => railEntry(root, "Layers").click());
  await resized();
  expect(zoomToFit, "the collapse re-framed").toHaveBeenCalledTimes(1);

  // The other half of the guard in the test above: this swap *does* hand the
  // canvas 288px back, so the refit is the point and skipping it would strand
  // the theme at the collapsed zoom.
  await act(async () => railEntry(root, "Layers").click());
  await resized();

  expect(zoomToFit, "and so does the reopen").toHaveBeenCalledTimes(2);

  layout.destroy();
});

it("tells a hovering author what the rail entry will do to the panel", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // The one that closes says so; the three that open say what they open.
  expect(railEntry(root, "Layers").title).toBe("Hide Layers");
  expect(railEntry(root, "Assets").title).toBe("Show Assets");

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
  // The Style tab holds a panel, not a sentence: the appearance section needs a
  // host the same way the other tabs do.
  expect(layout.hosts.style.parentElement).not.toBeNull();

  layout.destroy();
});

it("puts a diagnostic surface in the status line, and it reports a refusal", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const canvas = new Canvas(document.createElement("canvas"));
  const bridge = bridgeStub({
    editor: {
      canvas,
      viewport: { zoom: () => 1, onChange: () => () => undefined },
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

it("gives the Style tab a panel host instead of a placeholder sentence", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  expect(root.textContent).not.toContain("Colours and type resolve");

  layout.destroy();
});

it("shows one rail pane at a time and routes the dock through the bridge", async () => {
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

it("routes the inspector to tabs on selection and back to document panels", async () => {
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
  // The document panels stay reachable whatever the selection is.
  expect(root.contains(layout.hosts.document)).toBe(true);
  expect(root.querySelector('[role="tablist"]')).not.toBeNull();

  kind = "chart";
  for (const listener of listeners) listener();
  await Promise.resolve();

  const dataTab = Array.from(
    root.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).find((tab) => tab.textContent === "Data");
  expect(dataTab).not.toBeUndefined();
  dataTab?.click();
  await Promise.resolve();
  expect(layout.hosts.chart.parentElement).not.toBeNull();

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
  triggers[1].click();
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

  layout.destroy();
});
