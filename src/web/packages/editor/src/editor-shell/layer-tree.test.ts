// @vitest-environment jsdom
import {
  Group,
  Rect,
  type FabricObject,
  StaticCanvas,
  Textbox,
} from "fabric/es";
import { describe, expect, it } from "vitest";
import { reviveThemeEnvelope } from "@vigilia/scene-fabric";
import { createNewFabricTheme } from "../new-fabric-theme.js";
import { findById, ownerOf, pathTo, projectLayers } from "./layer-tree.js";

/** Nothing is open: the default an author meets, and the state a flat scene is
 * permanently in. A group with children is shut unless it is named here. */
const base = { expanded: new Set<string>(), selected: [] } as const;

/** The same projection with the named groups opened. */
const opened = (...ids: string[]) => ({
  ...base,
  expanded: new Set(ids),
});

describe("layer projection", () => {
  it("lists top-most first, matching paint order reversed", () => {
    const bottom = new Rect({ id: "bottom", width: 10, height: 10 });
    const top = new Rect({ id: "top", width: 10, height: 10 });
    const rows = projectLayers({ ...base, root: [bottom, top] });
    expect(rows.map((row) => row.id)).toEqual(["top", "bottom"]);
  });

  it("indents group children and marks the group as having children", () => {
    const child = new Textbox("hi", { id: "child" });
    // Group's constructor is typed to Partial<GroupProps>, which carries no id.
    const group = new Group([child]);
    group.set("id", "group");
    const rows = projectLayers({ ...opened("group"), root: [group] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "group",
      depth: 0,
      hasChildren: true,
      kind: "group",
    });
    expect(rows[1]).toMatchObject({
      id: "child",
      depth: 1,
      parentId: "group",
      kind: "text",
    });
  });

  it("starts a group shut, and shows only the group until it is opened", () => {
    // The default an author meets. The starter's eight cards are fifty objects
    // that would otherwise open as sixty rows, which is the noise the panel is
    // being changed to remove — and it is a default rather than stored state
    // (§67), so nothing records "shut" anywhere.
    const group = new Group([new Rect({ id: "child", width: 10, height: 10 })]);
    group.set("id", "group");
    const rows = projectLayers({ ...base, root: [group] });
    expect(rows.map((row) => row.id)).toEqual(["group"]);
    expect(rows[0]).toMatchObject({ collapsed: true, hasChildren: true });
    // And opening it is the whole of the change.
    expect(
      projectLayers({ ...opened("group"), root: [group] }).map((row) => row.id),
    ).toEqual(["group", "child"]);
  });

  it("reports a group with nothing in it as neither shut nor open", () => {
    // There is nothing to open, so a twisty offering to open it would be a lie
    // — and the panel draws one for any row claiming `hasChildren`.
    const empty = new Group([]);
    empty.set("id", "empty");
    const rows = projectLayers({ ...base, root: [empty] });
    expect(rows[0]).toMatchObject({ hasChildren: false, collapsed: false });
  });

  it("takes visibility and lock from the whole ancestor path", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child], { visible: false });
    group.set("id", "group");
    // Fabric has no `locked` prop, so it is set the way the lock manager does.
    group.set("locked", true);
    const rows = projectLayers({ ...opened("group"), root: [group] });
    // The child's own flags are both false; its row must still report the
    // group's state, so this fails if either read stops walking the path.
    expect(child.visible).toBe(true);
    expect((child as { locked?: boolean }).locked).toBeUndefined();
    expect(rows[1]).toMatchObject({
      id: "child",
      visible: false,
      locked: true,
    });
  });

  it("reads a hidden group's children as hidden, however deep they sit", () => {
    // Depth 2 rather than 1, and with the intermediate group shut: a walk that
    // stopped at the first shut group would have nothing to read, and one that
    // checked only the immediate parent would call this visible.
    const leaf = new Rect({ id: "leaf", width: 10, height: 10 });
    const inner = new Group([leaf]);
    inner.set("id", "inner");
    const outer = new Group([inner], { visible: false });
    outer.set("id", "outer");
    const rows = projectLayers({
      ...opened("outer", "inner"),
      root: [outer],
    });
    expect(rows.find((row) => row.id === "leaf")).toMatchObject({
      depth: 2,
      parentId: "inner",
      visible: false,
    });
  });

  it("reports an empty group as having no children", () => {
    const empty = new Group([]);
    empty.set("id", "empty");
    const rows = projectLayers({ ...base, root: [empty] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "empty",
      kind: "group",
      hasChildren: false,
    });
  });

  it("marks the row whose object is selected, resolving a child through its group", () => {
    const group = new Group([new Rect({ id: "child", width: 10, height: 10 })]);
    group.set("id", "group");
    const rows = projectLayers({
      ...opened("group"),
      root: [group],
      selected: [group],
    });
    expect(rows.find((row) => row.id === "group")?.selected).toBe(true);
    expect(rows.find((row) => row.id === "child")?.selected).toBe(false);
  });

  it("prefers the object's own display name over the id", () => {
    const rect = new Rect({
      id: "header",
      width: 10,
      height: 10,
      name: "Header rule",
    });
    const rows = projectLayers({ ...base, root: [rect] });
    expect(rows[0]?.name).toBe("Header rule");
  });

  it("keeps the id as the row's key when the object is named", () => {
    // The name is a label; the id is what every bridge command targets and
    // what bindings reference, so naming must not move either.
    const rect = new Rect({
      id: "header",
      width: 10,
      height: 10,
      name: "Header rule",
    });
    const rows = projectLayers({ ...base, root: [rect] });
    expect(rows[0]?.id).toBe("header");
    expect(findById([rect], rows[0]!.id)).toBe(rect);
  });

  it("falls back to the id for an object authored before the field", () => {
    // The backward-compatibility contract: a scene with no name on the object
    // still opens and still shows something an author can recognise.
    const rect = new Rect({ id: "header", width: 10, height: 10 });
    const rows = projectLayers({ ...base, root: [rect] });
    expect(rows[0]?.name).toBe("header");
  });

  it("does not crash on an object with no id", () => {
    const rows = projectLayers({
      ...base,
      root: [new Rect({ width: 10, height: 10 })],
    });
    expect(rows[0]?.id).toBe("unidentified");
    expect(rows[0]?.name).toBe("unidentified");
  });

  it("gives each id-less object its own row id", () => {
    const rows = projectLayers({
      ...base,
      root: [
        new Rect({ width: 10, height: 10 }),
        new Rect({ width: 10, height: 10 }),
      ],
    });
    expect(rows.map((row) => row.id)).toEqual([
      "unidentified",
      "unidentified#2",
    ]);
    expect(rows[0]?.name).toBe("unidentified");
  });

  it("falls back to the kind when neither the name nor the id is usable", () => {
    // Whitespace counts as unusable: a blank row tells the author nothing.
    const rect = new Rect({ id: "   ", width: 10, height: 10, name: "  " });
    const rows = projectLayers({ ...base, root: [rect] });
    expect(rows[0]?.name).toBe("Shape");
  });

  it("keeps the id when only the name is blank", () => {
    const rect = new Rect({ id: "header", width: 10, height: 10, name: "   " });
    const rows = projectLayers({ ...base, root: [rect] });
    expect(rows[0]?.name).toBe("header");
  });

  it("reports collapse on the group itself, not on the children it hides", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child]);
    group.set("id", "group");
    const rows = projectLayers({ ...base, root: [group] });
    expect(rows[0]?.collapsed).toBe(true);
    expect(rows[0]?.hasChildren).toBe(true);
  });
});

