import type { SampleSource } from '../data/source.js';
import type { Sample, SensorStatus } from '../types.js';
import { buildBarOption, type BarInput, type BarOption } from '../charts/bar.js';
import { buildGaugeOption, type GaugeOption } from '../charts/gauge.js';
import { buildLineOption, type LineOption, type SeriesInput } from '../charts/line.js';
import { buildPieOption, type PieOption, type PieSliceInput } from '../charts/pie.js';
import type {
  Binding,
  ChartContent,
  Globals,
  StyleMap,
  StyleValue,
  TextContent,
  TextRun,
  ThemeDocument,
  ThemeNode,
} from '../theme/document.js';

/**
 * Turns a theme document plus live data into a **render plan**: a flat
 * description of what to draw, with every decision already made.
 *
 * ## Why a plan, and not direct DOM calls
 *
 * Everything that could be wrong about a frame — resolved geometry, resolved
 * style, formatted text, chart options, which values are missing — is decided
 * here, in pure code, and is therefore unit-testable in Node. `mount.ts` then
 * only applies a plan to elements. That split is what lets the renderer be
 * tested without a browser, and it is the same discipline the chart adapters
 * already follow: emit a reviewable object, assert the object.
 *
 * It also serves §31 directly. The editor and the player run the *same* plan
 * builder; the editor adds interaction on top of it rather than rendering its
 * own scene, so the two cannot drift.
 *
 * This file is the seam the Fabric migration turns on (spec 0013): everything
 * it decides is engine-independent, so replacing the DOM applier with a Fabric
 * adapter leaves it untouched. Keep it that way — nothing Fabric-shaped belongs
 * in here.
 *
 * ## Status before value, everywhere
 *
 * §83's rule is applied at this layer rather than left to each element type. A
 * value run whose sample is not `ok` renders a placeholder and carries the
 * status; a chart whose binding is unmapped is reported in
 * {@link ScenePlan.issues} rather than drawn as zero.
 */

/** Placeholder shown where a value cannot be reported. Never a zero (§83). */
export const MISSING_VALUE_TEXT = '—';

/** Resolved style: globals substituted, literals unwrapped. */
export type ResolvedStyle = Readonly<Record<string, unknown>>;

/** Geometry in artboard pixels, local to the parent group (§57). */
export interface PlanBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

/** One drawn piece of a text element (§89). */
export interface PlanTextSegment {
  readonly text: string;
  readonly style: ResolvedStyle;
  /**
   * Present only on a value segment, and only when the sample is not `ok`, so a
   * theme can style a stale reading differently from a live one.
   */
  readonly status?: SensorStatus;
  /** Pre-redacted diagnostic from the sample (§101 — never a raw error). */
  readonly message?: string;
}

/**
 * How a text element fills its box (§89).
 *
 * Resolved here rather than read out of the style map in the DOM layer: these
 * come from the document's `TextContent`, they are layout rather than
 * typography, and `maxLines` has to be *computed* — which is exactly the kind of
 * decision that belongs in tested code.
 */
export interface PlanTextLayout {
  readonly wrap: boolean;
  /** §89 requires overflow to be authored, never silent. */
  readonly overflow: 'clip' | 'ellipsis' | 'visible';
  readonly align: 'left' | 'center' | 'right';
  readonly verticalAlign: 'top' | 'middle' | 'bottom';
  /**
   * Lines that fit the box at the resolved type size, when that is knowable.
   *
   * Needed because `text-overflow: ellipsis` does not apply to wrapped text —
   * only a line clamp does, and a clamp needs a line count. Undefined when the
   * type size is not resolvable, in which case the DOM layer falls back to a
   * single-line ellipsis.
   */
  readonly maxLines?: number;
}

