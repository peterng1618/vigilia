import {
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  STABLE_ID_PATTERN,
} from './document.js';
import type { FabricThemeEnvelope } from './fabric-envelope.js';
import { validateThemeDocument, type ValidationIssue } from './validate.js';

/** Bounds malformed Fabric JSON before it reaches Fabric's asynchronous revival. */
const MAX_SCENE_DEPTH = MAX_NODE_DEPTH + 8;

export type FabricEnvelopeValidationResult =
  | { readonly ok: true; readonly envelope: FabricThemeEnvelope }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Validates the versioned product envelope; Fabric compatibility remains scene-fabric's boundary. */
export function validateFabricThemeEnvelope(input: unknown): FabricEnvelopeValidationResult {
  if (!isRecord(input)) {
    return fail('not-an-object', '', 'The Fabric theme must be a JSON object.');
  }

  // An unknown version cannot be safely interpreted, so report it alone (§141).
  const version = input['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return fail('missing-field', '/schemaVersion', 'schemaVersion is required and must be an integer.');
  }
  if (version > 2) {
    return fail('newer-schema-version', '/schemaVersion', `This theme was made with a newer version of Vigilia (schema ${version}). Update Vigilia to open it.`);
  }
  if (version !== 2) {
    return fail('unsupported-schema-version', '/schemaVersion', `Schema version ${version} is not supported by this build (expected 2).`);
  }

  const issues: ValidationIssue[] = [];
  unknownKeys(input, '', ['schemaVersion', 'fabricVersion', 'id', 'metadata', 'artboard', 'globals', 'assets', 'bindings', 'editorMetadata', 'scene'], 'A Fabric theme', issues);
  if (typeof input['fabricVersion'] !== 'string' || !/^\d+\.\d+\.\d+$/.test(input['fabricVersion'])) {
    issues.push(issue('wrong-type', '/fabricVersion', 'fabricVersion must be a pinned major.minor.patch version.'));
  }
  issues.push(...sharedSemanticIssues(input));
  paletteNone(input['globals'], issues);
  palettePaints(input['globals'], issues);
  editorMetadata(input['editorMetadata'], issues);
  rejectGifAssets(input['assets'], issues);
  const sceneIds = scene(input['scene'], issues);
  scenePaintReferences(input['scene'], input['globals'], issues);
  sceneTypeReferences(input['scene'], input['globals'], issues);
  bindings(input['bindings'], sceneIds, issues);

  return issues.length === 0
    ? { ok: true, envelope: input as unknown as FabricThemeEnvelope }
    : { ok: false, issues };
}

/** Fabric text font properties are resolved cache; runs own their type-preset references. */
function sceneTypeReferences(scene: unknown, globals: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(scene) || !Array.isArray(scene['objects'])) return;
  const presets = isRecord(globals) && isRecord(globals['typePresets']) ? globals['typePresets'] : undefined;
  const visit = (object: unknown, path: string): void => {
    if (!isRecord(object)) return;
    const hasType = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'].some((property) => object[property] !== undefined);
    if (hasType) {
      const runs = isRecord(object['vigiliaText']) && Array.isArray(object['vigiliaText']['runs']) ? object['vigiliaText']['runs'] : undefined;
      if (runs === undefined || runs.length === 0) {
        issues.push(issue('unresolved-global-ref', `${path}/vigiliaText`, 'Text font properties need authored runs with typePreset references.'));
      } else {
        for (const [index, run] of runs.entries()) {
          const ref = isRecord(run) ? run['typePreset'] : undefined;
          const preset = typeof ref === 'string' && ref.startsWith('typePresets.') ? presets?.[ref.slice('typePresets.'.length)] : undefined;
          if (!isRecord(preset) || !isRecord(preset['value'])) {
            issues.push(issue('unresolved-global-ref', `${path}/vigiliaText/runs/${index}/typePreset`, 'Text runs must reference an existing type preset.'));
            continue;
          }
          if (index === 0) matchResolvedType(object, preset['value'], path, issues);
        }
      }
    }
    if (Array.isArray(object['objects'])) object['objects'].forEach((child, index) => visit(child, `${path}/objects/${index}`));
  };
  scene['objects'].forEach((object, index) => visit(object, `/scene/objects/${index}`));
}

