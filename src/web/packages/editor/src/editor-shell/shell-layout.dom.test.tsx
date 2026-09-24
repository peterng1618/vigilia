// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
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
    layerNames: vi.fn(() => ({})),
    setLayerNames: vi.fn(),
  };
}

function bridgeStub(
  overrides: Partial<EditorShellBridge> = {},
): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 0, locked: false, activeKind: "none" }),
    target: () => ({
      kind: "none",
      locked: false,
      memberCount: 0,
      isGroup: false,
    }),
    can: () => false,
    canArrange: () => false,
    layers: () => [],
    renameLayer: vi.fn(),
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: facade(),
    editor: {} as EditorShellBridge["editor"],
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
  expect(root.textContent).toContain("Arrange");
  expect(root.querySelector('select[aria-label="Shell palette"]')).not.toBeNull();

  layout.destroy();
});

it("keeps panel hosts mounted outside React's control", () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);

  // Panel owners hold these nodes; React only positions them.
  expect(layout.hosts.layers).toBeInstanceOf(HTMLElement);
  expect(layout.hosts.add).toBeInstanceOf(HTMLElement);
  expect(layout.hosts.assets).toBeInstanceOf(HTMLElement);
  expect(layout.hosts.document.parentElement).not.toBeNull();
  expect(layout.hosts.status.parentElement).not.toBeNull();
  // The Style tab holds a panel, not a sentence: the appearance section needs a
  // host the same way the other tabs do.
  expect(layout.hosts.style.parentElement).not.toBeNull();

  layout.destroy();
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
