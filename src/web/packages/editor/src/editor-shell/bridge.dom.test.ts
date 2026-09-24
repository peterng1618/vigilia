// @vitest-environment jsdom

import { VigiliaChart } from "@vigilia/scene-fabric";
import { ActiveSelection, Group, Rect } from "fabric/es";
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
) {
  const listeners = new Map<string, () => void>();
  const objects = active === undefined ? [] : [active];
  const canvas = {
    getActiveObject: () => active,
    getObjects: () => objects,
    on: vi.fn((name: string, listener: () => void) =>
      listeners.set(name, listener),
    ),
    off: vi.fn(),
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
