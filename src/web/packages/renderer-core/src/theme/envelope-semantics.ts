import {
  ASSET_PATH_PATTERN,
  GLOBAL_GROUPS,
  MAX_ARTBOARD_DIMENSION,
  STABLE_ID_PATTERN,
} from "./document.js";
import {
  envelopeKeysFor,
  type KnownKeyShape,
  knownKeysFor,
  nearestKey,
} from "./envelope-keys.js";

/**
 * The semantic checks over the envelope fields Vigilia owns.
 *
 * The v2 envelope's `scene` is opaque Fabric JSON, decided by
 * `fabric-envelope-validate.ts`; everything beside it is Vigilia's own data and
 * is decided here — metadata, id, artboard, globals, assets, background media
 * and artboard paint. The keys those checks read are declared in
 * `envelope-keys.ts`, which is the vocabulary the published schema is held to.
 */

export type IssueCode =
  | "not-an-object"
  | "unknown-field"
  | "newer-schema-version"
  | "unsupported-schema-version"
  | "missing-field"
  | "wrong-type"
  | "invalid-id"
  | "duplicate-id"
  | "out-of-range"
  | "invalid-enum"
  | "style-value-ambiguous"
  | "unresolved-global-ref"
  | "unresolved-asset-ref"
  | "unresolved-binding-ref"
  | "invalid-asset-path"
  | "too-deep"
  | "too-many-nodes"
  | "invalid-fabric-scene";

export interface ValidationIssue {
  readonly code: IssueCode;
  /** JSON Pointer for editor navigation. */
  readonly path: string;
  readonly message: string;
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
    const allowed = knownKeysFor(shape);

    for (const key of Object.keys(value)) {
      if (allowed.includes(key as never)) {
        continue;
      }

      const suggestion = nearestKey(key, allowed);

      this.add(
        "unknown-field",
        `${path}/${key}`,
        suggestion === undefined
          ? `${what} has no "${key}" property.`
          : `${what} has no "${key}" property. Did you mean "${suggestion}"?`,
      );
    }
  }

  object(
    value: unknown,
    path: string,
    what: string,
  ): value is Record<string, unknown> {
    if (!isRecord(value)) {
      this.add("wrong-type", path, `${what} must be an object.`);
      return false;
    }
    return true;
  }

  finiteNumber(value: unknown, path: string, what: string): value is number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.add("wrong-type", path, `${what} must be a finite number.`);
      return false;
    }
    return true;
  }

  stableId(value: unknown, path: string, what: string): value is string {
    if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
      this.add(
        "invalid-id",
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
    if (typeof value !== "string" || !allowed.includes(value as T)) {
      this.add(
        "invalid-enum",
        path,
        `${what} must be one of: ${allowed.join(", ")}.`,
      );
      return false;
    }
    return true;
  }
}

/**
 * Decides the Vigilia-owned half of a validated envelope, appending to `issues`.
 *
 * The caller has already walked the envelope's own key bag, so this reads fields
 * rather than re-deciding the root.
 */
export function validateEnvelopeSemantics(
  input: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  const own = new Issues();

  validateMetadata(own, input["metadata"]);
  own.stableId(input["id"], "/id", "The document id");
  validateArtboard(own, input["artboard"]);

  const globalKeys = validateGlobals(own, input["globals"]);
  validateAssets(own, input["assets"]);
  validateBackgroundMedia(
    own,
    resolveOptional(input["artboard"], "backgroundMedia"),
    input["assets"],
  );

  validateStyleValue(
    own,
    resolveOptional(input["artboard"], "background"),
    "/artboard/background",
    globalKeys,
  );
  validateStyleValue(
    own,
    resolveOptional(input["artboard"], "barColor"),
    "/artboard/barColor",
    globalKeys,
  );

  issues.push(...own.list);
}