function matchResolvedType(object: Record<string, unknown>, preset: Record<string, unknown>, path: string, issues: ValidationIssue[]): void {
  const pairs: readonly [string, string][] = [['fontFamily', 'family'], ['fontSize', 'size'], ['fontWeight', 'weight'], ['letterSpacing', 'letterSpacing'], ['lineHeight', 'lineHeight']];
  for (const [fabricProperty, presetProperty] of pairs) {
    if (object[fabricProperty] !== undefined && object[fabricProperty] !== preset[presetProperty]) {
      issues.push(issue('unresolved-global-ref', `${path}/${fabricProperty}`, `${fabricProperty} must equal its referenced type preset.`));
    }
  }
}

/** Resolved Fabric paint is a cache; its authored owner is always a palette token. */
function scenePaintReferences(scene: unknown, globals: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(scene) || !Array.isArray(scene['objects'])) return;
  const palette = isRecord(globals) && isRecord(globals['palette']) ? globals['palette'] : undefined;
  const visit = (object: unknown, path: string): void => {
    if (!isRecord(object)) return;
    const refs = isRecord(object['vigiliaPaint']) ? object['vigiliaPaint'] : undefined;
    for (const property of ['fill', 'stroke'] as const) {
      if (object[property] === undefined || object[property] === null || object[property] === '') continue;
      const ref = refs?.[property];
      if (typeof ref !== 'string' || !ref.startsWith('palette.') || palette?.[ref.slice('palette.'.length)] === undefined) {
        issues.push(issue('unresolved-global-ref', `${path}/${property}`, `${property} must reference an existing palette token through vigiliaPaint.`));
      }
    }
    if (Array.isArray(object['objects'])) object['objects'].forEach((child, index) => visit(child, `${path}/objects/${index}`));
  };
  scene['objects'].forEach((object, index) => visit(object, `/scene/objects/${index}`));
}

/** `palette.none` is the immutable transparent fallback for v2 authoring. */
function paletteNone(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value) || value['palette'] === undefined) return;
  const palette = value['palette'];
  if (!isRecord(palette)) return;
  const none = palette['none'];
  if (!isRecord(none) || none['name'] !== 'None' || !isRecord(none['value']) || none['value']['kind'] !== 'solid' || none['value']['color'] !== 'transparent') {
    issues.push(issue('missing-field', '/globals/palette/none', 'palette.none must be the immutable transparent token.'));
  }
}

/** v2 palette tokens are paints, not untyped values carried from the old document model. */
function palettePaints(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value) || !isRecord(value['palette'])) return;
  for (const [id, entry] of Object.entries(value['palette'])) {
    const path = `/globals/palette/${id}/value`;
    if (!isRecord(entry) || !isRecord(entry['value'])) {
      issues.push(issue('wrong-type', path, 'A palette value must be a solid or linear gradient paint.'));
      continue;
    }
    const paint = entry['value'];
    if (paint['kind'] === 'solid') {
      if (typeof paint['color'] !== 'string' || paint['color'].length === 0 || Object.keys(paint).length !== 2) {
        issues.push(issue('wrong-type', path, 'A solid palette paint needs only a non-empty CSS colour.'));
      }
      continue;
    }
    if (paint['kind'] !== 'gradient' || !Number.isFinite(paint['angle']) || !Array.isArray(paint['stops']) || paint['stops'].length < 2 || Object.keys(paint).length !== 3) {
      issues.push(issue('wrong-type', path, 'A gradient palette paint needs an angle and at least two stops.'));
      continue;
    }
    let previous = -1;
    for (const [index, stop] of paint['stops'].entries()) {
      if (!isRecord(stop) || !Number.isFinite(stop['offset']) || (stop['offset'] as number) < 0 || (stop['offset'] as number) > 1 || (stop['offset'] as number) < previous || typeof stop['color'] !== 'string' || stop['color'].length === 0 || Object.keys(stop).length !== 2) {
        issues.push(issue('wrong-type', `${path}/stops/${index}`, 'Gradient stops need ascending 0–1 offsets and non-empty CSS colours.'));
      } else previous = stop['offset'] as number;
    }
  }
}

