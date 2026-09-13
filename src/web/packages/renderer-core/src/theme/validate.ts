import { isKnownStyleProperty } from './capabilities.js';
import {
  ASSET_PATH_PATTERN,
  CHART_FAMILIES,
  GLOBAL_GROUPS,
  MAX_ARTBOARD_DIMENSION,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  NODE_TYPES,
  STABLE_ID_PATTERN,
  SUPPORTED_SCHEMA_VERSION,
  type ThemeDocument,
} from './document.js';

/**
 * Validates a parsed theme document (§141).
 *
 * ## Why this is hand-written
 *
 * The rules that matter most cannot be expressed in JSON Schema: that a style
 * value's `ref` resolves to a global that exists, that node and binding IDs are
 * unique, that a text run's `bindingId` names a binding **on its own node**,
 * that the tree is bounded in depth and count, and that a chart's settings suit
 * its family. A generic validator would check the shape and miss all of those.
 *
 * It also keeps the player dependency-free, which §47's bundle budget depends
 * on, and lets every message name the specific authoring mistake.
 *
 * `schema/theme-document.schema.json` stays the published contract. The shared
 * constants are asserted equal to it by `schema-sync.test.ts`.
 *
 * ## All issues, except for the version
 *
 * Import UX needs every problem at once, so checks accumulate. The one exception
 * is the schema version: §141 requires an unsupported version to fail **without
 * changing the library**, and reporting fifty type errors from a format we
 * admittedly do not understand would be noise at best and misleading at worst.
 */

export type IssueCode =
  | 'not-an-object'
  | 'unknown-field'
  | 'newer-schema-version'
  | 'unsupported-schema-version'
  | 'missing-field'
  | 'wrong-type'
  | 'invalid-id'
  | 'duplicate-id'
  | 'out-of-range'
  | 'invalid-enum'
  | 'style-value-ambiguous'
  | 'unresolved-global-ref'
  | 'unresolved-asset-ref'
  | 'unresolved-binding-ref'
  | 'binding-count'
  | 'invalid-asset-path'
  | 'too-deep'
  | 'too-many-nodes';

export interface ValidationIssue {
  readonly code: IssueCode;
  /** JSON Pointer into the document, so an editor can navigate to the fault. */
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly document: ThemeDocument }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Bindings a node type can consume. A binding nothing reads is an error, not a no-op. */
const BINDING_ARITY: Record<
  (typeof NODE_TYPES)[number],
  { readonly min: number; readonly max: number }
> = {
  group: { min: 0, max: 0 },
  rectangle: { min: 0, max: 0 },
  ellipse: { min: 0, max: 0 },
  line: { min: 0, max: 0 },
  // A text element may mix several live values with literals across styled runs.
  text: { min: 0, max: 64 },
  chart: { min: 1, max: 64 },
  image: { min: 0, max: 0 },
  video: { min: 0, max: 0 },
};

/** A gauge reads one value against a range; more than one has no meaning. */
const CHART_BINDING_ARITY: Record<
  (typeof CHART_FAMILIES)[number],
  { readonly min: number; readonly max: number }
> = {
  gauge: { min: 1, max: 1 },
  line: { min: 1, max: 16 },
  bar: { min: 1, max: 64 },
  pie: { min: 1, max: 64 },
};

/**
 * Known keys per shape, mirroring the schema's `additionalProperties: false`.
 *
 * These exist to catch the most common authoring mistake there is: a typo. A
 * document with `"visable": true` is valid JSON, passes every other check, and
 * silently renders a node the author believed they had hidden. Ignoring unknown
 * keys makes that invisible; rejecting them names the line.
 *
 * Forward compatibility is *not* what this trades away. A field a newer build
 * introduces comes with a `schemaVersion` bump, which is rejected earlier and
 * with a clearer message (§141). Within one declared version, an unexpected
 * field means something is wrong.
 *
 * `schema-sync.test.ts` asserts each of these against the schema's own
 * `properties`, so the two cannot drift apart silently.
 */
