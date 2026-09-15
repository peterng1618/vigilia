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
  /**
   * The current document→viewport mapping.
   *
   * Exposed for the editor, which has to place selection outlines and handles
   * over the scene and therefore needs the same scale and offset the artboard
   * is using. Recomputing it from the host's size would work until the two
   * disagreed by a pixel, which is exactly the bug that is hardest to see and
   * most annoying to use.
   */
  transform(): ArtboardTransform;
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
   * Called when an asset resolves to a URL that then fails to load.
   *
   * This cannot be a plan issue, which was not obvious until a fixture proved
   * it: a *declared* asset with a valid path always resolves, so
   * `unresolved-asset` only fires when nothing is declared or the path is
   * unsafe. "Declared in the document but absent from the package" is a fact
   * only the network knows, and only this layer hears about it.
   */
  readonly onAssetError?: (nodeId: string, src: string) => void;
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
  // Every node's own element, so an update can reach it without a DOM query.
  const elements = new Map<string, HTMLElement>();
  // The plan node last written to the DOM, per id. Used to skip work when
  // nothing about a node changed — see `updateNode`.
  const applied = new Map<string, PlanNode>();

  for (const node of plan.nodes) {
    artboard.append(
      createNode(
        node,
        charts,
        texts,
        media,
        elements,
        options.chartRenderer ?? 'canvas',
        options.onAssetError,
      ),
    );
  }

  function applyArtboard(): ArtboardTransform {
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

    return transform;
  }

  let currentTransform = applyArtboard();

  /** The artboard size the charts were last laid out for. See `resize`. */
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

      // Chart elements have fixed artboard-pixel sizes, so their own canvas
      // size never changes with the viewport — the artboard transform scales
      // them. Only a change to the artboard's OWN size needs to reach the
      // engine.
      //
      // Guarded, not unconditional, because `chart.resize()` interrupts a
      // running animation: ECharts re-lays out and jumps to the current target.
      // Resizing on every call made the player's appear animation vanish the
      // moment a ResizeObserver was used to drive re-fitting, because an
      // observer delivers one callback when observation begins — a "resize" to
      // the size the chart was already built at. Two browser tests caught it.
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
  elements: Map<string, HTMLElement>,
  chartRenderer: 'canvas' | 'svg',
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
        element.append(
          createNode(child, charts, texts, media, elements, chartRenderer, onAssetError),
        );
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
      if (node.content.monochrome !== undefined) {
        // §111's monochrome recolouring. A CSS mask rather than a filter: a
        // filter would tint whatever colours the artwork already has, while a
        // mask uses only its alpha, so the result is one flat colour regardless
        // of the source. That is what "monochrome" has to mean for it to be
        // predictable across a photo, a flat icon and a gradient.
        //
        // The trade-off is real and is why this is opt-in: the original's
        // colours are discarded entirely, and §111 requires multicolour
        // originals to survive unless the author asks for this.
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
      // An asset is decorative here: the document has no alt-text field, and
      // inventing one from a node name would put a designer's layer label into
      // the accessibility tree.
      img.alt = '';

      const src = node.content.src;
      if (src !== undefined) {
        // A file declared by the document but absent from the package would
        // otherwise draw the browser's broken-image glyph, which reads as a
        // rendering failure rather than a missing file. Hide it and report.
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

  // Visibility LAST, and never before the content switch. A text node's box is
  // laid out with `display: flex` for alignment, and setting visibility first
  // meant that flex overwrote `display: none` — a node marked
  // `"visible": false` rendered anyway. Found by a stress fixture that carried
  // a hidden element saying so.
  applyVisibility(element, node);

  return element;
}

/**
 * Shows or hides a node.
 *
 * `display` rather than `visibility`, because a hidden node must take no space
 * and receive no hit-testing — and the value when visible depends on the
 * content, so this cannot be a constant.
 */
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
    // A later plan can change visibility, geometry or style — `assertSameScene`
    // only pins node *ids*, so everything else about a node is fair game for an
    // update.
    //
    // Geometry and style were originally applied at mount only, on the
    // assumption that an update carries new DATA and nothing else. That holds
    // for the player, whose layout never changes, and it is wrong the moment an
    // editor moves something: the document changed, the plan changed, and the
    // element stayed exactly where it was. Found by the first editor drag.
    //
    // Guarded by a comparison so the player's 1 Hz tick still writes nothing:
    // the plan rebuilds these objects every frame, so identity says nothing and
    // the fields have to be compared.
    if (previous === undefined || !sameBox(previous.box, node.box)) {
      applyBox(mounted, node.box);
    }

    if (previous === undefined || previous.style !== node.style) {
      applyCommonStyle(mounted, node.style, node.content.kind === 'text' ? 'text' : 'box');
    }

    applyVisibility(mounted, node);
  }

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

  // The single engine boundary (§87), and it is now owned by
  // `charts/engine-option.ts` rather than written inline here: the Fabric
  // renderer needs the identical crossing, and two copies of a cast is how a
  // boundary turns into a habit.
  chart.setOption(toEngineOption(node.content.option));
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

    applyCommonStyle(span, segment.style, 'text');
    element.append(span);
  }
}

