import type { Page } from "@playwright/test";

/**
 * Canvas-aware probes for the Fabric player path.
 *
 * A canvas exposes no elements, spans or computed style, so behaviour is read
 * through the scene handle the player already exposes for diagnostics
 * (`window.vigilia`). Only plain values cross the boundary — a Fabric object
 * would not survive it.
 */

type HandleWindow = typeof window & {
  vigilia: { handle: Record<string, unknown> };
};

/**
 * One object's property by id, groups descended.
 *
 * The starter's cards are groups, so a card's gauge, value and bar are not in
 * `getObjects()`; they live inside it. A root-only `.find` reported
 * `undefined` for `cpu-card` and `storage-bar`, objects the author can see on
 * the wall, and the assertion failed as a *missing object* rather than as a
 * search that stopped too early — which is the harder failure to read, because
 * nothing in it names grouping.
 *
 * The adapter is asked first: it indexes what a plan applied, and a scene
 * revived from a saved package never went through one. The walk is inlined
 * rather than shared because `page.evaluate` serializes the function it is
 * handed and cannot reach a module binding; {@link sceneBounds} carries the
 * same one, and the two cannot drift because neither can be called.
 */
export async function sceneProperty(
  page: Page,
  nodeId: string,
  key: string,
): Promise<unknown> {
  return page.evaluate(
    ([id, prop]) => {
      type Obj = {
        get(key: string): unknown;
        getObjects?(): readonly Obj[];
      };
      const { handle } = (window as unknown as HandleWindow).vigilia;
      const adapter = handle["adapter"] as {
        objectFor(nodeId: string): Obj | undefined;
      };
      const canvas = handle["canvas"] as { getObjects(): readonly Obj[] };
      const find = (objects: readonly Obj[]): Obj | undefined => {
        for (const candidate of objects) {
          if (candidate.get("id") === id) return candidate;
          const found = find(candidate.getObjects?.() ?? []);
          if (found !== undefined) return found;
        }
        return undefined;
      };
      return (adapter.objectFor(id) ?? find(canvas.getObjects()))?.get(prop);
    },
    [nodeId, key] as const,
  );
}

/**
 * One object's **world** box by id, groups descended.
 *
 * World rather than group-local, because a part's own `left` is its position
 * *inside* its card: reading it told the caller a reading ended at 1645.9 when
 * the ink it was measuring was somewhere else entirely. `getBoundingRect`
 * composes the ancestor transform, which is the box a display actually paints.
 */
export async function sceneBounds(
  page: Page,
  nodeId: string,
): Promise<{ right: number; width: number } | undefined> {
  return page.evaluate((id) => {
    type Obj = {
      getObjects?(): readonly Obj[];
      getBoundingRect?: () => { right: number; width: number };
    };
    const { handle } = (window as unknown as HandleWindow).vigilia;
    const canvas = handle["canvas"] as { getObjects(): readonly Obj[] };
    const find = (objects: readonly Obj[]): Obj | undefined => {
      for (const candidate of objects) {
        if ((candidate as { get(id: string): unknown }).get("id") === id)
          return candidate;
        const found = find(candidate.getObjects?.() ?? []);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    const rect = find(canvas.getObjects())?.getBoundingRect?.();
    return rect === undefined
      ? undefined
      : { right: rect.right, width: rect.width };
  }, nodeId);
}

/** One scalar Fabric property; anything else means the probe asked wrong. */
export async function canvasProp(
  page: Page,
  nodeId: string,
  key: string,
): Promise<string | number | boolean | undefined> {
  const value = await sceneProperty(page, nodeId, key);
  return value !== undefined && value !== null && isScalar(value)
    ? value
    : undefined;
}

function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
