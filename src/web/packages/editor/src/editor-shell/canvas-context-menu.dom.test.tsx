// @vitest-environment jsdom
import type { FabricObject } from "fabric/es";
import { createRoot, type Root } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { OBJECT_ACTIONS, type ObjectTarget } from "../object-actions.js";
import { insertGroups } from "../new-object-panel.js";
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
    canArrange: vi.fn(() => true),
    undo: vi.fn(),
    redo: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    deleteActive: vi.fn(),
    duplicate: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    isDirty: vi.fn(() => false),
    subscribeDocumentChange: vi.fn(() => () => undefined),
  };
}

interface Opened {
  readonly items: readonly HTMLElement[];
  readonly labels: readonly (string | null)[];
  readonly groupLabels: readonly (string | null)[];
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
    groupLabels: Array.from(
      document.body.querySelectorAll<HTMLElement>(".editor-shell-menu-label"),
      (label) => label.textContent,
    ),
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

it("offers the Add pane's own list on empty canvas, and no object actions", async () => {
  const opened = await openMenu({ target: NO_TARGET });

  // The pane's list, flattened — read from the owner rather than restated, so
  // a third copy of "what can be inserted" cannot take root here. The menu used
  // to hold exactly that: text and the four chart families, with no shapes and
  // no panel, which is a surface an author cannot insert half the things the
  // product offers.
  const expected = insertGroups().flatMap((group) => group.objects);
  expect(expected.length).toBeGreaterThan(0);
  expect(opened.labels).toEqual(expected.map((object) => object.label));

  // And in the pane's groups, so "Line" — a chart and a shape — is told apart
  // by the heading above it here as it is in the pane and the Insert menu.
  expect(opened.groupLabels).toEqual(
    insertGroups()
      .map((group) => group.label)
      .filter((label): label is string => label !== undefined),
  );

  // The registry is the object menu's owner: nothing from it may appear here.
  expect(opened.labels).not.toContain(uiCopy.actions.duplicate);
  expect(opened.setActiveObject).not.toHaveBeenCalled();
  await opened.close();
});

it("routes every creation entry through the façade the way its kind says", async () => {
  const opened = await openMenu({ target: NO_TARGET });

  /** The entry `label` under the heading `group`, which is what tells the two
   *  "Line"s apart. Addressing one by its label alone finds whichever came
   *  first — which is the ambiguity the headings exist to remove. */
  const inGroup = (group: string, label: string): HTMLElement | undefined => {
    const heading = Array.from(
      document.body.querySelectorAll<HTMLElement>(".editor-shell-menu-label"),
    ).find((element) => element.textContent === group);
    return Array.from(
      heading?.parentElement?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        [],
    ).find((item) => item.getAttribute("aria-label") === label);
  };

  const text = opened.items.find(
    (item) => item.getAttribute("aria-label") === uiCopy.panels.text,
  );
  text?.click();
  expect(opened.session.addText).toHaveBeenCalled();

  // The two the old menu could not name at all.
  inGroup(uiCopy.panels.shapes, uiCopy.shapeKinds.line)?.click();
  expect(opened.session.addShape).toHaveBeenCalledWith("line");
  inGroup(uiCopy.panels.charts, uiCopy.chartFamilies.line)?.click();
  expect(opened.session.addChart).toHaveBeenCalledWith("line");

  inGroup(uiCopy.panels.charts, uiCopy.chartFamilies.gauge)?.click();
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
