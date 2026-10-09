// @vitest-environment jsdom

import { MAX_OBJECT_NAME_LENGTH } from "@vigilia/renderer-core";
import { VigiliaChart } from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  Canvas,
  type FabricObject,
  Group,
  Rect,
} from "fabric/es";
import { beforeEach, expect, it, vi } from "vitest";
import { objectAction } from "../object-actions.js";
import { createEditorShellBridge } from "./bridge.js";
import type { EditorActionFacade } from "./session-facade.js";

// A real applyArrange needs a live Fabric canvas; spying on it asserts the
// dispatch itself, which `can` alone cannot.
const applyArrange = vi.hoisted(() => vi.fn(() => true));
vi.mock("../arrange.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../arrange.js")>()),
  applyArrange,
}));

beforeEach(() => applyArrange.mockClear());

function facadeStub(): EditorActionFacade {
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
    insertCard: vi.fn(),
    arrange: vi.fn(() => true),
    canArrange: vi.fn(() => false),
    undo: vi.fn(),
    redo: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    deleteActive: vi.fn(),
    duplicate: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    isDirty: vi.fn(() => false),
    publishableDocument: vi.fn(() => undefined),
    subscribeDocumentChange: vi.fn(() => () => undefined),
  };
}

function bridgeFor(
  active: unknown,
  extra: Record<string, unknown> = {},
  sessionExtra: Record<string, unknown> = {},
  canvasExtra: Record<string, unknown> = {},
  bridgeExtra: Record<string, unknown> = {},
) {
  const listeners = new Map<string, () => void>();
  const objects = active === undefined ? [] : [active];
  const canvas = {
    getActiveObject: () => active,
    getObjects: () => objects,
    // Fabric's own add/remove, so a test that deletes or inserts is projecting
    // from the same array the canvas reports. A stub that only answered
    // `getObjects` would make every staleness test pass for the wrong reason.
    add: (object: NonNullable<typeof active>) => objects.push(object),
    remove: (object: NonNullable<typeof active>) => {
      const index = objects.indexOf(object);
      return index < 0 ? [] : objects.splice(index, 1);
    },
    requestRenderAll: vi.fn(),
    on: vi.fn((name: string, listener: () => void) =>
      listeners.set(name, listener),
    ),
    off: vi.fn(),
    // Fabric's own event bus, reduced to what the bridge subscribes to; the
    // options argument is carried so a caller reads as it does on the canvas.
    fire: (name: string, ..._options: readonly unknown[]) =>
      listeners.get(name)?.(),
    ...canvasExtra,
  };
  const editor = {
    canvas,
    // Real editors always carry the grouping manager; the empty context is the
    // default so a test that enters a group overrides only this one member.
    groupingManager: { groupContext: () => [] as readonly unknown[] },
    // Every committed layer command records exactly one history entry, so the
    // stub carries the manager they all go through.
    historyManager: { saveState: vi.fn() },
    ...extra,
  };
  const session = { ...facadeStub(), ...sessionExtra };
  return {
    bridge: createEditorShellBridge({
      editor,
      session,
      ...bridgeExtra,
    } as never),
    canvas,
    session,
    editor,
  };
}

it("reports selection changes and removes its canvas listeners", () => {
  const { bridge, canvas } = bridgeFor(new Rect());

  expect(bridge.snapshot().selectedCount).toBe(1);
  expect(bridge.snapshot().activeKind).toBe("object");

  bridge.destroy();
  expect(canvas.off).toHaveBeenCalled();
});

it("republishes the layer rows when an object changes, not only on selection", () => {
  // A row prints the display name, which lives on the object, so a rename that
  // moves no selection still has to reach the panel — otherwise the layer list
  // and the inspector that changed it disagree.
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, canvas } = bridgeFor(rect);
  const listener = vi.fn();
  bridge.subscribe(listener);

  canvas.fire("object:modified", { target: rect });

  expect(listener).toHaveBeenCalled();
});

