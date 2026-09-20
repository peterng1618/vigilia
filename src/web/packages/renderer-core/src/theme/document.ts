import type { BarSettings } from '../charts/bar.js';
import type { LineSettings } from '../charts/line.js';
import type { PieSettings } from '../charts/pie.js';
import type { GaugeSettings } from '../types.js';

/** In-memory form of the owned theme document format. */

/** Only schema version accepted by this build; unsupported versions are refused, not migrated. */
export const SUPPORTED_SCHEMA_VERSION = 1;

export const MAX_ARTBOARD_DIMENSION = 16384;

/** Stable IDs are separate from display names so renaming preserves references. */
export const STABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Necessary asset-path shape; validator also rejects `.`/`..` segments. */
export const ASSET_PATH_PATTERN = /^assets\/[A-Za-z0-9._/-]{1,200}$/;

/** Chosen import bounds, not measured rendering limits. */
export const MAX_NODE_DEPTH = 32;
export const MAX_NODE_COUNT = 5000;

const SEMANTIC_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export function isSemanticVersion(value: string): boolean {
  return SEMANTIC_VERSION.test(value);
}

export function bumpSemanticVersion(version: string | undefined, level: 'major' | 'minor' | 'patch'): string {
  if (version === undefined) return '0.1.0';
  const parts = SEMANTIC_VERSION.exec(version);
  if (parts === null) throw new Error('A release version must be semantic major.minor.patch.');
  const major = Number(parts[1]);
  const minor = Number(parts[2]);
  const patch = Number(parts[3]);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export const GLOBAL_GROUPS = ['palette', 'typePresets', 'fonts', 'fontSizes', 'spacing', 'assets'] as const;
export type GlobalGroupName = (typeof GLOBAL_GROUPS)[number];

export const NODE_TYPES = [
  'group',
  'rectangle',
  'ellipse',
  'line',
  'text',
  'chart',
  'image',
  'video',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const CHART_FAMILIES = ['gauge', 'line', 'bar', 'pie'] as const;
export type ChartFamily = (typeof CHART_FAMILIES)[number];

export type GlobalRef = `${GlobalGroupName}.${string}`;

/** A style value is exclusively a token reference or a literal. */
export type StyleValue =
  | { readonly ref: GlobalRef; readonly value?: never }
  | { readonly value: unknown; readonly ref?: never };

export type StyleMap = Readonly<Record<string, StyleValue>>;

export interface GlobalEntry {
  /** Display name; references use the map key. */
  readonly name: string;
  readonly value: unknown;
}

/** Palette paint is structured so gradients retain their authored geometry. */
export type PalettePaint =
  | { readonly kind: 'solid'; readonly color: string }
  | { readonly kind: 'gradient'; readonly angle: number; readonly stops: readonly { readonly offset: number; readonly color: string }[] };

/** One reusable typography treatment, applied independently to each text run. */
export interface TypePreset {
  readonly family: string;
  readonly size: number;
  readonly weight?: string | number;
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
  readonly face?: { readonly assetId: string };
  readonly trioRole?: 'heading' | 'body' | 'mono';
}

export type GlobalGroup = Readonly<Record<string, GlobalEntry>>;
export type Globals = Readonly<Partial<Record<GlobalGroupName, GlobalGroup>>>;

/** Group-local transform; transforms compose through ancestry. */
export interface Transform {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly rotation?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export interface Artboard {
  readonly width: number;
  readonly height: number;
  readonly background?: StyleValue;
  readonly fitMode?: 'contain' | 'cover';
  readonly barColor?: StyleValue;
  readonly backgroundMedia?: BackgroundMedia;
}
export interface BackgroundMedia {
  readonly assetId: string;
  readonly fit: 'contain' | 'cover';
}

/** Themes bind semantic keys, never provider-instance IDs. */
export interface Binding {
  readonly id: string;
  readonly semanticKey: string;
  readonly precision?: number;
  readonly unitDisplay?: 'none' | 'short' | 'long';
  readonly scale?: number;
  readonly offset?: number;
}

export type TextRun =
  | {
      readonly kind: 'literal';
      readonly text: string;
      readonly typePreset?: `typePresets.${string}`;
      readonly style?: StyleMap;
    }
  | {
      readonly kind: 'value';
      /** References a binding on the same node. */
      readonly bindingId: string;
      readonly precision?: number;
      readonly unitDisplay?: 'none' | 'short' | 'long';
      readonly typePreset?: `typePresets.${string}`;
      readonly style?: StyleMap;
    };

export interface TextContent {
  readonly runs: readonly TextRun[];
  readonly wrap?: boolean;
  readonly overflow?: 'clip' | 'ellipsis' | 'visible';
  readonly align?: 'left' | 'center' | 'right';
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
}

/** Chart settings stay discriminated by family and share adapter-owned setting types. */
export type ChartContent =
  | { readonly family: 'gauge'; readonly settings: GaugeSettings }
  | { readonly family: 'line'; readonly settings: LineSettings }
  | { readonly family: 'bar'; readonly settings: BarSettings }
  | { readonly family: 'pie'; readonly settings: PieSettings };

export interface RectangleContent {
  readonly cornerRadius?: number;
}

export interface ImageContent {
  readonly assetId: string;
  readonly fit?: 'contain' | 'cover' | 'stretch';
  readonly monochrome?: StyleValue;
}

export interface VideoContent {
  readonly assetId: string;
  readonly loop?: boolean;
  readonly muted?: boolean;
}

/** Origin metadata for an inserted widget copy; not a live library link. */
export interface WidgetProvenance {
  readonly widgetId: string;
  readonly widgetName?: string;
  readonly widgetVersion?: string;
  readonly insertedAt?: string;
}

interface NodeBase {
  readonly id: string;
  readonly name?: string;
  readonly transform?: Transform;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly provenance?: WidgetProvenance;
  readonly style?: StyleMap;
  readonly bindings?: readonly Binding[];
}

/** Array order is paint order; there is no separate z-index. */
export type ThemeNode =
  | (NodeBase & { readonly type: 'group'; readonly children: readonly ThemeNode[] })
  | (NodeBase & { readonly type: 'rectangle'; readonly content?: RectangleContent })
  | (NodeBase & { readonly type: 'ellipse' })
  | (NodeBase & { readonly type: 'line' })
  | (NodeBase & { readonly type: 'text'; readonly content: TextContent })
  | (NodeBase & { readonly type: 'chart'; readonly content: ChartContent })
  | (NodeBase & { readonly type: 'image'; readonly content: ImageContent })
  | (NodeBase & { readonly type: 'video'; readonly content: VideoContent });

export interface AssetLicense {
  readonly name?: string;
  readonly url?: string;
  readonly attribution?: string;
}

/** Asset type is declared explicitly; renderers should not infer it from the path. */
export type AssetKind = 'image' | 'svg' | 'gif' | 'video' | 'font';

export interface AssetReference {
  readonly id: string;
  readonly kind: AssetKind;
  readonly path: string;
  readonly sha256?: string;
  readonly sourceUrl?: string;
  readonly license?: AssetLicense;
}

export interface FontAssetReference extends AssetReference {
  readonly kind: 'font';
  readonly family: string;
  readonly weight: string | number;
  readonly style: 'normal' | 'italic';
  readonly format: 'woff2';
  readonly sourceUrl: string;
  readonly license: AssetLicense;
}

export interface ThemeMetadata {
  readonly name?: string;
  readonly author?: string;
  readonly description?: string;
  readonly version?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface ThemeDocument {
  readonly schemaVersion: number;
  readonly id: string;
  readonly metadata?: ThemeMetadata;
  readonly artboard: Artboard;
  readonly globals?: Globals;
  readonly nodes: readonly ThemeNode[];
  readonly assets?: readonly AssetReference[];
  /** Persisted editor-only state; not rendered or part of document undo. */
  readonly editorMetadata?: Readonly<Record<string, unknown>>;
}

/** Depth-first walk in paint order, parents before children. */
export function* walkNodes(
  nodes: readonly ThemeNode[],
): Generator<{ node: ThemeNode; depth: number; path: string }> {
  yield* walk(nodes, 0, '/nodes');
}

function* walk(
  nodes: readonly ThemeNode[],
  depth: number,
  path: string,
): Generator<{ node: ThemeNode; depth: number; path: string }> {
  for (const [index, node] of nodes.entries()) {
    const nodePath = `${path}/${index}`;
    yield { node, depth, path: nodePath };

    if (node.type === 'group') {
      yield* walk(node.children, depth + 1, `${nodePath}/children`);
    }
  }
}

export function* walkBindings(
  nodes: readonly ThemeNode[],
): Generator<{ binding: Binding; node: ThemeNode }> {
  for (const { node } of walkNodes(nodes)) {
    for (const binding of node.bindings ?? []) {
      yield { binding, node };
    }
  }
}

/** Sorted semantic-key set required by this document. */
export function requiredSemanticKeys(document: ThemeDocument): string[] {
  const keys = new Set<string>();

  for (const { binding } of walkBindings(document.nodes)) {
    keys.add(binding.semanticKey);
  }

  return [...keys].sort();
}