/** Reuses the one semantic validator without treating Fabric JSON as a legacy node tree. */
function sharedSemanticIssues(input: Record<string, unknown>): readonly ValidationIssue[] {
  const result = validateThemeDocument({
    schemaVersion: 1,
    id: input['id'],
    metadata: input['metadata'],
    artboard: input['artboard'],
    globals: input['globals'],
    assets: input['assets'],
    editorMetadata: input['editorMetadata'],
    nodes: [],
  });

  return result.ok ? [] : result.issues;
}

function editorMetadata(value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push(issue('wrong-type', '/editorMetadata', 'editorMetadata must be a JSON object.'));
    return;
  }
  jsonSafe(value, '/editorMetadata', 0, issues);
}

function rejectGifAssets(value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) return;
  for (const [index, asset] of value.entries()) {
    if (isRecord(asset) && asset['kind'] === 'gif') {
      issues.push(issue('invalid-enum', `/assets/${index}/kind`, 'An asset kind must be one of: image, svg, video, font.'));
    }
  }
}

function bindings(value: unknown, sceneIds: ReadonlySet<string>, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push(issue('wrong-type', '/bindings', 'bindings must be an object keyed by Fabric object id.'));
    return;
  }
  const ids = new Set<string>();
  for (const [objectId, entries] of Object.entries(value)) {
    stableId(objectId, `/bindings/${objectId}`, 'A bound Fabric object id', issues);
    if (!sceneIds.has(objectId)) {
      issues.push(issue('unresolved-binding-ref', `/bindings/${objectId}`, `Fabric object "${objectId}" is not in this scene.`));
    }
    if (!Array.isArray(entries)) {
      issues.push(issue('wrong-type', `/bindings/${objectId}`, 'Bindings for a Fabric object must be an array.'));
      continue;
    }
    for (const [index, entry] of entries.entries()) {
      const path = `/bindings/${objectId}/${index}`;
      if (!isRecord(entry)) {
        issues.push(issue('wrong-type', path, 'A binding must be an object.'));
        continue;
      }
      unknownKeys(entry, path, ['id', 'semanticKey', 'precision', 'unitDisplay', 'scale', 'offset'], 'A binding', issues);
      if (stableId(entry['id'], `${path}/id`, 'A binding id', issues)) {
        if (ids.has(entry['id'])) {
          issues.push(issue('duplicate-id', `${path}/id`, `Binding id "${entry['id']}" is used more than once.`));
        }
        ids.add(entry['id']);
      }
      if (typeof entry['semanticKey'] !== 'string' || entry['semanticKey'].length === 0 || entry['semanticKey'].length > 120) {
        issues.push(issue('missing-field', `${path}/semanticKey`, 'A binding needs a semantic key of 1–120 characters.'));
      }
      if (entry['precision'] !== undefined && (!Number.isInteger(entry['precision']) || (entry['precision'] as number) < 0 || (entry['precision'] as number) > 6)) {
        issues.push(issue('out-of-range', `${path}/precision`, 'precision must be an integer from 0 to 6.'));
      }
      if (entry['unitDisplay'] !== undefined && !['none', 'short', 'long'].includes(entry['unitDisplay'] as string)) {
        issues.push(issue('invalid-enum', `${path}/unitDisplay`, 'unitDisplay must be one of: none, short, long.'));
      }
      for (const key of ['scale', 'offset'] as const) {
        if (entry[key] !== undefined && (typeof entry[key] !== 'number' || !Number.isFinite(entry[key]))) {
          issues.push(issue('wrong-type', `${path}/${key}`, `${key} must be a finite number.`));
        }
      }
    }
  }
}

