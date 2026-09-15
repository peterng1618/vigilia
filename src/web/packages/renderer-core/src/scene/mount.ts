import * as echarts from 'echarts/core';
import { toEngineOption } from '../charts/engine-option.js';
import { computeArtboardTransform, toCssTransform, type ArtboardTransform } from '../artboard.js';
import type {
  PlanBox,
  PlanNode,
  PlanTextLayout,
  ResolvedStyle,
  ScenePlan,
} from './plan.js';

/** Legacy DOM ScenePlan applier. Rendering decisions belong in plan.ts. */

export interface SceneHandle {
  /** Renderer-owned artboard element; geometry consumers should use transform(). */
  readonly artboard: HTMLElement;
  readonly transform: () => ArtboardTransform;
  update(plan: ScenePlan): void;
  resize(): void;
  dispose(): void;
}

interface MountedChart {
  readonly element: HTMLElement;
  readonly chart: echarts.ECharts;
}

export interface MountOptions {
  readonly host: HTMLElement;
  readonly plan: ScenePlan;
  /** Network/runtime asset failures cannot be known by the pure plan. */
  readonly onAssetError?: (nodeId: string, src: string) => void;
}

export function mountScene(options: MountOptions): SceneHandle {
  const { host } = options;
  let plan = options.plan;

  host.textContent = '';
  host.style.overflow = 'hidden';

  // Preserve existing positioning; the host only needs to be non-static.
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }

  const artboard = document.createElement('div');
  artboard.dataset['vigilia'] = 'artboard';
  artboard.style.position = 'absolute';
  artboard.style.top = '0';
  artboard.style.left = '0';
  artboard.style.transformOrigin = '0 0';
  host.append(artboard);

  const charts = new Map<string, MountedChart>();
  const texts = new Map<string, HTMLElement>();
  const media = new Map<string, HTMLImageElement | HTMLVideoElement>();
  const elements = new Map<string, HTMLElement>();
  const applied = new Map<string, PlanNode>();

  for (const node of plan.nodes) {
    artboard.append(createNode(node, charts, texts, media, elements, options.onAssetError));
  }

  // Seed previous-plan state so the first update can skip unchanged writes.
  for (const node of walkPlan(plan.nodes)) {
    applied.set(node.id, node);
  }

  function applyArtboard(): ArtboardTransform {
    artboard.style.width = `${plan.artboard.width}px`;
    artboard.style.height = `${plan.artboard.height}px`;
    artboard.style.background = asCss(plan.artboard.background) ?? 'transparent';
    host.style.background = asCss(plan.artboard.barColor) ?? '#000';

    const transform = computeArtboardTransform({
      artboard: { width: plan.artboard.width, height: plan.artboard.height },
      viewport: { width: host.clientWidth, height: host.clientHeight },
      fitMode: plan.artboard.fitMode,
    });

    artboard.style.transform = toCssTransform(transform);
    artboard.style.visibility = transform.isDegenerate ? 'hidden' : 'visible';

    return transform;
  }

  let currentTransform = applyArtboard();

  /** Artboard size charts were last laid out against. */
  let chartArtboardSize = `${plan.artboard.width}x${plan.artboard.height}`;

  return {
    artboard,

    transform(): ArtboardTransform {
      return currentTransform;
    },

    update(next: ScenePlan): void {
      assertSameScene(plan, next);
      plan = next;
      currentTransform = applyArtboard();

      for (const node of walkPlan(next.nodes)) {
        updateNode(node, charts, texts, media, elements, applied);
      }
    },

    resize(): void {
      currentTransform = applyArtboard();

      // Viewport scaling is CSS-only; ECharts resize is needed only when the artboard size changes.
      const size = `${plan.artboard.width}x${plan.artboard.height}`;

      if (size === chartArtboardSize) {
        return;
      }

      chartArtboardSize = size;

      for (const { chart } of charts.values()) {
        chart.resize();
      }
    },

    dispose(): void {
      for (const { chart } of charts.values()) {
        chart.dispose();
      }
      charts.clear();
      texts.clear();
      media.clear();
      elements.clear();
      applied.clear();
      host.textContent = '';
    },
  };
}

