// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { accessibleName } from "../../accessible-name.js";
import type { EditorShellBridge } from "../../editor-shell/bridge.js";
import { CanvasDock } from "../../editor-shell/canvas-dock.js";
import { Glyph, PENCIL_GLYPH, STACK_GLYPH } from "../../editor-shell/icons.js";
import { LayerActions } from "../../editor-shell/layer-panel.js";
import type { LayerRow } from "../../editor-shell/layer-tree.js";
import { Pane } from "../../editor-shell/pane.js";
import { Rail } from "../../editor-shell/rail.js";
import { catalogFaces, fontTrios } from "../../font-catalog.js";
import { FontPicker } from "../../font-picker/font-picker.js";
import { createSpecimenCache } from "../../font-specimen-cache.js";
import { CompositionPane } from "../../panes/composition/composition-pane.js";
import { ControlIconButton } from "./control-icon-button.js";
import { GradientEditor } from "./gradient-editor.js";

// Base UI's popups need three browser APIs jsdom has none of — the same three
// `control.dom.test.tsx` supplies for the same reason — plus the switch's
// `PointerEvent` re-dispatch. FontPicker, mounted below, carries the selects.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * An icon-only control's name and its tooltip are one string, by construction
 * rather than by hand.
 *
 * DESIGN.md §6 makes it a defect for a glyph button's tooltip and accessible name to
 * disagree, and §6 rule 2 says the tooltip **is** the label. The defect this
 * file catches is a call site that wires the two by hand, so the assertions run
 * over **mounted surfaces** rather than over `ControlIconButton` alone — a sweep
 * of the component would say nothing about the dock, the rail or a layer row,
 * each of which draws its own button. They are driven the way a person reaches
 * them: focus, which opens a popup immediately, where hover waits out
 * `tooltip.ts`'s 220ms.
 *
 * The surfaces mounted here are the ones the census found carrying an icon-only
 * control: the rail and its gear, the canvas dock's two halves, a pane's footer
 * with the Composition tree in its body, and the font picker's trio list. A
 * surface that is not mounted is not audited — the same limit, and the same
 * stated contract, as `accessible-names.dom.test.ts`'s `mountPanels`.
 */

/**
 * The controls a person can reach, which is the audit's premise — the same two
 * exclusions `accessible-names.dom.test.ts` makes, for the same reasons:
 * `[hidden]` is `display: none` and a browser puts no such element in the
 * accessibility tree, and `aria-hidden` is Base UI's value carrier behind a
 * styled control.
 */
const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";

const reached = (element: HTMLElement): boolean =>
  !element.hidden && element.getAttribute("aria-hidden") !== "true";

/**
 * The words a control shows, which is its own text minus everything an SVG
 * carries.
 *
 * A `<title>` inside a glyph is the *picture's* own name, drawn for an
 * assistive reader rather than for the eye, so it does not make the button a
 * visible-text control: an `<svg>`-only button stays in the icon-only census
 * with or without one. `textContent` would read it as a word.
 */
function visibleText(control: Element): string {
  const clone = control.cloneNode(true) as Element;
  for (const svg of Array.from(clone.querySelectorAll("svg"))) svg.remove();
  return clone.textContent?.trim() ?? "";
}

/**
 * §6's icon-only control: a focusable thing whose whole content is a glyph and
 * which shows no word of its own.
 *
 * The `svg` clause draws that line. Drop it and the population grows by the
 * glyphless controls whose content carries no text at all — measured over the
 * fleet below, two `<input>`s and four `<button>`s — because a field's *value*
 * is not `textContent` and an empty field has none. A `<select>` or `<textarea>`
 * is caught before the clause is reached: its own content is not empty. Those
 * are the controls the clause exists to exclude; a glyph is what makes a control
 * icon-only, not the mere absence of a word.
 *
 * **Not every control with no text is one.** The gradient editor's stop dots
 * are focusable, carry an accessible name and draw no word — and they are drag
 * handles on a track, not glyph buttons, so §6 rule 1 does not reach them and
 * neither does this census. They *are* mounted in the fleet below; the clause
 * is why they are not counted. A glyph is what makes a control icon-only; the
 * dots draw none, and rule 2's tooltip there would be a box opening in the
 * middle of the drag it exists to serve. That ruling is recorded with this file.
 */
function iconOnly(scope: ParentNode): readonly HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(reached)
    .filter((control) => visibleText(control) === "")
    .filter((control) => control.querySelector("svg") !== null);
}

