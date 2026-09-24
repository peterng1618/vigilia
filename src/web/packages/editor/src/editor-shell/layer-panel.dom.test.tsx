// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { LayerPanel } from "./layer-panel.js";
import type { EditorShellBridge } from "./bridge.js";

function bridge(rows: readonly unknown[], overrides = {}): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    can: () => true,
    target: () => ({ kind: "object", locked: false, memberCount: 1, isGroup: false }),
    canArrange: () => false,
    layers: () => rows as never,
    selectLayer: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    renameLayer: vi.fn(),
    setCollapsed: vi.fn(),
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: { savePackage: vi.fn() } as never,
    editor: {} as never,
    destroy: vi.fn(),
    ...overrides,
  } as EditorShellBridge;
}

it("indents a group child and shows only its state icons", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge([
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
    { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
      hasChildren: false, visible: true, locked: true, selected: true },
  ])} />));

  const rows = host.querySelectorAll<HTMLElement>("[data-vigilia-layer]");
  expect(rows).toHaveLength(2);
  // One dense line, plus lock and visibility indicators — not six text buttons.
  expect(rows[1]?.style.getPropertyValue("--layer-depth")).toBe("1");
  expect(rows[1]?.querySelectorAll("button")).toHaveLength(2);
  expect(rows[1]?.querySelector('[aria-label="Unlock"]')).not.toBeNull();
});

it("collapses and expands a group from its twisty", async () => {
  const setCollapsed = vi.fn();
  const rows = [
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
  ];
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows, { setCollapsed })} />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Collapse Group"]')?.click(),
  );
  expect(setCollapsed).toHaveBeenCalledWith("group", true);
});