describe("a scene with no groups at all", () => {
  /** Review Focus 4, and the case the grouped default could quietly break:
   * a theme built from two hundred loose shapes has no group anywhere, so
   * every row is a root. Nothing here may assume a card is a rule about
   * themes — the starter is the only theme this plan builds, and the panel is
   * for all of them. */
  const loose = (count: number): FabricObject[] =>
    Array.from(
      { length: count },
      (_, at) =>
        new Rect({ id: `loose-${at}`, left: at * 10, width: 10, height: 10 }),
    );

  it("puts every row at depth 0 with no parent", () => {
    const scene = loose(200);
    const rows = projectLayers({ ...base, root: scene });
    expect(rows).toHaveLength(200);
    expect(rows.every((row) => row.depth === 0)).toBe(true);
    expect(rows.every((row) => row.parentId === undefined)).toBe(true);
    // Nothing to open, so nothing is shut and no row offers a twisty.
    expect(rows.every((row) => row.collapsed === false)).toBe(true);
    expect(rows.every((row) => row.hasChildren === false)).toBe(true);
  });

  it("keeps every loose object individually reachable and selectable", () => {
    // "Every one of those shapes keeps individually selectable, movable and
    // styleable" is the constraint, and a panel that hid or merged rows would
    // break it while still projecting the right number of them.
    const scene = loose(200);
    const rows = projectLayers({ ...base, root: scene, selected: [scene[7]!] });
    expect(rows.filter((row) => row.selected)).toHaveLength(1);
    expect(rows.find((row) => row.selected)?.id).toBe("loose-7");
    // Reversed paint order, so row 7 is `loose-192` — and it has to resolve
    // back to that object rather than to the one in the same index.
    expect(findById(scene, rows[7]!.id)).toBe(scene[192]);
    for (const row of rows)
      expect(row.visible && !row.locked, row.id).toBe(true);
  });

  it("reverses paint order without a group anywhere to reverse within", () => {
    const scene = loose(3);
    const rows = projectLayers({ ...base, root: scene });
    expect(rows.map((row) => row.id)).toEqual([
      "loose-2",
      "loose-1",
      "loose-0",
    ]);
  });
});