const KNOWN_KEYS = {
  document: ['schemaVersion', 'id', 'metadata', 'artboard', 'globals', 'nodes', 'assets', 'editorMetadata'],
  metadata: ['name', 'author', 'description', 'createdAt', 'updatedAt'],
  artboard: ['width', 'height', 'background', 'fitMode', 'barColor'],
  transform: ['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY'],
  node: [
    'id',
    'type',
    'name',
    'transform',
    'visible',
    'locked',
    'provenance',
    'style',
    'content',
    'bindings',
    'children',
  ],
  binding: ['id', 'semanticKey', 'precision', 'unitDisplay', 'scale', 'offset'],
  textContent: ['runs', 'wrap', 'overflow', 'align', 'verticalAlign'],
  literalRun: ['kind', 'text', 'style'],
  valueRun: ['kind', 'bindingId', 'precision', 'unitDisplay', 'style'],
  chartContent: ['family', 'settings'],
  rectangleContent: ['cornerRadius'],
  imageContent: ['assetId', 'fit', 'monochrome'],
  videoContent: ['assetId', 'loop', 'muted'],
  assetReference: ['id', 'kind', 'path', 'sha256', 'sourceUrl', 'license'],
  widgetProvenance: ['widgetId', 'widgetName', 'widgetVersion', 'insertedAt'],
  globalEntry: ['name', 'value'],
  gaugeSettings: [
    'startAngle',
    'endAngle',
    'min',
    'max',
    'thickness',
    'track',
    'progress',
    'roundCap',
    'gradientSegments',
    'animation',
  ],
  lineSettings: [
    'lineWidth',
    'interpolation',
    'dash',
    'stroke',
    'palette',
    'area',
    'showMarkers',
    'markerSize',
    'windowSeconds',
    'maxPoints',
    'min',
    'max',
    'showAxes',
    'sampling',
    'animation',
  ],
  barSettings: [
    'orientation',
    'min',
    'max',
    'barWidth',
    'categoryGapPercent',
    'cornerRadius',
    'fill',
    'track',
    'showAxes',
    'showCategoryLabels',
    'animation',
  ],
  pieSettings: [
    'innerRadiusPercent',
    'outerRadiusPercent',
    'startAngle',
    'endAngle',
    'padAngle',
    'cornerRadius',
    'total',
    'remainderFill',
    'palette',
    'showLabels',
    'animation',
  ],
} as const satisfies Record<string, readonly string[]>;

export type KnownKeyShape = keyof typeof KNOWN_KEYS;

/** The key lists above, for the drift guard in `schema-sync.test.ts`. */
export function knownKeysFor(shape: KnownKeyShape): readonly string[] {
  return KNOWN_KEYS[shape];
}

class Issues {
  readonly list: ValidationIssue[] = [];

  add(code: IssueCode, path: string, message: string): void {
    this.list.push({ code, path, message });
  }

  /**
   * Rejects keys the shape does not declare.
   *
   * The message suggests the nearest known key when there is an obvious one,
   * because the whole value of this check is turning "my theme does nothing"
   * into "line 14 says visable".
   */
  unknownKeys(
    value: Record<string, unknown>,
    path: string,
    shape: KnownKeyShape,
    what: string,
  ): void {
    const allowed = KNOWN_KEYS[shape];

    for (const key of Object.keys(value)) {
      if (allowed.includes(key as never)) {
        continue;
      }

      const suggestion = nearestKey(key, allowed);

      this.add(
        'unknown-field',
        `${path}/${key}`,
        suggestion === undefined
          ? `${what} has no "${key}" property.`
          : `${what} has no "${key}" property. Did you mean "${suggestion}"?`,
      );
    }
  }

  /** True when `value` is a plain object; records an issue and returns false otherwise. */
  object(value: unknown, path: string, what: string): value is Record<string, unknown> {
    if (!isRecord(value)) {
      this.add('wrong-type', path, `${what} must be an object.`);
      return false;
    }
    return true;
  }

  finiteNumber(value: unknown, path: string, what: string): value is number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.add('wrong-type', path, `${what} must be a finite number.`);
      return false;
    }
    return true;
  }

  stableId(value: unknown, path: string, what: string): value is string {
    if (typeof value !== 'string' || !STABLE_ID_PATTERN.test(value)) {
      this.add(
        'invalid-id',
        path,
        `${what} must match ${STABLE_ID_PATTERN.source} — 1–64 letters, digits, underscores or dashes.`,
      );
      return false;
    }
    return true;
  }

  enumValue<T extends string>(
    value: unknown,
    allowed: readonly T[],
    path: string,
    what: string,
  ): boolean {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      this.add('invalid-enum', path, `${what} must be one of: ${allowed.join(', ')}.`);
      return false;
    }
    return true;
  }
}

