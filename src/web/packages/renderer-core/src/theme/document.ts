import type { BarSettings } from '../charts/bar.js';
import type { LineSettings } from '../charts/line.js';
import type { PieSettings } from '../charts/pie.js';
import type { GaugeSettings } from '../types.js';

/**
 * The owned theme document format (§134), as TypeScript types.
 *
 * `schema/theme-document.schema.json` is the published contract; this is the
 * in-memory shape. The two are kept from drifting by `schema-sync.test.ts`,
 * which reads the schema file from disk and asserts the shared constants match.
 * That test exists because a mismatch here is silent — the same failure mode as
 * the C# ↔ `types.ts` mirror, which has no such test yet.
 *
 * These types are deliberately **stricter** than the JSON Schema in two places
 * the schema language cannot express well:
 *
 * - `content` is a discriminated union on node type, not an open object.
 * - {@link StyleValue} is a real exclusive-or, so `{ ref, value }` together is a
 *   compile error rather than a runtime surprise (§75).
 */

/**
 * The only document version this build accepts.
 *
 * §141: an unsupported version must fail import **without changing the
 * library**. There are no migrations yet, so this is an equality check, not a
 * floor — a document from a newer build is rejected with its own issue code so
 * the UI can distinguish "newer than this build" from "corrupt".
 */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** Largest artboard dimension, in artboard pixels. */
export const MAX_ARTBOARD_DIMENSION = 16384;

/** Stable-ID pattern. Display names live elsewhere so renaming preserves links (§75). */
export const STABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Asset paths are package-relative and confined to `assets/` (§141).
 *
 * Necessary but NOT sufficient: the character class permits `.`, so
 * `assets/../../x` matches this. The `..` rejection lives in the validator, and
 * that check is the one that actually confines a path to the package.
 */
export const ASSET_PATH_PATTERN = /^assets\/[A-Za-z0-9._/-]{1,200}$/;

/**
 * Maximum node-tree depth.
 *
 * CHOSEN, NOT MEASURED. §141 requires nesting to be validated; a deep tree
 * recurses in the renderer and in every walk over the document, so an unbounded
 * one is a stack-overflow vector in an importer that accepts third-party ZIPs.
 * 32 is far beyond any plausible hand-authored design. Revisit with a measured
 * figure if a real theme ever approaches it.
 */
export const MAX_NODE_DEPTH = 32;

/**
 * Maximum total nodes in one document.
 *
 * CHOSEN, NOT MEASURED, for the same reason as {@link MAX_NODE_DEPTH}: a bound
 * that exists is what §141 asks for. Gate 0 should replace it with a figure tied
 * to measured render cost on the reference phone.
 */
export const MAX_NODE_COUNT = 5000;

/** Groups of named literals a style property may reference (§73). */
export const GLOBAL_GROUPS = ['palette', 'fonts', 'fontSizes', 'spacing', 'assets'] as const;

export type GlobalGroupName = (typeof GLOBAL_GROUPS)[number];

/** V1 node types. Deliberately minimal (§43). */
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

/** The four v1 chart families (§81). */
export const CHART_FAMILIES = ['gauge', 'line', 'bar', 'pie'] as const;

export type ChartFamily = (typeof CHART_FAMILIES)[number];

/** A reference into `globals`, as `group.id`. */
export type GlobalRef = `${GlobalGroupName}.${string}`;

/**
 * §75: a compatible property is **either** a global reference **or** its own
 * literal — never both, and never a bare value whose origin is ambiguous.
 *
 * The `never` members make that exclusive at compile time: with
 * `exactOptionalPropertyTypes`, `{ ref: 'palette.accent', value: 1 }` does not
 * type-check. The validator enforces the same rule for parsed JSON, which the
 * type system never sees.
 */
export type StyleValue =
  | { readonly ref: GlobalRef; readonly value?: never }
  | { readonly value: unknown; readonly ref?: never };

/** Map of style property name to a reference-or-literal. */
export type StyleMap = Readonly<Record<string, StyleValue>>;

/** One named literal in a global group. */
export interface GlobalEntry {
  /** Display name. Changing it must not break references, which use the key (§75). */
  readonly name: string;
  readonly value: unknown;
}

export type GlobalGroup = Readonly<Record<string, GlobalEntry>>;

export type Globals = Readonly<Partial<Record<GlobalGroupName, GlobalGroup>>>;

/** Group-local transform. Transforms compose rather than being baked (§57). */
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
  /** §53: 'contain' fits the whole design with bars; 'cover' fills and crops. */
  readonly fitMode?: 'contain' | 'cover';
  readonly barColor?: StyleValue;
}

/**
 * §93: a binding names a **semantic key**, and a mapping layer resolves it to an
 * actual sensor. A theme never stores a provider instance ID, so changing
 * providers must not require editing the theme.
 */