function scene(value: unknown, issues: ValidationIssue[]): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!isRecord(value)) {
    issues.push(issue('invalid-fabric-scene', '/scene', 'scene must be a Fabric JSON object.'));
    return ids;
  }
  if (typeof value['version'] !== 'string' || !/^\d+\.\d+\.\d+$/.test(value['version'])) {
    issues.push(issue('invalid-fabric-scene', '/scene/version', 'scene.version must be a Fabric version string.'));
  }
  if (!Array.isArray(value['objects'])) {
    issues.push(issue('invalid-fabric-scene', '/scene/objects', 'scene.objects must be an array.'));
    return ids;
  }
  const count = { value: 0 };
  for (const [index, object] of value['objects'].entries()) {
    sceneObject(object, `/scene/objects/${index}`, 0, ids, count, issues);
  }
  return ids;
}

function sceneObject(value: unknown, path: string, depth: number, ids: Set<string>, count: { value: number }, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue('invalid-fabric-scene', path, 'A Fabric scene object must be an object.'));
    return;
  }
  count.value += 1;
  if (count.value > MAX_NODE_COUNT) {
    issues.push(issue('too-many-nodes', path, `The scene exceeds the maximum of ${MAX_NODE_COUNT} objects.`));
    return;
  }
  if (depth > MAX_SCENE_DEPTH) {
    issues.push(issue('too-deep', path, `Scene nesting exceeds the maximum depth of ${MAX_SCENE_DEPTH}.`));
    return;
  }
  if (stableId(value['id'], `${path}/id`, 'A Fabric object id', issues)) {
    if (ids.has(value['id'])) {
      issues.push(issue('duplicate-id', `${path}/id`, `Fabric object id "${value['id']}" is used more than once.`));
    }
    ids.add(value['id']);
  }
  if (typeof value['type'] !== 'string' || value['type'].length === 0) {
    issues.push(issue('invalid-fabric-scene', `${path}/type`, 'A Fabric scene object needs a type.'));
  }
  if (!jsonSafe(value, path, depth, issues)) return;
  if (value['objects'] !== undefined) {
    if (!Array.isArray(value['objects'])) {
      issues.push(issue('invalid-fabric-scene', `${path}/objects`, 'A Fabric group objects property must be an array.'));
    } else {
      for (const [index, child] of value['objects'].entries()) {
        sceneObject(child, `${path}/objects/${index}`, depth + 1, ids, count, issues);
      }
    }
  }
}

function jsonSafe(value: unknown, path: string, depth: number, issues: ValidationIssue[]): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return true;
    issues.push(issue('invalid-fabric-scene', path, 'Fabric scene values must be finite JSON values.'));
    return false;
  }
  if (depth > MAX_SCENE_DEPTH + 8) {
    issues.push(issue('too-deep', path, 'Fabric scene JSON is too deeply nested.'));
    return false;
  }
  if (Array.isArray(value)) return value.every((item, index) => jsonSafe(item, `${path}/${index}`, depth + 1, issues));
  if (isRecord(value)) return Object.entries(value).every(([key, item]) => jsonSafe(item, `${path}/${key}`, depth + 1, issues));
  issues.push(issue('invalid-fabric-scene', path, 'Fabric scene values must be JSON-safe.'));
  return false;
}

function stableId(value: unknown, path: string, what: string, issues: ValidationIssue[]): value is string {
  if (typeof value === 'string' && STABLE_ID_PATTERN.test(value)) return true;
  issues.push(issue('invalid-id', path, `${what} must match ${STABLE_ID_PATTERN.source} — 1–64 letters, digits, underscores or dashes.`));
  return false;
}

function unknownKeys(value: Record<string, unknown>, path: string, allowed: readonly string[], what: string, issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(issue('unknown-field', `${path}/${key}`, `${what} has no "${key}" property.`));
  }
}

function fail(code: ValidationIssue['code'], path: string, message: string): FabricEnvelopeValidationResult {
  return { ok: false, issues: [issue(code, path, message)] };
}

function issue(code: ValidationIssue['code'], path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