/** Validates a parsed JSON value as a theme document. */
export function validateThemeDocument(input: unknown): ValidationResult {
  const issues = new Issues();

  if (!issues.object(input, '', 'The document')) {
    return { ok: false, issues: [{ code: 'not-an-object', path: '', message: 'The document must be a JSON object.' }] };
  }

  // §141: version first, and alone. Anything else we might report about a format
  // we do not understand would be speculation.
  const versionIssue = checkSchemaVersion(input['schemaVersion']);
  if (versionIssue) {
    return { ok: false, issues: [versionIssue] };
  }

  issues.unknownKeys(input, '', 'document', 'A theme document');

  const metadata = input['metadata'];
  if (metadata !== undefined && issues.object(metadata, '/metadata', 'metadata')) {
    issues.unknownKeys(metadata, '/metadata', 'metadata', 'Document metadata');
  }

  if (!issues.stableId(input['id'], '/id', 'The document id')) {
    // Keep going: an unusable id does not stop the rest from being checked.
  }

  validateArtboard(issues, input['artboard']);

  const globalKeys = validateGlobals(issues, input['globals']);
  const assetIds = validateAssets(issues, input['assets']);

  validateStyleValue(issues, resolveOptional(input['artboard'], 'background'), '/artboard/background', globalKeys);
  validateStyleValue(issues, resolveOptional(input['artboard'], 'barColor'), '/artboard/barColor', globalKeys);

  validateNodes(issues, input['nodes'], globalKeys, assetIds);

  if (issues.list.length > 0) {
    return { ok: false, issues: issues.list };
  }

  // The checks above establish every field this cast asserts. It is the one
  // unchecked narrowing in the module, and it is sound only because of them —
  // an early return added above it would silently make it a lie.
  return { ok: true, document: input as unknown as ThemeDocument };
}

function checkSchemaVersion(value: unknown): ValidationIssue | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return {
      code: 'missing-field',
      path: '/schemaVersion',
      message: 'schemaVersion is required and must be an integer.',
    };
  }

  if (value > SUPPORTED_SCHEMA_VERSION) {
    return {
      code: 'newer-schema-version',
      path: '/schemaVersion',
      message:
        `This theme was made with a newer version of Vigilia (schema ${value}; ` +
        `this build supports ${SUPPORTED_SCHEMA_VERSION}). Update Vigilia to open it.`,
    };
  }

  if (value !== SUPPORTED_SCHEMA_VERSION) {
    return {
      code: 'unsupported-schema-version',
      path: '/schemaVersion',
      message: `Schema version ${value} is not supported by this build (expected ${SUPPORTED_SCHEMA_VERSION}).`,
    };
  }

  return undefined;
}

function validateArtboard(issues: Issues, value: unknown): void {
  if (!issues.object(value, '/artboard', 'artboard')) {
    return;
  }

  issues.unknownKeys(value, '/artboard', 'artboard', 'The artboard');

  for (const dimension of ['width', 'height'] as const) {
    const path = `/artboard/${dimension}`;
    const raw = value[dimension];

    if (!issues.finiteNumber(raw, path, dimension)) {
      continue;
    }

    if (raw <= 0 || raw > MAX_ARTBOARD_DIMENSION) {
      issues.add(
        'out-of-range',
        path,
        `${dimension} must be above 0 and at most ${MAX_ARTBOARD_DIMENSION}.`,
      );
    }
  }

  if (value['fitMode'] !== undefined) {
    issues.enumValue(value['fitMode'], ['contain', 'cover'] as const, '/artboard/fitMode', 'fitMode');
  }
}