export type PlanContent =
  | { readonly kind: 'group' }
  | {
      readonly kind: 'shape';
      readonly shape: 'rectangle' | 'ellipse' | 'line';
      readonly cornerRadius: number;
    }
  | {
      readonly kind: 'text';
      readonly segments: readonly PlanTextSegment[];
      readonly layout: PlanTextLayout;
    }
  // Split per family rather than pairing one `family` field with a union of
  // options: narrowing on `family` then yields that family's option type, so a
  // consumer never has to cast to read it.
  | { readonly kind: 'chart'; readonly family: 'gauge'; readonly option: GaugeOption }
  | { readonly kind: 'chart'; readonly family: 'line'; readonly option: LineOption }
  | { readonly kind: 'chart'; readonly family: 'bar'; readonly option: BarOption }
  | { readonly kind: 'chart'; readonly family: 'pie'; readonly option: PieOption }
  | {
      readonly kind: 'image';
      /** Resolved by the caller's asset resolver. Undefined when unresolvable. */
      readonly src: string | undefined;
      readonly fit: 'contain' | 'cover' | 'stretch';
      /**
       * Recolour the artwork to one flat colour (§111).
       *
       * Opt-in, because §111 also requires multicolour originals to be
       * preserved: an icon is only flattened when the author asks.
       */
      readonly monochrome?: string;
    }
  | {
      readonly kind: 'video';
      readonly src: string | undefined;
      readonly loop: boolean;
      readonly muted: boolean;
    };

export interface PlanNode {
  readonly id: string;
  readonly box: PlanBox;
  readonly visible: boolean;
  readonly style: ResolvedStyle;
  readonly content: PlanContent;
  readonly children: readonly PlanNode[];
}

/**
 * Something the frame could not express, for a diagnostic surface (§97, §141).
 *
 * These are runtime facts about *this frame*, not authoring errors — a validated
 * document still produces `unmapped-key` issues when the host has no sensor for
 * a semantic key, which is precisely the case that needs explicit remapping
 * rather than a silent zero.
 */
export interface PlanIssue {
  readonly code: 'unmapped-key' | 'unresolved-global' | 'unresolved-asset';
  readonly nodeId: string;
  readonly detail: string;
}

export interface ScenePlan {
  readonly artboard: {
    readonly width: number;
    readonly height: number;
    readonly fitMode: 'contain' | 'cover';
    readonly background: unknown;
    readonly barColor: unknown;
  };
  readonly nodes: readonly PlanNode[];
  readonly issues: readonly PlanIssue[];
}

export interface PlanContext {
  readonly document: ThemeDocument;
  readonly source: SampleSource;
  /** Epoch milliseconds for this frame. Passed in, never read from the clock here. */
  readonly nowMs: number;
  /** Whether chart transitions animate. Disable for screenshots. */
  readonly animate?: boolean;
  /** Maps an asset ID to a URL the document can load. */
  readonly resolveAsset?: (assetId: string) => string | undefined;
  /**
   * Long unit names for `unitDisplay: 'long'`, keyed by the short symbol the
   * sample carries. Without it, long falls back to the short symbol — the
   * sensor catalog (§93) is where these will come from.
   */
  readonly longUnits?: Readonly<Record<string, string>>;
}

/** Builds the plan for one frame. */
export function buildScenePlan(context: PlanContext): ScenePlan {
  const issues: PlanIssue[] = [];
  const globals = context.document.globals ?? {};

  const nodes = context.document.nodes.map((node) => planNode(node, context, globals, issues));

  const artboard = context.document.artboard;

  return {
    artboard: {
      width: artboard.width,
      height: artboard.height,
      fitMode: artboard.fitMode ?? 'contain',
      background: resolveStyleValue(artboard.background, globals, 'artboard', issues),
      barColor: resolveStyleValue(artboard.barColor, globals, 'artboard', issues),
    },
    nodes,
    issues,
  };
}

function planNode(
  node: ThemeNode,
  context: PlanContext,
  globals: Globals,
  issues: PlanIssue[],
): PlanNode {
  const box = planBox(node);
  // Resolved once and passed down: resolving again inside planContent would
  // report every unresolved global twice.
  const style = resolveStyleMap(node.style, globals, node.id, issues);

  return {
    id: node.id,
    box,
    // Absent means visible: a node is drawn unless the document says otherwise.
    visible: node.visible !== false,
    style,
    content: planContent(node, context, globals, issues, box, style),
    children:
      node.type === 'group'
        ? node.children.map((child) => planNode(child, context, globals, issues))
        : [],
  };
}

