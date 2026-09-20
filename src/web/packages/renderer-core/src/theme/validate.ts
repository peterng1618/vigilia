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

/** Validates parsed theme documents, including cross-reference and structural invariants. */

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
  | 'too-many-nodes'
  | 'invalid-fabric-scene';

export interface ValidationIssue {
  readonly code: IssueCode;
  /** JSON Pointer for editor navigation. */
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly document: ThemeDocument }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Bindings each node type may consume. */
const BINDING_ARITY: Record<
  (typeof NODE_TYPES)[number],
  { readonly min: number; readonly max: number }
> = {
  group: { min: 0, max: 0 },
  rectangle: { min: 0, max: 0 },
  ellipse: { min: 0, max: 0 },
  line: { min: 0, max: 0 },
  text: { min: 0, max: 64 },
  chart: { min: 1, max: 64 },
  image: { min: 0, max: 0 },
  video: { min: 0, max: 0 },
};

const CHART_BINDING_ARITY: Record<
  (typeof CHART_FAMILIES)[number],
  { readonly min: number; readonly max: number }
> = {
  gauge: { min: 1, max: 1 },
  line: { min: 1, max: 16 },
  bar: { min: 1, max: 64 },
  pie: { min: 1, max: 64 },
};

/** Known keys mirror schema shapes with `additionalProperties: false`. */
const KNOWN_KEYS = {
  document: ['schemaVersion', 'id', 'metadata', 'artboard', 'globals', 'nodes', 'assets', 'editorMetadata'],
  metadata: ['name', 'author', 'description', 'version', 'createdAt', 'updatedAt'],
  artboard: ['width', 'height', 'background', 'fitMode', 'barColor', 'backgroundMedia'],
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
  literalRun: ['kind', 'text', 'typePreset', 'style'],
  valueRun: ['kind', 'bindingId', 'precision', 'unitDisplay', 'typePreset', 'style'],
  chartContent: ['family', 'settings'],
  rectangleContent: ['cornerRadius'],
  imageContent: ['assetId', 'fit', 'monochrome'],
  videoContent: ['assetId', 'loop', 'muted'],
  assetReference: ['id', 'kind', 'path', 'sha256', 'sourceUrl', 'license', 'family', 'weight', 'style', 'format'],
  widgetProvenance: ['widgetId', 'widgetName', 'widgetVersion', 'insertedAt'],
  globalEntry: ['name', 'value'],
  typePreset: ['family', 'size', 'weight', 'letterSpacing', 'lineHeight', 'face', 'trioRole'],
  fontFaceReference: ['assetId'],
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

/** Exposed for schema drift tests. */
export function knownKeysFor(shape: KnownKeyShape): readonly string[] {
  return KNOWN_KEYS[shape];
}

class Issues {
  readonly list: ValidationIssue[] = [];

  add(code: IssueCode, path: string, message: string): void {
    this.list.push({ code, path, message });
  }

  /** Rejects unknown keys and suggests a close declared key when useful. */
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

export function validateThemeDocument(input: unknown): ValidationResult {
  const issues = new Issues();

  if (!issues.object(input, '', 'The document')) {
    return { ok: false, issues: [{ code: 'not-an-object', path: '', message: 'The document must be a JSON object.' }] };
  }

  // Version is checked first and alone; other validation would interpret an unknown format.
  const versionIssue = checkSchemaVersion(input['schemaVersion']);
  if (versionIssue) {
    return { ok: false, issues: [versionIssue] };
  }

  issues.unknownKeys(input, '', 'document', 'A theme document');

  const metadata = input['metadata'];
  if (metadata !== undefined && issues.object(metadata, '/metadata', 'metadata')) {
    issues.unknownKeys(metadata, '/metadata', 'metadata', 'Document metadata');
    if (metadata['version'] !== undefined && (typeof metadata['version'] !== 'string' || !/^\d+\.\d+\.\d+$/.test(metadata['version']))) {
      issues.add('wrong-type', '/metadata/version', 'version must be a semantic major.minor.patch string.');
    }
  }

  if (!issues.stableId(input['id'], '/id', 'The document id')) {
    // Continue to report all errors in this supported format.
  }

  validateArtboard(issues, input['artboard']);

  const globalKeys = validateGlobals(issues, input['globals']);
  const assetIds = validateAssets(issues, input['assets']);
  validateBackgroundMedia(issues, resolveOptional(input['artboard'], 'backgroundMedia'), input['assets']);

  validateStyleValue(issues, resolveOptional(input['artboard'], 'background'), '/artboard/background', globalKeys);
  validateStyleValue(issues, resolveOptional(input['artboard'], 'barColor'), '/artboard/barColor', globalKeys);

  validateNodes(issues, input['nodes'], globalKeys, assetIds);

  if (issues.list.length > 0) {
    return { ok: false, issues: issues.list };
  }

  // All fields have been narrowed by the checks above.
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

/** Returns valid `group.id` references. */
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

      if (groupName === 'typePresets') {
        validateTypePreset(issues, entry['value'], `${entryPath}/value`);
      }

      keys.add(`${groupName}.${entryId}`);
    }
  }

  return keys;
}