/** Returns the set of valid `group.id` references. */
function validateGlobals(issues: Issues, value: unknown): Set<string> {
  const keys = new Set<string>();

  if (value === undefined) {
    return keys;
  }

  if (!issues.object(value, '/globals', 'globals')) {
    return keys;
  }

  for (const [groupName, group] of Object.entries(value)) {
    const groupPath = `/globals/${groupName}`;

    if (!GLOBAL_GROUPS.includes(groupName as (typeof GLOBAL_GROUPS)[number])) {
      issues.add('invalid-enum', groupPath, `Unknown global group. Expected one of: ${GLOBAL_GROUPS.join(', ')}.`);
      continue;
    }

    if (!issues.object(group, groupPath, `globals.${groupName}`)) {
      continue;
    }

    for (const [entryId, entry] of Object.entries(group)) {
      const entryPath = `${groupPath}/${entryId}`;

      if (!issues.stableId(entryId, entryPath, 'A global id')) {
        continue;
      }

      if (!issues.object(entry, entryPath, 'A global entry')) {
        continue;
      }

      issues.unknownKeys(entry, entryPath, 'globalEntry', 'A global entry');

      if (typeof entry['name'] !== 'string' || entry['name'].length === 0) {
        issues.add('missing-field', `${entryPath}/name`, 'A global entry needs a non-empty display name.');
      }

      if (!('value' in entry)) {
        issues.add('missing-field', `${entryPath}/value`, 'A global entry needs a value.');
      }

      keys.add(`${groupName}.${entryId}`);
    }
  }

  return keys;
}

/** Returns the set of declared asset IDs. */
function validateAssets(issues: Issues, value: unknown): Set<string> {
  const ids = new Set<string>();

  if (value === undefined) {
    return ids;
  }

  if (!Array.isArray(value)) {
    issues.add('wrong-type', '/assets', 'assets must be an array.');
    return ids;
  }

  for (const [index, asset] of value.entries()) {
    const path = `/assets/${index}`;

    if (!issues.object(asset, path, 'An asset reference')) {
      continue;
    }

    issues.unknownKeys(asset, path, 'assetReference', 'An asset reference');

    if (issues.stableId(asset['id'], `${path}/id`, 'An asset id')) {
      const id = asset['id'] as string;
      if (ids.has(id)) {
        issues.add('duplicate-id', `${path}/id`, `Asset id "${id}" is used more than once.`);
      }
      ids.add(id);
    }

    issues.enumValue(
      asset['kind'],
      ['image', 'svg', 'gif', 'video', 'font'] as const,
      `${path}/kind`,
      'An asset kind',
    );

    validateAssetPath(issues, asset['path'], `${path}/path`);

    if (asset['sha256'] !== undefined && !/^[a-f0-9]{64}$/.test(String(asset['sha256']))) {
      issues.add('wrong-type', `${path}/sha256`, 'sha256 must be 64 lowercase hex characters.');
    }
  }

  return ids;
}

/**
 * Checks an asset path.
 *
 * The traversal check is NOT redundant with the pattern. `ASSET_PATH_PATTERN`
 * permits `.`, `/` and `-`, so `assets/../../secrets.env` matches it — the
 * schema's own description claims traversal is rejected, but its pattern alone
 * does not do that. Rejecting a `..` segment is the part that actually holds.
 */
function validateAssetPath(issues: Issues, value: unknown, path: string): void {
  if (typeof value !== 'string') {
    issues.add('missing-field', path, 'An asset needs a package-relative path.');
    return;
  }

  if (!ASSET_PATH_PATTERN.test(value)) {
    issues.add('invalid-asset-path', path, 'An asset path must be under assets/ and use safe characters.');
    return;
  }

  if (value.split('/').includes('..')) {
    issues.add(
      'invalid-asset-path',
      path,
      'An asset path must not contain a ".." segment: it would escape the package.',
    );
  }
}

function validateNodes(
  issues: Issues,
  value: unknown,
  globalKeys: Set<string>,
  assetIds: Set<string>,
): void {
  if (!Array.isArray(value)) {
    issues.add('wrong-type', '/nodes', 'nodes must be an array.');
    return;
  }

  const nodeIds = new Set<string>();
  const bindingIds = new Set<string>();
  const counter = { nodes: 0 };

  validateNodeList(issues, value, '/nodes', 0, { nodeIds, bindingIds, globalKeys, assetIds, counter });
}

interface NodeContext {
  readonly nodeIds: Set<string>;
  readonly bindingIds: Set<string>;
  readonly globalKeys: Set<string>;
  readonly assetIds: Set<string>;
  readonly counter: { nodes: number };
}

