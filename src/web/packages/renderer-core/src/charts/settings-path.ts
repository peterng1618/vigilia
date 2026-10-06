import { defaultAnimationSettings } from "./animation.js";

/**
 * Reading and writing one setting, addressed by the path the renderer reads it
 * from.
 *
 * Two settings live one level down — `PieSettings.total.value` and each
 * family's optional `AnimationSettings` block — and a surface that commits
 * `{...settings, [property]: value}` writes a shape the renderer never reads
 * while the validator shrugs: the author's choice survives the click and dies on
 * reopen. These two helpers are the write path, and their two exceptions are
 * exactly the two nested settings, named rather than generalised (ADR-0028).
 *
 * Both build new objects and never touch the argument, so a commit can diff the
 * settings it was handed.
 */

type SettingsRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is SettingsRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The value at `path`, or `undefined` when a parent along the way is absent.
 *
 * Absent is absent — never a fabricated default, never a throw — so a surface
 * can ask "has the author set this yet" without a second read. A path two
 * levels deep (`["animation", "durationMs"]` on a chart that has no `animation`
 * block) answers `undefined` like any other missing key.
 */
export function readSetting(
  settings: unknown,
  path: readonly string[],
): unknown {
  let current: unknown = settings;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * `settings` with `value` written at `path`, as a new object.
 */
export function writeSetting<T extends object>(
  settings: T,
  path: readonly string[],
  value: unknown,
): T {
  return writeBlock(settings as SettingsRecord, path, value) as T;
}

function writeBlock(
  settings: SettingsRecord,
  path: readonly string[],
  value: unknown,
): SettingsRecord {
  // `PieTotal` is a union: `{kind: "sum"}` has no `value`, so writing the tag
  // replaces the block rather than merging into it. A merge would leave a
  // sibling the union does not have — a document that validates and lies — and
  // writing `fixed` with no value is why this leaves `value` absent rather than
  // filling in `0`: only the author's own number puts one there.
  if (path.length === 2 && path[0] === "total" && path[1] === "kind") {
    return { ...settings, total: { kind: value } };
  }

  return write(settings, path, value);
}

function write(
  settings: SettingsRecord,
  path: readonly string[],
  value: unknown,
): SettingsRecord {
  const head = path[0];

  if (head === undefined) {
    return settings;
  }

  const rest = path.slice(1);

  if (rest.length === 0) {
    return { ...settings, [head]: value };
  }

  const existing = settings[head];
  const child = isRecord(existing) ? existing : blockDefaultsFor(head);

  return { ...settings, [head]: write(child, rest, value) };
}

/**
 * The block a nested write creates before it can hold the value.
 *
 * `AnimationSettings` is optional but, when present, a whole object: a write
 * into an absent block creates all four keys from their owner
 * (`charts/animation.ts`), so the descriptor table still declares no default and
 * a document never holds a partial block. Nothing else nests, so nothing else
 * has an entry — an unknown key gets an empty block rather than a fabricated
 * default.
 */
function blockDefaultsFor(key: string): SettingsRecord {
  return key === "animation" ? { ...defaultAnimationSettings } : {};
}