function validateMetadata(issues: Issues, value: unknown): void {
  if (value === undefined || !issues.object(value, "/metadata", "metadata")) {
    return;
  }

  issues.unknownKeys(value, "/metadata", "metadata", "Document metadata");

  if (
    value["version"] !== undefined &&
    (typeof value["version"] !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(value["version"]))
  ) {
    issues.add(
      "wrong-type",
      "/metadata/version",
      "version must be a semantic major.minor.patch string.",
    );
  }
}

function validateArtboard(issues: Issues, value: unknown): void {
  if (!issues.object(value, "/artboard", "artboard")) {
    return;
  }

  issues.unknownKeys(value, "/artboard", "artboard", "The artboard");

  for (const dimension of ["width", "height"] as const) {
    const path = `/artboard/${dimension}`;
    const raw = value[dimension];

    if (!issues.finiteNumber(raw, path, dimension)) {
      continue;
    }

    if (raw <= 0 || raw > MAX_ARTBOARD_DIMENSION) {
      issues.add(
        "out-of-range",
        path,
        `${dimension} must be above 0 and at most ${MAX_ARTBOARD_DIMENSION}.`,
      );
    }
  }

  if (value["contentFit"] !== undefined) {
    issues.enumValue(
      value["contentFit"],
      ["contain", "cover"] as const,
      "/artboard/contentFit",
      "contentFit",
    );
  }
}

/** Returns valid `group.id` references. */
function validateGlobals(issues: Issues, value: unknown): Set<string> {
  const keys = new Set<string>();

  if (value === undefined) {
    return keys;
  }

  if (!issues.object(value, "/globals", "globals")) {
    return keys;
  }

  for (const [groupName, group] of Object.entries(value)) {
    const groupPath = `/globals/${groupName}`;

    if (!GLOBAL_GROUPS.includes(groupName as (typeof GLOBAL_GROUPS)[number])) {
      issues.add(
        "invalid-enum",
        groupPath,
        `Unknown global group. Expected one of: ${GLOBAL_GROUPS.join(", ")}.`,
      );
      continue;
    }

    if (!issues.object(group, groupPath, `globals.${groupName}`)) {
      continue;
    }

    for (const [entryId, entry] of Object.entries(group)) {
      const entryPath = `${groupPath}/${entryId}`;

      if (!issues.stableId(entryId, entryPath, "A global id")) {
        continue;
      }

      if (!issues.object(entry, entryPath, "A global entry")) {
        continue;
      }

      issues.unknownKeys(entry, entryPath, "globalEntry", "A global entry");

      if (typeof entry["name"] !== "string" || entry["name"].length === 0) {
        issues.add(
          "missing-field",
          `${entryPath}/name`,
          "A global entry needs a non-empty display name.",
        );
      }

      if (!("value" in entry)) {
        issues.add(
          "missing-field",
          `${entryPath}/value`,
          "A global entry needs a value.",
        );
      }

      if (groupName === "typePresets") {
        validateTypePreset(issues, entry["value"], `${entryPath}/value`);
      }

      keys.add(`${groupName}.${entryId}`);
    }
  }

  return keys;
}

function validateBackgroundMedia(
  issues: Issues,
  value: unknown,
  assets: unknown,
): void {
  if (value === undefined) return;
  if (!issues.object(value, "/artboard/backgroundMedia", "backgroundMedia"))
    return;
  for (const key of Object.keys(value))
    if (!envelopeKeysFor("backgroundMedia").includes(key as never))
      issues.add(
        "unknown-field",
        `/artboard/backgroundMedia/${key}`,
        `backgroundMedia has no "${key}" property.`,
      );
  issues.enumValue(
    value["fit"],
    ["contain", "cover"] as const,
    "/artboard/backgroundMedia/fit",
    "fit",
  );
  const asset = Array.isArray(assets)
    ? assets.find(
        (entry) => isRecord(entry) && entry["id"] === value["assetId"],
      )
    : undefined;
  if (
    !isRecord(asset) ||
    !["image", "svg", "video"].includes(String(asset["kind"]))
  ) {
    issues.add(
      "unresolved-asset-ref",
      "/artboard/backgroundMedia/assetId",
      "backgroundMedia must reference a declared image, SVG or video asset.",
    );
  }
}