function validateNodeList(
  issues: Issues,
  nodes: readonly unknown[],
  path: string,
  depth: number,
  context: NodeContext,
): void {
  if (depth > MAX_NODE_DEPTH) {
    issues.add(
      'too-deep',
      path,
      `Node nesting exceeds the maximum depth of ${MAX_NODE_DEPTH}.`,
    );
    return;
  }

  for (const [index, node] of nodes.entries()) {
    validateNode(issues, node, `${path}/${index}`, depth, context);
  }
}

function validateNode(
  issues: Issues,
  value: unknown,
  path: string,
  depth: number,
  context: NodeContext,
): void {
  if (!issues.object(value, path, 'A node')) {
    return;
  }

  issues.unknownKeys(value, path, 'node', 'A node');

  context.counter.nodes += 1;
  if (context.counter.nodes === MAX_NODE_COUNT + 1) {
    issues.add('too-many-nodes', path, `The document exceeds the maximum of ${MAX_NODE_COUNT} nodes.`);
  }

  if (issues.stableId(value['id'], `${path}/id`, 'A node id')) {
    const id = value['id'] as string;
    if (context.nodeIds.has(id)) {
      // §75: links are by stable id, so a duplicate makes them ambiguous.
      issues.add('duplicate-id', `${path}/id`, `Node id "${id}" is used more than once.`);
    }
    context.nodeIds.add(id);
  }

  if (!issues.enumValue(value['type'], NODE_TYPES, `${path}/type`, 'A node type')) {
    return;
  }

  const type = value['type'] as (typeof NODE_TYPES)[number];

  validateTransform(issues, value['transform'], `${path}/transform`);

  for (const flag of ['visible', 'locked'] as const) {
    if (value[flag] !== undefined && typeof value[flag] !== 'boolean') {
      issues.add('wrong-type', `${path}/${flag}`, `${flag} must be a boolean.`);
    }
  }

  validateProvenance(issues, value['provenance'], `${path}/provenance`);

  validateStyleMap(issues, value['style'], `${path}/style`, context.globalKeys);

  const ownBindingIds = validateBindings(issues, value['bindings'], `${path}/bindings`, type, context);

  validateContent(issues, value, path, type, ownBindingIds, context, depth);
}

/**
 * Checks an inserted widget's provenance stamp (§138).
 *
 * Only `widgetId` is required. A widget exported without a name or version is
 * still a widget, and rejecting the stamp would lose the only record of where a
 * subtree came from.
 */
function validateProvenance(issues: Issues, value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }

  if (!issues.object(value, path, 'provenance')) {
    return;
  }

  issues.unknownKeys(value, path, 'widgetProvenance', 'A provenance stamp');
  issues.stableId(value['widgetId'], `${path}/widgetId`, 'A provenance widgetId');

  for (const key of ['widgetName', 'widgetVersion', 'insertedAt'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      issues.add('wrong-type', `${path}/${key}`, `${key} must be a string.`);
    }
  }
}

function validateTransform(issues: Issues, value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }

  if (!issues.object(value, path, 'transform')) {
    return;
  }

  issues.unknownKeys(value, path, 'transform', 'A transform');

  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY'] as const) {
    const raw = value[key];
    if (raw === undefined) {
      continue;
    }

    if (!issues.finiteNumber(raw, `${path}/${key}`, key)) {
      continue;
    }

    if ((key === 'width' || key === 'height') && raw < 0) {
      issues.add('out-of-range', `${path}/${key}`, `${key} must not be negative.`);
    }

    if (key === 'rotation' && (raw < -360 || raw > 360)) {
      issues.add('out-of-range', `${path}/${key}`, 'rotation must be within −360…360 degrees.');
    }
  }
}

function validateStyleMap(
  issues: Issues,
  value: unknown,
  path: string,
  globalKeys: Set<string>,
): void {
  if (value === undefined) {
    return;
  }

  if (!issues.object(value, path, 'style')) {
    return;
  }

  for (const [property, styleValue] of Object.entries(value)) {
    if (!isKnownStyleProperty(property)) {
      issues.add('unknown-field', `${path}/${property}`, `Unknown style property "${property}".`);
      continue;
    }
    validateStyleValue(issues, styleValue, `${path}/${property}`, globalKeys);
  }
}

