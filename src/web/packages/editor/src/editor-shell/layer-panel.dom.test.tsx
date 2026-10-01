// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { LayerPanel } from "./layer-panel.js";
import type { EditorShellBridge } from "./bridge.js";
import { actionEnabled, OBJECT_ACTIONS } from "../object-actions.js";

function bridge(rows: readonly unknown[], overrides = {}): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    capture: () => undefined,
    can: () => true,
    target: () => ({ kind: "object", locked: false, memberCount: 1, isGroup: false }),
    canArrange: () => false,
    layers: () => rows as never,
    groupContext: () => [],
    selectLayer: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    renameLayer: vi.fn(),
    setCollapsed: vi.fn(),
    sameLayerParent: () => false,
    reorderLayer: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
    session: { savePackage: vi.fn() } as never,
    editor: {} as never,
    destroy: vi.fn(),
    ...overrides,
  } as EditorShellBridge;
}

it("titles a row with what it says rather than the key behind it", async () => {
  // A tooltip printing the raw uuid told the author nothing the row did not,
  // and the name is what every other surface shows for this object.
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge([
    { ...textRow, name: "Brand mark" },
  ])} />));

  const row = host.querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]');
  expect(row?.title).toBe("Brand mark");
});

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

it("draws the twisty as an icon, in both states", async () => {
  // The glyphs this replaces were markup rather than copy, so the copy table's
  // pictograph guard never reached them: `▸`/`▾` are announced as a word of
  // their own and cannot take a shell colour the way every icon beside them
  // does. A Lucide icon carries the state in its own shape, so the two states
  // must be distinguishable here and not only by the name.
  const host = await renderPanel([
    { id: "open", name: "Open", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false, collapsed: false },
    { id: "shut", name: "Shut", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false, collapsed: true },
  ]);
  const twisty = (name: string): SVGSVGElement | null =>
    host.querySelector(`[aria-label$=" ${name}"] svg`);
  expect(twisty("Open")?.getAttribute("class")).toContain("lucide-chevron-down");
  expect(twisty("Shut")?.getAttribute("class")).toContain("lucide-chevron-right");
  // The state the glyph used to draw is still said out loud, not only shown.
  expect(
    host.querySelector('[aria-label="Collapse Open"]')?.getAttribute("aria-expanded"),
  ).toBe("true");
  expect(
    host.querySelector('[aria-label="Expand Shut"]')?.getAttribute("aria-expanded"),
  ).toBe("false");
  expect(host.textContent).not.toMatch(/[▸▾]/u);
});

const rows = [
  { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
    hasChildren: true, visible: true, locked: false, selected: false },
  { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
    hasChildren: false, visible: true, locked: true, selected: true },
];

/** Two groups, so the negative half of the assertion has a row to read. The
 * non-current group is what makes this a test of "dims the rest" rather than
 * of "sets an attribute somewhere". */
const contextRows = [
  { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
    hasChildren: true, visible: true, locked: false, selected: false },
  { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
    hasChildren: false, visible: true, locked: false, selected: true },
  { id: "other", name: "Other", kind: "group", depth: 0, parentId: undefined,
    hasChildren: true, visible: true, locked: false, selected: false },
];

it("marks the group whose children are current and dims the rest", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(contextRows, { groupContext: () => ["group"] })} />,
  ));
  expect(host.querySelector('[data-vigilia-layer="group"]')?.getAttribute("data-context")).toBe("true");
  expect(host.querySelector('[data-vigilia-layer="other"]')?.getAttribute("data-context")).toBe("false");
  // The child inside the current context is selectable in its own right — the
  // half of the branch that Step 3 adds, and the reason the context is marked.
  expect(host.querySelector('[data-vigilia-layer="child"]')?.getAttribute("data-context")).toBe("true");
});

it("dims nothing when no group is entered", async () => {
  // With no group entered the context is empty, so the guard must keep the
  // attribute off the rows entirely. React writes a boolean `false` as the
  // *string* "false", which is exactly what the stylesheet rule dims on, and
  // with nothing entered every top-level layer is selectable on the canvas — a
  // tree greyed out on open would say the opposite. jsdom applies no stylesheet
  // (nothing imports `editor-main.ts` here), so what this pins is the guard that
  // makes the attribute honest: an attribute reading "false" on every row is the
  // state that rule turns into a fully dimmed tree.
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(contextRows, { groupContext: () => [] })} />,
  ));
  for (const row of host.querySelectorAll(".vigilia-layer-row"))
    expect(row.getAttribute("data-context")).toBeNull();
});

it("selects the row that was clicked, not the group it sits under", async () => {
  const selectLayer = vi.fn();
  const host = await renderPanel(contextRows, { selectLayer });
  // An indented child is the plausible mistake: the row carries its group in
  // `parentId`, and group-context work makes wiring that id to `selectLayer`
  // look reasonable. The wire must carry the clicked row's own id.
  await act(async () =>
    host.querySelector<HTMLElement>('[data-vigilia-layer="child"]')?.click(),
  );
  expect(selectLayer.mock.calls).toEqual([["child"]]);
});