it("carries the document's name, and republishes it when the theme is renamed", () => {
  // A rename moves no object, so no canvas event fires for it. Without the
  // session's own document change the snapshot would keep the name the bridge
  // was built with, and the stage's identity chip would show a stale one —
  // which is what the `heard` assertion below is for: the snapshot pulls the
  // name on demand, so only the notification proves the cluster was told.
  let name = "System dashboard";
  const documentListeners: (() => void)[] = [];
  const { bridge } = bridgeFor(
    undefined,
    {},
    {
      subscribeDocumentChange: (listener: () => void) => {
        documentListeners.push(listener);
        return () => undefined;
      },
    },
    {},
    { documentName: () => name },
  );
  const heard = vi.fn();
  bridge.subscribe(heard);

  expect(bridge.snapshot().documentName).toBe("System dashboard");

  name = "Kitchen";
  for (const listener of documentListeners) listener();

  expect(heard).toHaveBeenCalled();
  expect(bridge.snapshot().documentName).toBe("Kitchen");
});

it("routes selection kind for menus, groups and charts", () => {
  const { bridge: none } = bridgeFor(undefined);
  expect(none.snapshot().activeKind).toBe("none");

  const { bridge: group } = bridgeFor(new Group([]));
  expect(group.snapshot().activeKind).toBe("group");

  const { bridge: charted } = bridgeFor(
    // A chart instance without a live ECharts backing.
    Object.create(VigiliaChart.prototype) as VigiliaChart,
  );
  expect(charted.snapshot().activeKind).toBe("chart");
});

it("delegates layer commands to the editor manager", () => {
  const bringToFront = vi.fn();
  const { bridge } = bridgeFor(new Rect(), { layerManager: { bringToFront } });

  bridge.run("front");

  expect(bringToFront).toHaveBeenCalled();
});

it("runs arrange through the editor owner, not a duplicated implementation", () => {
  const { bridge } = bridgeFor(
    new ActiveSelection([
      new Rect({ left: 0, top: 0, width: 10, height: 10 }),
      new Rect({ left: 20, top: 0, width: 10, height: 10 }),
    ]),
  );

  bridge.run("arrange:align-left");

  // Assert the dispatch: `can` alone would pass without running anything.
  expect(applyArrange).toHaveBeenCalledWith(expect.anything(), "align-left");
});

it("reports a Fabric-free target for the action registry", () => {
  const selection = new ActiveSelection([
    new Rect({ left: 0, top: 0, width: 10, height: 10 }),
    new Rect({ left: 20, top: 0, width: 10, height: 10 }),
  ]);
  const { bridge } = bridgeFor(selection);
  expect(bridge.target()).toEqual({
    kind: "group",
    locked: false,
    memberCount: 2,
    // ActiveSelection extends Group, but it is not a Group for ungrouping.
    isGroup: false,
  });
});

it("agrees with the registry about eligibility", () => {
  const { bridge } = bridgeFor(
    new Group([new Rect({ width: 10, height: 10 })]),
  );
  expect(bridge.can("ungroup")).toBe(true);
  expect(objectAction("ungroup").eligible(bridge.target())).toBe(true);
  // The refusal side matters too: without it an always-true `can` would pass.
  expect(bridge.can("group")).toBe(false);
  expect(objectAction("group").eligible(bridge.target())).toBe(false);
});

it("does not advertise actions a locked selection cannot run", () => {
  const selected = new Rect();
  selected.set("locked", true);
  const { bridge } = bridgeFor(selected);

  expect(bridge.can("delete")).toBe(false);
  expect(bridge.can("lock")).toBe(false);
  expect(bridge.can("unlock")).toBe(true);
  expect(bridge.can("arrange:align-left")).toBe(false);
});

it("gates ungroup on a real Group selection", () => {
  const grouped = new Group([new Rect()]);
  const { bridge } = bridgeFor(grouped);

  expect(bridge.can("ungroup")).toBe(true);
  expect(bridge.can("group")).toBe(false);
});

it("republishes when an object is deleted, so the row goes with it", () => {
  // A deletion fires no selection event — the active object is discarded
  // first — so the projection was never re-read and the layer list kept a row
  // for something the canvas no longer had. The layer list, the canvas and the
  // inspector disagreed about what the document contained.
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, canvas } = bridgeFor(rect);
  const heard = vi.fn();
  bridge.subscribe(heard);

  canvas.remove(rect);
  canvas.fire("object:removed", { target: rect });
  expect(heard).toHaveBeenCalled();
  expect(bridge.layers().map((row) => row.id)).not.toContain("header");
});