/**
 * §75: either a global reference or a local literal, and the document must say
 * which. Both together is rejected rather than resolved by precedence — a
 * silent winner is how a theme ends up showing a colour nobody can find in the
 * inspector.
 */
function validateStyleValue(
  issues: Issues,
  value: unknown,
  path: string,
  globalKeys: Set<string>,
): void {
  if (value === undefined) {
    return;
  }

  if (!issues.object(value, path, 'A style value')) {
    return;
  }

  const hasRef = 'ref' in value;
  const hasValue = 'value' in value;

  if (hasRef && hasValue) {
    issues.add(
      'style-value-ambiguous',
      path,
      'A style value must be either a global "ref" or a local "value", not both.',
    );
    return;
  }

  if (!hasRef && !hasValue) {
    issues.add(
      'style-value-ambiguous',
      path,
      'A style value must declare either a global "ref" or a local "value".',
    );
    return;
  }

  if (!hasRef) {
    return;
  }

  const ref = value['ref'];

  if (typeof ref !== 'string') {
    issues.add('wrong-type', `${path}/ref`, 'A global reference must be a string.');
    return;
  }

  const [group, ...rest] = ref.split('.');
  const entryId = rest.join('.');

  if (!GLOBAL_GROUPS.includes(group as (typeof GLOBAL_GROUPS)[number]) || entryId.length === 0) {
    issues.add(
      'unresolved-global-ref',
      `${path}/ref`,
      `"${ref}" is not a valid global reference. Use one of: ${GLOBAL_GROUPS.join(', ')}.<id>.`,
    );
    return;
  }

  if (!globalKeys.has(ref)) {
    issues.add('unresolved-global-ref', `${path}/ref`, `Global "${ref}" is not defined in this document.`);
  }
}

/** Returns the binding IDs declared on this node. */
function validateBindings(
  issues: Issues,
  value: unknown,
  path: string,
  type: (typeof NODE_TYPES)[number],
  context: NodeContext,
): Set<string> {
  const own = new Set<string>();

  if (value !== undefined && !Array.isArray(value)) {
    issues.add('wrong-type', path, 'bindings must be an array.');
    return own;
  }

  const bindings = (value ?? []) as readonly unknown[];
  const arity = BINDING_ARITY[type];

  if (bindings.length < arity.min || bindings.length > arity.max) {
    issues.add(
      'binding-count',
      path,
      arity.max === 0
        ? `A ${type} node reads no sensor data, so it must declare no bindings. A binding nothing reads would silently do nothing.`
        : `A ${type} node must declare between ${arity.min} and ${arity.max} bindings.`,
    );
  }

  for (const [index, binding] of bindings.entries()) {
    const bindingPath = `${path}/${index}`;

    if (!issues.object(binding, bindingPath, 'A binding')) {
      continue;
    }

    issues.unknownKeys(binding, bindingPath, 'binding', 'A binding');

    if (issues.stableId(binding['id'], `${bindingPath}/id`, 'A binding id')) {
      const id = binding['id'] as string;
      if (context.bindingIds.has(id)) {
        issues.add('duplicate-id', `${bindingPath}/id`, `Binding id "${id}" is used more than once.`);
      }
      context.bindingIds.add(id);
      own.add(id);
    }

    const key = binding['semanticKey'];
    if (typeof key !== 'string' || key.length === 0 || key.length > 120) {
      // §93: the semantic key is the whole point of a binding — a provider
      // instance id here would defeat provider replacement.
      issues.add('missing-field', `${bindingPath}/semanticKey`, 'A binding needs a semantic key of 1–120 characters.');
    }

    const precision = binding['precision'];
    if (precision !== undefined) {
      if (!Number.isInteger(precision) || (precision as number) < 0 || (precision as number) > 6) {
        issues.add('out-of-range', `${bindingPath}/precision`, 'precision must be an integer from 0 to 6.');
      }
    }

    if (binding['unitDisplay'] !== undefined) {
      issues.enumValue(
        binding['unitDisplay'],
        ['none', 'short', 'long'] as const,
        `${bindingPath}/unitDisplay`,
        'unitDisplay',
      );
    }

    for (const numeric of ['scale', 'offset'] as const) {
      if (binding[numeric] !== undefined) {
        issues.finiteNumber(binding[numeric], `${bindingPath}/${numeric}`, numeric);
      }
    }
  }

  return own;
}

