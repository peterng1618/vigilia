// @vitest-environment jsdom

import {
  outsideCount,
  sceneBoxesOf,
  type SceneBox,
} from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  type Canvas,
  type FabricObject,
  Group,
  Rect,
} from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountEditorShell } from "../editor-shell.js";
import { createNewFabricTheme } from "../new-fabric-theme.js";
import type { GroupingManager } from "./index.js";

/** The CPU card: the frosted panel and the six parts printed on it. Stated
 *  rather than read, so a card that gained or lost a part fails here — where
 *  the failure can name itself — instead of quietly re-basing every assertion
 *  below it. The GPU card is the eight-part one; this is not a limit. */
const CARD_ID = "group-cpu-card";
const CARD_PARTS = 7;

/** §57 requires group/ungroup to preserve world appearance and forbids reflow,
 *  and names no number. Half a pixel is inside the float noise a transform
 *  composition leaves behind and far below anything the author can see, so a
 *  shift that *is* visible cannot pass. */
const UNMOVED = 0.5;

// jsdom cannot drawImage an undecoded img inside Fabric's render pass; the
// starter mounts a backdrop, so this is the same proxy `editor-shell.dom.test.ts`
// installs.
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real === null) return;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      new Proxy(real, {
        get(target, property) {
          if (property === "drawImage") return (): void => {};
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
        set(target, property, value) {
          if (property === "patternQuality") return true;
          return Reflect.set(target, property, value);
        },
      }) as unknown as CanvasRenderingContext2D,
  );
});

interface WorldBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const EDGES = ["left", "top", "width", "height"] as const;

function hostBox(width: number, height: number): HTMLElement {
  const host = document.createElement("div");
  Object.defineProperties(host, {
    clientWidth: { value: width },
    clientHeight: { value: height },
  });
  return host;
}

function everyObject(canvas: Canvas): FabricObject[] {
  const found: FabricObject[] = [];
  const walk = (objects: readonly FabricObject[]): void => {
    for (const object of objects) {
      found.push(object);
      if (object instanceof Group) walk(object.getObjects());
    }
  };
  walk(canvas.getObjects());
  return found;
}

/** World box of every object in the scene, by id, at any depth.
 *
 *  Not the authored `left`/`top`: a card's parts are stored around the group's
 *  centre, so their local coordinates are not what the author sees and do not
 *  even survive a move unchanged. The composed world box *is* the appearance,
 *  and it is what §57 is about.
 *
 *  `setCoords()` first, and it is defensive rather than load-bearing. Fabric
 *  caches each object's axis-aligned box in `aCoords` and `getBoundingRect()`
 *  reads that cache; `group()` used to leave it holding the *pre*-grouping box
 *  — measured here as a 562-unit jump on the 1672 × 941 starter host (983
 *  against 421) that a save and reload then contradicted. `group()` now
 *  refreshes every member itself, so nothing here depends on the call: these
 *  five assertions pass without it. It stays because a helper that reads a box
 *  should not depend on some other owner's discipline to make that box true,
 *  and the test that pins the staleness itself is the crop count below, which
 *  deliberately reads unrefreshed. */
function worldBoxes(canvas: Canvas): Map<string, WorldBox> {
  return new Map(
    everyObject(canvas).flatMap((object) => {
      const id = object.get("id");
      if (typeof id !== "string") return [];
      object.setCoords();
      const box = object.getBoundingRect();
      return [
        [
          id,
          {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          },
        ] as const,
      ];
    }),
  );
}

function boxesOf(
  canvas: Canvas,
  ids: readonly string[],
): Map<string, WorldBox> {
  const all = worldBoxes(canvas);
  return new Map(
    ids.flatMap((id) => {
      const box = all.get(id);
      return box === undefined ? [] : [[id, box] as const];
    }),
  );
}