/**
 * The popup a control shows when a person reaches it, or null for none.
 *
 * Only one tooltip is open at a time — `tooltip.ts` destroys the open one before
 * showing the next — and the popup is portalled to `body`, so this reads the
 * document rather than the mounted tree.
 *
 * The `pointerdown` is the dismissal a person's move from the last control
 * would make, and it is not decoration: dispatching `focus` alone leaves the
 * previous popup in the document, so the next control — one with no tooltip of
 * its own — reads *that* popup and looks like it has one. Without it the census
 * below counts only the controls before the first popup and reports 0 whatever
 * the population.
 */
function tooltipFor(control: HTMLElement): HTMLElement | null {
  act(() => {
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    control.dispatchEvent(new Event("focus"));
  });
  return document.querySelector<HTMLElement>(".editor-shell-tooltip");
}

/**
 * The tooltip's action label: the words it states, without the shortcut chip
 * that sits beside them.
 *
 * Read exactly, with no trimming and no substring matching, so `"Delete extra"`
 * and `"Delete "` both fail equality to `"Delete"` — the equality is the whole
 * of the rule, and a `contains` here would pass on the drift it exists to catch.
 */
function tooltipActionText(popup: Element): string {
  for (const child of Array.from(popup.children)) {
    if (!child.classList.contains("editor-shell-tooltip-key")) {
      return child.textContent ?? "";
    }
  }
  return "";
}

/** The icon-only controls of the mounted fleet that show no tooltip at all. */
function noTooltip(scope: ParentNode): readonly HTMLElement[] {
  return iconOnly(scope).filter((control) => tooltipFor(control) === null);
}

let roots: Root[] = [];
let host: HTMLElement | undefined;

afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots = [];
  host?.remove();
  host = undefined;
  // The popups are portalled here, and nothing else this file mounts is.
  document.body.replaceChildren();
});

describe("an icon-only control's name and its tooltip", () => {
  it("gives every icon-only control one string for its name and its tooltip", () => {
    const controls = iconOnly(mountFleet());
    // A sweep that mounted nothing would satisfy the loop by never entering it.
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const popup = tooltipFor(control);
      expect(accessibleName(control)).not.toBe("");
      expect(popup).not.toBeNull();
      expect(tooltipActionText(popup!)).toBe(accessibleName(control));
    }
  });

  it("says how many icon-only controls carry no tooltip at all", () => {
    // **Not an assertion of a rule; the record.** §6 rule 1 decides per glyph,
    // so the number is whatever the adjudication settled, and this case exists
    // so it cannot change unnoticed. It is read over the whole mounted tree
    // rather than over `reachable`, because the first case is about what a
    // person can reach and this one is about everything the fleet rendered.
    //
    // **Settled at 0, from the census's 4.** Three of the four gained the
    // tooltip that is their label, each through the control set's one owner of
    // the pairing: the font picker's favourite `Star` (§6 rule 1's first clause
    // — a star is unambiguous, so the glyph may replace the word), the tree's
    // twisty, and its group-entry button (the same clause, where the door glyph
    // is made unambiguous *by* the tooltip — rule 1's middle clause at work).
    // The fourth, the gradient editor's stop dots, is mounted in the fleet
    // below and carries no tooltip **by ruling**: a drag handle is not a glyph,
    // so rule 1 never applied to it. What keeps it out of the count is the
    // glyph clause in `iconOnly`, and that the clause is *live* is the number
    // this case measures the moment it is deleted — with the clause gone the
    // fleet reports **6** (the two stop dots, the two colour-picker triggers,
    // the font picker's search field and its favourites-only checkbox), where
    // before the dots were mounted the same deletion still reported 0. The
    // number is 0 because no icon-only control is left without the tooltip that
    // is its name — a fifth one written tomorrow makes it 1 and lands here.
    expect(noTooltip(mountFleet()).length).toBe(0);
  });

  it("is one string where a surface draws its own button, not the component", () => {
    // The dock, the rail, a layer row and the font picker each render a bare
    // `<button>` rather than `ControlIconButton`: a dock action is a glass
    // control of its own size, a rail slot carries `aria-pressed`, a row
    // control sits directly in `.vigilia-layer-state` so the stylesheet can ask
    // the slot how much room beside the key it needs, and the star's label
    // changes with its pressed state. All take the same owner of the pairing,
    // and one of each is named here so a bespoke button cannot quietly stop at
    // two strings while the fleet case stays green over controls that never
    // reach it.
    const mounted = mountFleet();
    const bespoke = [
      "[data-rail-slot]",
      "[data-vigilia-canvas-toolbar] button",
      "[data-vigilia-layer-entry]",
      "[data-vigilia-font-favorite]",
    ];
    for (const selector of bespoke) {
      const control = mounted.querySelector<HTMLElement>(selector);
      expect(control).not.toBeNull();
      const popup = tooltipFor(control!);
      expect(popup).not.toBeNull();
      expect(tooltipActionText(popup!)).toBe(accessibleName(control!));
    }
  });
});