/** Updates require the same node-id tree; document tree changes must remount. */
function assertSameScene(current: ScenePlan, next: ScenePlan): void {
  const currentIds = [...walkPlan(current.nodes)].map((node) => node.id).join(',');
  const nextIds = [...walkPlan(next.nodes)].map((node) => node.id).join(',');

  if (currentIds !== nextIds) {
    throw new Error(
      'This plan describes a different node tree. Dispose the scene and mount the new one — ' +
        'updates are for new data, not a new document.',
    );
  }
}

function* walkPlan(nodes: readonly PlanNode[]): Generator<PlanNode> {
  for (const node of nodes) {
    yield node;
    yield* walkPlan(node.children);
  }
}

function createNode(
  node: PlanNode,
  charts: Map<string, MountedChart>,
  texts: Map<string, HTMLElement>,
  media: Map<string, HTMLImageElement | HTMLVideoElement>,
  elements: Map<string, HTMLElement>,
  onAssetError: ((nodeId: string, src: string) => void) | undefined,
): HTMLElement {
  const element = document.createElement('div');
  element.dataset['nodeId'] = node.id;
  elements.set(node.id, element);
  element.style.position = 'absolute';
  applyBox(element, node.box);
  applyCommonStyle(element, node.style, node.content.kind === 'text' ? 'text' : 'box');

  switch (node.content.kind) {
    case 'group':
      for (const child of node.children) {
        element.append(createNode(child, charts, texts, media, elements, onAssetError));
      }
      break;

    case 'shape':
      if (node.content.shape === 'ellipse') {
        element.style.borderRadius = '50%';
      } else if (node.content.shape === 'rectangle' && node.content.cornerRadius > 0) {
        element.style.borderRadius = `${node.content.cornerRadius}px`;
      }
      break;

    case 'text': {
      // Outer flex box handles vertical alignment; inner block owns text overflow/wrapping.
      const inner = document.createElement('div');
      inner.dataset['vigiliaText'] = 'runs';
      inner.style.minWidth = '0';
      inner.style.maxWidth = '100%';
      element.append(inner);

      applyTextBox(element, node.content.layout);
      applyTextFlow(inner, node.content.layout);

      texts.set(node.id, inner);
      renderText(inner, node);
      break;
    }

    case 'chart': {
      const chart = echarts.init(element, undefined, { renderer: 'canvas' });
      charts.set(node.id, { element, chart });
      setChartOption(chart, node);
      break;
    }

    case 'image': {
      if (node.content.monochrome !== undefined) {
        // CSS mask uses source alpha to produce a predictable flat recolour.
        element.style.backgroundColor = node.content.monochrome;
        const size = node.content.fit === 'stretch' ? '100% 100%' : node.content.fit;
        if (node.content.src !== undefined) {
          const mask = `url("${encodeURI(node.content.src)}") center / ${size} no-repeat`;
          element.style.setProperty('mask', mask);
          element.style.setProperty('-webkit-mask', mask);
        }
        break;
      }

      const img = document.createElement('img');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = node.content.fit === 'stretch' ? 'fill' : node.content.fit;
      img.alt = '';

      const src = node.content.src;
      if (src !== undefined) {
        img.addEventListener('error', () => {
          img.style.display = 'none';
          element.dataset['assetError'] = src;
          onAssetError?.(node.id, src);
        });
        img.src = src;
      }
      media.set(node.id, img);
      element.append(img);
      break;
    }

    case 'video': {
      const video = document.createElement('video');
      video.style.width = '100%';
      video.style.height = '100%';
      video.loop = node.content.loop;
      video.muted = node.content.muted;
      video.autoplay = true;
      video.playsInline = true;
      if (node.content.src !== undefined) {
        video.src = node.content.src;
      }
      media.set(node.id, video);
      element.append(video);
      break;
    }
  }

  // Apply last because text layout also writes display:flex.
  applyVisibility(element, node);

  return element;
}

/** Visibility has one owner because visible text uses flex while other nodes use block. */
function applyVisibility(element: HTMLElement, node: PlanNode): void {
  element.style.display = node.visible
    ? node.content.kind === 'text'
      ? 'flex'
      : 'block'
    : 'none';
}

