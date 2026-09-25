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

/** The rename field is seeded with `defaultValue`, which React tracks on the
 * DOM node, so assigning `.value` directly is swallowed. Go through the
 * prototype setter and fire the event React listens for. */
function typeInto(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
    input,
    value,
  );
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const textRow = {
  id: "wordmark",
  name: "wordmark",
  kind: "text",
  depth: 0,
  parentId: undefined,
  hasChildren: false,
  visible: true,
  locked: false,
  selected: false,
};

async function renderPanel(
  rows: readonly unknown[],
  overrides = {},
): Promise<HTMLElement> {
  const host = document.createElement("div");
  await act(async () =>
    (await Promise.resolve(createRoot(host))).render(
      <LayerPanel bridge={bridge(rows, overrides)} />,
    ),
  );
  return host;
}

function renameField(host: HTMLElement): HTMLInputElement {
  return host.querySelector<HTMLInputElement>('[aria-label="Rename wordmark"]')!;
}

it("commits a rename typed into the field on Enter", async () => {
  const renameLayer = vi.fn();
  const host = await renderPanel([textRow], { renameLayer });
  await act(async () =>
    host
      .querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]')
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  const input = renameField(host);
  await act(async () => {
    typeInto(input, "Brand mark");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  expect(renameLayer).toHaveBeenCalledWith("wordmark", "Brand mark");
});

it("does not commit a rename cancelled with Escape", async () => {
  const renameLayer = vi.fn();
  const host = await renderPanel([textRow], { renameLayer });
  await act(async () =>
    host
      .querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]')
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  const input = renameField(host);
  await act(async () => {
    typeInto(input, "Discarded");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  // The field must actually close, or the negative below would pass on a
  // component that swallowed Escape entirely.
  expect(host.querySelector('[aria-label="Rename wordmark"]')).toBeNull();
  expect(renameLayer).not.toHaveBeenCalled();
});

it("does not commit when the cancelled field unmounts and blurs", async () => {
  const renameLayer = vi.fn();
  const host = await renderPanel([textRow], { renameLayer });
  await act(async () =>
    host
      .querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]')
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  const input = renameField(host);
  // Escape and the focus loss it causes are driven in one act block, because
  // the guard being tested is exactly the ordering between them. React 19 maps
  // `onBlur` onto the non-bubbling `focusout`, so that is the event to send.
  await act(async () => {
    typeInto(input, "Discarded");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(renameLayer).not.toHaveBeenCalled();
});

it("opens the rename field from the keyboard and keeps the row's role", async () => {
  const host = await renderPanel([textRow]);
  const row = host.querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]')!;
  await act(async () => {
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
  });
  expect(renameField(host).closest('[role="treeitem"]')).toBe(row);
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