describe("the control set's own icon button", () => {
  it("mounts the tooltip that is its label", () => {
    const container = mount(
      <ControlIconButton label="Delete layer" onClick={vi.fn()}>
        <Glyph icon={PENCIL_GLYPH} size={15} />
      </ControlIconButton>,
    );
    const button = container.querySelector("button")!;
    expect(tooltipActionText(tooltipFor(button)!)).toBe("Delete layer");
  });
});

/** Mounts one node into a fresh host, for the single-control case above. */
function mount(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(node));
  return container;
}

/**
 * The fleet: every surface the census found carrying an icon-only control,
 * mounted together so a call site wired by hand is caught by the same sweep
 * that catches a converted one.
 */
function mountFleet(): HTMLElement {
  const mounted = document.createElement("div");
  document.body.append(mounted);
  host = mounted;
  const root = createRoot(mounted);
  roots.push(root);
  const bridge = treeBridge();
  act(() => {
    root.render(
      <>
        <Rail
          slot="composition"
          collapsed={false}
          onChoose={vi.fn()}
          onOpenSettings={vi.fn()}
        />
        <CanvasDock bridge={dockBridge()} />
        <Pane
          id="layers"
          title="Layers"
          icon={STACK_GLYPH}
          footer={<LayerActions bridge={bridge} />}
        >
          <CompositionPane bridge={bridge} />
        </Pane>
        <FontPicker
          trios={fontTrios()}
          faces={catalogFaces()}
          favorites={[]}
          cache={createSpecimenCache({
            fetch: vi.fn(
              async () => new Response(new Uint8Array([0]), { status: 200 }),
            ),
            createFontFace: vi.fn(() => ({
              load: vi.fn(async () => undefined),
            })),
            fonts: { add: vi.fn(), delete: vi.fn() },
          })}
          onApplyTrio={vi.fn()}
          onApplyFace={vi.fn()}
          onToggleFavorite={vi.fn()}
        />
        <GradientEditor
          // Two stops, so the census has two handles to exclude rather than
          // one. `hsl()` and not a hex: this file is under the design ratchet,
          // which refuses a hex literal wherever a token belongs.
          stops={[
            { offset: 0, color: "hsl(0, 0%, 0%)" },
            { offset: 1, color: "hsl(0, 0%, 100%)" },
          ]}
          angle={90}
          onChange={vi.fn()}
          label="Palette gradient"
        />
      </>,
    );
  });
  return mounted;
}

/** The dock's bridge: one object selected, so both halves render — the object
 *  half filtered in, the arrange half greyed. */
function dockBridge(): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    target: () => ({
      kind: "object",
      locked: false,
      memberCount: 1,
      isGroup: false,
    }),
    canArrange: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
  } as unknown as EditorShellBridge;
}

/** A selected, expandable group: the one row that draws all four of the tree's
 *  own controls — the twisty, the way in, and `RowAffordances`' three. */
const GROUP_ROW: LayerRow = {
  id: "group",
  name: "Group",
  kind: "group",
  mark: { kind: "group" },
  role: { kind: "group", unit: undefined },
  bound: [],
  depth: 0,
  parentId: undefined,
  hasChildren: true,
  collapsed: false,
  visible: true,
  locked: false,
  selected: true,
};

/** The tree's bridge, with the one row above and every write it can make. */
function treeBridge(): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 1, locked: false, activeKind: "object" }),
    target: () => ({
      kind: "object",
      locked: false,
      memberCount: 1,
      isGroup: false,
    }),
    canArrange: () => false,
    layers: () => [GROUP_ROW],
    groupContext: () => [],
    selectLayer: vi.fn(),
    enterGroup: vi.fn(),
    exitGroup: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    renameLayer: vi.fn(),
    setCollapsed: vi.fn(),
    layerDrop: () => undefined,
    moveLayer: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
  } as unknown as EditorShellBridge;
}
