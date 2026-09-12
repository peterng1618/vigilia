import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { computeArtboardTransform, toCssTransform } from '../artboard.js';
import type {
  PlanBox,
  PlanNode,
  PlanTextLayout,
  ResolvedStyle,
  ScenePlan,
} from './plan.js';

/**
 * Applies a {@link ScenePlan} to the DOM.
 *
 * This layer decides **nothing**. Every value it writes was computed by
 * `plan.ts`, which is pure and unit-tested; anything here that started making
 * choices would be untestable without a browser, which is exactly the split
 * this file exists to preserve.
 *
 * ## Mount once, then update
 *
 * The design document requires charts to update "without recreating the scene".
 * {@link mountScene} builds the element tree once and returns a handle;
 * {@link SceneHandle.update} then writes new text and calls `setOption` on
 * existing chart instances. Nothing is recreated per frame, so ECharts keeps its
 * own animation state and the browser keeps its layout.
 *
 * A plan whose node **ids** differ from the mounted tree is a different scene —
 * the handle rejects it rather than guessing, because reconciling an arbitrary
 * tree diff is the editor's job and doing it implicitly here would hide theme
 * switches that should reload.
 *
 * ## One transform for everything (§51)
 *
 * The artboard element carries a single CSS transform. Nothing inside it is
 * scaled individually, so strokes, glyphs and shadows all scale together and no
 * element reflows (§57).
 */

/** The chart types the caller must register with ECharts before mounting. */
export interface SceneHandle {
  /** The artboard element. Positioned and scaled; do not restyle it. */
  readonly artboard: HTMLElement;
  /** Applies a new plan for the same scene. */
  update(plan: ScenePlan): void;
  /** Recomputes the artboard transform for the host's current size. */
  resize(): void;
  /** Disposes chart instances and empties the host. */
  dispose(): void;
}

interface MountedChart {
  readonly element: HTMLElement;
  readonly chart: echarts.ECharts;
}

export interface MountOptions {
  /** Where the scene is mounted. Emptied first. */
  readonly host: HTMLElement;
  readonly plan: ScenePlan;
  /**
   * Renderer for chart elements. Canvas is the default; SVG trades draw speed
   * for crisper scaling and is worth measuring on the reference phone (§157).
   */
  readonly chartRenderer?: 'canvas' | 'svg';
}

export function mountScene(options: MountOptions): SceneHandle {
  const { host } = options;
  let plan = options.plan;

  host.textContent = '';
  // The host clips the artboard: in `cover` mode the scaled design is larger
  // than the viewport by design, and without this it would spill onto the page.
  host.style.overflow = 'hidden';

  // Only when the host is not already positioned. Writing `relative`
  // unconditionally overrode a host styled `position: absolute; inset: 0`,
  // which dropped it out of that layout and collapsed its height to zero — its
  // only child being absolutely positioned. The transform then correctly
  // reported a degenerate viewport and hid the whole scene. The artboard needs
  // *a* positioned ancestor, not a specific one.
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }

  const artboard = document.createElement('div');
  artboard.dataset['vigilia'] = 'artboard';
  artboard.style.position = 'absolute';
  artboard.style.top = '0';
  artboard.style.left = '0';
  // Transform from the top-left, so the computed offsets mean what they say.
  artboard.style.transformOrigin = '0 0';
  host.append(artboard);

  const charts = new Map<string, MountedChart>();
  const texts = new Map<string, HTMLElement>();
  const media = new Map<string, HTMLImageElement | HTMLVideoElement>();

  for (const node of plan.nodes) {
    artboard.append(createNode(node, charts, texts, media, options.chartRenderer ?? 'canvas'));
  }

  function applyArtboard(): void {
    artboard.style.width = `${plan.artboard.width}px`;
    artboard.style.height = `${plan.artboard.height}px`;
    artboard.style.background = asCss(plan.artboard.background) ?? 'transparent';

    // §53: the bars are the host's background, not the artboard's — they are
    // what shows where the design is not.
    host.style.background = asCss(plan.artboard.barColor) ?? '#000';

    const transform = computeArtboardTransform({
      artboard: { width: plan.artboard.width, height: plan.artboard.height },
      viewport: { width: host.clientWidth, height: host.clientHeight },
      fitMode: plan.artboard.fitMode,
    });

    artboard.style.transform = toCssTransform(transform);
    // A degenerate transform means no visible area — a hidden element or a phone
    // mid-rotation. Nothing to draw, and charts must not be resized to zero.
    artboard.style.visibility = transform.isDegenerate ? 'hidden' : 'visible';
  }

  applyArtboard();

  return {
    artboard,

    update(next: ScenePlan): void {
      assertSameScene(plan, next);
      plan = next;
      applyArtboard();

      for (const node of walkPlan(next.nodes)) {
        updateNode(node, charts, texts, media);
      }
    },

    resize(): void {
      applyArtboard();
      // Chart elements have fixed artboard-pixel sizes, so their own canvas size
      // never changes with the viewport — the artboard transform scales them.
      // This exists for the case where the artboard itself changed size.
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
      host.textContent = '';
    },
  };
}

