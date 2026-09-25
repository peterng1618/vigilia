// @vitest-environment jsdom

import { VigiliaChart } from "@vigilia/scene-fabric";
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
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
    openPackage: vi.fn(),
    savePackage: vi.fn(async () => undefined),
    releasePackage: vi.fn(async () => undefined),
    openLibrary: vi.fn(async () => undefined),
    saveLibrary: vi.fn(async () => undefined),
    addText: vi.fn(),
    addChart: vi.fn(),
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
    layerNames: vi.fn(() => ({})),
    setLayerNames: vi.fn(),
  };
}

function bridgeFor(
  active: unknown,
  extra: Record<string, unknown> = {},
  sessionExtra: Record<string, unknown> = {},
  canvasExtra: Record<string, unknown> = {},
) {
  const listeners = new Map<string, () => void>();
  const objects = active === undefined ? [] : [active];
  const canvas = {
    getActiveObject: () => active,
    getObjects: () => objects,
    requestRenderAll: vi.fn(),
    on: vi.fn((name: string, listener: () => void) =>
      listeners.set(name, listener),
    ),
    off: vi.fn(),
    ...canvasExtra,
  };
  const editor = { canvas, ...extra };
  const session = { ...facadeStub(), ...sessionExtra };
  return {
    bridge: createEditorShellBridge({ editor, session } as never),
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

it("carries display names into the projection and back out again", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, session } = bridgeFor(
    rect,
    {},
    {
      layerNames: () => ({ header: "Header rule" }),
    },
  );
  expect(bridge.layers()[0]?.name).toBe("Header rule");

  bridge.renameLayer("header", "Top rule");
  // The write goes to the facade, not to a local copy — assert it there. The
  // stub does not feed the value back, so re-reading layers() here would only
  // re-assert the seeded value.
  expect(session.setLayerNames).toHaveBeenCalledWith({ header: "Top rule" });
});

it("clears the stored name when a rename is blank", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, session } = bridgeFor(rect);
  bridge.renameLayer("header", "   ");
  // Removing the key, not storing whitespace: Task 3's name ladder already
  // falls back to the id for a row with no stored name.
  expect(session.setLayerNames).toHaveBeenCalledWith({});
});

it("keeps sibling names when one is renamed", () => {
  const rect = new Rect({ id: "header", width: 10, height: 10 });
  const { bridge, session } = bridgeFor(
    rect,
    {},
    {
      layerNames: () => ({ other: "Kept" }),
    },
  );
  bridge.renameLayer("header", "Top rule");
  expect(session.setLayerNames).toHaveBeenCalledWith({
    other: "Kept",
    header: "Top rule",
  });
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

it("keeps collapse in the bridge and drops the children from the projection", () => {
  const child = new Rect({ id: "child", width: 10, height: 10 });
  const group = new Group([child]);
  group.set("id", "group");
  const { bridge } = bridgeFor(group);

  expect(bridge.layers().map((row) => row.id)).toEqual(["group", "child"]);
  bridge.setCollapsed("group", true);
  expect(bridge.layers().map((row) => row.id)).toEqual(["group"]);
  expect(bridge.layers()[0]?.collapsed).toBe(true);
  bridge.setCollapsed("group", false);
  expect(bridge.layers().map((row) => row.id)).toEqual(["group", "child"]);
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