it("renders object actions in a bottom row, not on the selected row", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows)} />));
  const row = host.querySelector('[data-vigilia-layer="child"]');
  expect(row?.querySelector('[aria-label="Duplicate"]')).toBeNull();
  expect(host.querySelector('[data-vigilia-layer-actions] [aria-label="Duplicate"]')).not.toBeNull();
});

it("renders the bottom row from the registry, so eligibility matches the dock", async () => {
  // Eligibility is expressed through `target()`: `actionEnabled` reads the
  // ActionGate, and the bridge has no `can` in that path. Overriding `can` here
  // would change nothing and the test would silently assert the unfiltered row.
  const none = () => ({ kind: "none", locked: false, memberCount: 0, isGroup: false });
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge(rows, { target: none })} />));
  const empty = host.querySelector("[data-vigilia-layer-actions]");
  expect(empty?.querySelectorAll("button")).toHaveLength(0);

  // With the helper's default single unlocked object the row is the registry's
  // own answer, derived rather than hand-written — a literal count here would
  // only pass if the row re-derived eligibility, which Step 3 forbids.
  const host2 = document.createElement("div");
  const root2 = createRoot(host2);
  await act(async () => root2.render(<LayerPanel bridge={bridge(rows)} />));
  const gate = bridge(rows);
  const expected = OBJECT_ACTIONS
    .filter((action) => actionEnabled(gate, action.id))
    .map((action) => action.label);
  const rendered = [...(host2.querySelector("[data-vigilia-layer-actions]")
    ?.querySelectorAll("button") ?? [])].map((button) => button.getAttribute("aria-label"));
  expect(rendered.sort()).toEqual([...expected].sort());
  expect(expected.length).toBeGreaterThan(1);
});

it("only marks a drop slot that would actually land", async () => {
  const reorderLayer = vi.fn(() => false);
  // A drop is a pointing gesture: without this the click that precedes the
  // drag would select the row the drop refused.
  const selectLayer = vi.fn();
  // Two children in one group and a sibling at the top level: the first pair
  // shares a parent, so a drop between them lands; the sibling does not, so the
  // same gesture across the boundary must stay unmarked — including a drop on
  // the group's own row, since a child is not the group's sibling.
  const tree = [
    { id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined,
      hasChildren: true, visible: true, locked: false, selected: false },
    { id: "child", name: "Child", kind: "text", depth: 1, parentId: "group",
      hasChildren: false, visible: true, locked: false, selected: false },
    { id: "peer", name: "Peer", kind: "shape", depth: 1, parentId: "group",
      hasChildren: false, visible: true, locked: false, selected: false },
    { id: "sibling", name: "Sibling", kind: "shape", depth: 0, parentId: undefined,
      hasChildren: false, visible: true, locked: false, selected: false },
  ];
  const owned = (id: string): string => (id === "child" || id === "peer" ? "group" : "");
  const host = await renderPanel(tree, {
    reorderLayer,
    selectLayer,
    // The bridge's own owner comparison, keyed by the tree above.
    sameLayerParent: (a: string, b: string) => owned(a) === owned(b),
  });
  const row = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;
  const line = (): HTMLElement =>
    host.querySelector<HTMLElement>("[data-vigilia-layer-dropline]")!;

  // The marker is permanent chrome, so "no drop" has to be its hidden state.
  expect(line().hidden).toBe(true);
  // jsdom has neither DragEvent nor DataTransfer: the handler only writes the
  // payload Chrome needs to start a drag, so a plain event with a stub on it
  // carries everything the component actually reads.
  const drag = (type: string): Event => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { setData: () => undefined },
    });
    return event;
  };

  await act(async () => row("child").dispatchEvent(drag("dragstart")));
  for (const refused of ["sibling", "group"]) {
    await act(async () => row(refused).dispatchEvent(drag("dragover")));
    // Across the boundary the same pointer position that lands below is left
    // unmarked: the difference can only come from the parent comparison.
    expect(line().hidden).toBe(true);
  }

  await act(async () => row("peer").dispatchEvent(drag("dragover")));
  // Landing: the child moves above its peer, inside their shared group. The
  // line is placed at the slot the drop would take.
  expect(line().hidden).toBe(false);
  expect(line().style.getPropertyValue("--layer-dropline-top")).toBe("48");
  expect(line().style.getPropertyValue("--layer-dropline-left")).toBe("19");

  await act(async () => row("peer").dispatchEvent(drag("drop")));
  expect(reorderLayer).toHaveBeenCalledWith("child", "peer");
  expect(selectLayer).not.toHaveBeenCalled();
  expect(line().hidden).toBe(true);
});

