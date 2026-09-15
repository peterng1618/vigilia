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

/** Legacy editor overlay. Handles stay viewport-sized instead of scaling with the artboard. */

const HANDLE_SIZE = 9;
const HANDLE_HIT_SIZE = 18;
const ROTATE_OFFSET = 26;

export const RESIZE_HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface OverlayElements {
  readonly root: HTMLElement;
  update(input: OverlayInput): void;
  dispose(): void;
}

export interface OverlayInput {
  readonly transform: ArtboardTransform;
  readonly selected: readonly PlacedNode[];
  /** Composed placement, not raw parent-local transform. */
  readonly handlesFor: PlacedNode | undefined;
  readonly guides: readonly SnapGuide[];
  readonly artboard: { readonly width: number; readonly height: number };
  readonly marquee: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined;
}

export function createOverlay(host: HTMLElement): OverlayElements {
  const root = document.createElement('div');
  root.dataset['vigiliaOverlay'] = 'root';
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

/** Rotated selection outline from the same composed geometry used by interaction. */
function outline(node: PlacedNode, transform: ArtboardTransform): SVGSVGElement {
  const points = corners(node)
    .map((point) => documentToViewport(transform, point))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;overflow:visible;pointer-events:none');
  svg.dataset['vigiliaOverlay'] = 'outline';
  // Do not reuse renderer `data-node-id`; this element is decoration, not the node.
  svg.dataset['outlineFor'] = node.id;

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', points);
  polygon.setAttribute('fill', 'none');
  polygon.style.stroke = 'var(--vigilia-accent)';
  polygon.setAttribute('stroke-width', '1.5');
  polygon.setAttribute('vector-effect', 'non-scaling-stroke');

  svg.append(polygon);

  return svg;
}

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

  // Spread in viewport pixels because handle hit areas are viewport-sized.
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
    'pointer-events:auto',
    `cursor:${cursorFor(handle)}`,
  ].join(';');

  const dot = document.createElement('div');
  dot.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    'pointer-events:none',
    'background:var(--vigilia-canvas-bg)',
    'border:1.5px solid var(--vigilia-accent)',
    handle === 'rotate' ? 'border-radius:50%' : 'border-radius:2px',
    'box-sizing:border-box',
  ].join(';');

  element.append(dot);

  return element;
}

/** CSS offers only fixed directional cursors; keep them stable instead of approximating rotation. */
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

/** Draw a full-artboard snap guide on the aligned axis. */
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
