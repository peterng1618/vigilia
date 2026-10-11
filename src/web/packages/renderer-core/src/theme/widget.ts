import { STABLE_ID_PATTERN } from "./document.js";

/** Mints the ids an inserted unit takes with it. */

export interface WidgetIssue {
  readonly code: "unmapped-global" | "id-collision" | "invalid-id";
  readonly detail: string;
}

const MAX_ID_LENGTH = 64;

/**
 * Mints the ids a copy takes: `${prefix}-${original}`, sanitised to
 * `STABLE_ID_PATTERN`, truncated before any collision suffix and suffixed until
 * the destination is free. Asking twice for one id gives one id back.
 *
 * Exported because "a copy is a copy" is one rule and not two. A Fabric scene
 * object is minted here too — the editor's document is Fabric JSON (§134), not
 * a `ThemeNode` list — and an author reading a tree of inserted units cannot be
 * shown two policies for what a fresh id looks like.
 */
export function createWidgetIdAllocator(
  prefix: string,
  existingIds: Iterable<string> | undefined,
  issues: WidgetIssue[],
): (original: string) => string {
  const taken = new Set(existingIds ?? []);
  const minted = new Map<string, string>();

  return (original: string): string => {
    const already = minted.get(original);
    if (already !== undefined) return already;

    const sanitized = sanitizeId(`${prefix}-${original}`);

    if (sanitized === "") {
      issues.push({
        code: "invalid-id",
        detail: `Could not derive a valid id from prefix "${prefix}" and "${original}".`,
      });
      minted.set(original, original);
      return original;
    }

    let candidate = sanitized;
    let counter = 2;

    while (taken.has(candidate)) {
      const suffix = `-${counter}`;
      candidate = `${sanitized.slice(0, MAX_ID_LENGTH - suffix.length)}${suffix}`;
      counter += 1;
    }

    taken.add(candidate);
    minted.set(original, candidate);
    return candidate;
  };
}

function sanitizeId(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, MAX_ID_LENGTH);
  return STABLE_ID_PATTERN.test(cleaned) ? cleaned : "";
}
