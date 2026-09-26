/**
 * Authored glass treatment: one optional object property holding a backdrop
 * blur radius in artboard units. Absence means off and zero means no blur, so
 * an ordinary panel never carries the property at all.
 */

/** Persisted treatment property; Fabric JSON is the only place it is written. */
export const VIGILIA_GLASS_PROPERTY = "vigiliaGlass";

/**
 * Measured bound, not a preference. Task 1's radius sweep held 2.5–3.7 ms per
 * frame across 0–64 px, with the cost first clearly rising at 128 px (6.44 ms),
 * so 48 sits inside the measured-flat band while still bounding the worst case.
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

/**
 * The kinds a published theme may carry the treatment on, in a stable order.
 * The schema drift guard compares against this list, so widening the vocabulary
 * without widening the published schema fails a test.
 */
export const GLASS_TYPES: readonly string[] = [...GLASS_OBJECT_TYPES];

/** Whether an object kind may carry the treatment at all. */
export function supportsGlass(type: string): boolean {
  return GLASS_OBJECT_TYPES.has(type);
}

/**
 * Read a validated treatment from a revived object, or `undefined` when the
 * property is absent or malformed. Trust boundary, not a repair path: a value
 * that fails here was already refused at import, and is treated as off here
 * rather than coerced to a default.
 *
 * Returns a copy: the property on a revived object is that object's own state,
 * and handing out the reference would let a caller that mutates what it read
 * rewrite the scene behind the validator's back.
 */
export function glassTreatment(object: {
  get(name: string): unknown;
}): GlassTreatment | undefined {
  const value = object.get(VIGILIA_GLASS_PROPERTY);
  if (!isGlassTreatment(value)) return undefined;
  return { blurRadius: value.blurRadius };
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