/**
 * Refuses a plan that describes a different scene.
 *
 * Silently re-mounting would make a theme switch look like an update and lose
 * whatever the caller wanted to do about it (a fade, a reload, a diagnostic).
 */
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
  chartRenderer: 'canvas' | 'svg',
): HTMLElement {
  const element = document.createElement('div');
  element.dataset['nodeId'] = node.id;
  element.style.position = 'absolute';
  applyBox(element, node.box);
  applyCommonStyle(element, node.style);
  element.style.display = node.visible ? 'block' : 'none';

  switch (node.content.kind) {
    case 'group':
      for (const child of node.children) {
        element.append(createNode(child, charts, texts, media, chartRenderer));
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
      // Two levels, because one cannot do both jobs: the outer element is a
      // flex container for vertical alignment, and `text-overflow: ellipsis`
      // does not apply to a flex container — so the text itself lives in an
      // inner block that owns wrapping, alignment and overflow.
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
      const chart = echarts.init(element, undefined, { renderer: chartRenderer });
      charts.set(node.id, { element, chart });
      setChartOption(chart, node);
      break;
    }

    case 'image': {
      const img = document.createElement('img');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = node.content.fit === 'stretch' ? 'fill' : node.content.fit;
      if (node.content.src !== undefined) {
        img.src = node.content.src;
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
      // Autoplay is only permitted while muted, and a dashboard has no
      // interaction to unmute with, so an unmuted video would simply not start.
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

  return element;
}

function updateNode(
  node: PlanNode,
  charts: Map<string, MountedChart>,
  texts: Map<string, HTMLElement>,
  media: Map<string, HTMLImageElement | HTMLVideoElement>,
): void {
  if (node.content.kind === 'text') {
    const element = texts.get(node.id);
    if (element !== undefined) {
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
    // Reassigning the same src restarts a video and re-decodes a GIF, so only
    // write it when it actually changed.
    if (element !== undefined && src !== undefined && element.src !== src) {
      element.src = src;
    }
  }
}

function setChartOption(chart: echarts.ECharts, node: PlanNode): void {
  if (node.content.kind !== 'chart') {
    return;
  }

  // The single engine boundary (§87). The plan's option types are our own
  // reviewable shapes, and ECharts' option type is an open index-signature
  // record, so the two are structurally incompatible by design. Cast exactly
  // here and nowhere else — a cast in feature code means the typed-settings
  // boundary has been breached.
  chart.setOption(node.content.option as unknown as EChartsCoreOption);
}

function renderText(element: HTMLElement, node: PlanNode): void {
  if (node.content.kind !== 'text') {
    return;
  }

  // §91: a native text overlay is acceptable, a bitmap label never is. These are
  // real spans, so they inherit font loading, ligatures and text rendering.
  element.textContent = '';

  for (const segment of node.content.segments) {
    const span = document.createElement('span');
    span.textContent = segment.text;

    if (segment.status !== undefined) {
      // Exposed as a data attribute so a theme can style a stale or failed
      // reading differently, without this layer deciding what that looks like.
      span.dataset['status'] = segment.status;
    }

    if (segment.message !== undefined) {
      // Already redacted upstream (§101) — the sample carries no secrets.
      span.title = segment.message;
    }

    applyCommonStyle(span, segment.style);
    element.append(span);
  }
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
    // Rotate about the element's own centre, which is what a designer means by
    // rotation; the default origin would swing the element around its corner.
    element.style.transformOrigin = '50% 50%';
  }
}

/** The outer box: alignment within the authored rectangle. */
function applyTextBox(element: HTMLElement, layout: PlanTextLayout): void {
  element.style.display = 'flex';
  element.style.justifyContent =
    layout.align === 'center' ? 'center' : layout.align === 'right' ? 'flex-end' : 'flex-start';
  element.style.alignItems =
    layout.verticalAlign === 'middle'
      ? 'center'
      : layout.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start';

  // `visible` is the one overflow mode that must not clip. The other two both
  // need the box to clip; which of them applies is decided on the inner block.
  element.style.overflow = layout.overflow === 'visible' ? 'visible' : 'hidden';
}

/** The inner block: wrapping, alignment of wrapped lines, and overflow. */
function applyTextFlow(element: HTMLElement, layout: PlanTextLayout): void {
  // `pre-wrap` and `pre` both preserve authored spacing, which matters because
  // runs are concatenated and a theme may space them deliberately.
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
    // A line clamp is the only thing that ellipsises WRAPPED text;
    // `text-overflow` applies to a single line only. The line count comes from
    // the plan, which computed it from the box and the resolved type size.
    element.style.display = '-webkit-box';
    element.style.setProperty('-webkit-box-orient', 'vertical');
    element.style.setProperty('-webkit-line-clamp', String(layout.maxLines));
    return;
  }

  // Single-line ellipsis. Also the fallback when the type size was not
  // resolvable, because a wrong clamp hides text that would have fitted.
  element.style.whiteSpace = 'nowrap';
  element.style.textOverflow = 'ellipsis';
}

// Font availability diagnostics live in `fonts.ts`, because the collection half
// is pure and testable and only the measuring needs a browser.

/**
 * Writes the style properties this renderer understands.
 *
 * Deliberately a fixed list rather than a pass-through of every key onto
 * `element.style`: the theme format owns its property names, and letting
 * arbitrary keys reach CSS would make the document format depend on whatever
 * the browser happens to accept. Unknown properties are ignored here and
 * reported by the validator, not applied.
 */
function applyCommonStyle(element: HTMLElement, style: ResolvedStyle): void {
  const fill = asCss(style['fill']);
  if (fill !== undefined) {
    // A span takes a fill as its text colour; a box takes it as a background.
    if (element.tagName === 'SPAN') {
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

  const strokeColor = asCss(style['strokeColor']);
  const strokeWidth = asNumber(style['strokeWidth']);
  if (strokeColor !== undefined && strokeWidth !== undefined && strokeWidth > 0) {
    element.style.border = `${strokeWidth}px solid ${strokeColor}`;
    // Keep the authored box the outer box: a border would otherwise grow the
    // element beyond the geometry the artboard laid out.
    element.style.boxSizing = 'border-box';
  }

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

  // Alignment is deliberately NOT here. It is layout, it comes from the
  // document's TextContent rather than its style map, and it is applied by
  // applyTextBox/applyTextFlow — which also need it to agree with wrapping and
  // overflow. Two places writing justifyContent would fight.

  const tabularNumerals = style['tabularNumerals'];
  if (tabularNumerals === true) {
    // §89: tabular figures "where the font supports them". A font without them
    // ignores this, which is the correct degradation — nothing is substituted.
    element.style.fontVariantNumeric = 'tabular-nums';
  }
}

function asCss(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
