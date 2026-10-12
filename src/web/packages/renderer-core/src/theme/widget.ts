/** Mints the ids an inserted unit takes with it. */

export interface WidgetIssue {
  readonly code: "unmapped-global" | "id-collision";
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

/** Total by construction: every character outside the class becomes `-`, so the
 *  allocator's `${prefix}-${original}` — which carries the `-` and so is never
 *  empty — always yields a `STABLE_ID_PATTERN` match. No input leaves this
 *  without a usable id, so no caller has an unusable id to report. */
function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, MAX_ID_LENGTH);
}