function expectUnmoved(
  canvas: Canvas,
  ids: readonly string[],
  before: ReadonlyMap<string, WorldBox>,
  label: string,
): void {
  const now = worldBoxes(canvas);
  for (const id of ids) {
    const after = now.get(id);
    expect(after, `${label}: ${id} is on the canvas`).toBeDefined();
    if (after === undefined) continue;
    const was = before.get(id);
    if (was === undefined) throw new Error(`${id} had no recorded world box`);
    for (const edge of EDGES) {
      expect(
        Math.abs(after[edge] - was[edge]),
        `${label}: ${id} ${edge} moved`,
      ).toBeLessThanOrEqual(UNMOVED);
    }
  }
}

/** The card on the canvas right now.
 *
 *  By id rather than by position, because `group()` mints a fresh id for what
 *  it creates — correct, since a re-grouped card is a new object and not the
 *  authored one — so `group-cpu-card` names the *starting* card and nothing
 *  after the first ungroup. */
function cardGroup(canvas: Canvas, id: string): FabricObject | undefined {
  return canvas
    .getObjects()
    .find((object) => object instanceof Group && object.get("id") === id);
}

function cardPartIds(canvas: Canvas, id: string): string[] {
  const card = cardGroup(canvas, id);
  if (!(card instanceof Group))
    throw new Error(`${id} is not a group on the canvas`);
  return card.getObjects().map((object) => String(object.get("id")));
}

/** After an ungroup the parts are canvas roots again — not merely reachable by
 *  a recursive walk, which would also pass for a document that still had some
 *  group above them. */
function expectUngroupedRoots(
  canvas: Canvas,
  cardId: string,
  ids: readonly string[],
): void {
  const roots = canvas.getObjects().map((object) => String(object.get("id")));
  expect(roots, `${cardId} itself is gone`).not.toContain(cardId);
  for (const id of ids) {
    expect(roots, `${id} is a canvas root after ungroup`).toContain(id);
  }
}

/** The parts selected the way an author's selection reaches the manager: an
 *  `ActiveSelection` over instances on the canvas. Undo revives new instances,
 *  so this re-resolves by id every time rather than holding on to objects. */
function selectParts(canvas: Canvas, ids: readonly string[]): void {
  const byId = new Map(
    everyObject(canvas).map((object) => [String(object.get("id")), object]),
  );
  const parts = ids
    .map((id) => byId.get(id))
    .filter((object): object is FabricObject => object !== undefined);
  expect(parts, "every part is on the canvas").toHaveLength(ids.length);
  canvas.discardActiveObject();
  canvas.setActiveObject(new ActiveSelection(parts, { canvas }));
}

/** Ungroups the card and groups it again: the round trip §57 has to hold.
 *  Returns the id of the group that came out. */
function roundTrip(
  canvas: Canvas,
  grouping: GroupingManager,
  cardId: string,
  ids: readonly string[],
): string {
  const card = cardGroup(canvas, cardId);
  if (card === undefined) throw new Error(`${cardId} left the canvas`);
  canvas.discardActiveObject();
  canvas.setActiveObject(card);
  const released = grouping.ungroup();
  expect(released, "ungroup released the parts").toHaveLength(ids.length);
  expectUngroupedRoots(canvas, cardId, ids);
  selectParts(canvas, ids);
  const group = grouping.group();
  expect(group, "group() made a group").toBeInstanceOf(Group);
  return String(group?.get("id") ?? "");
}

async function mountStarter(artboard?: {
  readonly width: number;
  readonly height: number;
}) {
  const authored = createNewFabricTheme();
  return await mountEditorShell({
    host: hostBox(1672, 941),
    artboard: artboard ?? authored.artboard,
    envelope: authored,
  });
}