function validateTypePreset(
  issues: Issues,
  value: unknown,
  path: string,
): void {
  if (!issues.object(value, path, "A type preset")) return;
  issues.unknownKeys(value, path, "typePreset", "A type preset");
  if (
    typeof value["family"] !== "string" ||
    value["family"].trim().length === 0
  ) {
    issues.add(
      "missing-field",
      `${path}/family`,
      "A type preset needs a font family.",
    );
  }
  if (
    !issues.finiteNumber(value["size"], `${path}/size`, "size") ||
    (value["size"] as number) <= 0
  ) {
    issues.add(
      "out-of-range",
      `${path}/size`,
      "A type preset size must be above 0.",
    );
  }
  const weight = value["weight"];
  if (
    weight !== undefined &&
    typeof weight !== "string" &&
    (typeof weight !== "number" || !Number.isFinite(weight))
  ) {
    issues.add(
      "wrong-type",
      `${path}/weight`,
      "A type preset weight must be a string or finite number.",
    );
  }
  for (const key of ["letterSpacing", "lineHeight"] as const) {
    const raw = value[key];
    if (raw !== undefined && !issues.finiteNumber(raw, `${path}/${key}`, key))
      continue;
    if (key === "lineHeight" && raw !== undefined && (raw as number) <= 0) {
      issues.add(
        "out-of-range",
        `${path}/${key}`,
        "A type preset lineHeight must be above 0.",
      );
    }
  }
  const face = value["face"];
  if (face !== undefined) {
    if (!issues.object(face, `${path}/face`, "A font face reference")) return;
    issues.unknownKeys(
      face,
      `${path}/face`,
      "fontFaceReference",
      "A font face reference",
    );
    issues.stableId(
      face["assetId"],
      `${path}/face/assetId`,
      "A font face asset id",
    );
  }
  if (value["trioRole"] !== undefined) {
    issues.enumValue(
      value["trioRole"],
      ["heading", "body", "mono"] as const,
      `${path}/trioRole`,
      "A trio role",
    );
  }
}

/** Returns declared asset IDs. */
function validateAssets(issues: Issues, value: unknown): Set<string> {
  const ids = new Set<string>();

  if (value === undefined) {
    return ids;
  }

  if (!Array.isArray(value)) {
    issues.add("wrong-type", "/assets", "assets must be an array.");
    return ids;
  }

  for (const [index, asset] of value.entries()) {
    const path = `/assets/${index}`;

    if (!issues.object(asset, path, "An asset reference")) {
      continue;
    }

    issues.unknownKeys(asset, path, "assetReference", "An asset reference");

    if (issues.stableId(asset["id"], `${path}/id`, "An asset id")) {
      const id = asset["id"] as string;
      if (ids.has(id)) {
        issues.add(
          "duplicate-id",
          `${path}/id`,
          `Asset id "${id}" is used more than once.`,
        );
      }
      ids.add(id);
    }

    issues.enumValue(
      asset["kind"],
      ["image", "svg", "gif", "video", "font"] as const,
      `${path}/kind`,
      "An asset kind",
    );

    validateAssetPath(issues, asset["path"], `${path}/path`);

    if (asset["kind"] === "font") validateFontAsset(issues, asset, path);

    if (
      asset["sha256"] !== undefined &&
      !/^[a-f0-9]{64}$/.test(String(asset["sha256"]))
    ) {
      issues.add(
        "wrong-type",
        `${path}/sha256`,
        "sha256 must be 64 lowercase hex characters.",
      );
    }
  }

  return ids;
}

