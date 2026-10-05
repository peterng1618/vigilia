/**
 * The author-facing display name a scene object carries beside its stable id.
 *
 * The id is the key bindings and round-trips reference and is never renamed
 * (§75); this is the label an author reads in the layer list, the selection and
 * anywhere else that would otherwise print an id. Absence means "fall back to
 * the id", so a scene authored before the field still opens and still reads.
 */

/** Persisted property; Fabric JSON is the only place it is written. */
export const VIGILIA_NAME_PROPERTY = "name";

/**
 * A label, not a document. Matches the bound the palette and type-preset names
 * already publish, so a name is the same size of thing wherever it is read.
 */
export const MAX_OBJECT_NAME_LENGTH = 120;

/**
 * Read a validated name from a revived object, or `undefined` when it is
 * absent or malformed. Trust boundary, not a repair path: a value that fails
 * here was already refused at import, and is treated as unnamed here rather than
 * coerced into a label.
 */
export function objectName(object: {
  get(name: string): unknown;
}): string | undefined {
  const value = object.get(VIGILIA_NAME_PROPERTY);
  return isObjectName(value) ? value : undefined;
}

/** Accepts only a non-blank string inside the published bound. */
export function isObjectName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= MAX_OBJECT_NAME_LENGTH
  );
}