function planBox(node: ThemeNode): PlanBox {
  const transform = node.transform ?? {};

  return {
    x: transform.x ?? 0,
    y: transform.y ?? 0,
    // A node with no explicit size has no size. Defaulting to a visible box
    // would put an invisible-in-the-document rectangle on screen.
    width: transform.width ?? 0,
    height: transform.height ?? 0,
    rotation: transform.rotation ?? 0,
    scaleX: transform.scaleX ?? 1,
    scaleY: transform.scaleY ?? 1,
  };
}

function planContent(
  node: ThemeNode,
  context: PlanContext,
  globals: Globals,
  issues: PlanIssue[],
  box: PlanBox,
  style: ResolvedStyle,
): PlanContent {
  switch (node.type) {
    case 'group':
      return { kind: 'group' };

    case 'rectangle':
      return { kind: 'shape', shape: 'rectangle', cornerRadius: node.content?.cornerRadius ?? 0 };

    case 'ellipse':
      return { kind: 'shape', shape: 'ellipse', cornerRadius: 0 };

    case 'line':
      return { kind: 'shape', shape: 'line', cornerRadius: 0 };

    case 'text':
      return {
        kind: 'text',
        segments: planTextSegments(node.id, node.content.runs, node.bindings ?? [], context, globals, issues),
        layout: planTextLayout(node.content, box.height, style),
      };

    case 'chart':
      return planChart(node.id, node.content, node.bindings ?? [], context, issues);

    case 'image': {
      const src = resolveAsset(node.id, node.content.assetId, context, issues);
      const monochrome = resolveStyleValue(node.content.monochrome, globals, node.id, issues);

      return {
        kind: 'image',
        src,
        fit: node.content.fit ?? 'contain',
        ...(typeof monochrome === 'string' && monochrome.length > 0 ? { monochrome } : {}),
      };
    }

    case 'video': {
      const src = resolveAsset(node.id, node.content.assetId, context, issues);
      return {
        kind: 'video',
        src,
        loop: node.content.loop ?? true,
        muted: node.content.muted ?? true,
      };
    }
  }
}

function resolveAsset(
  nodeId: string,
  assetId: string,
  context: PlanContext,
  issues: PlanIssue[],
): string | undefined {
  const src = context.resolveAsset?.(assetId);

  if (src === undefined) {
    issues.push({
      code: 'unresolved-asset',
      nodeId,
      detail: `Asset "${assetId}" could not be resolved to a URL.`,
    });
  }

  return src;
}

/** Default line height when the document does not set one. */
const DEFAULT_LINE_HEIGHT = 1.2;

function planTextLayout(
  content: TextContent,
  boxHeight: number,
  style: ResolvedStyle,
): PlanTextLayout {
  const wrap = content.wrap ?? false;
  // Clip by default: §89 wants overflow explicit, and of the three, clipping is
  // the one that cannot mislead — it shows less rather than something else.
  const overflow = content.overflow ?? 'clip';

  const maxLines =
    wrap && overflow === 'ellipsis'
      ? computeMaxLines(boxHeight, style['fontSize'], style['lineHeight'])
      : undefined;

  return {
    wrap,
    overflow,
    align: content.align ?? 'left',
    verticalAlign: content.verticalAlign ?? 'top',
    ...(maxLines === undefined ? {} : { maxLines }),
  };
}

/**
 * How many lines of this type size fit in a box.
 *
 * Returns undefined when the answer is not knowable — no height, or no resolved
 * font size — rather than guessing. A wrong clamp is worse than none: it hides
 * text that would have fitted.
 */
export function computeMaxLines(
  boxHeight: number,
  fontSize: unknown,
  lineHeight: unknown,
): number | undefined {
  if (!Number.isFinite(boxHeight) || boxHeight <= 0) {
    return undefined;
  }

  if (typeof fontSize !== 'number' || !Number.isFinite(fontSize) || fontSize <= 0) {
    return undefined;
  }

  const factor =
    typeof lineHeight === 'number' && Number.isFinite(lineHeight) && lineHeight > 0
      ? lineHeight
      : DEFAULT_LINE_HEIGHT;

  // At least one line: a box too short for even one line should still show that
  // line clipped, not nothing at all.
  return Math.max(1, Math.floor(boxHeight / (fontSize * factor)));
}