function validateContent(
  issues: Issues,
  node: Record<string, unknown>,
  path: string,
  type: (typeof NODE_TYPES)[number],
  ownBindingIds: Set<string>,
  context: NodeContext,
  depth: number,
): void {
  const content = node['content'];

  switch (type) {
    case 'group': {
      const children = node['children'];
      if (!Array.isArray(children)) {
        issues.add('missing-field', `${path}/children`, 'A group must have a children array.');
        return;
      }
      validateNodeList(issues, children, `${path}/children`, depth + 1, context);
      return;
    }

    case 'text':
      validateTextContent(issues, content, `${path}/content`, ownBindingIds, context.globalKeys);
      return;

    case 'chart':
      validateChartContent(issues, content, `${path}/content`, ownBindingIds.size, path);
      return;

    case 'image':
    case 'video': {
      if (!issues.object(content, `${path}/content`, `A ${type} node's content`)) {
        return;
      }

      issues.unknownKeys(
        content,
        `${path}/content`,
        type === 'image' ? 'imageContent' : 'videoContent',
        `A ${type} node's content`,
      );
      const assetId = content['assetId'];
      if (typeof assetId !== 'string') {
        issues.add('missing-field', `${path}/content/assetId`, `A ${type} node needs an assetId.`);
        return;
      }
      if (!context.assetIds.has(assetId)) {
        issues.add(
          'unresolved-asset-ref',
          `${path}/content/assetId`,
          `Asset "${assetId}" is not declared in this document's assets.`,
        );
      }
      return;
    }

    case 'rectangle': {
      if (content === undefined) {
        return;
      }
      if (!issues.object(content, `${path}/content`, "A rectangle node's content")) {
        return;
      }

      issues.unknownKeys(content, `${path}/content`, 'rectangleContent', "A rectangle's content");
      const radius = content['cornerRadius'];
      if (radius !== undefined) {
        if (issues.finiteNumber(radius, `${path}/content/cornerRadius`, 'cornerRadius') && radius < 0) {
          issues.add('out-of-range', `${path}/content/cornerRadius`, 'cornerRadius must not be negative.');
        }
      }
      return;
    }

    case 'ellipse':
    case 'line':
      return;
  }
}

function validateTextContent(
  issues: Issues,
  value: unknown,
  path: string,
  ownBindingIds: Set<string>,
  globalKeys: Set<string>,
): void {
  if (!issues.object(value, path, "A text node's content")) {
    return;
  }

  issues.unknownKeys(value, path, 'textContent', "A text node's content");

  const runs = value['runs'];

  if (!Array.isArray(runs)) {
    issues.add('missing-field', `${path}/runs`, 'A text node needs a runs array (§89 styled runs).');
    return;
  }

  for (const [index, run] of runs.entries()) {
    const runPath = `${path}/runs/${index}`;

    if (!issues.object(run, runPath, 'A text run')) {
      continue;
    }

    if (!issues.enumValue(run['kind'], ['literal', 'value'] as const, `${runPath}/kind`, 'A run kind')) {
      continue;
    }

    issues.unknownKeys(
      run,
      runPath,
      run['kind'] === 'literal' ? 'literalRun' : 'valueRun',
      `A ${String(run['kind'])} run`,
    );

    if (run['kind'] === 'literal') {
      if (typeof run['text'] !== 'string') {
        issues.add('missing-field', `${runPath}/text`, 'A literal run needs text.');
      }
    } else {
      const bindingId = run['bindingId'];

      if (typeof bindingId !== 'string') {
        issues.add('missing-field', `${runPath}/bindingId`, 'A value run needs a bindingId.');
      } else if (!ownBindingIds.has(bindingId)) {
        // Deliberately node-local. A run reading another node's binding would
        // make a text element's data depend on a node it has no relationship
        // to, and moving either one would break it invisibly.
        issues.add(
          'unresolved-binding-ref',
          `${runPath}/bindingId`,
          `Binding "${bindingId}" is not declared on this node.`,
        );
      }
    }

    validateStyleMap(issues, run['style'], `${runPath}/style`, globalKeys);
  }
}

