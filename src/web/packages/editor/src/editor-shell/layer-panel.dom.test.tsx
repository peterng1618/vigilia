// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { Canvas, Rect } from "fabric/es";
import { LayerPanel } from "./layer-panel.js";
import { createEditorShellBridge, type EditorShellBridge } from "./bridge.js";
import type { LayerKind, LayerMark, LayerRow } from "./layer-tree.js";
import { actionEnabled, OBJECT_ACTIONS } from "../object-actions.js";
import { uiCopy } from "../ui-copy.js";

/** The mark a fixture gets unless it names its own: the kind's own data, with
 * nothing a test would mistake for a real document's reading. */
function markFor(kind: LayerKind): LayerMark {
  switch (kind) {
    case "text":
      return {
        kind,
        text: "Aa",
        family: "Segoe UI, sans-serif",
        weight: "400",
      };
    case "chart":
      return { kind, family: "bar" };
    case "shape":
      return { kind, paint: "#000" };
    case "image":
      return { kind, src: undefined };
    case "group":
      return { kind };
  }
}

/** A row as the projection emits it, from the parts a test cares about.
 *
 * The mark and the bound key are required by the projection, so a fixture that
 * left them out would crash the panel before the assertion under test ran.
 * Filling them here keeps twenty fixtures that are about selection from each
 * restating a treatment none of them is looking at. */
function layerRow(
  parts: Partial<Omit<LayerRow, "mark">> & { readonly mark?: LayerMark } = {},
): LayerRow {
  const kind = parts.kind ?? "text";
  return {
    id: "layer",
    name: "Layer",
    kind,
    mark: markFor(kind),
    bound: [],
    depth: 0,
    parentId: undefined,
    hasChildren: false,
    collapsed: false,
    visible: true,
    locked: false,
    selected: false,
    ...parts,
  };
}

function bridge(rows: readonly LayerRow[], overrides = {}): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    capture: () => undefined,
    can: () => true,
    target: () => ({ kind: "object", locked: false, memberCount: 1, isGroup: false }),
    canArrange: () => false,
    // Completed here rather than in twenty fixtures: `layerRow` fills only what
    // a fixture left out, so a row that names its own treatment still has it.
    layers: () => rows.map((row) => layerRow(row)) as never,
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