describe("nested groups", () => {
  const nest = (): { outer: Group; inner: Group; leaf: FabricObject } => {
    const leaf = new Rect({ id: "leaf", width: 10, height: 10 });
    const inner = new Group([leaf]);
    inner.set("id", "inner");
    const outer = new Group([inner]);
    outer.set("id", "outer");
    return { outer, inner, leaf };
  };

  it("names the right parent at depth 2 and at depth 3", () => {
    const great = new Rect({ id: "great", width: 10, height: 10 });
    const grandchild = new Group([great]);
    grandchild.set("id", "grandchild");
    const child = new Group([grandchild]);
    child.set("id", "child");
    const { outer } = nest();
    outer.add(child);
    const rows = projectLayers({
      ...opened("outer", "inner", "child", "grandchild"),
      root: [outer],
    });
    // `outer` holds `inner` then `child`, and the walk reverses paint order at
    // every level, so `child` leads and `great` sits at depth 3.
    expect(
      rows.map((row) => ({
        id: row.id,
        depth: row.depth,
        parent: row.parentId,
      })),
    ).toEqual([
      { id: "outer", depth: 0, parent: undefined },
      { id: "child", depth: 1, parent: "outer" },
      { id: "grandchild", depth: 2, parent: "child" },
      { id: "great", depth: 3, parent: "grandchild" },
      { id: "inner", depth: 1, parent: "outer" },
      { id: "leaf", depth: 2, parent: "inner" },
    ]);
  });

  it("emits a parent before its children, so one forward pass reaches any depth", () => {
    // `layer-panel`'s group-context marking relies on this: it walks the rows
    // once, adding a row whose parent is already in the set.
    const { outer } = nest();
    const rows = projectLayers({
      ...opened("outer", "inner"),
      root: [outer],
    });
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.parentId !== undefined) expect(seen.has(row.parentId)).toBe(true);
      seen.add(row.id);
    }
  });

  it("hides a whole shut subtree, and everything under it", () => {
    const { outer } = nest();
    const rows = projectLayers({ ...opened("inner"), root: [outer] });
    // `inner` is open but `outer` is shut, so nothing under `outer` is shown
    // however open the group inside it is.
    expect(rows.map((row) => row.id)).toEqual(["outer"]);
  });

  it("resolves an id inside a shut group to the object the panel drew it from", () => {
    // `findById` walks the whole document while the projection emits only what
    // is open, so the two must agree on what an id names — or a rename or a
    // hide lands on whichever object happened to be walked first.
    const { outer, inner, leaf } = nest();
    const rows = projectLayers({ ...opened("inner"), root: [outer] });
    expect(rows.map((row) => row.id)).toEqual(["outer"]);
    expect(findById([outer], "inner")).toBe(inner);
    expect(findById([outer], "leaf")).toBe(leaf);
  });

  it("keeps a loose row's fallback id pointing at that row when a shut group holds an id-less object", () => {
    // The fallback id is *positional* — `layerIds` numbers id-less objects by
    // walk order — and `findById` walks the whole document while the projection
    // emits only what is open. The id-less object *inside the shut group* is
    // what makes the two disagree: if the projection stopped at the shut group
    // it would never number it, `findById` would, and the loose row's id would
    // resolve to the hidden object instead. A rename or a hide would then land
    // on something the author never clicked.
    const hidden = new Rect({ width: 10, height: 10 });
    const group = new Group([hidden]);
    group.set("id", "group");
    const loose = new Rect({ left: 200, width: 10, height: 10 });
    const scene = [loose, group];

    const rows = projectLayers({ ...base, root: scene });
    // `hidden` is numbered `unidentified` even though it is behind a shut
    // group, which is why `loose` is the *second* id-less object. That gap is
    // the evidence: a walk that stopped at the shut group would have numbered
    // `loose` first, and `findById` — which does descend — would then have
    // resolved that id to `hidden` instead.
    expect(rows.map((row) => row.id)).toEqual(["group", "unidentified#2"]);
    // The row that drew `loose` is the one the panel would act on.
    expect(findById(scene, rows[1]!.id)).toBe(loose);
    expect(findById(scene, rows[1]!.id)).not.toBe(hidden);

    // And opening the group does not renumber it, or a row the author had
    // already clicked would resolve to a different object.
    const open = projectLayers({ ...opened("group"), root: scene });
    expect(open[2]!.id).toBe(rows[1]!.id);
    expect(findById(scene, open[2]!.id)).toBe(loose);
  });
});

