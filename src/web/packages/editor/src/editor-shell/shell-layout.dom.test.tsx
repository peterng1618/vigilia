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
  };
}

function bridgeStub(
  overrides: Partial<EditorShellBridge> = {},
): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 0, locked: false, activeKind: "none" }),
    can: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: facade(),
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

  layout.destroy();
});

it("shows one rail pane at a time and routes the dock through the bridge", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const run = vi.fn();
  const bridge = bridgeStub({
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    can: (action) => action === "duplicate",
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
  // Undersized/absent eligibility must not advertise invalid actions.
  expect(dock.querySelector('[aria-label="Group"]')).toBeNull();

  duplicate?.click();
  expect(run).toHaveBeenCalledWith("duplicate");

  layout.destroy();
});