it("republishes when an object is added", () => {
  const { bridge, canvas } = bridgeFor(undefined);
  const heard = vi.fn();
  bridge.subscribe(heard);

  const added = new Rect({ id: "footer", width: 10, height: 10 });
  canvas.add(added);
  canvas.fire("object:added", { target: added });
  expect(heard).toHaveBeenCalled();
  expect(bridge.layers().map((row) => row.id)).toContain("footer");
});

it("carries the object's display name into the projection and back out again", () => {
  const rect = new Rect({
    id: "header",
    width: 10,
    height: 10,
    name: "Header rule",
  });
  const { bridge } = bridgeFor(rect);
  expect(bridge.layers()[0]?.name).toBe("Header rule");

  bridge.renameLayer("header", "Top rule");
  // The name rides on the object, so the next projection reads the write
  // straight back rather than from a second store that could disagree.
  expect(rect.get("name")).toBe("Top rule");
  expect(bridge.layers()[0]?.name).toBe("Top rule");
});

it("clears the stored name when a rename is blank", () => {
  const rect = new Rect({
    id: "header",
    width: 10,
    height: 10,
    name: "Header rule",
  });
  const { bridge } = bridgeFor(rect);
  bridge.renameLayer("header", "   ");
  // Removing the key, not storing whitespace: the projection falls back to the
  // id for an object with no name, which is what a cleared name should show.
  expect(rect.get("name")).toBeUndefined();
  expect(bridge.layers()[0]?.name).toBe("header");
});

it("refuses a rename past the published bound rather than clearing the name", () => {
  // Clearing here would make the author's typing vanish; the panel re-reads the
  // projection, so a refused rename leaves the row showing what it carried.
  const rect = new Rect({
    id: "header",
    width: 10,
    height: 10,
    name: "Header rule",
  });
  const { bridge, editor } = bridgeFor(rect);
  bridge.renameLayer("header", "x".repeat(MAX_OBJECT_NAME_LENGTH + 1));
  expect(rect.get("name")).toBe("Header rule");
  expect(editor.historyManager.saveState).not.toHaveBeenCalled();
});

it("saves one history entry per rename", () => {
  // The name is authored document state now, so it is undoable like any other
  // committed edit (§67) — the editor-only side map it replaces deliberately
  // was not, which is why it could never be what a save carried.
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, editor } = bridgeFor(rect);
  bridge.renameLayer("header", "Top rule");
  expect(editor.historyManager.saveState).toHaveBeenCalledTimes(1);
});

it("selects a group child through its owning group, not the child", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const setActiveObject = vi.fn();
  const { bridge } = bridgeFor(group, {}, {}, { setActiveObject });
  // bridgeFor puts the group on the canvas, so its child is reachable by id.
  bridge.selectLayer("child");
  expect(setActiveObject).toHaveBeenCalledWith(group);
});

it("selects the child itself when its group is the entered context", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const setActiveObject = vi.fn();
  const { bridge } = bridgeFor(
    group,
    { groupingManager: { groupContext: () => [group] } },
    {},
    { setActiveObject },
  );
  // Entering a group is exactly what makes its children reachable on their own,
  // so the tree click must reach the child rather than the group.
  bridge.selectLayer("child");
  expect(setActiveObject).toHaveBeenCalledWith(child);
});

it("projects the entered group's context as ids, never Fabric objects", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  // An anonymous object has no row to mark, so it must not appear as an id.
  const anonymous = new Rect({ width: 10, height: 10 });
  const { bridge } = bridgeFor(group, {
    groupingManager: { groupContext: () => [group, anonymous] },
  });
  expect(bridge.groupContext()).toEqual(["group"]);
});