function validateBackgroundMedia(issues: Issues, value: unknown, assets: unknown): void {
  if (value === undefined) return;
  if (!issues.object(value, '/artboard/backgroundMedia', 'backgroundMedia')) return;
  for (const key of Object.keys(value)) if (key !== 'assetId' && key !== 'fit') issues.add('unknown-field', `/artboard/backgroundMedia/${key}`, `backgroundMedia has no "${key}" property.`);
  issues.enumValue(value['fit'], ['contain', 'cover'] as const, '/artboard/backgroundMedia/fit', 'fit');
  const asset = Array.isArray(assets) ? assets.find((entry) => isRecord(entry) && entry['id'] === value['assetId']) : undefined;
  if (!isRecord(asset) || !['image', 'svg', 'video'].includes(String(asset['kind']))) {
    issues.add('unresolved-asset-ref', '/artboard/backgroundMedia/assetId', 'backgroundMedia must reference a declared image, SVG or video asset.');
  }
}

function validateTypePreset(issues: Issues, value: unknown, path: string): void {
  if (!issues.object(value, path, 'A type preset')) return;
  issues.unknownKeys(value, path, 'typePreset', 'A type preset');
  if (typeof value['family'] !== 'string' || value['family'].trim().length === 0) {
    issues.add('missing-field', `${path}/family`, 'A type preset needs a font family.');
  }
  if (!issues.finiteNumber(value['size'], `${path}/size`, 'size') || (value['size'] as number) <= 0) {
    issues.add('out-of-range', `${path}/size`, 'A type preset size must be above 0.');
  }
  const weight = value['weight'];
  if (weight !== undefined && typeof weight !== 'string' && (typeof weight !== 'number' || !Number.isFinite(weight))) {
    issues.add('wrong-type', `${path}/weight`, 'A type preset weight must be a string or finite number.');
  }
  for (const key of ['letterSpacing', 'lineHeight'] as const) {
    const raw = value[key];
    if (raw !== undefined && !issues.finiteNumber(raw, `${path}/${key}`, key)) continue;
    if (key === 'lineHeight' && raw !== undefined && (raw as number) <= 0) {
      issues.add('out-of-range', `${path}/${key}`, 'A type preset lineHeight must be above 0.');
    }
  }
  const face = value['face'];
  if (face !== undefined) {
    if (!issues.object(face, `${path}/face`, 'A font face reference')) return;
    issues.unknownKeys(face, `${path}/face`, 'fontFaceReference', 'A font face reference');
    issues.stableId(face['assetId'], `${path}/face/assetId`, 'A font face asset id');
  }
  if (value['trioRole'] !== undefined) {
    issues.enumValue(value['trioRole'], ['heading', 'body', 'mono'] as const, `${path}/trioRole`, 'A trio role');
  }
}

/** Returns declared asset IDs. */
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

    if (asset['kind'] === 'font') validateFontAsset(issues, asset, path);

    if (asset['sha256'] !== undefined && !/^[a-f0-9]{64}$/.test(String(asset['sha256']))) {
      issues.add('wrong-type', `${path}/sha256`, 'sha256 must be 64 lowercase hex characters.');
    }
  }

  return ids;
}

/** Pattern matching alone does not reject `..`; traversal is checked explicitly. */
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

/** Only widgetId is required on provenance. */
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

function validateFontAsset(issues: Issues, asset: Record<string, unknown>, path: string): void {
  if (typeof asset['family'] !== 'string' || asset['family'].trim().length === 0) {
    issues.add('missing-field', `${path}/family`, 'A font asset needs a font family.');
  }
  if (typeof asset['weight'] !== 'string' && (typeof asset['weight'] !== 'number' || !Number.isFinite(asset['weight']))) {
    issues.add('wrong-type', `${path}/weight`, 'A font asset weight must be a string or finite number.');
  }
  issues.enumValue(asset['style'], ['normal', 'italic'] as const, `${path}/style`, 'A font asset style');
  if (asset['format'] !== 'woff2') issues.add('invalid-enum', `${path}/format`, 'A font asset format must be woff2.');
  if (typeof asset['path'] !== 'string' || !asset['path'].endsWith('.woff2')) {
    issues.add('invalid-asset-path', `${path}/path`, 'A WOFF2 font asset path must end in .woff2.');
  }
  if (typeof asset['sourceUrl'] !== 'string' || !isHttpUrl(asset['sourceUrl'])) {
    issues.add('wrong-type', `${path}/sourceUrl`, 'A font asset needs an HTTPS Fontsource source URL.');
  }
  const license = asset['license'];
  if (!isRecord(license) || typeof license['name'] !== 'string' || license['name'].trim().length === 0 || typeof license['url'] !== 'string' || !isHttpUrl(license['url'])) {
    issues.add('missing-field', `${path}/license`, 'A font asset needs licence name and URL metadata.');
  }
}

function isHttpUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Style values must declare exactly one of `ref` or `value`. */
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

/** Returns binding IDs declared on this node. */
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
        // Value runs may reference bindings on their own node only.
        issues.add(
          'unresolved-binding-ref',
          `${runPath}/bindingId`,
          `Binding "${bindingId}" is not declared on this node.`,
        );
      }
    }

    validateStyleMap(issues, run['style'], `${runPath}/style`, globalKeys);
    validateTypePresetReference(issues, run['typePreset'], `${runPath}/typePreset`, globalKeys);
  }
}

function validateTypePresetReference(issues: Issues, value: unknown, path: string, globalKeys: Set<string>): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^typePresets\.[A-Za-z0-9_-]{1,64}$/.test(value)) {
    issues.add('unresolved-global-ref', path, 'A text run typePreset must reference typePresets.<id>.');
  } else if (!globalKeys.has(value)) {
    issues.add('unresolved-global-ref', path, `Type preset "${value}" is not defined in this document.`);
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

/** Validates only settings invariants adapters cannot recover from. */
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

/** Returns a close known key for typo diagnostics, capped at edit distance 3. */
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
  // Single-row Levenshtein is enough for short property names.
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
