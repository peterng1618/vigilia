import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as core from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The legacy DOM mount path is retired, and the line clamp goes with it
 * (vg-343, RULED 2026-10-12). `mountScene` was the only consumer of
 * `PlanTextLayout`, so the public arithmetic had no reason to outlive the
 * consumer: the export, the barrel entry and `plan.test.ts`'s cases go in the
 * same change as the path. The ruling is a **public-surface** decision, so the
 * case reads the surface — the barrel and the retired file — rather than a
 * behaviour. `SceneHandle` survives: `scene-fabric`'s `FabricSceneHandle`
 * extends it and the player types against it.
 */
describe("the legacy DOM mount and the clamp are gone", () => {
  it("exports neither mountScene nor computeMaxLines", () => {
    expect("mountScene" in core).toBe(false);
    expect("computeMaxLines" in core).toBe(false);
  });

  it("keeps no scene/mount module", () => {
    expect(() =>
      readFileSync(resolve(here, "scene/mount.ts"), "utf8"),
    ).toThrow();
  });
});