/** Pattern matching alone does not reject `..`; traversal is checked explicitly. */
function validateAssetPath(issues: Issues, value: unknown, path: string): void {
  if (typeof value !== "string") {
    issues.add(
      "missing-field",
      path,
      "An asset needs a package-relative path.",
    );
    return;
  }

  if (!ASSET_PATH_PATTERN.test(value)) {
    issues.add(
      "invalid-asset-path",
      path,
      "An asset path must be under assets/ and use safe characters.",
    );
    return;
  }

  if (value.split("/").includes("..")) {
    issues.add(
      "invalid-asset-path",
      path,
      'An asset path must not contain a ".." segment: it would escape the package.',
    );
  }
}

function validateFontAsset(
  issues: Issues,
  asset: Record<string, unknown>,
  path: string,
): void {
  if (
    typeof asset["family"] !== "string" ||
    asset["family"].trim().length === 0
  ) {
    issues.add(
      "missing-field",
      `${path}/family`,
      "A font asset needs a font family.",
    );
  }
  if (
    typeof asset["weight"] !== "string" &&
    (typeof asset["weight"] !== "number" || !Number.isFinite(asset["weight"]))
  ) {
    issues.add(
      "wrong-type",
      `${path}/weight`,
      "A font asset weight must be a string or finite number.",
    );
  }
  issues.enumValue(
    asset["style"],
    ["normal", "italic"] as const,
    `${path}/style`,
    "A font asset style",
  );
  if (asset["format"] !== "woff2")
    issues.add(
      "invalid-enum",
      `${path}/format`,
      "A font asset format must be woff2.",
    );
  if (typeof asset["path"] !== "string" || !asset["path"].endsWith(".woff2")) {
    issues.add(
      "invalid-asset-path",
      `${path}/path`,
      "A WOFF2 font asset path must end in .woff2.",
    );
  }
  if (
    typeof asset["sourceUrl"] !== "string" ||
    !isHttpUrl(asset["sourceUrl"])
  ) {
    issues.add(
      "wrong-type",
      `${path}/sourceUrl`,
      "A font asset needs an HTTPS Fontsource source URL.",
    );
  }
  const license = asset["license"];
  if (
    !isRecord(license) ||
    typeof license["name"] !== "string" ||
    license["name"].trim().length === 0 ||
    typeof license["url"] !== "string" ||
    !isHttpUrl(license["url"])
  ) {
    issues.add(
      "missing-field",
      `${path}/license`,
      "A font asset needs licence name and URL metadata.",
    );
  }
}

function isHttpUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
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

  if (!issues.object(value, path, "A style value")) {
    return;
  }

  const hasRef = "ref" in value;
  const hasValue = "value" in value;

  if (hasRef && hasValue) {
    issues.add(
      "style-value-ambiguous",
      path,
      'A style value must be either a global "ref" or a local "value", not both.',
    );
    return;
  }

  if (!hasRef && !hasValue) {
    issues.add(
      "style-value-ambiguous",
      path,
      'A style value must declare either a global "ref" or a local "value".',
    );
    return;
  }

  if (!hasRef) {
    return;
  }

  const ref = value["ref"];

  if (typeof ref !== "string") {
    issues.add(
      "wrong-type",
      `${path}/ref`,
      "A global reference must be a string.",
    );
    return;
  }

  const [group, ...rest] = ref.split(".");
  const entryId = rest.join(".");

  if (
    !GLOBAL_GROUPS.includes(group as (typeof GLOBAL_GROUPS)[number]) ||
    entryId.length === 0
  ) {
    issues.add(
      "unresolved-global-ref",
      `${path}/ref`,
      `"${ref}" is not a valid global reference. Use one of: ${GLOBAL_GROUPS.join(", ")}.<id>.`,
    );
    return;
  }

  if (!globalKeys.has(ref)) {
    issues.add(
      "unresolved-global-ref",
      `${path}/ref`,
      `Global "${ref}" is not defined in this document.`,
    );
  }
}

function resolveOptional(container: unknown, key: string): unknown {
  return isRecord(container) ? container[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