function updateNode(
  node: PlanNode,
  charts: Map<string, MountedChart>,
  texts: Map<string, HTMLElement>,
  media: Map<string, HTMLImageElement | HTMLVideoElement>,
  elements: Map<string, HTMLElement>,
  applied: Map<string, PlanNode>,
): void {
  const mounted = elements.get(node.id);
  const previous = applied.get(node.id);
  applied.set(node.id, node);

  if (mounted !== undefined) {
    if (previous === undefined || !sameBox(previous.box, node.box)) {
      applyBox(mounted, node.box);
    }

    // Plans rebuild style objects every frame, so compare fields rather than identity.
    if (previous === undefined || !sameStyle(previous.style, node.style)) {
      applyCommonStyle(mounted, node.style, node.content.kind === 'text' ? 'text' : 'box');
    }

    applyVisibility(mounted, node);
  }

  if (node.content.kind === 'text') {
    const element = texts.get(node.id);

    // Rebuilding unchanged spans is costly and can detach test/browser references mid-read.
    if (element !== undefined && (previous === undefined || !sameText(previous, node))) {
      renderText(element, node);
    }
    return;
  }

  if (node.content.kind === 'chart') {
    const mounted = charts.get(node.id);
    if (mounted !== undefined) {
      setChartOption(mounted.chart, node);
    }
    return;
  }

  if (node.content.kind === 'image' || node.content.kind === 'video') {
    const element = media.get(node.id);
    const src = node.content.src;
    // Reassigning the same src restarts video/GIF playback.
    if (element !== undefined && src !== undefined && element.src !== src) {
      element.src = src;
    }
  }
}

function setChartOption(chart: echarts.ECharts, node: PlanNode): void {
  if (node.content.kind !== 'chart') {
    return;
  }

  chart.setOption(toEngineOption(node.content.option));
}

function renderText(element: HTMLElement, node: PlanNode): void {
  if (node.content.kind !== 'text') {
    return;
  }

  element.textContent = '';

  for (const segment of node.content.segments) {
    const span = document.createElement('span');
    span.textContent = segment.text;

    if (segment.status !== undefined) {
      span.dataset['status'] = segment.status;
    }

    if (segment.message !== undefined) {
      span.title = segment.message;
    }

    applyCommonStyle(span, segment.style, 'text');
    element.append(span);
  }
}

/** Compares rendered text fields because segment/style identities change every plan build. */
function sameText(a: PlanNode, b: PlanNode): boolean {
  if (a.content.kind !== 'text' || b.content.kind !== 'text') {
    return false;
  }

  const before = a.content.segments;
  const after = b.content.segments;

  return (
    before.length === after.length &&
    before.every((segment, index) => {
      const other = after[index]!;

      return (
        segment.text === other.text &&
        segment.status === other.status &&
        segment.message === other.message &&
        sameStyle(segment.style, other.style)
      );
    })
  );
}

/** Shallow conservative comparison; object-valued styles intentionally count as changed. */
function sameStyle(a: ResolvedStyle, b: ResolvedStyle): boolean {
  const keys = Object.keys(a);

  return (
    keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
  );
}

function sameBox(a: PlanBox, b: PlanBox): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
}

function applyBox(element: HTMLElement, box: PlanBox): void {
  element.style.left = `${box.x}px`;
  element.style.top = `${box.y}px`;
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;

  const parts: string[] = [];
  if (box.rotation !== 0) {
    parts.push(`rotate(${box.rotation}deg)`);
  }
  if (box.scaleX !== 1 || box.scaleY !== 1) {
    parts.push(`scale(${box.scaleX}, ${box.scaleY})`);
  }

  if (parts.length > 0) {
    element.style.transform = parts.join(' ');
    element.style.transformOrigin = '50% 50%';
  } else {
    element.style.transform = '';
  }
}

/** Outer text box owns alignment and clipping, never visibility/display. */
function applyTextBox(element: HTMLElement, layout: PlanTextLayout): void {
  element.style.justifyContent =
    layout.align === 'center' ? 'center' : layout.align === 'right' ? 'flex-end' : 'flex-start';
  element.style.alignItems =
    layout.verticalAlign === 'middle'
      ? 'center'
      : layout.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start';

  element.style.overflow = layout.overflow === 'visible' ? 'visible' : 'hidden';
}

