// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { act } from "react";
import { expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { arrangeActions } from "../object-actions.js";
import type { ViewportManager } from "../viewport-manager/index.js";
import type { EditorShellBridge } from "./bridge.js";
import { createShellLayout } from "./shell-layout.js";
import type { EditorActionFacade } from "./session-facade.js";

function facade(): EditorActionFacade {
  return {
    newDocument: vi.fn(async () => undefined),
    openPackage: vi.fn(),
    savePackage: vi.fn(async () => undefined),
    releasePackage: vi.fn(async () => undefined),
    openLibrary: vi.fn(async () => undefined),
    saveLibrary: vi.fn(async () => undefined),
    addText: vi.fn(),
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
  // Four panes and the inspector, which the fifth entry opens.
  expect(
    root.querySelector('[aria-label="Editor areas"]')?.children.length,
  ).toBe(5);
  expect(root.textContent).toContain("File");
  expect(root.textContent).toContain("Arrange");
  expect(root.querySelector('select[aria-label="Shell palette"]')).not.toBeNull();

  layout.destroy();
});

/** The rail entry for a pane, found by the accessible name it carries. */
function railEntry(root: HTMLElement, label: string): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>(
    `.editor-shell-rail button[aria-label="${label}"]`,
  )!;
}

/** `matchMedia` is absent under jsdom, so the shell reads a wide surface there.
 *  A test that needs the narrow one has to say so, exactly as a browser does. */
function stubNarrowShell(narrow: boolean): () => void {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow && query === "(max-width: 980px)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  return () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: original,
    });
  };
}

it("opens on the canvas on a narrow shell and on the inspector on a wide one", () => {
  // The default follows the surface, because the two want opposite first
  // paints: a phone author arrives to the canvas they are authoring on, and a
  // desktop author arrives to the selection they came to edit.
  for (const [narrow, open] of [
    [true, false],
    [false, true],
  ] as const) {
    const restore = stubNarrowShell(narrow);
    try {
      const root = document.createElement("div");
      const layout = createShellLayout(root);
      expect(root.querySelector<HTMLElement>(".editor-shell-inspector")!.hidden).toBe(
        !open,
      );
      expect(root.querySelector<HTMLElement>(".editor-shell-panel")!.hidden).toBe(
        false,
      );
      layout.destroy();
    } finally {
      restore();
    }
  }
});

it("names every rail entry by its label and draws an icon, not a glyph", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const entries = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".editor-shell-rail button"),
  );
  // The inspector is the fifth entry: it is the selection's own surface, and
  // below 980px it is the only way to reach it at all (F1.29).
  expect(entries.map((entry) => entry.getAttribute("aria-label"))).toEqual([
    "Layers",
    "Add",
    "Assets",
    "Settings",
    "Inspect",
  ]);

  for (const entry of entries) {
    // The name is `aria-label` and never the content, so swapping a stored
    // glyph for a Lucide icon cannot strip it.
    expect(entry.textContent?.trim()).toBe("");
    expect(entry.querySelector("svg")).not.toBeNull();
  }

  layout.destroy();
});

it("collapses the inspector from the rail and leaves the accessibility tree", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const inspector = root.querySelector<HTMLElement>(".editor-shell-inspector")!;
  const body = root.querySelector<HTMLElement>(".editor-shell-body")!;
  const entry = railEntry(root, "Inspect");

  // Open on a wide shell — jsdom has no `matchMedia`, so this is the wide
  // surface, and where the inspector has always been.
  expect(inspector.hidden).toBe(false);
  expect(body.dataset["inspector"]).toBe("true");
  expect(entry.getAttribute("aria-expanded")).toBe("true");
  // No `aria-pressed`: the entry names a region, and there is no set of panes
  // for it to be pressed against.
  expect(entry.hasAttribute("aria-pressed")).toBe(false);

  await act(async () => entry.click());

  // A closed region leaves the accessibility tree rather than sitting in it
  // with no box, which is the defect F1.29 was hiding behind a `display: none`
  // that measured 0x0 and was still read out.
  expect(inspector.hidden).toBe(true);
  expect(body.dataset["inspector"]).toBe("false");
  expect(entry.getAttribute("aria-expanded")).toBe("false");
  // The panel is untouched by the inspector's toggle — they are two regions
  // that can be open at once on a wide shell.
  expect(root.querySelector<HTMLElement>(".editor-shell-panel")!.hidden).toBe(
    false,
  );

  await act(async () => entry.click());

  expect(inspector.hidden).toBe(false);
  expect(entry.getAttribute("aria-expanded")).toBe("true");

  layout.destroy();
});

it("tells a hovering author what the Inspect entry will do", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  expect(railEntry(root, "Inspect").title).toBe("Hide Inspect");
  layout.destroy();
});

it("keeps both regions open at once on a wide shell", async () => {
  const restore = stubNarrowShell(false);
  try {
    const root = document.createElement("div");
    const layout = createShellLayout(root);

    // A wide shell has room for a column each, so the two are independent — the
    // inspector must not cost the author the layer tree.
    expect(root.querySelector<HTMLElement>(".editor-shell-panel")!.hidden).toBe(
      false,
    );

    await act(async () => railEntry(root, "Inspect").click());
    expect(root.querySelector<HTMLElement>(".editor-shell-inspector")!.hidden).toBe(
      true,
    );

    await act(async () => railEntry(root, "Inspect").click());
    expect(root.querySelector<HTMLElement>(".editor-shell-inspector")!.hidden).toBe(
      false,
    );
    expect(root.querySelector<HTMLElement>(".editor-shell-panel")!.hidden).toBe(
      false,
    );

    layout.destroy();
  } finally {
    restore();
  }
});

it("shows one region at a time on a narrow shell", async () => {
  const restore = stubNarrowShell(true);
  try {
    const root = document.createElement("div");
    const layout = createShellLayout(root);
    const panel = root.querySelector<HTMLElement>(".editor-shell-panel")!;
    const inspector = root.querySelector<HTMLElement>(".editor-shell-inspector")!;

    await act(async () => railEntry(root, "Inspect").click());
    expect(inspector.hidden).toBe(false);
    // Two 280px sheets over a 336px canvas is not a wider panel; it is the top
    // one hiding the bottom one, so opening either closes the other.
    expect(panel.hidden).toBe(true);

    await act(async () => railEntry(root, "Add").click());
    expect(panel.hidden).toBe(false);
    expect(inspector.hidden).toBe(true);

    // Closing the showing region leaves the canvas alone, which is the same
    // answer on both widths.
    await act(async () => railEntry(root, "Add").click());
    expect(panel.hidden).toBe(true);
    expect(inspector.hidden).toBe(true);

    layout.destroy();
  } finally {
    restore();
  }
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