function planTextSegments(
  nodeId: string,
  runs: readonly TextRun[],
  bindings: readonly Binding[],
  context: PlanContext,
  globals: Globals,
  issues: PlanIssue[],
): PlanTextSegment[] {
  return runs.map((run) => {
    const style = resolveStyleMap(run.style, globals, nodeId, issues);

    if (run.kind === 'literal') {
      return { text: run.text, style };
    }

    const binding = bindings.find((candidate) => candidate.id === run.bindingId);

    if (binding === undefined) {
      // Validation rejects this at import, so reaching it means an
      // unvalidated document. Reporting beats throwing: one bad run should not
      // take down a whole dashboard on a phone.
      issues.push({
        code: 'unmapped-key',
        nodeId,
        detail: `Text run references binding "${run.bindingId}", which this node does not declare.`,
      });
      return { text: MISSING_VALUE_TEXT, style };
    }

    const sample = context.source.latest(binding.semanticKey);

    if (sample === undefined) {
      issues.push({
        code: 'unmapped-key',
        nodeId,
        detail: `No sensor is mapped to "${binding.semanticKey}".`,
      });
      return { text: MISSING_VALUE_TEXT, style };
    }

    return formatValueSegment(sample, binding, run, style, context);
  });
}

function formatValueSegment(
  sample: Sample,
  binding: Binding,
  run: Extract<TextRun, { kind: 'value' }>,
  style: ResolvedStyle,
  context: PlanContext,
): PlanTextSegment {
  // §83: status before value. A non-ok sample carries no value, so there is
  // nothing to format and nothing may be substituted.
  if (sample.status !== 'ok') {
    return {
      text: MISSING_VALUE_TEXT,
      style,
      status: sample.status,
      ...(sample.message === undefined ? {} : { message: sample.message }),
    };
  }

  const precision = run.precision ?? binding.precision;
  const unitDisplay = run.unitDisplay ?? binding.unitDisplay ?? 'short';

  let text: string;

  if (typeof sample.value === 'number' && Number.isFinite(sample.value)) {
    // Scale and offset are authored per binding (§93) so a theme can show MB
    // where a sensor reports bytes, without the host knowing about the theme.
    const scaled = sample.value * (binding.scale ?? 1) + (binding.offset ?? 0);
    text = formatNumber(scaled, precision);
  } else if (sample.textValue !== undefined) {
    text = sample.textValue;
  } else if (sample.booleanValue !== undefined) {
    text = sample.booleanValue ? 'on' : 'off';
  } else {
    // Status said ok but no value of any type arrived. That is a provider bug;
    // the placeholder makes it visible instead of rendering an empty box.
    return { text: MISSING_VALUE_TEXT, style, status: 'error' };
  }

  const unit = formatUnit(sample.unit, unitDisplay, context.longUnits);

  return { text: unit === '' ? text : `${text}${unit}`, style };
}

/**
 * Formats a number for display.
 *
 * An explicit `precision` is honoured exactly, including trailing zeroes: §89
 * asks for tabular readouts, and a digit count that changes with the value makes
 * a value box jitter.
 *
 * With no precision the value is rounded to at most one decimal and a trailing
 * `.0` is dropped, which reads correctly for percentages, temperatures and RPM
 * alike. A fixed default would be wrong for at least one of them.
 */
