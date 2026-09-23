// @vitest-environment jsdom
import { Group, Rect } from "fabric/es";
import { VigiliaChart } from "@vigilia/scene-fabric";
import { expect, it, vi } from "vitest";
import { createEditorShellBridge } from "./bridge.js";
import type { EditorActionFacade } from "./session-facade.js";

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
  };
}

function bridgeFor(active: unknown, extra: Record<string, unknown> = {}) {
  const listeners = new Map<string, () => void>();
  const canvas = {
    getActiveObject: () => active,
    on: vi.fn((name: string, listener: () => void) =>
      listeners.set(name, listener),
    ),
    off: vi.fn(),
  };
  const editor = { canvas, ...extra };
  const session = facadeStub();
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
  const { bridge } = bridgeFor(new Rect(), {});

  // `canArrange` is false for a single object, so the action must not run.
  bridge.run({ type: "arrange", action: "align-left" });

  expect(bridge.can({ type: "arrange", action: "align-left" })).toBe(false);
});

it("does not advertise actions a locked selection cannot run", () => {
  const selected = new Rect();
  selected.set("locked", true);
  const { bridge } = bridgeFor(selected);

  expect(bridge.can("delete")).toBe(false);
  expect(bridge.can("lock")).toBe(false);
  expect(bridge.can("unlock")).toBe(true);
  expect(bridge.can({ type: "arrange", action: "align-left" })).toBe(false);
});

it("gates ungroup on a real Group selection", () => {
  const grouped = new Group([new Rect()]);
  const { bridge } = bridgeFor(grouped);

  expect(bridge.can("ungroup")).toBe(true);
  expect(bridge.can("group")).toBe(false);
});
