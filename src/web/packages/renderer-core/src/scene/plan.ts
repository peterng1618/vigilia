import type { SampleSource } from '../data/source.js';
import type { Sample, SensorStatus } from '../types.js';
import { buildBarOption, type BarInput } from '../charts/bar.js';
import { buildGaugeOption } from '../charts/gauge.js';
import { buildLineOption, type SeriesInput } from '../charts/line.js';
import { buildPieOption, type PieSliceInput } from '../charts/pie.js';
import type { ChartOptionByFamily } from '../charts/engine-option.js';
import type {
  AssetKind,
  Binding,
  ChartContent,
  ChartFamily,
  Globals,
  StyleMap,
  StyleValue,
  TextContent,
  TextRun,
  ThemeDocument,
  ThemeNode,
} from '../theme/document.js';

/**
 * Pure document + telemetry → render plan. All renderer-independent decisions
 * live here; DOM/Fabric layers only apply the result. Non-ok data becomes gaps,
 * never fabricated zeroes (§83).
 */

export const MISSING_VALUE_TEXT = '—';

export type ResolvedStyle = Readonly<Record<string, unknown>>;

/** Parent-local geometry in artboard units (§57). */
export interface PlanBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export interface PlanTextSegment {
  readonly text: string;
  readonly style: ResolvedStyle;
  /** Present only for a non-ok value segment. */
  readonly status?: SensorStatus;
  /** Pre-redacted diagnostic (§101). */
  readonly message?: string;
}

export interface PlanTextLayout {
  readonly wrap: boolean;
  readonly overflow: 'clip' | 'ellipsis' | 'visible';
  readonly align: 'left' | 'center' | 'right';
  readonly verticalAlign: 'top' | 'middle' | 'bottom';
  /** Computed wrapped-line capacity when font metrics are knowable. */
  readonly maxLines?: number;
}

/** Authored chart state paired with this frame's derived engine option. */
export type PlanChart = {
  [F in ChartFamily]: Extract<ChartContent, { readonly family: F }> & {
    readonly kind: 'chart';
    readonly option: ChartOptionByFamily[F];
  };
}[ChartFamily];

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
  | PlanChart
  | {
      readonly kind: 'image';
      readonly src: string | undefined;
      /** Asset declaration, needed where vector/raster handling differs. */
      readonly assetKind: AssetKind | undefined;
      readonly fit: 'contain' | 'cover' | 'stretch';
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

/** Runtime frame diagnostics, not document-validation errors. */
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
  /** Epoch milliseconds supplied by the caller; this module never reads the clock. */
  readonly nowMs: number;
  readonly animate?: boolean;
  readonly resolveAsset?: (assetId: string) => string | undefined;
  /** Long unit names keyed by short symbol; absent entries fall back to short. */
  readonly longUnits?: Readonly<Record<string, string>>;
}

/** Runtime inputs required to derive one authored chart's display option. */
export type ChartPlanContext = Pick<PlanContext, 'source' | 'nowMs' | 'animate'>;

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
  // Resolve once so an unresolved global is reported once.
  const style = resolveStyleMap(node.style, globals, node.id, issues);

  return {
    id: node.id,
    box,
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
      return buildChartPlan(node.id, node.content, node.bindings ?? [], context, issues);

    case 'image': {
      const src = resolveAsset(node.id, node.content.assetId, context, issues);
      const monochrome = resolveStyleValue(node.content.monochrome, globals, node.id, issues);
      const assetKind = assetKindOf(node.content.assetId, context);

      return {
        kind: 'image',
        src,
        assetKind,
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

function assetKindOf(assetId: string, context: PlanContext): AssetKind | undefined {
  return context.document.assets?.find((asset) => asset.id === assetId)?.kind;
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

const DEFAULT_LINE_HEIGHT = 1.2;

function planTextLayout(
  content: TextContent,
  boxHeight: number,
  style: ResolvedStyle,
): PlanTextLayout {
  const wrap = content.wrap ?? false;
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

/** Return undefined rather than guessing when font metrics cannot determine a clamp. */
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
    const scaled = sample.value * (binding.scale ?? 1) + (binding.offset ?? 0);
    text = formatNumber(scaled, precision);
  } else if (sample.textValue !== undefined) {
    text = sample.textValue;
  } else if (sample.booleanValue !== undefined) {
    text = sample.booleanValue ? 'on' : 'off';
  } else {
    return { text: MISSING_VALUE_TEXT, style, status: 'error' };
  }

  const unit = formatUnit(sample.unit, unitDisplay, context.longUnits);

  return { text: unit === '' ? text : `${text}${unit}`, style };
}

/** Explicit precision preserves trailing zeroes; default uses at most one decimal. */
export function formatNumber(value: number, precision: number | undefined): string {
  if (precision !== undefined) {
    return value.toFixed(Math.min(Math.max(Math.trunc(precision), 0), 6));
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

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
    return long === undefined ? spaced(unit) : ` ${long}`;
  }

  return spaced(unit);
}

/** Percent/degree attach directly; word-like units get a leading space. */
function spaced(unit: string): string {
  return /^[%°]/.test(unit) ? unit : ` ${unit}`;
}

export function buildChartPlan(
  nodeId: string,
  content: ChartContent,
  bindings: readonly Binding[],
  context: ChartPlanContext,
  issues: PlanIssue[],
): PlanChart {
  const animate = context.animate ?? true;

  // Adapters handle absent samples; report unmapped semantic keys separately.
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
        settings: content.settings,
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
        settings: content.settings,
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
        settings: content.settings,
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
        settings: content.settings,
        option: buildPieOption(content.settings, slices, animate),
      };
    }
  }
}

/** Apply authored scale/offset only to ok numeric samples. */
function applyTransform(sample: Sample | undefined, binding: Binding | undefined): Sample | undefined {
  if (sample === undefined || binding === undefined) {
    return sample;
  }

  return transformSample(sample, binding);
}

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

/** Missing references report an issue and resolve to undefined; never substitute. */
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