/** Field-by-field, because the plan builds a fresh box object every frame. */
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
    // Rotate about the element's own centre, which is what a designer means by
    // rotation; the default origin would swing the element around its corner.
    element.style.transformOrigin = '50% 50%';
  } else {
    // Cleared explicitly. On an update this function may be re-applying a box
    // that no longer rotates, and leaving the previous transform in place would
    // keep a node visibly rotated after the author set it back to zero.
    element.style.transform = '';
  }
}

/**
 * The outer box: alignment within the authored rectangle.
 *
 * Deliberately does NOT set `display`. That belongs to
 * {@link applyVisibility}, which is the only place allowed to write it —
 * two writers is how a hidden node became visible.
 */
function applyTextBox(element: HTMLElement, layout: PlanTextLayout): void {
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
 * Whether an element is painted as a box or as text.
 *
 * Several authored properties mean different CSS depending on this — `fill` is a
 * background or a colour, a shadow is a `box-shadow` or a `text-shadow`, an
 * outline is a border or a text stroke.
 *
 * It is passed in rather than inferred from the element, because inferring it
 * was wrong: a text node's container is a `<div>`, so a tag-name check gave it
 * box semantics and a shadow authored on a text node became a `box-shadow`
 * around its bounding box. It produced nothing visible and no error. Found by a
 * browser test.
 */
type PaintMode = 'box' | 'text';

/**
 * Writes the style properties this renderer understands.
 *
 * Deliberately a fixed list rather than a pass-through of every key onto
 * `element.style`: the theme format owns its property names, and letting
 * arbitrary keys reach CSS would make the document format depend on whatever
 * the browser happens to accept. Unknown properties are ignored here and
 * reported by the validator, not applied.
 */
function applyCommonStyle(element: HTMLElement, style: ResolvedStyle, mode: PaintMode): void {
  const fill = asCss(style['fill']);
  if (fill !== undefined) {
    // Text takes a fill as its colour; a box takes it as a background.
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

/**
 * Outlines and dashes (§81's "outlines/dashes").
 *
 * A span takes an outline as a **text** stroke via `-webkit-text-stroke`, which
 * a box cannot use; a box takes it as a border. Same authored property, two
 * correct meanings — which is why this is not one shared line of CSS.
 *
 * `box-sizing: border-box` keeps the authored rectangle the *outer* rectangle.
 * Without it a border grows the element past the geometry the artboard laid out,
 * and a 2 px outline silently shifts everything inside by 2 px.
 *
 * A dash pattern applies to a box only. Dashed text strokes are not expressible
 * in CSS, and §85 says to mark a gap rather than approximate it: an authored
 * dash on a text element is ignored, and the validator is where that should
 * eventually be reported.
 */
function applyOutline(element: HTMLElement, style: ResolvedStyle, mode: PaintMode): void {
  const color = asCss(style['strokeColor']);
  const width = asNumber(style['strokeWidth']);

  if (color === undefined || width === undefined || width <= 0) {
    return;
  }

  if (mode === 'text') {
    // Paint the stroke behind the glyph so it reads as an outline rather than
    // eating into the letterform.
    element.style.setProperty('-webkit-text-stroke', `${width}px ${color}`);
    element.style.setProperty('paint-order', 'stroke fill');
    return;
  }

  const dash = style['strokeDash'];
  const dashed = dash === 'dashed' || dash === 'dotted';

  element.style.border = `${width}px ${dashed ? String(dash) : 'solid'} ${color}`;
  element.style.boxSizing = 'border-box';
}

/**
 * Shadows (§81's "shadows").
 *
 * A span needs `text-shadow` and a box needs `box-shadow`; applying the wrong
 * one produces nothing at all rather than an error, which is exactly the kind of
 * silent miss the screenshot pass exists to catch.
 *
 * Blur and offsets are in artboard pixels, so they scale with the artboard
 * transform along with everything else (§51). A shadow expressed in viewport
 * pixels would stay a fixed size while the design around it scaled.
 */
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