it("expands the entered group in the projection, so the panel agrees with the canvas", () => {
  // An author who has entered a card is inside it, and a tree still showing
  // that card shut — with an *Expand* button and no row for the part they are
  // editing — is telling them they are somewhere they are not. This is the only
  // place the two surfaces could contradict each other outright, and the
  // projection is where it is answered: the canvas entry and the panel read the
  // same context, rather than the panel being told to expand by a second path.
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  let entered: readonly unknown[] = [];
  const { bridge } = bridgeFor(group, {
    groupingManager: { groupContext: () => entered },
  });

  const ids = (): readonly string[] =>
    bridge.layers().map((row: { id: string }) => row.id);
  expect(ids()).toEqual(["group"]);

  entered = [group];
  expect(ids()).toEqual(["group", "child"]);
  expect(
    bridge.layers().find((row: { id: string }) => row.id === "group")
      ?.collapsed,
  ).toBe(false);

  // Leaving collapses it again, because the context no longer names it — and it
  // is derived, not recorded, so a group the author had opened themselves is
  // still open when they come back out of some *other* group.
  entered = [];
  expect(ids()).toEqual(["group"]);
});

it("enters the group a row names, so its children become the reachable rows", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  // The manager records the entry and answers the context with it, which is what
  // the panel dims and expands from; the stub mirrors that rather than the
  // bridge being told what to think.
  let entered: readonly FabricObject[] = [];
  const enterGroup = vi.fn((options: { object: FabricObject }) => {
    entered = [options.object];
  });
  const { bridge } = bridgeFor(group, {
    groupingManager: { groupContext: () => entered, enterGroup },
  });

  // Shut until entered, because a group is the default view state (§67).
  expect(bridge.layers().map((row) => row.id)).toEqual(["group"]);
  bridge.enterGroup("group");

  expect(enterGroup).toHaveBeenCalledWith({ object: group });
  // Asserted through the projection the panel reads, not through the manager:
  // the part the author is inside is a row now, on one click from the tree.
  expect(bridge.groupContext()).toEqual(["group"]);
  expect(bridge.layers().map((row) => row.id)).toEqual(["group", "child"]);
});

it("enters the group a nested row names, not the group that owns it", () => {
  // `enterGroup` enters the group *around* the object it is handed, one hop up
  // `ownerGroup` — so handing it the nested group itself would enter `outer`,
  // dimming the rows around the parent the author never pressed while the row
  // they did press named `inner`. The nested group is reached through one of its
  // own children instead, which is the same one hop pointing the other way.
  const leaf = new Rect({ id: "leaf", width: 10, height: 10 });
  const inner = new Group([leaf]);
  inner.set("id", "inner");
  const outer = new Group([inner]);
  outer.set("id", "outer");
  let entered: readonly FabricObject[] = [];
  const enterGroup = vi.fn((options: { object: FabricObject }) => {
    // The manager's own rule, in the test's hands: this is what the entry turns
    // into, so the context below is the one the panel would be shown.
    const owner = options.object.parent;
    entered = [owner instanceof Group ? owner : options.object];
  });
  const { bridge } = bridgeFor(outer, {
    groupingManager: { groupContext: () => entered, enterGroup },
  });

  bridge.enterGroup("inner");

  expect(enterGroup).toHaveBeenCalledTimes(1);
  // The consequence first: what the panel would dim is the group the author is
  // inside, and the trap shows up here as `["outer"]`.
  expect(bridge.groupContext()).toEqual(["inner"]);
  expect(enterGroup).toHaveBeenCalledWith({ object: leaf });
});

it("enters nothing for an id the tree no longer holds", () => {
  // Review Focus 3: the row was painted from a projection taken before the undo,
  // delete or ungroup that rebuilt the scene, so the id names nothing the canvas
  // has. A verb that handed the id straight on would give the manager no object,
  // and the manager falls back to the *active* object — entering a group nobody
  // asked for, from a row for something that is gone.
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  let entered: readonly FabricObject[] = [];
  const enterGroup = vi.fn((options?: { object?: FabricObject }) => {
    // The manager's own fallback, `options?.object ?? canvas.getActiveObject()`,
    // with the group standing in for what is active.
    entered = [options?.object ?? group];
  });
  const { bridge } = bridgeFor(group, {
    groupingManager: { groupContext: () => entered, enterGroup },
  });

  expect(() => bridge.enterGroup("deleted")).not.toThrow();

  expect(enterGroup).not.toHaveBeenCalled();
  expect(bridge.groupContext()).toEqual([]);
  expect(bridge.layers().map((row) => row.id)).toEqual(["group"]);
});

