import {
  documentToViewport,
  type ArtboardTransform,
} from '@vigilia/renderer-core';
import type { Transform } from '@vigilia/renderer-core';
import { corners, type PlacedNode } from './geometry.js';
import {
  handleWorldDirection,
  placedHandlePosition,
  spreadHandlesBy,
  visibleResizeHandles,
  type Handle,
} from './transform-gesture.js';
import type { SnapGuide } from './snapping/resolver.js';

/**
 * Selection outlines, transform handles and snap guides, drawn over the scene.
 *
 * ## Why an overlay rather than decorating the nodes
 *
 * The renderer's elements belong to the renderer. Adding an outline to a node's
 * own element would change its layout (a border grows a box), leak editor state
 * into the display path, and put editor-only styling inside the thing that has
 * to look identical in the player. So the overlay is a separate, absolutely
 * positioned layer that never touches a node.
 *
 * ## Handles are drawn in viewport space, not artboard space
 *
 * A handle must be the same size on screen whatever the zoom — an 8 px grip
 * that becomes 2 px at 25 % is unusable. So node corners are converted from
 * document space through the artboard transform, and the handles are placed at
 * the resulting viewport positions with fixed pixel sizes. Everything else in
 * this project scales with the artboard; this is the one layer that must not.
 */

/** Sizes in viewport pixels, deliberately independent of zoom. */
const HANDLE_SIZE = 9;
const HANDLE_HIT_SIZE = 18;
const ROTATE_OFFSET = 26;

/** The eight resize handles, in a stable order. */
export const RESIZE_HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface OverlayElements {
  readonly root: HTMLElement;
  /** Redraws for the current selection. */
  update(input: OverlayInput): void;
  dispose(): void;
}

export interface OverlayInput {
  readonly transform: ArtboardTransform;
  /** Selected nodes, already placed in world space. */
  readonly selected: readonly PlacedNode[];
  /**
   * The single node whose handles are shown, if exactly one is selected.
   *
   * A placement, not a transform: a transform is in the node's PARENT space, so
   * using one here drew the handles of a grouped node near the artboard origin
   * while its outline — which already used the composed matrix — sat correctly
   * on the shape. The two must come from the same source.
   */
  readonly handlesFor: PlacedNode | undefined;
  readonly guides: readonly SnapGuide[];
  readonly artboard: { readonly width: number; readonly height: number };
  /** Marquee rectangle in viewport space, while dragging one. */
  readonly marquee: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined;
}

/** Creates the overlay layer inside `host`. */
export function createOverlay(host: HTMLElement): OverlayElements {
  const root = document.createElement('div');
  root.dataset['vigiliaOverlay'] = 'root';
  // `inset: 0` over the host, and never intercepting pointer events: the
  // gesture layer listens on the host, and an overlay that swallowed clicks
  // would make every node unselectable.
  root.style.cssText =
    'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5';
  host.append(root);

  return {
    root,

    update(input: OverlayInput): void {
      root.textContent = '';

      for (const guide of input.guides) {
        root.append(guideLine(guide, input.transform, input.artboard));
      }

      for (const node of input.selected) {
        root.append(outline(node, input.transform));
      }

      if (input.handlesFor !== undefined) {
        // Only the handles this box is big enough to tell apart on screen —
        // `visibleResizeHandles` explains why offering the rest was worse than
        // offering fewer. Document units scaled by the artboard transform give
        // the on-screen size the constant-size hit areas compete in.
        const scale = input.transform.scale;
        const handles = visibleResizeHandles(
          input.handlesFor.width * scale,
          input.handlesFor.height * scale,
          HANDLE_HIT_SIZE,
        );

        for (const handle of [...handles, 'rotate' as Handle]) {
          root.append(handleDot(input.handlesFor, handle, input.transform));
        }
      }

      if (input.marquee !== undefined) {
        root.append(marqueeBox(input.marquee));
      }
    },

    dispose(): void {
      root.remove();
    },
  };
}

/**
 * The outline of a selected node, as an SVG polygon.
 *
 * A polygon rather than a positioned div with a border, because a rotated node's
 * outline is not an axis-aligned rectangle. A div would need its own rotation to
 * match, which means duplicating the transform composition the geometry module
 * already does — and any disagreement shows up as an outline that does not sit
 * on the shape.
 */
function outline(node: PlacedNode, transform: ArtboardTransform): SVGSVGElement {
  const points = corners(node)
    .map((point) => documentToViewport(transform, point))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;overflow:visible;pointer-events:none');
  svg.dataset['vigiliaOverlay'] = 'outline';
  // `data-outline-for`, NOT `data-node-id`: that attribute means "this element
  // IS this node", and the renderer puts it on the node itself. Reusing it here
  // made every selected node match two elements, which broke the first browser
  // test that measured one after selecting it — and would have made any
  // node-id query in future code ambiguous in a way that is hard to notice.
  svg.dataset['outlineFor'] = node.id;

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', points);
  polygon.setAttribute('fill', 'none');
  // Accent via style, not a `stroke` attribute: presentation attributes do not
  // resolve `var()`, inline style does.
  polygon.style.stroke = 'var(--vigilia-accent)';
  // Constant on screen, like the handles: an outline that thins out as you zoom
  // in is harder to see exactly when precision matters most.
  polygon.setAttribute('stroke-width', '1.5');
  polygon.setAttribute('vector-effect', 'non-scaling-stroke');

  svg.append(polygon);

  return svg;
}

