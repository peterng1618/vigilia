/**
 * Authored glass treatment: one optional object property holding a backdrop
 * blur radius in artboard units. Absence means off and zero means no blur, so
 * an ordinary panel never carries the property at all.
 */

/** Persisted treatment property; Fabric JSON is the only place it is written. */
export const VIGILIA_GLASS_PROPERTY = "vigiliaGlass";

/**
 * Measured bound, not a preference: the Task 1 radius sweep was flat from
 * 0–48 artboard units and rose sharply above it.
 */
export const MAX_GLASS_BLUR_RADIUS = 48;

/** The single authored field. Everything else about a panel stays native. */
export interface GlassTreatment {
  readonly blurRadius: number;
}

/**
 * Object kinds whose backdrop Task 1 actually measured: rounded and square
 * rectangles, including one inside a rotated group. Every other Fabric shape
 * may well behave the same, but that is Task 4's evidence to produce — until
 * then an unmeasured kind is refused rather than silently rendering a
 * treatment nobody has seen. Text, image and chart objects are excluded on
 * their own terms: they are not panels, and a blur behind a glyph or a
 * plotted series has no meaning.
 */
const GLASS_OBJECT_TYPES: ReadonlySet<string> = new Set(["Rect", "Group"]);

/** Whether an object kind may carry the treatment at all. */
export function supportsGlass(type: string): boolean {
  return GLASS_OBJECT_TYPES.has(type);
}

/**
 * Read a validated treatment from a revived object, or `undefined` when the
 * property is absent or malformed. Trust boundary, not a repair path: a value
 * that fails here was already refused at import, and is treated as off here
 * rather than coerced to a default.
 */
export function glassTreatment(object: {
  get(name: string): unknown;
}): GlassTreatment | undefined {
  const value = object.get(VIGILIA_GLASS_PROPERTY);
  return isGlassTreatment(value) ? value : undefined;
}

/** Accepts only the exact authored shape: one finite radius inside the bound. */
export function isGlassTreatment(value: unknown): value is GlassTreatment {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const treatment = value as Record<string, unknown>;
  if (Object.keys(treatment).length !== 1) return false;
  const radius = treatment["blurRadius"];
  return (
    typeof radius === "number" &&
    Number.isFinite(radius) &&
    radius >= 0 &&
    radius <= MAX_GLASS_BLUR_RADIUS
  );
}