export function formatNumber(value: number, precision: number | undefined): string {
  if (precision !== undefined) {
    return value.toFixed(Math.min(Math.max(Math.trunc(precision), 0), 6));
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

/** Renders the unit suffix, including its separating space where appropriate. */
export function formatUnit(
  unit: string | undefined,
  display: 'none' | 'short' | 'long',
  longUnits: Readonly<Record<string, string>> | undefined,
): string {
  if (display === 'none' || unit === undefined || unit === '') {
    return '';
  }

  if (display === 'long') {
    const long = longUnits?.[unit];
    // Falls back to the short symbol rather than inventing a name. The sensor
    // catalog is where long names will come from (§93).
    return long === undefined ? spaced(unit) : ` ${long}`;
  }

  return spaced(unit);
}

/**
 * Typographic convention: no space before a percent or degree sign, one space
 * before a word-like unit. Getting this wrong is the most visible formatting
 * error on a dashboard.
 */
function spaced(unit: string): string {
  return /^[%°]/.test(unit) ? unit : ` ${unit}`;
}

function planChart(
  nodeId: string,
  content: ChartContent,
  bindings: readonly Binding[],
  context: PlanContext,
  issues: PlanIssue[],
): PlanContent {
  const animate = context.animate ?? true;

  // Report unmapped keys once per chart, before building the option. The
  // adapters handle an absent sample correctly — that is what their gap rules
  // are for — but nothing else would tell the user the key is unmapped.
  for (const binding of bindings) {
    if (context.source.latest(binding.semanticKey) === undefined) {
      issues.push({
        code: 'unmapped-key',
        nodeId,
        detail: `No sensor is mapped to "${binding.semanticKey}".`,
      });
    }
  }

  switch (content.family) {
    case 'gauge': {
      const binding = bindings[0];
      const sample = binding === undefined ? undefined : context.source.latest(binding.semanticKey);

      return {
        kind: 'chart',
        family: 'gauge',
        option: buildGaugeOption(content.settings, applyTransform(sample, binding), animate),
      };
    }

    case 'line': {
      const series: SeriesInput[] = bindings.map((binding) => ({
        sensorId: binding.semanticKey,
        samples: context.source
          .history(binding.semanticKey, content.settings.windowSeconds)
          .map((sample) => transformSample(sample, binding)),
      }));

      return {
        kind: 'chart',
        family: 'line',
        option: buildLineOption(content.settings, series, context.nowMs, animate),
      };
    }

    case 'bar': {
      const inputs: BarInput[] = bindings.map((binding) => ({
        sensorId: binding.semanticKey,
        sample: applyTransform(context.source.latest(binding.semanticKey), binding),
      }));

      return {
        kind: 'chart',
        family: 'bar',
        option: buildBarOption(content.settings, inputs, animate),
      };
    }

    case 'pie': {
      const slices: PieSliceInput[] = bindings.map((binding) => ({
        sensorId: binding.semanticKey,
        sample: applyTransform(context.source.latest(binding.semanticKey), binding),
      }));

      return {
        kind: 'chart',
        family: 'pie',
        option: buildPieOption(content.settings, slices, animate),
      };
    }
  }
}

/**
 * Applies a binding's scale and offset to a sample.
 *
 * Charts need this as much as text does — a gauge with a 0–32 range bound to a
 * sensor reporting bytes would otherwise peg at full. A non-ok sample passes
 * through untouched: there is no value to transform, and `status` is what the
 * adapters read.
 */
function applyTransform(sample: Sample | undefined, binding: Binding | undefined): Sample | undefined {
  if (sample === undefined || binding === undefined) {
    return sample;
  }

  return transformSample(sample, binding);
}

/** {@link applyTransform} for a sample already known to exist. */
function transformSample(sample: Sample, binding: Binding): Sample {
  const scale = binding.scale ?? 1;
  const offset = binding.offset ?? 0;

  if (scale === 1 && offset === 0) {
    return sample;
  }

  if (sample.status !== 'ok' || typeof sample.value !== 'number') {
    return sample;
  }

  return { ...sample, value: sample.value * scale + offset };
}

function resolveStyleMap(
  style: StyleMap | undefined,
  globals: Globals,
  nodeId: string,
  issues: PlanIssue[],
): ResolvedStyle {
  if (style === undefined) {
    return {};
  }

  const resolved: Record<string, unknown> = {};

  for (const [property, value] of Object.entries(style)) {
    const literal = resolveStyleValue(value, globals, nodeId, issues);
    if (literal !== undefined) {
      resolved[property] = literal;
    }
  }

  return resolved;
}

/**
 * Resolves one style value to its literal (§75).
 *
 * A reference that does not resolve yields `undefined` and an issue rather than
 * a guessed default: a silently substituted colour is how a theme ends up
 * looking wrong with nothing to point at.
 */
export function resolveStyleValue(
  value: StyleValue | undefined,
  globals: Globals,
  nodeId: string,
  issues: PlanIssue[],
): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (!('ref' in value) || value.ref === undefined) {
    return value.value;
  }

  const [group, ...rest] = value.ref.split('.');
  const entryId = rest.join('.');
  const entry =
    group === undefined ? undefined : globals[group as keyof Globals]?.[entryId];

  if (entry === undefined) {
    issues.push({
      code: 'unresolved-global',
      nodeId,
      detail: `Global "${value.ref}" is not defined in this document.`,
    });
    return undefined;
  }

  return entry.value;
}
