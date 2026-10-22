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