it("enters nothing for a row that is not a group", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const enterGroup = vi.fn();
  const { bridge } = bridgeFor(group, {
    groupingManager: { groupContext: () => [], enterGroup },
  });

  // The row names something to select, not somewhere to go: handed on, the
  // manager would resolve it to `group`, an entry the author never asked for.
  bridge.enterGroup("child");
  expect(enterGroup).not.toHaveBeenCalled();
});

it("republishes on entry even when the entered context already agreed", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const { bridge } = bridgeFor(group, {
    // Already entered, so the manager fires no context event for the same entry
    // again — and a verb leaning on that event alone would repaint nothing.
    groupingManager: { groupContext: () => [group], enterGroup: vi.fn() },
  });
  const heard = vi.fn();
  bridge.subscribe(heard);

  bridge.enterGroup("group");

  expect(heard).toHaveBeenCalled();
});

it("leaves the entered group, and leaves an empty context alone", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  let entered: readonly FabricObject[] = [];
  const exitGroup = vi.fn(() => {
    const before = [...entered];
    entered = before.slice(0, -1);
    return before;
  });
  const { bridge } = bridgeFor(group, {
    groupingManager: { groupContext: () => entered, exitGroup },
  });
  const rows = (): readonly string[] => bridge.layers().map((row) => row.id);

  // Nothing entered: the manager refuses and no row moves. The bridge still
  // republishes, as `selectLayer` does for a selection it refused.
  bridge.exitGroup();
  expect(bridge.groupContext()).toEqual([]);
  expect(rows()).toEqual(["group"]);

  entered = [group];
  expect(rows()).toEqual(["group", "child"]);
  bridge.exitGroup();

  expect(exitGroup).toHaveBeenCalledTimes(2);
  expect(bridge.groupContext()).toEqual([]);
  expect(rows()).toEqual(["group"]);
});

it("reveals a hidden ancestor path but hides only the requested object", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  // The sibling is hidden on its own account: revealing the child must not
  // reveal it, or "show" would mean "show everything under this group".
  const sibling = new Rect({ id: "sibling", width: 10, height: 10 });
  sibling.set("visible", false);
  const group = new Group([child, sibling], { visible: false });
  group.set("id", "group");
  const saveState = vi.fn();
  const { bridge } = bridgeFor(
    group,
    { historyManager: { saveState } },
    {},
    { requestRenderAll: vi.fn() },
  );

  bridge.setLayerVisible("child", true);
  expect(group.visible).toBe(true);
  expect(child.visible).toBe(true);
  expect(sibling.visible).toBe(false);
  expect(saveState).toHaveBeenCalledTimes(1);

  bridge.setLayerVisible("child", false);
  expect(child.visible).toBe(false);
  expect(group.visible).toBe(true);
});

it("locks through the owning group so a group child stays protected", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const lockObject = vi.fn();
  const unlockObject = vi.fn();
  const { bridge } = bridgeFor(group, {
    objectLockManager: { lockObject, unlockObject },
  });

  bridge.setLayerLocked("child", true);
  expect(lockObject).toHaveBeenCalledWith({ object: group });
  bridge.setLayerLocked("child", false);
  expect(unlockObject).toHaveBeenCalledWith({ object: group });
});

it("keeps collapse in the bridge, and opens a group shut to begin with", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const { bridge } = bridgeFor(group);

  // Shut on open, because a group is the default rather than a state the shell
  // has to record (§67). The flag still lives here, so a remount keeps what the
  // author opened rather than re-asking them.
  expect(bridge.layers().map((row) => row.id)).toEqual(["group"]);
  expect(bridge.layers()[0]?.collapsed).toBe(true);
  bridge.setCollapsed("group", false);
  expect(bridge.layers().map((row) => row.id)).toEqual(["group", "child"]);
  bridge.setCollapsed("group", true);
  expect(bridge.layers().map((row) => row.id)).toEqual(["group"]);
});

it("notifies subscribers when a layer command changes the projection", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const { bridge } = bridgeFor(group);
  const seen = vi.fn();
  bridge.subscribe(seen);

  bridge.setCollapsed("group", true);
  expect(seen).toHaveBeenCalled();
});