it("draws locked as a filled lock and unlocked as an outline one", async () => {
  // vg-024: at 13px the two outline locks differ only by a gap in the shackle,
  // which the author could not tell apart. Filled versus outline is a
  // difference in weight the row can be read by at that size, and it comes from
  // the icon's own `fill` rather than from hand-picking a second glyph.
  const host = await renderPanel([
    { id: "shut", name: "Shut", kind: "shape", depth: 0, parentId: undefined,
      hasChildren: false, visible: true, locked: true, selected: false },
    { id: "open", name: "Open", kind: "shape", depth: 0, parentId: undefined,
      hasChildren: false, visible: true, locked: false, selected: false },
  ]);
  // Both state buttons carry `aria-pressed`, so the lock one is named rather
  // than positional: the visibility icon would satisfy a bare attribute match.
  const lock = (id: string): SVGSVGElement | null =>
    host.querySelector(
      `[data-vigilia-layer="${id}"] button[aria-label="Lock"], [data-vigilia-layer="${id}"] button[aria-label="Unlock"]`,
    )?.querySelector("svg") ?? null;

  // Lucide's own default is `fill: none`; the locked row overrides it.
  expect(lock("shut")?.getAttribute("fill")).toBe("currentColor");
  // The other half of the contract: the unlocked row is untouched, so a fix
  // that filled everything would fail here rather than pass.
  expect(lock("open")?.getAttribute("fill")).toBe("none");
  // Same glyph family either way — the difference is the property, not a
  // different drawing.
  expect(lock("shut")?.getAttribute("class")).toContain("lucide-lock");
  expect(lock("open")?.getAttribute("class")).toContain("lucide-lock-open");
});


it("answers the keys a tree is defined by, and does not nudge", async () => {
  // The rows declare `role="treeitem"`, and a treeitem whose arrow keys do
  // nothing is a promise the panel does not keep. The nudge handler owns the
  // arrow keys on the canvas but defers only for a TEXT ENTRY, and a row is a
  // `div` — so without the row taking them, an unmodified arrow key navigated
  // nothing and moved the selected object instead.
  const renameLayer = vi.fn();
  const host = await renderPanel(
    [
      textRow,
      { ...textRow, id: "second", name: "second" },
      { ...textRow, id: "third", name: "third" },
    ],
    { renameLayer },
  );
  // Attached, because `focus()` on a detached subtree sets nothing.
  document.body.append(host);
  const rows = [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  expect(rows).toHaveLength(3);
  const first = rows[0]!;
  first.focus();
  expect(host.ownerDocument.activeElement).toBe(first);

  const press = async (key: string): Promise<number> => {
    await act(async () => {
      host.ownerDocument.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
      await Promise.resolve();
    });
    return rows.findIndex((row) => row === host.ownerDocument.activeElement);
  };

  expect(await press("ArrowDown")).toBe(1);
  expect(await press("ArrowDown")).toBe(2);
  // Clamped at the ends, the way a tree is.
  expect(await press("ArrowDown")).toBe(2);
  expect(await press("ArrowUp")).toBe(1);
  expect(await press("Home")).toBe(0);
  expect(await press("End")).toBe(2);
  host.remove();
});


it("marks a hidden row so the list says what the canvas is doing", async () => {
  // Hiding a layer hides it on the canvas, and the row changed in exactly one
  // measurable way: the eye button's title. One property flip on a control the
  // author sets once and then forgets is not the same as the row looking hidden.
  // The attribute is what the stylesheet dims on, so it is the contract worth
  // pinning — jsdom applies no CSS, and a computed style here would be theatre.
  const renameLayer = vi.fn();
  const host = await renderPanel(
    [
      { ...textRow, id: "shown", name: "shown" },
      { ...textRow, id: "hidden-one", name: "hidden-one", visible: false },
    ],
    { renameLayer },
  );
  const shown = host.querySelector('[data-vigilia-layer="shown"]')!;
  const hidden = host.querySelector('[data-vigilia-layer="hidden-one"]')!;

  expect(shown.getAttribute("data-hidden")).toBe("false");
  expect(hidden.getAttribute("data-hidden")).toBe("true");
  host.remove();
});


it("selects the focused row with Space, so the list can be driven without a mouse", async () => {
  // vg-067 gave the list navigation and vg-074 is its residual: a treeitem you
  // can walk to but not pick is half a tree. Enter is already rename's, so
  // selection takes the key a list has always used for it.
  const selectLayer = vi.fn();
  const renameLayer = vi.fn();
  const host = await renderPanel(
    [
      { ...textRow, id: "first", name: "first" },
      { ...textRow, id: "second", name: "second" },
    ],
    { selectLayer, renameLayer },
  );
  document.body.append(host);
  const rows = [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  rows[1]!.focus();

  await act(async () => {
    host.ownerDocument.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    await Promise.resolve();
  });

  expect(selectLayer).toHaveBeenCalledWith("second");
  // And the row that was in rename's way is not selected by it.
  expect(renameLayer).not.toHaveBeenCalled();
  host.remove();
});