export interface Binding {
  /** Stable, document-unique. Text runs reference bindings by this. */
  readonly id: string;
  readonly semanticKey: string;
  readonly precision?: number;
  readonly unitDisplay?: 'none' | 'short' | 'long';
  readonly scale?: number;
  readonly offset?: number;
}

/**
 * One run within a text element (§89), so a label, a live value and a unit can
 * be styled differently inside one text box.
 */
export type TextRun =
  | {
      readonly kind: 'literal';
      readonly text: string;
      readonly style?: StyleMap;
    }
  | {
      readonly kind: 'value';
      /** Must match a {@link Binding.id} on the same node. */
      readonly bindingId: string;
      /** Overrides the binding's own precision for this run. */
      readonly precision?: number;
      readonly unitDisplay?: 'none' | 'short' | 'long';
      readonly style?: StyleMap;
    };

export interface TextContent {
  readonly runs: readonly TextRun[];
  readonly wrap?: boolean;
  /** §89: explicit clipping or ellipsis, never silent overflow. */
  readonly overflow?: 'clip' | 'ellipsis' | 'visible';
  readonly align?: 'left' | 'center' | 'right';
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
}

/**
 * Typed chart settings, discriminated by family (§87).
 *
 * The settings types are the same ones the adapters take, so the document
 * format and the renderer cannot disagree about what a gauge is.
 */
export type ChartContent =
  | { readonly family: 'gauge'; readonly settings: GaugeSettings }
  | { readonly family: 'line'; readonly settings: LineSettings }
  | { readonly family: 'bar'; readonly settings: BarSettings }
  | { readonly family: 'pie'; readonly settings: PieSettings };

/**
 * Geometry a rectangle needs beyond its transform.
 *
 * Shape geometry lives in `content` rather than beside `transform` so that every
 * node type keeps the same top-level shape, and per-type detail has exactly one
 * home.
 */
export interface RectangleContent {
  readonly cornerRadius?: number;
}

export interface ImageContent {
  /** Must match an {@link AssetReference.id}. */
  readonly assetId: string;
  readonly fit?: 'contain' | 'cover' | 'stretch';
  /** §111: monochrome recolouring for imported SVG icons. */
  readonly monochrome?: StyleValue;
}

export interface VideoContent {
  readonly assetId: string;
  readonly loop?: boolean;
  readonly muted?: boolean;
}

/**
 * Where an inserted subtree came from (§138).
 *
 * V1 insertion embeds a **copy** and there is no automatic library-update
 * propagation, so this is a record of origin rather than a live link. It exists
 * so an author can tell which elements arrived together — and so a future
 * version can offer "update from library" as an explicit action instead of
 * guessing.
 */
export interface WidgetProvenance {
  readonly widgetId: string;
  readonly widgetName?: string;
  /** Widget version at insertion time, if the source declared one. */
  readonly widgetVersion?: string;
  /** ISO-8601. */
  readonly insertedAt?: string;
}

interface NodeBase {
  readonly id: string;
  readonly name?: string;
  readonly transform?: Transform;
  readonly visible?: boolean;
  /** §61: inspectable in the tree but not transformable until unlocked. */
  readonly locked?: boolean;
  /** Present only on the roots of an inserted widget copy. */
  readonly provenance?: WidgetProvenance;
  readonly style?: StyleMap;
  readonly bindings?: readonly Binding[];
}

/**
 * A node in the document tree.
 *
 * Child order alone determines stacking (§137) — there is no z-index, so moving
 * a node in the array is the only way to change paint order.
 */
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

export interface AssetReference {
  readonly id: string;
  readonly kind: 'image' | 'svg' | 'gif' | 'video' | 'font';
  /** Package-relative, under `assets/`. Traversal and absolute paths are rejected (§141). */
  readonly path: string;
  readonly sha256?: string;
  readonly sourceUrl?: string;
  /** §132: a URL alone does not establish reuse rights. */
  readonly license?: AssetLicense;
}

export interface ThemeMetadata {
  readonly name?: string;
  readonly author?: string;
  readonly description?: string;
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
  /** Persisted but never rendered, and never part of undo (§67). */
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

/** Every binding in the document, with the node that owns it. */
export function* walkBindings(
  nodes: readonly ThemeNode[],
): Generator<{ binding: Binding; node: ThemeNode }> {
  for (const { node } of walkNodes(nodes)) {
    for (const binding of node.bindings ?? []) {
      yield { binding, node };
    }
  }
}

/**
 * The set of semantic keys a document needs.
 *
 * §122: the host subscribes to the union of sensors active clients need. This is
 * how a client states that union, and it is why a theme exports binding
 * requirements rather than endpoint configuration (§99).
 */
export function requiredSemanticKeys(document: ThemeDocument): string[] {
  const keys = new Set<string>();

  for (const { binding } of walkBindings(document.nodes)) {
    keys.add(binding.semanticKey);
  }

  return [...keys].sort();
}