describe("grouping a card's parts on the grouped starter", () => {
  it("leaves the crop count reading the boxes an author sees", async () => {
    // 1200×800 rather than the starter's own 1672×941: the starter fits itself,
    // so nothing is outside at that size and the count is 0 before and after
    // however wrong the boxes are. Cropped against a smaller frame, grouping
    // two objects used to move the figure from 5 of 29 to 11 of 30 — `group()`
    // rewrote every member into group-local coordinates and left Fabric's
    // `aCoords` cache holding the pre-grouping box, and `sceneBoxesOf` walks
    // children straight through that cache.
    const artboard = { width: 1200, height: 800 };
    const shell = await mountStarter(artboard);
    const { canvas, groupingManager } = shell.editor;
    const ids = cardPartIds(canvas, CARD_ID);

    /** The un-refreshed read, deliberately: `sceneBoxesOf` is what the artboard
     *  panel is handed, and a helper that called `setCoords` first would be
     *  asserting the fix rather than the defect. */
    const read = (): SceneBox[] => sceneBoxesOf(canvas.getObjects());

    canvas.discardActiveObject();
    canvas.setActiveObject(cardGroup(canvas, CARD_ID) as FabricObject);
    const released = groupingManager.ungroup();
    expect(released).toHaveLength(CARD_PARTS);
    const before = outsideCount(read(), artboard);

    selectParts(canvas, ids);
    groupingManager.group();

    // `outside` alone, not the whole `{outside, counted}` pair: `counted` is
    // meant to grow by one, because a group is a box *and* its children. The
    // outside figure is what the panel puts in front of an author, and grouping
    // nothing into a different place must not change it.
    expect(
      outsideCount(read(), artboard).outside,
      "the crop count moved on a grouping that moved nothing",
    ).toBe(before.outside);

    // And the boxes themselves, which is the sharper claim: the count could
    // agree by luck. A forced refresh is what a correct read produces, so any
    // difference here is a box `group()` left lying.
    const stale = read();
    for (const object of everyObject(canvas)) object.setCoords();
    expect(stale, "the crop count read a box only a refresh corrected").toEqual(
      read(),
    );

    shell.destroy();
  });

  it("makes one object out of the parts, in one history entry", async () => {
    const shell = await mountStarter();
    const { canvas, groupingManager, historyManager } = shell.editor;
    const ids = cardPartIds(canvas, CARD_ID);
    expect(ids, "the CPU card's parts").toHaveLength(CARD_PARTS);

    // `save()` fires this once per recorded entry, so the count *is* the number
    // of undo steps the author will press.
    let commits = 0;
    canvas.on(
      "editor:edit-committed" as never,
      ((): void => {
        commits += 1;
      }) as never,
    );

    canvas.discardActiveObject();
    canvas.setActiveObject(cardGroup(canvas, CARD_ID) as FabricObject);
    const released = groupingManager.ungroup();
    expect(released).toHaveLength(CARD_PARTS);
    const afterUngroup = commits;

    const group = groupingManager.group();

    expect(group).toBeInstanceOf(Group);
    expect(group?.getObjects()).toHaveLength(CARD_PARTS);
    expect(
      group
        ?.getObjects()
        .map((object) => String(object.get("id")))
        .sort(),
      "grouping renumbered, reordered or dropped a child",
    ).toEqual([...ids].sort());
    expect(
      commits - afterUngroup,
      "history entries recorded by one group()",
    ).toBe(1);

    // And the single entry undoes all of it, which is what "one" means to an
    // author pressing the key rather than reading a counter.
    await historyManager.undo();
    expectUngroupedRoots(canvas, String(group?.get("id")), ids);

    shell.destroy();
  });

  it("undo returns the parts to where they were, and redo returns the group", async () => {
    const shell = await mountStarter();
    const { canvas, groupingManager, historyManager } = shell.editor;
    const ids = cardPartIds(canvas, CARD_ID);
    const before = boxesOf(canvas, ids);

    const groupedId = roundTrip(canvas, groupingManager, CARD_ID, ids);
    expectUnmoved(canvas, ids, before, "after grouping");

    await historyManager.undo();
    expectUngroupedRoots(canvas, groupedId, ids);
    expectUnmoved(canvas, ids, before, "after undo");

    await historyManager.redo();
    const restored = cardGroup(canvas, groupedId);
    expect(restored, "redo brought the group back").toBeInstanceOf(Group);
    expect(
      restored instanceof Group ? restored.getObjects() : [],
      "the restored group still holds every part",
    ).toHaveLength(CARD_PARTS);
    expectUnmoved(canvas, ids, before, "after redo");

    shell.destroy();
  });

  it("survives two round trips, which is where an accumulating offset shows", async () => {
    const shell = await mountStarter();
    const { canvas, groupingManager, historyManager } = shell.editor;
    const ids = cardPartIds(canvas, CARD_ID);
    const before = boxesOf(canvas, ids);

    // A single pass could hide a transform that is rewritten in place: every
    // trip through `new Group(members)` re-derives the group box from its
    // children, and a re-derivation that composes rather than replaces adds a
    // little every time. Two trips is where that becomes visible; one is not
    // enough to tell it apart from float noise.
    let cardId = CARD_ID;
    for (const round of [1, 2]) {
      cardId = roundTrip(canvas, groupingManager, cardId, ids);
      expectUnmoved(canvas, ids, before, `round ${round}: grouped`);

      await historyManager.undo();
      expectUngroupedRoots(canvas, cardId, ids);
      expectUnmoved(canvas, ids, before, `round ${round}: undone`);

      await historyManager.redo();
      expectUnmoved(canvas, ids, before, `round ${round}: redone`);
    }

    // And a second ungroup, so both halves of the trip have run twice.
    canvas.discardActiveObject();
    canvas.setActiveObject(cardGroup(canvas, cardId) as FabricObject);
    expect(groupingManager.ungroup()).toHaveLength(CARD_PARTS);
    expectUngroupedRoots(canvas, cardId, ids);
    expectUnmoved(canvas, ids, before, "round 2: ungrouped again");

    shell.destroy();
  });

  it("keeps a group it wraps a group inside, and never flattens one silently", async () => {
    // Nesting is a composition an author can ask for and an easy one to lose
    // silently: a walk that reads `_objects` rather than `getObjects()` reports
    // the inner group as gone while its parts survive, ungrouped, at the outer
    // level — and nothing on the canvas says the shape changed. The shape is
    // pinned here, not merely the absence of flattening, so a change to either
    // has to be a decision somebody wrote down.
    const shell = await mountEditorShell({
      host: hostBox(400, 300),
      artboard: { width: 400, height: 300 },
    });
    const { canvas, groupingManager, historyManager } = shell.editor;
    const inner = new Group([
      new Rect({ id: "inner-a", width: 10, height: 10 }),
      new Rect({ id: "inner-b", left: 40, width: 10, height: 10 }),
    ]);
    inner.set("id", "inner-group");
    const outsider = new Rect({
      id: "outsider",
      left: 200,
      width: 10,
      height: 10,
    });
    canvas.add(inner, outsider);
    historyManager.resetHistory();

    const before = boxesOf(canvas, ["inner-a", "inner-b", "outsider"]);
    canvas.setActiveObject(new ActiveSelection([inner, outsider], { canvas }));
    const outer = groupingManager.group();

    expect(outer).toBeInstanceOf(Group);
    const children = outer?.getObjects() ?? [];
    // Nesting, explicitly: the inner group is a child, still holding its own
    // two parts. Its parts must not also arrive at the outer level.
    expect(
      children.filter((object) => object === inner),
      "the outer group holds the inner group",
    ).toHaveLength(1);
    expect(
      children.map((object) => String(object.get("id"))),
      "nothing was hoisted out of the inner group",
    ).toEqual(["inner-group", "outsider"]);
    expectUnmoved(canvas, ["inner-a", "inner-b", "outsider"], before, "nested");

    // And it comes apart the same way: one ungroup peels the outer group only,
    // leaving a group that is still a group on the canvas.
    canvas.setActiveObject(outer as FabricObject);
    const released = groupingManager.ungroup();
    expect(released?.map((object) => String(object.get("id")))).toEqual([
      "inner-group",
      "outsider",
    ]);
    expect(
      (released?.[0] as Group)
        .getObjects()
        .map((object) => String(object.get("id"))),
      "the inner group came out whole",
    ).toEqual(["inner-a", "inner-b"]);

    shell.destroy();
  });
});