it("ignores a layer command aimed at an id the tree does not have", () => {
  const setActiveObject = vi.fn();
  const saveState = vi.fn();
  const { bridge } = bridgeFor(
    new Rect({ id: "only" }),
    { historyManager: { saveState } },
    {},
    { setActiveObject, requestRenderAll: vi.fn() },
  );

  bridge.selectLayer("missing");
  bridge.setLayerVisible("missing", true);
  bridge.setLayerLocked("missing", true);
  // A refusal that still did any of this would corrupt unrelated state.
  expect(setActiveObject).not.toHaveBeenCalled();
  expect(saveState).not.toHaveBeenCalled();
});

it("reorders within one parent and reports the move", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const alpha = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  const beta = new Rect({ left: 20, top: 0, width: 10, height: 10 });
  alpha.set("id", "alpha");
  beta.set("id", "beta");
  canvas.add(alpha, beta);
  const saveState = vi.fn();
  const { bridge } = bridgeFor(undefined, {
    canvas,
    historyManager: { saveState },
  });

  const order = (): unknown[] =>
    canvas.getObjects().map((object) => object.get("id"));

  // Paint order is bottom-first; the panel reverses it for display.
  expect(order()).toEqual(["alpha", "beta"]);
  expect(bridge.reorderLayer("alpha", "beta")).toBe(true);
  expect(order()).toEqual(["beta", "alpha"]);
  // Reordering is authored state: without this the drop would not reach the
  // saved envelope, and the browser test below is the only other thing that
  // would notice.
  expect(saveState).toHaveBeenCalledTimes(1);
});

it("refuses to move a layer across a group boundary", () => {
  // Crossing owners changes membership, which is a different operation.
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  child.set("id", "child");
  const group = new Group([child]);
  group.set("id", "grp");
  const sibling = new Rect({ left: 60, top: 0, width: 10, height: 10 });
  sibling.set("id", "sibling");
  canvas.add(group, sibling);
  const { bridge } = bridgeFor(undefined, {
    canvas,
    historyManager: { saveState: vi.fn() },
  });

  const before = canvas.getObjects().map((object) => object.get("id"));
  expect(bridge.reorderLayer("child", "sibling")).toBe(false);
  expect(canvas.getObjects().map((object) => object.get("id"))).toEqual(before);
  expect(child.group).toBe(group);
});

it("refuses an unknown id instead of moving something else", () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const alpha = new Rect();
  const beta = new Rect();
  alpha.set("id", "alpha");
  beta.set("id", "beta");
  canvas.add(alpha, beta);
  const { bridge } = bridgeFor(undefined, {
    canvas,
    historyManager: { saveState: vi.fn() },
  });

  const before = canvas.getObjects().map((object) => object.get("id"));
  expect(bridge.reorderLayer("nope", "beta")).toBe(false);
  expect(bridge.reorderLayer("alpha", "nope")).toBe(false);
  expect(canvas.getObjects().map((object) => object.get("id"))).toEqual(before);
});

it("reorders inside a group without lifting the child out of it", () => {
  // The regression this test exists for: `siblings` is the group's array while
  // the move was issued on the canvas, so the child landed in the canvas root
  // *and* stayed in the group. `canvas.getObjects()` is the assertion that
  // catches it — the same-parent test above cannot, because its siblings are
  // canvas-root and the two arrays happen to be the same one.
  const canvas = new Canvas(document.createElement("canvas"));
  const child = new Rect({ left: 0, top: 0, width: 10, height: 10 });
  const peer = new Rect({ left: 20, top: 0, width: 10, height: 10 });
  child.set("id", "child");
  peer.set("id", "peer");
  const group = new Group([child, peer]);
  group.set("id", "grp");
  canvas.add(group);
  const saveState = vi.fn();
  const { bridge } = bridgeFor(undefined, {
    canvas,
    historyManager: { saveState },
  });

  const ids = (objects: readonly { get(key: string): unknown }[]): unknown[] =>
    objects.map((object) => object.get("id"));

  expect(ids(canvas.getObjects())).toEqual(["grp"]);
  expect(ids(group.getObjects())).toEqual(["child", "peer"]);
  expect(bridge.reorderLayer("child", "peer")).toBe(true);
  // The group is still the only canvas-root object, and the child is still in it.
  expect(ids(canvas.getObjects())).toEqual(["grp"]);
  expect(ids(group.getObjects())).toEqual(["peer", "child"]);
  expect(child.group).toBe(group);
  expect(saveState).toHaveBeenCalledTimes(1);
});