/** Inner text block owns wrapping, line alignment, and ellipsis. */
function applyTextFlow(element: HTMLElement, layout: PlanTextLayout): void {
  element.style.whiteSpace = layout.wrap ? 'pre-wrap' : 'pre';
  element.style.textAlign = layout.align;

  if (layout.overflow === 'visible') {
    return;
  }

  element.style.overflow = 'hidden';

  if (layout.overflow !== 'ellipsis') {
    return;
  }

  if (layout.wrap && layout.maxLines !== undefined) {
    element.style.display = '-webkit-box';
    element.style.setProperty('-webkit-box-orient', 'vertical');
    element.style.setProperty('-webkit-line-clamp', String(layout.maxLines));
    return;
  }

  element.style.whiteSpace = 'nowrap';
  element.style.textOverflow = 'ellipsis';
}

type PaintMode = 'box' | 'text';

/** Writes only declared style properties; box/text mode changes CSS semantics. */
function applyCommonStyle(element: HTMLElement, style: ResolvedStyle, mode: PaintMode): void {
  const fill = asCss(style['fill']);
  if (fill !== undefined) {
    if (mode === 'text') {
      element.style.color = fill;
    } else {
      element.style.background = fill;
    }
  }

  const color = asCss(style['color']);
  if (color !== undefined) {
    element.style.color = color;
  }

  const opacity = asNumber(style['opacity']);
  if (opacity !== undefined) {
    element.style.opacity = String(opacity);
  }

  applyOutline(element, style, mode);
  applyShadow(element, style, mode);

  const fontFamily = asCss(style['fontFamily']);
  if (fontFamily !== undefined) {
    element.style.fontFamily = fontFamily;
  }

  const fontSize = asNumber(style['fontSize']);
  if (fontSize !== undefined) {
    element.style.fontSize = `${fontSize}px`;
  }

  const fontWeight = style['fontWeight'];
  if (typeof fontWeight === 'number' || typeof fontWeight === 'string') {
    element.style.fontWeight = String(fontWeight);
  }

  const letterSpacing = asNumber(style['letterSpacing']);
  if (letterSpacing !== undefined) {
    element.style.letterSpacing = `${letterSpacing}px`;
  }

  const lineHeight = asNumber(style['lineHeight']);
  if (lineHeight !== undefined) {
    element.style.lineHeight = String(lineHeight);
  }

  if (style['tabularNumerals'] === true) {
    element.style.fontVariantNumeric = 'tabular-nums';
  }
}

/** Box outlines use borders; text outlines use a glyph stroke. */
function applyOutline(element: HTMLElement, style: ResolvedStyle, mode: PaintMode): void {
  const color = asCss(style['strokeColor']);
  const width = asNumber(style['strokeWidth']);

  if (color === undefined || width === undefined || width <= 0) {
    return;
  }

  if (mode === 'text') {
    element.style.setProperty('-webkit-text-stroke', `${width}px ${color}`);
    element.style.setProperty('paint-order', 'stroke fill');
    return;
  }

  const dash = style['strokeDash'];
  const dashed = dash === 'dashed' || dash === 'dotted';

  element.style.border = `${width}px ${dashed ? String(dash) : 'solid'} ${color}`;
  element.style.boxSizing = 'border-box';
}

/** Text and box shadows use different CSS properties; values remain in artboard units. */
function applyShadow(element: HTMLElement, style: ResolvedStyle, mode: PaintMode): void {
  const color = asCss(style['shadowColor']);

  if (color === undefined) {
    return;
  }

  const blur = asNumber(style['shadowBlur']) ?? 0;
  const offsetX = asNumber(style['shadowOffsetX']) ?? 0;
  const offsetY = asNumber(style['shadowOffsetY']) ?? 0;

  const shadow = `${offsetX}px ${offsetY}px ${Math.max(0, blur)}px ${color}`;

  if (mode === 'text') {
    element.style.textShadow = shadow;
    return;
  }

  element.style.boxShadow = shadow;
}

function asCss(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
