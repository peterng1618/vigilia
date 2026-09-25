// @vitest-environment jsdom
import type { FabricObject } from "fabric/es";
import { createRoot, type Root } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { OBJECT_ACTIONS, type ObjectTarget } from "../object-actions.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import { CanvasContextMenu } from "./canvas-context-menu.js";
import type { EditorActionFacade } from "./session-facade.js";

// jsdom's selector engine cannot answer `:modal`/`:popover-open`, and floating-ui
// asks for both on every position. Each unanswerable call costs ~0.5s of selector
// parsing, which turns one menu open into ~35s. Real browsers answer both.
beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(
    function (this: Element, selector: string): boolean {
      if (selector === ":modal" || selector === ":popover-open") return false;
      return matches.call(this, selector);
    },
    matches,
  );
});

const CHART_TARGET: ObjectTarget = {
  kind: "chart",
  locked: false,
  memberCount: 1,
  isGroup: false,
};

const NO_TARGET: ObjectTarget = {
  kind: "none",
  locked: false,
  memberCount: 0,
  isGroup: false,
};

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
    canArrange: vi.fn(() => true),
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

interface Opened {
  readonly items: readonly HTMLElement[];
  readonly labels: readonly (string | null)[];
  readonly event: MouseEvent;
  readonly setActiveObject: ReturnType<typeof vi.fn>;
  readonly run: ReturnType<typeof vi.fn>;
  readonly session: EditorActionFacade;
  readonly root: Root;
  readonly close: () => Promise<void>;
}

/** React schedules outside `act`, and floating-ui's measurement never settles
 * inside one, so the menu is flushed with macrotasks instead. */
async function flush(): Promise<void> {
  for (let round = 0; round < 3; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function openMenu(options: {
  readonly hit?: FabricObject;
  readonly target: ObjectTarget;
}): Promise<Opened> {
  const host = document.createElement("div");
  document.body.append(host);
  const upper = document.createElement("canvas");
  upper.className = "upper-canvas";
  host.append(upper);

  const setActiveObject = vi.fn();
  const run = vi.fn();
  const session = facadeStub();
  const bridge = {
    target: () => options.target,
    canArrange: () => false,
    run,
    session,
    editor: {
      canvas: {
        upperCanvasEl: upper,
        findTarget: () => ({ target: options.hit }),
        setActiveObject,
        requestRenderAll: vi.fn(),
      },
    },
  } as unknown as EditorShellBridge;

  const root = createRoot(host);
  root.render(<CanvasContextMenu bridge={bridge} />);
  await flush();

  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 120,
    clientY: 90,
  });
  upper.dispatchEvent(event);
  await flush();

  const items = Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
  return {
    items,
    labels: items.map((item) => item.getAttribute("aria-label")),
    event,
    setActiveObject,
    run,
    session,
    root,
    close: async () => {
      root.unmount();
      host.remove();
      await flush();
    },
  };
}

it("renders exactly the registry's eligible entries for the object under the pointer", async () => {
  const chart = {} as unknown as FabricObject;
  const opened = await openMenu({ hit: chart, target: CHART_TARGET });

  // Derived from the registry's own predicate, not from `actionEnabled` — the
  // function the menu itself calls would make this assertion tautological.
  const expected = OBJECT_ACTIONS.filter((action) =>
    action.eligible(CHART_TARGET),
  ).map((action) => action.label);
  // Without this the assertion below passes on a menu that rendered nothing.
  expect(expected.length).toBeGreaterThan(0);
  expect(opened.labels).toEqual(expected);
  // A right-click changes no selection, so the hit has to be selected for the
  // entries above to describe it.
  expect(opened.setActiveObject).toHaveBeenCalledWith(chart);
  // The native menu is suppressed, and only here.
  expect(opened.event.defaultPrevented).toBe(true);
  await opened.close();
});

it("dispatches the clicked entry through the bridge's own run", async () => {
  const opened = await openMenu({
    hit: {} as unknown as FabricObject,
    target: CHART_TARGET,
  });
  const duplicate = opened.items.find(
    (item) => item.getAttribute("aria-label") === uiCopy.actions.duplicate,
  );
  expect(duplicate).toBeDefined();
  duplicate?.click();
  expect(opened.run).toHaveBeenCalledWith("duplicate");
  await opened.close();
});

it("offers creation actions and no object actions on empty canvas", async () => {
  const opened = await openMenu({ target: NO_TARGET });
  expect(opened.labels).toEqual([
    uiCopy.panels.text,
    uiCopy.chartFamilies.gauge,
    uiCopy.chartFamilies.line,
    uiCopy.chartFamilies.bar,
    uiCopy.chartFamilies.pie,
  ]);
  // The registry is the object menu's owner: nothing from it may appear here.
  expect(opened.labels).not.toContain(uiCopy.actions.duplicate);
  expect(opened.setActiveObject).not.toHaveBeenCalled();

  const byLabel = (label: string) =>
    opened.items.find((item) => item.getAttribute("aria-label") === label);
  byLabel(uiCopy.panels.text)?.click();
  expect(opened.session.addText).toHaveBeenCalled();
  byLabel(uiCopy.chartFamilies.gauge)?.click();
  expect(opened.session.addChart).toHaveBeenCalledWith("gauge");
  await opened.close();
});

it("stays inert until a document mounts a bridge", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const upper = document.createElement("canvas");
  upper.className = "upper-canvas";
  host.append(upper);
  const root = createRoot(host);
  root.render(<CanvasContextMenu bridge={undefined} />);
  await flush();

  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
  });
  expect(() => upper.dispatchEvent(event)).not.toThrow();
  await flush();
  expect(document.body.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
  // Nothing owns the canvas yet, so the native menu must still appear.
  expect(event.defaultPrevented).toBe(false);

  root.unmount();
  host.remove();
  await flush();
});