/** One handle, centred on its position and sized in viewport pixels. */
function handleDot(
  placed: PlacedNode,
  handle: Handle,
  transform: ArtboardTransform,
): HTMLElement {
  const world = placedHandlePosition(
    placed,
    handle,
    ROTATE_OFFSET / Math.max(transform.scale, 0.0001),
  );

  // Spread applied in VIEWPORT pixels, because the hit areas it is separating
  // are a constant size in viewport pixels — doing it in document units would
  // make the separation depend on zoom, which is the bug it exists to fix.
  const centreWorld = placedHandlePosition(placed, 'move');
  const viewport =
    handle === 'rotate'
      ? documentToViewport(transform, world)
      : spreadHandlesBy(
          documentToViewport(transform, world),
          documentToViewport(transform, centreWorld),
          handleWorldDirection(placed.matrix, handle),
          HANDLE_HIT_SIZE * 0.8,
        );

  const element = document.createElement('div');
  element.dataset['vigiliaHandle'] = handle;
  // The visible dot is HANDLE_SIZE; the element is larger so it is easy to
  // grab. A 9 px target is accurate with a mouse and hopeless with a trackpad.
  const size = handle === 'rotate' ? HANDLE_SIZE + 2 : HANDLE_SIZE;

  element.style.cssText = [
    'position:absolute',
    `left:${viewport.x - HANDLE_HIT_SIZE / 2}px`,
    `top:${viewport.y - HANDLE_HIT_SIZE / 2}px`,
    `width:${HANDLE_HIT_SIZE}px`,
    `height:${HANDLE_HIT_SIZE}px`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    // The hit area DOES take pointer events — it is the one part of the overlay
    // that must, or a handle could never be grabbed.
    'pointer-events:auto',
    `cursor:${cursorFor(handle)}`,
  ].join(';');

  const dot = document.createElement('div');
  dot.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    // Never the event target: the wrapper is the hit area, and the gesture
    // layer identifies a handle from the element it was pressed on.
    'pointer-events:none',
    'background:var(--vigilia-canvas-bg)',
    'border:1.5px solid var(--vigilia-accent)',
    handle === 'rotate' ? 'border-radius:50%' : 'border-radius:2px',
    'box-sizing:border-box',
  ].join(';');

  element.append(dot);

  return element;
}

/**
 * The cursor for a handle.
 *
 * Diagonal cursors are deliberately not rotated with the node: CSS has only
 * eight directional cursors, so a node at 20° has no correct one, and picking
 * the nearest makes the cursor flip unpredictably during a rotation. A
 * consistent-by-handle cursor is at least predictable.
 */
function cursorFor(handle: Handle): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'rotate':
      return 'grab';
    default:
      return 'move';
  }
}

/**
 * A snap guide, drawn across the artboard on the axis it aligned.
 *
 * Full-span rather than only between the two aligned edges. Spanning is less
 * precise but far easier to see, and the guide's job is to answer "what did I
 * just line up with" in the half second before the author releases the pointer.
 */
function guideLine(
  guide: SnapGuide,
  transform: ArtboardTransform,
  artboard: { readonly width: number; readonly height: number },
): HTMLElement {
  const element = document.createElement('div');
  element.dataset['vigiliaGuide'] = guide.axis;

  if (guide.axis === 'x') {
    const start = documentToViewport(transform, { x: guide.position, y: 0 });
    const end = documentToViewport(transform, { x: guide.position, y: artboard.height });

    element.style.cssText = [
      'position:absolute',
      `left:${start.x}px`,
      `top:${start.y}px`,
      'width:1px',
      `height:${end.y - start.y}px`,
      'background:var(--vigilia-guide)',
      'pointer-events:none',
    ].join(';');
  } else {
    const start = documentToViewport(transform, { x: 0, y: guide.position });
    const end = documentToViewport(transform, { x: artboard.width, y: guide.position });

    element.style.cssText = [
      'position:absolute',
      `left:${start.x}px`,
      `top:${start.y}px`,
      `width:${end.x - start.x}px`,
      'height:1px',
      'background:var(--vigilia-guide)',
      'pointer-events:none',
    ].join(';');
  }

  return element;
}

function marqueeBox(box: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): HTMLElement {
  const element = document.createElement('div');
  element.dataset['vigiliaOverlay'] = 'marquee';
  element.style.cssText = [
    'position:absolute',
    `left:${box.x}px`,
    `top:${box.y}px`,
    `width:${box.width}px`,
    `height:${box.height}px`,
    'border:1px solid var(--vigilia-accent)',
    'background:var(--vigilia-accent-dim)',
    'pointer-events:none',
  ].join(';');

  return element;
}
