// @vitest-environment jsdom
import {
  ActiveSelection,
  Group,
  Rect,
  Textbox,
  type FabricObject,
} from "fabric/es";
import type { ImageEditor } from "@anu3ev/fabric-image-editor";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLayerPanel } from "./layer-panel.js";

describe("semantic layer panel", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("projects paint order and navigates a child through its owning group", () => {
    vi.useFakeTimers();
    const { canvas, foreground, group } = editorFixture();
    const panel = createLayerPanel(document.body, canvas);

    expect(
      [...panel.root.querySelectorAll<HTMLElement>("[data-vigilia-layer]")].map(
        (row) => row.dataset["vigiliaLayer"],
      ),
    ).toEqual(["foreground", "group", "child", "background"]);
    expect(panel.root.textContent).toContain("foreground");
    expect(panel.root.textContent).toContain("group");
    expect(panel.root.textContent).toContain("child");

    selectLayer(layer(panel.root, "foreground"));
    vi.runAllTimers();
    expect(canvas.canvas.setActiveObject).toHaveBeenCalledWith(foreground);
    expect(layer(panel.root, "foreground").getAttribute("aria-pressed")).toBe(
      "true",
    );

    selectLayer(layer(panel.root, "child"));
    vi.runAllTimers();
    expect(canvas.canvas.setActiveObject).toHaveBeenLastCalledWith(group);
    expect(layer(panel.root, "child").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("reveals a hidden parent path and delegates layer controls to the fork", () => {
    const { canvas, group, child, foreground } = editorFixture();
    group.set("visible", false);
    const panel = createLayerPanel(document.body, canvas);

    action(layer(panel.root, "child"), "show").click();
    expect(group.visible).toBe(true);
    expect(child.visible).toBe(true);
    expect(canvas.canvas.requestRenderAll).toHaveBeenCalledTimes(1);
    expect(canvas.historyManager.saveState).toHaveBeenCalledTimes(1);
    expect(canvas.canvas.setActiveObject).toHaveBeenCalledWith(group);
    expect(
      layer(panel.root, "child").querySelector(
        '[data-vigilia-layer-action="hide"]',
      ),
    ).not.toBeNull();

    action(layer(panel.root, "foreground"), "lock").click();
    action(layer(panel.root, "foreground"), "front").click();
    expect(canvas.objectLockManager.lockObject).toHaveBeenCalledWith({
      object: foreground,
    });
    expect(canvas.layerManager.bringToFront).toHaveBeenCalledWith(foreground);
  });

  it("refreshes from canvas events and unregisters them on teardown", () => {
    const { canvas, listeners } = editorFixture();
    const panel = createLayerPanel(document.body, canvas);

    listeners.get("object:modified")!();
    listeners.get("selection:created")!();
    expect(canvas.canvas.getObjects).toHaveBeenCalledTimes(3);

    panel.destroy();
    expect(canvas.canvas.off).toHaveBeenCalledTimes(6);
    expect(panel.root.isConnected).toBe(false);
  });

  it("offers alignment for two selected objects but disables distribution", () => {
    const { canvas, foreground, group, historyManager, activeObject } =
      editorFixture();
    activeObject.mockReturnValue(new ActiveSelection([foreground, group]));
    const panel = createLayerPanel(document.body, canvas);

    const align = panel.root.querySelector<HTMLButtonElement>(
      '[data-vigilia-arrange="align-left"]',
    )!;
    const distribute = panel.root.querySelector<HTMLButtonElement>(
      '[data-vigilia-arrange="distribute-x"]',
    )!;
    expect(align.disabled).toBe(false);
    expect(distribute.disabled).toBe(true);

    align.click();
    expect(historyManager.saveState).toHaveBeenCalledTimes(1);
  });
});

function editorFixture() {
  const background = new Rect();
  background.set("id", "background");
  const child = new Textbox("child");
  child.set("id", "child");
  const group = new Group([child]);
  group.set("id", "group");
  const foreground = new Rect();
  foreground.set("id", "foreground");
  const listeners = new Map<string, () => void>();
  let selected: FabricObject | undefined;
  const activeObject = vi.fn(() => selected);
  const historyManager = { saveState: vi.fn() };
  const canvas = {
    canvas: {
      getObjects: vi.fn(() => [background, group, foreground]),
      getActiveObject: activeObject,
      discardActiveObject: vi.fn(() => {
        selected = undefined;
      }),
      fire: vi.fn(),
      setActiveObject: vi.fn((object: FabricObject) => {
        selected = object;
      }),
      requestRenderAll: vi.fn(),
      on: vi.fn((event: string, listener: () => void) =>
        listeners.set(event, listener),
      ),
      off: vi.fn(),
    },
    layerManager: {
      bringToFront: vi.fn(),
      bringForward: vi.fn(),
      sendToBack: vi.fn(),
      sendBackwards: vi.fn(),
    },
    objectLockManager: { lockObject: vi.fn(), unlockObject: vi.fn() },
    historyManager,
  } as unknown as ImageEditor;
  return {
    canvas,
    background,
    child,
    group,
    foreground,
    listeners,
    activeObject,
    historyManager,
  };
}

function layer(root: HTMLElement, id: string): HTMLElement {
  return root.querySelector<HTMLElement>(`[data-vigilia-layer="${id}"]`)!;
}

function action(row: HTMLElement, name: string): HTMLButtonElement {
  return row.querySelector<HTMLButtonElement>(
    `[data-vigilia-layer-action="${name}"]`,
  )!;
}

function selectLayer(row: HTMLElement): void {
  row.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}