describe("the starter theme", () => {
  /** The starter is what this plan changed, so it is measured rather than
   * assumed: `new-fabric-theme.test.ts` states these parts so a card that
   * gained or lost one fails where the failure can name itself. The GPU card is
   * the eight-part one; this is not a limit. */
  const CARD_PARTS = 8;
  /** Ten top-level rows, not eight: the wordmark and the strapline are loose by
   * design — they are not a card, and a design that made every object a group
   * is the cage this project is written to avoid (`new-fabric-theme.test.ts`
   * pins that). Eight is the count of *cards*, which is what the plan's prose
   * means; the row count an author reads is ten. */
  const TOP_LEVEL_ROWS = 10;
  const CARDS = 8;
  /** Every object in the document, at any depth. */
  const TOTAL_OBJECTS = 60;

  const starter = async (): Promise<readonly FabricObject[]> => {
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);
    return canvas.getObjects();
  };

  it("projects to its top-level rows, with every card shut", async () => {
    const roots = await starter();
    const rows = projectLayers({ ...base, root: roots });
    expect(rows).toHaveLength(TOP_LEVEL_ROWS);
    expect(
      rows.every((row) => row.depth === 0 && row.parentId === undefined),
    ).toBe(true);
    const cards = rows.filter((row) => row.kind === "group");
    expect(cards).toHaveLength(CARDS);
    expect(cards.every((row) => row.collapsed && row.hasChildren)).toBe(true);
    // The two loose labels are rows too, at the same level as the cards.
    expect(rows.filter((row) => row.kind === "text")).toHaveLength(2);
  });

  it("reaches every object once every card is opened", async () => {
    const roots = await starter();
    const rows = projectLayers({
      ...base,
      expanded: new Set(
        roots
          .filter((object) => object instanceof Group)
          .map((group) => String(group.get("id"))),
      ),
      root: roots,
    });
    expect(rows).toHaveLength(TOTAL_OBJECTS);
    // And each row names a distinct object, so nothing is lost or doubled by
    // the walk reaching into groups.
    expect(new Set(rows.map((row) => row.id)).size).toBe(TOTAL_OBJECTS);
    expect(rows.every((row) => row.depth === 1 || row.depth === 0)).toBe(true);
  });

  it("keeps the CPU and GPU cards at their measured part counts", async () => {
    const roots = await starter();
    const rows = projectLayers({
      ...base,
      expanded: new Set(["group-cpu-card", "group-gpu-card"]),
      root: roots,
    });
    const under = (card: string): number =>
      rows.filter((row) => row.parentId === card).length;
    expect(under("group-cpu-card")).toBe(7);
    expect(under("group-gpu-card")).toBe(CARD_PARTS);
  });
});

describe("layer tree lookups", () => {
  it("resolves an id to the same object the projection named", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child]);
    group.set("id", "group");
    const rows = projectLayers({ ...opened("group"), root: [group] });
    // The id the row carried has to resolve back to the object that row drew,
    // including the nested child, or every bridge command targets the wrong one.
    expect(findById([group], rows[1]!.id)).toBe(child);
  });

  it("resolves the anonymous fallback ids the projection hands out", () => {
    const first = new Rect({ width: 10, height: 10 });
    const second = new Rect({ width: 10, height: 10 });
    const rows = projectLayers({ ...base, root: [first, second] });
    expect(rows.map((row) => row.id)).toEqual([
      "unidentified",
      "unidentified#2",
    ]);
    expect(findById([first, second], rows[0]!.id)).toBe(second);
    expect(findById([first, second], rows[1]!.id)).toBe(first);
  });

  it("names the owning group of a child and nothing above a top-level object", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const group = new Group([child]);
    group.set("id", "group");
    expect(ownerOf([group], "child")).toBe(group);
    expect(ownerOf([group], "group")).toBeUndefined();
    expect(ownerOf([group], "missing")).toBeUndefined();
  });

  it("returns the root-first path to a nested id, and nothing for a miss", () => {
    const child = new Rect({ id: "child", width: 10, height: 10 });
    const inner = new Group([child]);
    inner.set("id", "inner");
    const outer = new Group([inner]);
    outer.set("id", "outer");
    expect(pathTo([outer], "child")).toEqual([outer, inner, child]);
    expect(pathTo([outer], "missing")).toEqual([]);
  });
});