function validateChartContent(
  issues: Issues,
  value: unknown,
  path: string,
  bindingCount: number,
  nodePath: string,
): void {
  if (!issues.object(value, path, "A chart node's content")) {
    return;
  }

  issues.unknownKeys(value, path, 'chartContent', "A chart node's content");

  if (!issues.enumValue(value['family'], CHART_FAMILIES, `${path}/family`, 'A chart family')) {
    return;
  }

  const family = value['family'] as (typeof CHART_FAMILIES)[number];
  const arity = CHART_BINDING_ARITY[family];

  if (bindingCount < arity.min || bindingCount > arity.max) {
    issues.add(
      'binding-count',
      `${nodePath}/bindings`,
      family === 'gauge'
        ? 'A gauge reads one value against a range, so it must declare exactly one binding.'
        : `A ${family} chart must declare between ${arity.min} and ${arity.max} bindings.`,
    );
  }

  const settings = value['settings'];

  if (!issues.object(settings, `${path}/settings`, "A chart's settings")) {
    return;
  }

  issues.unknownKeys(settings, `${path}/settings`, `${family}Settings`, `${family} settings`);

  validateSettingsRange(issues, settings, `${path}/settings`, family);
}

/**
 * Checks the numeric invariants that would otherwise render nothing or divide by
 * zero. This is not a full settings validation: the adapters clamp their own
 * cosmetic inputs, and duplicating every bound here would be a second place to
 * keep in sync. What is checked here is what the adapters cannot recover from.
 */
function validateSettingsRange(
  issues: Issues,
  settings: Record<string, unknown>,
  path: string,
  family: (typeof CHART_FAMILIES)[number],
): void {
  if (family === 'gauge' || family === 'bar') {
    const min = settings['min'];
    const max = settings['max'];

    const minOk = issues.finiteNumber(min, `${path}/min`, 'min');
    const maxOk = issues.finiteNumber(max, `${path}/max`, 'max');

    if (minOk && maxOk && (max as number) <= (min as number)) {
      issues.add('out-of-range', `${path}/max`, 'max must be greater than min.');
    }
    return;
  }

  if (family === 'line') {
    for (const key of ['windowSeconds', 'maxPoints'] as const) {
      const raw = settings[key];
      if (issues.finiteNumber(raw, `${path}/${key}`, key) && (raw as number) <= 0) {
        issues.add('out-of-range', `${path}/${key}`, `${key} must be above 0.`);
      }
    }
    return;
  }

  // Pie. A zero-width ring draws nothing, which looks like a broken theme
  // rather than an authoring mistake.
  const inner = settings['innerRadiusPercent'];
  const outer = settings['outerRadiusPercent'];

  const innerOk = issues.finiteNumber(inner, `${path}/innerRadiusPercent`, 'innerRadiusPercent');
  const outerOk = issues.finiteNumber(outer, `${path}/outerRadiusPercent`, 'outerRadiusPercent');

  if (innerOk && outerOk && (outer as number) <= (inner as number)) {
    issues.add(
      'out-of-range',
      `${path}/outerRadiusPercent`,
      'outerRadiusPercent must be greater than innerRadiusPercent.',
    );
  }

  const total = settings['total'];
  if (isRecord(total) && total['kind'] === 'fixed' && !Number.isFinite(total['value'])) {
    issues.add('wrong-type', `${path}/total/value`, 'A fixed total needs a finite value.');
  }
}

/**
 * The known key closest to a misspelling, or undefined if none is close.
 *
 * Case-insensitive Levenshtein with a distance cap of 3, which catches
 * `visable`, `strokewidth` and `cornerRadious` without inventing a suggestion
 * for a key that was simply never part of the format.
 */
function nearestKey(key: string, allowed: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 4;

  for (const candidate of allowed) {
    const distance = editDistance(key.toLowerCase(), candidate.toLowerCase());

    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function editDistance(a: string, b: string): number {
  // Single-row Levenshtein: the inputs are property names, so this runs on
  // strings of a dozen characters and allocating a matrix would be wasteful.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = current[j - 1]! + 1;
      const deletion = previous[j]! + 1;
      current.push(Math.min(substitution, insertion, deletion));
    }

    previous = current;
  }

  return previous[b.length]!;
}

function resolveOptional(container: unknown, key: string): unknown {
  return isRecord(container) ? container[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