it("indents a group child and carries both state icons once it is selected", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge([
    layerRow({ id: "group", name: "Group", kind: "group", hasChildren: true }),
    layerRow({ id: "child", name: "Child", kind: "text", depth: 1,
      parentId: "group", locked: true, selected: true }),
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

const textRow = layerRow({ id: "wordmark", name: "wordmark", kind: "text" });

async function renderPanel(
  rows: readonly LayerRow[],
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
    layerRow({ id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
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
    layerRow({ id: "open", name: "Open", kind: "group", hasChildren: true, collapsed: false }),
    layerRow({ id: "shut", name: "Shut", kind: "group", hasChildren: true, collapsed: true }),
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
  layerRow({ id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
  layerRow({ id: "child", name: "Child", kind: "text", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: true, selected: true }),
];

/** Two groups, so the negative half of the assertion has a row to read. The
 * non-current group is what makes this a test of "dims the rest" rather than
 * of "sets an attribute somewhere". */
const contextRows = [
  layerRow({ id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
  layerRow({ id: "child", name: "Child", kind: "text", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: true }),
  layerRow({ id: "other", name: "Other", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
];

it("shows a shut group as one row offering to open, and no children", async () => {
  // What an author meets on opening the starter: the eight cards are rows, not
  // sixty. The projection decides that; what this pins is that the panel reads
  // it as "shut" — a twisty that says expand and points the other way — rather
  // than as an open group whose children are missing.
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<LayerPanel bridge={bridge([
    layerRow({ id: "group", name: "CPU card", kind: "group", depth: 0, parentId: undefined, hasChildren: true, collapsed: true, visible: true, locked: false, selected: false }),
    layerRow({ id: "loose", name: "Wordmark", kind: "text", depth: 0, parentId: undefined, hasChildren: false, collapsed: false, visible: true, locked: false, selected: false }),
  ])} />));

  const rows = host.querySelectorAll("[data-vigilia-layer]");
  expect(rows).toHaveLength(2);
  const twisty = host.querySelector('[aria-label="Expand CPU card"]');
  expect(twisty?.getAttribute("aria-expanded")).toBe("false");
  expect(twisty?.querySelector("svg")?.getAttribute("class")).toContain(
    "lucide-chevron-right",
  );
  // The loose object beside it has no twisty at all, so the two rows are not
  // offering the same affordance.
  expect(
    host.querySelector('[aria-label^="Expand"], [aria-label^="Collapse"]'),
  ).toBe(twisty);
});

it("opens a shut group from its twisty and closes it again", async () => {
  // Both directions, because the projection's default means the first press is
  // now the common one and a twisty that only ever closed would be useless.
  // The panel holds no state of its own — it re-reads the projection — so the
  // row is re-rendered from the bridge rather than mutated here.
  const setCollapsed = vi.fn();
  const row = layerRow({ id: "group", name: "Group", kind: "group", hasChildren: true });
  const host = document.createElement("div");
  const root = createRoot(host);
  const draw = async (collapsed: boolean) => {
    await act(async () => root.render(
      <LayerPanel bridge={bridge([{ ...row, collapsed }], { setCollapsed })} />,
    ));
  };
  await draw(true);
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Expand Group"]')?.click(),
  );
  expect(setCollapsed).toHaveBeenLastCalledWith("group", false);
  await draw(false);
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Collapse Group"]')?.click(),
  );
  expect(setCollapsed).toHaveBeenLastCalledWith("group", true);
});

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
    layerRow({ id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
    layerRow({ id: "child", name: "Child", kind: "text", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: false }),
    layerRow({ id: "peer", name: "Peer", kind: "shape", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: false }),
    layerRow({ id: "sibling", name: "Sibling", kind: "shape", depth: 0, parentId: undefined, hasChildren: false, visible: true, locked: false, selected: false }),
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
  // The units are the assertion, not the numbers: `top: 48` is an invalid
  // length, so the declaration is dropped, `top` falls back to `auto` and the
  // line sizes to zero. Measured on canvas — the line had never drawn.
  expect(line().style.getPropertyValue("--layer-dropline-top")).toBe("48px");
  expect(line().style.getPropertyValue("--layer-dropline-left")).toBe("19px");

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
  //
  // Both rows are *selected*, because a default row now carries no lock at all
  // (see "keeps a default row quiet"). The negative half still has to be
  // measured on a row that draws the button, or it would pass on an absent
  // icon — which is exactly the vacuous assertion this treatment removed.
  const host = await renderPanel([
    layerRow({ id: "shut", name: "Shut", kind: "shape", locked: true, selected: true }),
    layerRow({ id: "open", name: "Open", kind: "shape", locked: false, selected: true }),
  ]);
  // Both state buttons carry `aria-pressed`, so the lock one is named rather
  // than positional: the visibility icon would satisfy a bare attribute match.
  const lock = (id: string): SVGSVGElement | null =>
    host.querySelector(
      `[data-vigilia-layer="${id}"] button[aria-label="Lock"], [data-vigilia-layer="${id}"] button[aria-label="Unlock"]`,
    )?.querySelector("svg") ?? null;

  // Both rows must actually be drawing the button, or the two halves below say
  // nothing about the glyphs.
  expect(lock("shut")).not.toBeNull();
  expect(lock("open")).not.toBeNull();
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

/** jsdom has neither `DragEvent` nor `DataTransfer`, so a drag is driven as the
 * three plain events the panel listens for. `cancelable` is what a real one
 * carries: `dragover` is only a valid drop target because the handler cancels
 * it, and `defaultPrevented` is how that cancellation is observable here. */
function dragEvent(type: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { setData: () => undefined },
  });
  return event;
}

/** vg-099: the refusal was silent, so an author dragging toward another group
 * saw the same row, the same cursor and the same list as a drop that lands.
 * `draggable` is honest and cross-group reordering is still refused — what was
 * missing is the panel saying so, so the state a row carries mid-gesture is
 * the thing pinned here: a slot, a refusal, or neither. */
it("tells a refused drop target from one that would land, mid-gesture", async () => {
  const reorderLayer = vi.fn(() => false);
  const tree = [
    layerRow({ id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
    layerRow({ id: "child", name: "Child", kind: "text", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: false }),
    layerRow({ id: "peer", name: "Peer", kind: "shape", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: false }),
    layerRow({ id: "sibling", name: "Sibling", kind: "shape", depth: 0, parentId: undefined, hasChildren: false, visible: true, locked: false, selected: false }),
  ];
  const owned = (id: string): string => (id === "child" || id === "peer" ? "group" : "");
  const host = await renderPanel(tree, {
    reorderLayer,
    sameLayerParent: (a: string, b: string) => owned(a) === owned(b),
  });
  const row = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;
  const tree_ = (): HTMLElement => host.querySelector<HTMLElement>('[role="tree"]')!;

  // Before any gesture nothing is marked, so an ordinary hover is untouched.
  expect(row("peer").getAttribute("data-drop")).toBeNull();
  expect(tree_().getAttribute("data-dragging")).toBeNull();

  await act(async () => row("child").dispatchEvent(dragEvent("dragstart")));
  // The tree knows a gesture is in flight, which is what lets the stylesheet
  // dim every row that is not the slot — the refusal has to be visible
  // somewhere other than the row the pointer happens to be over.
  expect(tree_().getAttribute("data-dragging")).toBe("child");

  const refused = await act(async () => {
    const event = dragEvent("dragover");
    row("sibling").dispatchEvent(event);
    return event.defaultPrevented;
  });
  // The gesture is answered rather than swallowed: a refused row is not
  // cancelled, so the browser's own drag cursor joins in and says no too.
  expect(refused).toBe(false);
  expect(row("sibling").getAttribute("data-drop")).toBe("refused");
  // The source row is not a refusal — it is where the layer already is, which
  // is a third answer the panel must not confuse with either of the others.
  await act(async () => row("child").dispatchEvent(dragEvent("dragover")));
  expect(row("child").getAttribute("data-drop")).toBeNull();

  await act(async () => row("peer").dispatchEvent(dragEvent("dragover")));
  expect(row("peer").getAttribute("data-drop")).toBe("slot");
  // Only one row is ever marked, so a refusal cannot linger beside a slot.
  expect(row("sibling").getAttribute("data-drop")).toBeNull();

  // The mark is the drag's, so the gesture ending takes it with it.
  await act(async () => row("peer").dispatchEvent(dragEvent("dragend")));
  expect(tree_().getAttribute("data-dragging")).toBeNull();
  expect(row("peer").getAttribute("data-drop")).toBeNull();
});

it("takes the drop line away when the row under the pointer refuses it", async () => {
  // The line is the panel's promise of a landing slot. Found on canvas, not by
  // reading the handler: it is a single element for the whole tree, so a line
  // shown over a sibling is still lit while the pointer has moved a row further
  // to a refusal — offering the very drop that row has just said no to.
  const tree = [
    layerRow({ id: "group", name: "Group", kind: "group", depth: 0, parentId: undefined, hasChildren: true, visible: true, locked: false, selected: false }),
    layerRow({ id: "child", name: "Child", kind: "text", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: false }),
    layerRow({ id: "peer", name: "Peer", kind: "shape", depth: 1, parentId: "group", hasChildren: false, visible: true, locked: false, selected: false }),
    layerRow({ id: "sibling", name: "Sibling", kind: "shape", depth: 0, parentId: undefined, hasChildren: false, visible: true, locked: false, selected: false }),
  ];
  const owned = (id: string): string => (id === "child" || id === "peer" ? "group" : "");
  const host = await renderPanel(tree, {
    sameLayerParent: (a: string, b: string) => owned(a) === owned(b),
  });
  const row = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;
  const line = (): HTMLElement =>
    host.querySelector<HTMLElement>("[data-vigilia-layer-dropline]")!;

  await act(async () => row("child").dispatchEvent(dragEvent("dragstart")));
  await act(async () => row("peer").dispatchEvent(dragEvent("dragover")));
  expect(line().hidden).toBe(false);

  // One row further, across the boundary: the line must go with the slot.
  await act(async () => row("sibling").dispatchEvent(dragEvent("dragover")));
  expect(line().hidden).toBe(true);

  // And back again, so it is the row's answer that drives it rather than a
  // one-way latch.
  await act(async () => row("peer").dispatchEvent(dragEvent("dragover")));
  expect(line().hidden).toBe(false);
});

it("still restacks on a drop the panel marked, and refuses the one it did not", async () => {
  // The half of vg-099 that must not move: making a refusal visible is not a
  // reason to stop accepting a drop, and the two answers come from one gesture.
  const reorderLayer = vi.fn(() => true);
  const tree = [
    { ...textRow, id: "child", name: "Child", depth: 1, parentId: "group" },
    { ...textRow, id: "peer", name: "Peer", depth: 1, parentId: "group" },
    { ...textRow, id: "sibling", name: "Sibling", depth: 0 },
  ];
  const owned = (id: string): string => (id === "child" || id === "peer" ? "group" : "");
  const host = await renderPanel(tree, {
    reorderLayer,
    sameLayerParent: (a: string, b: string) => owned(a) === owned(b),
  });
  const row = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;

  await act(async () => row("child").dispatchEvent(dragEvent("dragstart")));
  await act(async () => row("sibling").dispatchEvent(dragEvent("dragover")));
  await act(async () => row("sibling").dispatchEvent(dragEvent("drop")));
  expect(reorderLayer).not.toHaveBeenCalled();

  await act(async () => row("child").dispatchEvent(dragEvent("dragstart")));
  await act(async () => row("peer").dispatchEvent(dragEvent("dragover")));
  await act(async () => row("peer").dispatchEvent(dragEvent("drop")));
  expect(reorderLayer).toHaveBeenCalledWith("child", "peer");
  expect(row("peer").getAttribute("data-drop")).toBeNull();
  expect(host.querySelector('[role="tree"]')?.getAttribute("data-dragging")).toBeNull();
});

it("states the reorder rule in the panel's own words, for a reader and not only a pointer", async () => {
  // A cursor is a pointer's answer; an author who has never read a line of
  // documentation needs the rule in text too. It hangs off the tree through
  // `aria-describedby`, which is how a screen-reader user reaches it — the
  // brief's own criterion was one an author can satisfy without hovering.
  const host = await renderPanel([textRow]);
  const rule = host.querySelector<HTMLElement>("[data-vigilia-layer-rule]");
  expect(rule?.textContent).toBe(uiCopy.panels.reorderRule);
  const tree = host.querySelector('[role="tree"]');
  expect(tree?.getAttribute("aria-describedby")).toBe(rule?.id);
});

/** vg-087: the rows said `draggable` and nothing acted on it. Every earlier test
 * here drove the panel through a stub bridge, so a stub that answered
 * `sameLayerParent` and `reorderLayer` the way the test wanted would keep them
 * green while the real bridge refused the same gesture. This one wires the real
 * `createEditorShellBridge` over a real Fabric canvas, so the drag has to land
 * in Fabric's own array — the thing the panel's markup promises.
 *
 * The assertion is the document, not a call count: what an author gets from a
 * drag is the layer list in a new order, and a stubbed call would pass even if
 * the move Fabric performed were a no-op. */
it("restacks the document when a row is dropped on another", async () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const alpha = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  const beta = new Rect({ left: 20, top: 0, width: 10, height: 10 });
  alpha.set("id", "alpha");
  beta.set("id", "beta");
  canvas.add(alpha, beta);
  const real = createEditorShellBridge({
    editor: {
      canvas,
      groupingManager: { groupContext: () => [] },
      historyManager: { saveState: vi.fn() },
    },
    session: {} as never,
    capture: () => undefined,
  } as never);

  const host = document.createElement("div");
  await act(async () =>
    (await Promise.resolve(createRoot(host))).render(
      <LayerPanel bridge={real} />,
    ),
  );
  const order = (): unknown[] =>
    canvas.getObjects().map((object) => object.get("id"));
  const row = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;
  const panelOrder = (): (string | null)[] =>
    [...host.querySelectorAll("[data-vigilia-layer]")].map((element) =>
      element.getAttribute("data-vigilia-layer"),
    );

  const before = order();
  expect(before).toEqual(["alpha", "beta"]);
  // The panel paints topmost-first, so `beta` is the row above `alpha`.
  expect(panelOrder()).toEqual(["beta", "alpha"]);

  await act(async () => row("alpha").dispatchEvent(dragEvent("dragstart")));
  const over = await act(async () => {
    const event = dragEvent("dragover");
    row("beta").dispatchEvent(event);
    return event.defaultPrevented;
  });
  // A refused dragover leaves the browser with no valid drop target, so the
  // `drop` that follows is never delivered. This is the half that made the
  // gesture inert while every attribute still read as though it worked.
  expect(over).toBe(true);

  await act(async () => row("beta").dispatchEvent(dragEvent("drop")));
  expect(order()).not.toEqual(before);
  // And the list the author reads followed the document, rather than the panel
  // re-rendering the order it was handed a moment earlier.
  expect(panelOrder()).toEqual(["alpha", "beta"]);

  host.remove();
});

// ── A row says what it is ────────────────────────────────────────────────────

it("draws a text row as its own words, in its own face", async () => {
  // The brief's first subtraction: a 12px `T` glyph cannot survive 340px, and
  // it answers neither question an author has. The row's own string does both
  // at once — *what it says* and *that it is text* — and its own face says the
  // rest. Read on the declared value: jsdom applies no stylesheet here, so a
  // computed style would be theatre, but the inline declaration is exactly
  // what the browser will paint and is what a browser case confirms.
  const host = await renderPanel([
    layerRow({
      id: "wordmark",
      name: "wordmark",
      kind: "text",
      mark: {
        kind: "text",
        text: "VIGILIA",
        family: "Inter, sans-serif",
        weight: "600",
      },
    }),
  ]);

  const sample = host.querySelector<HTMLElement>('[data-vigilia-layer-mark="text"]')!;
  expect(sample.textContent).toBe("VIGILIA");
  expect(sample.style.fontFamily).toBe("Inter, sans-serif");
  expect(sample.style.fontWeight).toBe("600");
  // The panel declares no face of its own, so the specimen is the only place a
  // font family appears. A row that inherited `--shell-display` would leave
  // this empty and read as shell text, which is the failure the assertion is
  // here for — checked on the declaration rather than a substring, because
  // `sans-serif` contains `serif` and a substring test would say nothing.
  expect(host.querySelectorAll("[style*='font-family']")).toHaveLength(1);
});

it("gives each kind a mark that says which kind it is", async () => {
  // The negative half matters as much as the positive: one column that drew the
  // old glyph for everything would pass a test that only checked the arms it
  // happens to get right. So every kind is asked, including the two that draw
  // no mark at all.
  const host = await renderPanel([
    layerRow({ id: "gauge", kind: "chart", mark: { kind: "chart", family: "gauge" } }),
    layerRow({ id: "spark", kind: "chart", mark: { kind: "chart", family: "line" } }),
    layerRow({ id: "panel", kind: "shape", mark: { kind: "shape", paint: "#2ee6a8" } }),
    layerRow({ id: "logo", kind: "image", mark: { kind: "image", src: "blob:pic" } }),
    layerRow({ id: "card", kind: "group", mark: { kind: "group" } }),
  ]);

  const mark = (id: string): SVGSVGElement | null =>
    host.querySelector(`[data-vigilia-layer="${id}"] [data-vigilia-layer-mark] svg`) ?? null;

  // A chart's *family*, which is what the eight cards of a starter differ by.
  expect(mark("gauge")?.getAttribute("class")).toContain("lucide-gauge");
  expect(mark("spark")?.getAttribute("class")).toContain("lucide-chart-line");
  // A shape's own paint, not a square in the shell's colour.
  const swatch = host.querySelector<HTMLElement>(
    '[data-vigilia-layer="panel"] [data-vigilia-layer-mark="shape"]',
  )!;
  expect(swatch.style.background).toBe("rgb(46, 230, 168)");
  // An image is its own picture.
  expect(
    host.querySelector<HTMLImageElement>(
      '[data-vigilia-layer="logo"] [data-vigilia-layer-mark="image"]',
    )?.getAttribute("src"),
  ).toBe("blob:pic");
  // A group draws no mark: its twisty is the mark, and a third symbol saying
  // "group" beside a bold name would be a second word for the same word.
  expect(
    host.querySelector('[data-vigilia-layer="card"] [data-vigilia-layer-mark]'),
  ).toBeNull();
  // …and it is marked as a group for the stylesheet, which bolds the name.
  expect(
    host.querySelector('[data-vigilia-layer="card"]')?.getAttribute("data-kind"),
  ).toBe("group");
});

it("prints the bound key the projection reported, and nothing where there is none", async () => {
  // The bound column is only worth a column if it is the document's key: a
  // panel that typed one in would still read correctly on the starter and be
  // wrong on every other theme.
  const host = await renderPanel([
    layerRow({ id: "gauge", name: "RAM ring", bound: ["ram.used.percent"] }),
    layerRow({
      id: "trends",
      name: "Trends",
      bound: ["cpu.load", "gpu.load", "ram.used.percent"],
    }),
    layerRow({ id: "panel", name: "Panel", bound: [] }),
  ]);
  const bound = (id: string): HTMLElement | null =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"] .vigilia-layer-bound`);

  expect(bound("gauge")?.textContent).toBe("ram.used.percent");
  // Three keys, so the separator earns its place; the title keeps the full
  // list for the row that clips it.
  expect(bound("trends")?.textContent).toContain("cpu.load");
  expect(bound("trends")?.textContent).toContain("ram.used.percent");
  // A row bound to nothing carries nothing. A word printed here on every
  // unbound row would be repeated ink paid for out of the layer *name*, and an
  // unbound row must never claim a key it has not got.
  expect(bound("panel")).toBeNull();
});

// ── …and is quiet when nothing is wrong ─────────────────────────────────────

it("carries no state icon at all on a default row", async () => {
  // Every row said "visible, unlocked" before, and the noise grew with the row
  // count — which is precisely the case a card-heavy panel would hide. Two
  // flags that are both the default carry no information, so both are absent.
  const host = await renderPanel([layerRow({ id: "wordmark", name: "wordmark" })]);

  const row = host.querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]')!;
  expect(row.querySelectorAll("button")).toHaveLength(0);
  expect(row.querySelector('[aria-label="Hide"]')).toBeNull();
  expect(row.querySelector('[aria-label="Lock"]')).toBeNull();
});

it("shows the state icons on hover, on focus and on selection", async () => {
  // Three ways of saying "this is the row you are about to act on", and the
  // pointer is only one of them: a keyboard author has to reach the same
  // controls a pointer reaches.
  const host = await renderPanel([layerRow({ id: "wordmark", name: "wordmark" })]);
  document.body.append(host);
  const row = host.querySelector<HTMLElement>('[data-vigilia-layer="wordmark"]')!;
  const icons = (): number => row.querySelectorAll("button").length;
  expect(icons()).toBe(0);

  // React attaches its listeners to the root container, so both events have to
  // bubble to reach them — a non-bubbling dispatch is delivered to the target
  // and then to nothing.
  await act(async () =>
    row.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  expect(icons()).toBe(2);

  await act(async () =>
    row.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })),
  );
  expect(icons()).toBe(0);

  // React's onFocus maps to focusin, which bubbles; a plain `focus` event does
  // not reach it.
  await act(async () =>
    row.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
  );
  expect(icons()).toBe(2);

  await act(async () =>
    row.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  expect(icons()).toBe(0);
  host.remove();
});

it("keeps the icons on a row whose own state is not the default", async () => {
  // A hidden layer and a locked one are the two facts the panel exists to show,
  // so neither may wait for a hover to appear.
  const host = await renderPanel([
    layerRow({ id: "hidden-one", visible: false }),
    layerRow({ id: "locked-one", locked: true }),
  ]);
  const row = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;

  // Only the one that differs: a hidden row is still unlocked, so an unlocked
  // row's lock icon would be noise even here.
  expect(row("hidden-one").querySelector('[aria-label="Show"]')).not.toBeNull();
  expect(row("hidden-one").querySelector('[aria-label="Lock"]')).toBeNull();
  expect(row("locked-one").querySelector('[aria-label="Unlock"]')).not.toBeNull();
  expect(row("locked-one").querySelector('[aria-label="Hide"]')).toBeNull();
});

it("still hides and locks the row whose icons the author pressed", async () => {
  // The subtractions are allowed to remove ink, not the actions. Selecting a row
  // is what brings the buttons back, so the press has to reach the bridge.
  const setLayerVisible = vi.fn();
  const setLayerLocked = vi.fn();
  const host = await renderPanel([layerRow({ id: "wordmark", selected: true })], {
    setLayerVisible,
    setLayerLocked,
  });
  const press = async (label: string): Promise<void> => {
    await act(async () =>
      host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click(),
    );
  };
  await press("Hide");
  await press("Lock");
  expect(setLayerVisible).toHaveBeenCalledWith("wordmark", false);
  expect(setLayerLocked).toHaveBeenCalledWith("wordmark", true);
});

it("keeps every row reachable in a scene with two hundred of them", async () => {
  // Review Focus 4, and the case the whole treatment has to survive: a theme
  // of loose shapes has no group anywhere, so every row is a top-level row and
  // none of them is a card. The treatment must read for a free shape, and the
  // panel must still be a panel at two hundred rows.
  const rows = Array.from({ length: 200 }, (_, at) =>
    layerRow({ id: `loose-${at}`, name: `loose-${at}`, kind: "shape" }),
  );
  const host = await renderPanel(rows);

  const rendered = host.querySelectorAll("[data-vigilia-layer]");
  expect(rendered).toHaveLength(200);
  // Every row is still a row with a name and a mark — none is dropped, merged
  // or collapsed to make the treatment fit.
  for (const row of rendered) {
    expect(row.querySelector(".vigilia-layer-name")?.textContent).not.toBe("");
    expect(row.querySelector("[data-vigilia-layer-mark]")).not.toBeNull();
  }
  // And the whole tree is still two hundred quiet rows: the default state adds
  // nothing, so a scene that big opens without 400 icons of noise.
  expect(host.querySelectorAll("[data-vigilia-layer] button")).toHaveLength(0);
});

it("selects any one of two hundred rows through the panel's own click", async () => {
  // The "selects" half of *"a theme of two hundred loose shapes opens, selects,
  // moves and styles every one of them"*. The test above proves every row
  // **renders**; this proves the click still reaches the bridge for a row deep
  // in a scene with no group anywhere, which is the case where a selection
  // quietly resolves to the wrong object — `bridge.selectLayer` deliberately
  // selects `owner ?? target`, and with no owner every row is its own owner.
  //
  // Sampled across the tree rather than at one depth, because a resolver that
  // only works near the top is not a resolver.
  const rows = Array.from({ length: 200 }, (_, at) =>
    layerRow({ id: `loose-${at}`, name: `loose-${at}`, kind: "shape" }),
  );
  const selectLayer = vi.fn();
  const host = await renderPanel(rows, { selectLayer });

  for (const at of [0, 57, 142, 199]) {
    const id = `loose-${at}`;
    await act(async () =>
      host.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)?.click(),
    );
    // One call, naming that row and nothing else — a panel that answered every
    // click with the same id would satisfy a count-only assertion.
    expect(selectLayer.mock.calls).toEqual([[id]]);
    selectLayer.mockClear();
  }
});
