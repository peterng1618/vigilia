import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

/**
 * The document's own version shape: three integers, with no prefix,
 * prerelease or build. Semver's wider grammar is not what a theme version
 * means, so a value it can parse but this cannot is not a version here.
 */
const SEMANTIC_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export type VersionLevel = "initial" | "none" | "patch" | "minor" | "major";

export type ChangeReason =
  | "schema"
  | "canvas"
  | "sensor-removed"
  | "sensor-added"
  | "structure"
  | "backdrop"
  | "metadata"
  | "content";

export interface ThemeChange {
  readonly level: VersionLevel;
  readonly reasons: readonly ChangeReason[];
}

export function isSemanticVersion(text: string): boolean {
  return SEMANTIC_VERSION.test(text);
}

export function bumpVersion(
  previous: string,
  level: "patch" | "minor" | "major",
): string | undefined {
  const match = SEMANTIC_VERSION.exec(previous);
  if (match === null) return undefined;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  // A digit string past the safe-integer range cannot round-trip through
  // numbers, so bumping it would print a version nobody wrote.
  if (
    !Number.isSafeInteger(major) ||
    !Number.isSafeInteger(minor) ||
    !Number.isSafeInteger(patch)
  )
    return undefined;
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function versionFor(
  previous: string | undefined,
  change: ThemeChange,
): string | undefined {
  switch (change.level) {
    case "initial":
      // Initial only mints a version. A previous alongside it is a contradic-
      // tion: either this is the first publication or it is not.
      return previous === undefined ? "1.0.0" : undefined;
    case "none":
      return previous !== undefined && isSemanticVersion(previous)
        ? previous
        : undefined;
    case "patch":
    case "minor":
    case "major":
      return previous === undefined
        ? undefined
        : bumpVersion(previous, change.level);
  }
}

type ChangeLevel = Exclude<VersionLevel, "initial">;

type Rule = (before: unknown, after: unknown) => ThemeChange | undefined;

const IGNORED_METADATA_KEYS = ["version", "createdAt", "updatedAt"] as const;

/**
 * A member's own reader. A rule that does not know a field still answers
 * `patch`, because an unknown field inside a member this build reads is content
 * — only an unknown *member* is a format change.
 */
function change(level: ChangeLevel, ...reasons: ChangeReason[]): ThemeChange {
  return { level, reasons };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Two documents that differ only in property order are the same document. */
function stable(value: unknown): string {
  return (
    JSON.stringify(value, (_key, entry: unknown) =>
      isRecord(entry)
        ? Object.fromEntries(
            Object.entries(entry).sort(([a], [b]) =>
              a < b ? -1 : a > b ? 1 : 0,
            ),
          )
        : entry,
    ) ?? ""
  );
}

function withoutKeys(
  value: unknown,
  ignored: readonly string[],
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !ignored.includes(key)),
  );
}

/** The interface is the sensors bound, not the objects that bind them. */
function sensors(bindings: unknown): ReadonlySet<string> {
  const found = new Set<string>();
  if (!isRecord(bindings)) return found;
  for (const objectBindings of Object.values(bindings)) {
    if (!Array.isArray(objectBindings)) continue;
    for (const binding of objectBindings) {
      const key = isRecord(binding) ? binding["semanticKey"] : undefined;
      if (typeof key === "string") found.add(key);
    }
  }
  return found;
}

function artboardChange(
  before: unknown,
  after: unknown,
): ThemeChange | undefined {
  const a = isRecord(before) ? before : {};
  const b = isRecord(after) ? after : {};
  const canvas = a["width"] !== b["width"] || a["height"] !== b["height"];
  const content =
    stable(withoutKeys(a, ["width", "height"])) !==
    stable(withoutKeys(b, ["width", "height"]));
  const reasons: ChangeReason[] = [];
  if (canvas) reasons.push("canvas");
  if (content) reasons.push("content");
  return reasons.length === 0
    ? undefined
    : change(canvas ? "major" : "patch", ...reasons);
}

function bindingsChange(
  before: unknown,
  after: unknown,
): ThemeChange | undefined {
  const beforeSensors = sensors(before);
  const afterSensors = sensors(after);
  const removed = [...beforeSensors].some((key) => !afterSensors.has(key));
  const added = [...afterSensors].some((key) => !beforeSensors.has(key));
  if (removed || added) {
    const reasons: ChangeReason[] = [];
    if (removed) reasons.push("sensor-removed");
    if (added) reasons.push("sensor-added");
    return change(removed ? "major" : "minor", ...reasons);
  }
  return stable(before) === stable(after)
    ? undefined
    : change("patch", "content");
}

function metadataChange(
  before: unknown,
  after: unknown,
): ThemeChange | undefined {
  return stable(withoutKeys(before, IGNORED_METADATA_KEYS)) ===
    stable(withoutKeys(after, IGNORED_METADATA_KEYS))
    ? undefined
    : change("patch", "metadata");
}

/** `scene.version` moves when the editor upgrades, not when the theme does. */
function sceneChange(before: unknown, after: unknown): ThemeChange | undefined {
  return stable(withoutKeys(before, ["version"])) ===
    stable(withoutKeys(after, ["version"]))
    ? undefined
    : change("patch", "content");
}

function contentChange(
  before: unknown,
  after: unknown,
): ThemeChange | undefined {
  return stable(before) === stable(after)
    ? undefined
    : change("patch", "content");
}

const RULES: Readonly<Record<string, Rule>> = {
  schemaVersion: (before, after) =>
    before === after ? undefined : change("major", "schema"),
  artboard: artboardChange,
  globals: contentChange,
  assets: contentChange,
  bindings: bindingsChange,
  metadata: metadataChange,
  scene: sceneChange,
};

export const CLASSIFIED_ENVELOPE_KEYS: readonly string[] = Object.keys(RULES);

/**
 * `id` is ignored because the diff only runs between documents already proven
 * to be the same item; an editor upgrade and a save move the other two.
 */
export const IGNORED_ENVELOPE_KEYS: readonly string[] = [
  "fabricVersion",
  "editorMetadata",
  "id",
];

const KNOWN_ENVELOPE_KEYS = new Set([
  ...CLASSIFIED_ENVELOPE_KEYS,
  ...IGNORED_ENVELOPE_KEYS,
]);

const LEVEL_ORDER: Readonly<Record<VersionLevel, number>> = {
  initial: 0,
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

/** The editor renders these in one fixed order; the classifier never writes prose. */
const REASON_ORDER: readonly ChangeReason[] = [
  "schema",
  "canvas",
  "sensor-removed",
  "sensor-added",
  "structure",
  "backdrop",
  "metadata",
  "content",
];

export function classifyThemeChange(
  previous: FabricThemeEnvelope | undefined,
  next: FabricThemeEnvelope,
): ThemeChange {
  if (previous === undefined) return { level: "initial", reasons: [] };
  const before = previous as unknown as Readonly<Record<string, unknown>>;
  const after = next as unknown as Readonly<Record<string, unknown>>;
  const fired = new Set<ChangeReason>();
  let level: VersionLevel = "none";
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    // A member this build does not know is a format change, so it errs upward.
    if (!KNOWN_ENVELOPE_KEYS.has(key)) {
      fired.add("schema");
      level = "major";
      continue;
    }
    const result = RULES[key]?.(before[key], after[key]);
    if (result === undefined) continue;
    if (LEVEL_ORDER[result.level] > LEVEL_ORDER[level]) level = result.level;
    for (const reason of result.reasons) fired.add(reason);
  }
  return { level, reasons: REASON_ORDER.filter((reason) => fired.has(reason)) };
}
