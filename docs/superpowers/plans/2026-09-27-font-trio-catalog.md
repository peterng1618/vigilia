# Font catalogue and trio picker implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-entry hand-written font catalogue with all 380 Fonttrio pairings, and replace the two-option dropdowns with one searchable, faceted face picker that renders every family name in its own type.

**Architecture:** `editor/src/font-catalog.ts` keeps its exported surface and stops holding literal data; a build-time generator emits a committed `font-trios.generated.ts` of 380 trios over 238 deduplicated faces, each version-pinned to a Fontsource artifact with its heading weight clamped to what the family ships. A new Base UI island inside the type-preset panel browses those faces, rendering each name in that family and loading faces progressively as rows approach the viewport. Favourites are a host settings store beside `display.ts`, never theme content. A trio is a bulk reseed of role presets; a single face is a reseed of one.

**Tech Stack:** TypeScript, React 19 + Base UI, `FontFace`/`document.fonts`, Node scripts for generation, Vitest + jsdom, Playwright, Fontsource WOFF2 over jsDelivr.

**Spec:** [`2026-09-27-font-trio-catalog-design.md`](../specs/2026-09-27-font-trio-catalog-design.md) — the plan argues from it, so executors read both.

## Global Constraints

- The catalogue is **generated and committed**. `npm run fonts:generate` is manual and never runs during a build or test.
- Generated data records the Fonttrio commit it was built from. Upstream changing afterwards must not fail a build.
- Every face URL is version-pinned. `latest` never appears in a `sourceUrl`.
- Every emitted face is `woff2`, `latin` subset, with its OFL-1.1 name and URL.
- A heading weight is clamped to the nearest weight its family actually ships, and the clamped value is recorded on the face.
- The exported surface of `font-catalog.ts` — `fontTrio`, `fontTrios`, `faceForRole`, `applyFontTrio` — is unchanged. Callers do not learn about generation.
- `previewFontFace` and `releaseFontPreview` keep their signatures. A separate multi-face owner is added beside them.
- The `data-vigilia-font-face`, `data-vigilia-font-trio`, `data-vigilia-font-apply` and `vigiliaFontTrio` selectors keep working and keep their keyboard behaviour.
- Favourites live in the host. They never enter a `.vigilia-theme` package, the document schema, or the player.
- New UI copy goes in `editor/src/ui-copy.ts`, not inline in a component.
- No licence headers in source files. The generated module carries a provenance header naming Fonttrio (MIT) as the pairing source.
- AGENTS.md rules apply throughout: no `git add -A`, Conventional Commit titles, run commands from `src/web/`.

## Review Focus

The spec is a vision document; these are the input classes it implies but no single task's happy path exercises. Each line's test is added to the task that owns the code, in that task's own step style.

- **A face CDN 404s at browse time** (jsDelivr outage, a version unpublished later). The row must show the name in the fallback face and stay selectable; it must not blank the list, block search, or fail the picker's open.
- **A pairing's family ships no weight the catalogue assumed.** The clamp must pick the nearest real cut, record it, and the picker must show the clamped number — not the weight upstream recommended.
- **A stored favourite names a trio id the catalogue no longer has** (after a regeneration drops one). Read must drop it silently; the picker must not render a dead chip or throw.
- **The author unloads a package on a document whose preset references an adopted face, then edits Family.** The fields are disabled while bound, so this is unreachable from the UI; the validation still refuses it for a hand-edited package.
- **The author scrolls the whole 238-face list.** Roughly 4 MB of fetches. Virtualisation and the session cache must keep it bounded, and no row may trigger a fetch after the picker closes.

---

### Task 1: Generate the catalogue from pinned upstream data

**Files:**
- Create: `src/web/scripts/generate-font-trios.mjs`
- Create: `src/web/packages/editor/src/font-trios.generated.ts` (output, committed)
- Create: `src/web/packages/editor/src/font-trios.generated.test.ts`
- Modify: `src/web/package.json` (add the `fonts:generate` script)

**Interfaces:**
- Consumes: nothing. This task is the first.
- Produces: `src/web/packages/editor/src/font-trios.generated.ts` exporting
  ```ts
  export interface GeneratedFace {
    readonly id: string;            // `${fontId}-${weight}`
    readonly fontId: string;         // Fontsource id, e.g. "dm-sans"
    readonly family: string;         // display family, e.g. "DM Sans"
    readonly role: FontTrioRole;
    readonly weight: number;
    readonly style: "normal";
    readonly format: "woff2";
    readonly subset: "latin";
    readonly sourceUrl: string;      // version-pinned, never "latest"
    readonly license: { readonly name: string; readonly url: string };
    readonly clamped: boolean;       // true when the weight is not the family's own cut
  }
  export interface GeneratedTrio {
    readonly id: string;
    readonly name: string;           // upstream title, e.g. "Dashboard — Manrope + DM Sans + Fira Code"
    readonly description: string;
    readonly categories: readonly string[];
    readonly mood: readonly string[];
    readonly useCase: readonly string[];
    readonly superfamily: string;    // Fontsource category, e.g. "sans-serif"
    readonly faces: readonly [GeneratedFace, GeneratedFace, GeneratedFace]; // heading, body, mono
  }
  export const GENERATED_SOURCE_REVISION: string;  // Fonttrio commit
  export const GENERATED_TRIOS: readonly GeneratedTrio[];
  export const GENERATED_FACES: readonly GeneratedFace[];  // 238, deduplicated
  ```
  `GeneratedFace` is structurally assignable to the existing `CuratedFontFace`
  in `font-catalog.ts` (same field names), so `applyFontTrio` consumes it unchanged.

- [ ] **Step 1: Write the failing test**

`src/web/packages/editor/src/font-trios.generated.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GENERATED_FACES,
  GENERATED_SOURCE_REVISION,
  GENERATED_TRIOS,
} from "./font-trios.generated.js";

const PINNED =
  /^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/[a-z0-9-]+@\d+\.\d+\.\d+\/latin-\d+-normal\.woff2$/;

describe("generated font catalogue", () => {
  it("carries every pairing from the pinned upstream revision", () => {
    expect(GENERATED_TRIOS).toHaveLength(380);
    expect(GENERATED_SOURCE_REVISION).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gives every trio exactly one heading, body and mono face", () => {
    for (const trio of GENERATED_TRIOS) {
      expect(trio.faces.map((face) => face.role)).toEqual([
        "heading",
        "body",
        "mono",
      ]);
      for (const face of trio.faces) {
        expect(face.subset).toBe("latin");
        expect(face.format).toBe("woff2");
        expect(face.license.name).toBe("SIL Open Font License 1.1");
      }
    }
  });

  it("pins every face to a version and never to latest", () => {
    for (const face of GENERATED_FACES) {
      expect(face.sourceUrl).toMatch(PINNED);
      expect(face.sourceUrl).not.toContain("latest");
    }
  });

  it("deduplicates faces so one family appears once", () => {
    expect(new Set(GENERATED_FACES.map((face) => face.id)).size).toBe(
      GENERATED_FACES.length,
    );
    expect(GENERATED_FACES).toHaveLength(238);
  });

  it("clamps a heading to a weight its family actually ships", () => {
    // Anton ships only 400. Upstream recommends 700 for the `headline`
    // pairing, so that face must be the 400 cut and marked clamped.
    const anton = GENERATED_FACES.find(
      (face) => face.fontId === "anton" && face.role === "heading",
    );
    expect(anton?.weight).toBe(400);
    expect(anton?.clamped).toBe(true);
  });

  it("does not mark a face clamped when the family ships the weight", () => {
    const inter = GENERATED_FACES.find(
      (face) => face.fontId === "inter" && face.role === "heading",
    );
    expect(inter?.weight).toBe(700);
    expect(inter?.clamped).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/web && npm test -- --run packages/editor/src/font-trios.generated.test.ts
```

Expected: FAIL — cannot resolve `./font-trios.generated.js`.

- [ ] **Step 3: Write the generator**

`src/web/scripts/generate-font-trios.mjs`. It must be deterministic for a given upstream commit, and must never be invoked by a build or test.

```js
#!/usr/bin/env node
// Generates packages/editor/src/font-trios.generated.ts from the Fonttrio
// registry at a pinned commit. Manual: `npm run fonts:generate`.
//
// Fonttrio pairing metadata is MIT licensed and copied as data, not as a
// dependency. Font faces are pinned Fontsource WOFF2 artifacts, OFL-1.1.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONTTRIO_COMMIT = process.env["FONTTRIO_COMMIT"] ?? "";
const FONTTRIO_RAW = `https://raw.githubusercontent.com/kapishdima/fonttrio/${FONTTRIO_COMMIT}`;
const FONTSOURCE_API = "https://api.fontsource.org/v1/fonts";
const UA = { "User-Agent": "vigilia-font-catalogue" };
const OUT = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "packages/editor/src/font-trios.generated.ts",
);

async function json(url) {
  const response = await fetch(url, { headers: UA });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
}

const registry = await json(`${FONTTRIO_RAW}/registry.json`);
const familyCache = new Map();
async function fontsource(family) {
  if (!familyCache.has(family)) familyCache.set(family, await json(`${FONTSOURCE_API}/${family}`));
  return familyCache.get(family);
}

/** Upstream names the family in the var() it points at, which matches the
 * Fontsource id for every pairing checked, but fall back to a family-name
 * lookup rather than dropping the trio. */
const byFamilyName = new Map(
  (await json(`${FONTSOURCE_API}`)).map((font) => [font.family.toLowerCase(), font.id]),
);

const roleWeight = { heading: 700, body: 400, mono: 400 };
const faceCache = new Map();

async function faceFor(pairing, role) {
  const family = pairing.cssVars.theme[`--font-${role}`].match(/var\(--font-(.+)\)$/)[1];
  const font = (await fontsource(family)) ?? { id: byFamilyName.get(family.toLowerCase()) };
  const meta = await fontsource(font.id);
  const weights = Array.isArray(meta.weights) ? meta.weights : [meta.weights];
  if (!meta.subsets.includes("latin")) {
    throw new Error(`${pairing.name}: ${meta.family} has no latin subset.`);
  }
  // A single-weight family must serve its role, so a heading may end up at 400.
  const available = weights.includes(roleWeight[role]) ? roleWeight[role] : weights.reduce((best, w) =>
    Math.abs(w - roleWeight[role]) < Math.abs(best - roleWeight[role]) ? w : best);
  const id = `${font.id}-${available}`;
  if (!faceCache.has(id)) {
    faceCache.set(id, {
      id,
      fontId: font.id,
      family: meta.family,
      role,
      weight: available,
      style: "normal",
      format: "woff2",
      subset: "latin",
      sourceUrl: `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}@${meta.npmVersion}/latin-${available}-normal.woff2`,
      license: {
        name: meta.license === "OFL-1.1" ? "SIL Open Font License 1.1" : meta.license,
        url: "https://openfontlicense.org/",
      },
      // The heading's own recommendation is upstream's, not necessarily real.
      clamped: role === "heading" && available !== Number(pairing.css["@layer base"]?.h1?.["font-weight"] ?? available),
    });
  }
  const resolved = faceCache.get(id);
  // One face can serve several roles; the emitted record names the role asked
  // for so a trio's three faces are always heading/body/mono in order.
  return { ...resolved, role };
}

const trios = [];
for (const entry of registry.pairings) {
  const pairing = await json(`${FONTTRIO_RAW}/registry/pairings/${entry.name}.json`);
  const faces = [];
  for (const role of ["heading", "body", "mono"]) faces.push(await faceFor(pairing, role));
  trios.push({
    id: entry.name,
    name: entry.title,
    description: pairing.description,
    categories: pairing.categories ?? [],
    mood: pairing.meta?.mood ?? [],
    useCase: pairing.meta?.useCase ?? [],
    superfamily: (await fontsource(faces[0].fontId)).category,
    faces,
  });
}

const faces = [...new Map([...faceCache].map(([id, face]) => [id, face])).values()]
  .sort((a, b) => a.id.localeCompare(b.id));

const body = `// Generated by \`npm run fonts:generate\`. Do not edit by hand.
//
// Pairing metadata copied as data from Fonttrio (MIT,
// https://github.com/kapishdima/fonttrio) at commit ${FONTTRIO_COMMIT}.
// Faces are pinned Fontsource WOFF2 artifacts under the SIL Open Font
// License 1.1. A heading weight is clamped to the nearest the family ships;
// \`clamped\` records when that happened.
import type { FontTrioRole } from "./font-catalog.js";

export interface GeneratedFace {
${["id","fontId","family","role","weight","style","format","subset","sourceUrl","license","clamped"]
  .map((k) => `  readonly ${k}: ${k === "role" ? "FontTrioRole" : k === "license" ? "{ readonly name: string; readonly url: string }" : k === "sourceUrl" || k === "subset" || k === "format" || k === "style" ? k === "style" ? '"normal"' : k === "format" ? '"woff2"' : k === "subset" ? '"latin"' : "string" : k === "id" || k === "fontId" || k === "family" ? "string" : k === "weight" ? "number" : "boolean"};`).join("\n")}
}
export interface GeneratedTrio {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categories: readonly string[];
  readonly mood: readonly string[];
  readonly useCase: readonly string[];
  readonly superfamily: string;
  readonly faces: readonly [GeneratedFace, GeneratedFace, GeneratedFace];
}
export const GENERATED_SOURCE_REVISION = ${JSON.stringify(FONTTRIO_COMMIT)};
export const GENERATED_TRIOS: readonly GeneratedTrio[] = ${JSON.stringify(trios, null, 2)};
export const GENERATED_FACES: readonly GeneratedFace[] = ${JSON.stringify(faces, null, 2)};
`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, body, "utf8");
console.log(`Wrote ${trios.length} trios and ${faces.length} faces from ${FONTTRIO_COMMIT}.`);
```

Add to `src/web/package.json` scripts, beside the existing entries:

```json
"fonts:generate": "node scripts/generate-font-trios.mjs"
```

- [ ] **Step 4: Resolve the pinned Fonttrio commit and run the generator once**

```bash
cd src/web
FONTTRIO_COMMIT=$(git ls-remote https://github.com/kapishdima/fonttrio.git HEAD | cut -f1)
echo "$FONTTRIO_COMMIT"
FONTTRIO_COMMIT=$FONTTRIO_COMMIT npm run fonts:generate
```

Expected: `Wrote 380 trios and 238 faces from <sha>.` If the face count differs, the upstream commit is not the one the spec measured — re-check against the spec's 380/174/238 before proceeding, and record any drift rather than editing the expected numbers.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd src/web && npm test -- --run packages/editor/src/font-trios.generated.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/web/scripts/generate-font-trios.mjs src/web/packages/editor/src/font-trios.generated.ts src/web/packages/editor/src/font-trios.generated.test.ts src/web/package.json
git commit -m "feat(editor): generate the font catalogue from Fonttrio"
```

---

### Task 2: Serve the generated catalogue from the existing catalog owner

**Files:**
- Modify: `src/web/packages/editor/src/font-catalog.ts`
- Modify: `src/web/packages/editor/src/font-catalog.test.ts`

**Interfaces:**
- Consumes: `GENERATED_TRIOS`, `GENERATED_FACES` from `./font-trios.generated.js` (Task 1).
- Produces: unchanged exports — `FontTrioRole`, `CuratedFontFace`, `FontTrio`, `fontTrio(id)`, `fontTrios()`, `faceForRole(trio, role, weight)`, `applyFontTrio(presets, trio)`. Adds `catalogFaces(): readonly CuratedFontFace[]` for the picker, returning the 238 deduplicated faces.

- [ ] **Step 1: Replace the hard-coded test with catalogue-level tests**

Rewrite `src/web/packages/editor/src/font-catalog.test.ts`. The old suite pinned the `minimal` trio, which no longer exists; its behavioural cases are preserved against a real trio from the generated data.

```ts
import { describe, expect, it } from "vitest";
import {
  applyFontTrio,
  catalogFaces,
  faceForRole,
  fontTrio,
  fontTrios,
} from "./font-catalog.js";

/** A real trio with three distinct families, so a test cannot pass on a
 * fixture whose three roles happen to share one family. */
const trio = fontTrios().find((candidate) =>
  new Set(candidate.faces.map((face) => face.family)).size === 3,
)!;

describe("curated font trios", () => {
  it("serves every generated trio through one owner", () => {
    expect(fontTrios().length).toBeGreaterThan(1);
    expect(fontTrio(trio.id)).toBe(trio);
    expect(fontTrio("no-such-trio")).toBeUndefined();
  });

  it("selects the nearest available role face weight", () => {
    const heading = trio.faces.find((face) => face.role === "heading")!;
    expect(faceForRole(trio, "heading", heading.weight)?.weight).toBe(heading.weight);
    expect(faceForRole(trio, "body", 9999)).toBeDefined();
  });

  it("exposes each distinct face once for the picker", () => {
    const faces = catalogFaces();
    expect(new Set(faces.map((face) => face.id)).size).toBe(faces.length);
    expect(faces.length).toBeGreaterThan(100);
  });

  it("updates every role preset without changing its treatment or custom presets", () => {
    const heading = trio.faces.find((face) => face.role === "heading")!;
    const body = trio.faces.find((face) => face.role === "body")!;
    const mono = trio.faces.find((face) => face.role === "mono")!;
    const presets = {
      heading: {
        name: "Heading",
        value: {
          family: "Segoe UI",
          size: 32,
          weight: "500",
          lineHeight: 1.2,
          trioRole: "heading" as const,
        },
      },
      body: {
        name: "Body",
        value: { family: "Segoe UI", size: 14, trioRole: "body" as const },
      },
      mono: { name: "Code", value: { size: 12, trioRole: "mono" as const } },
      custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
    };

    expect(applyFontTrio(presets, trio)).toEqual({
      heading: {
        name: "Heading",
        value: {
          family: heading.family,
          size: 32,
          weight: heading.weight,
          lineHeight: 1.2,
          trioRole: "heading",
          face: { assetId: heading.id },
        },
      },
      body: {
        name: "Body",
        value: {
          family: body.family,
          size: 14,
          weight: body.weight,
          trioRole: "body",
          face: { assetId: body.id },
        },
      },
      mono: {
        name: "Code",
        value: {
          family: mono.family,
          size: 12,
          weight: mono.weight,
          trioRole: "mono",
          face: { assetId: mono.id },
        },
      },
      custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
    });
  });

  it("leaves a preset with no trio role untouched", () => {
    const custom = { only: { name: "Only", value: { family: "Georgia", size: 19 } } };
    expect(applyFontTrio(custom, trio)).toEqual(custom);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/web && npm test -- --run packages/editor/src/font-catalog.test.ts
```

Expected: FAIL — `catalogFaces` is not exported, and `fontTrios()` still returns one entry so the `distinct family` lookup finds nothing.

- [ ] **Step 3: Swap the literal array for the generated data**

In `src/web/packages/editor/src/font-catalog.ts`, delete the hand-written `TRIOS` array and the `face(...)` helper and the `FONTSOURCE_LICENSE` constant, and add the import and `catalogFaces`:

```ts
import type { TypePreset } from "@vigilia/renderer-core";
import {
  GENERATED_FACES,
  type GeneratedFace,
  type GeneratedTrio,
  GENERATED_TRIOS,
} from "./font-trios.generated.js";

export type FontTrioRole = "heading" | "body" | "mono";

export interface CuratedFontFace {
  readonly id: string;
  readonly role: FontTrioRole;
  readonly family: string;
  readonly weight: number;
  readonly style: "normal" | "italic";
  readonly format: "woff2";
  readonly subset: string;
  readonly sourceUrl: string;
  readonly license: { readonly name: string; readonly url: string };
  /** True when the weight is the nearest the family ships, not the family's
   * own cut. The picker must show this value, not a recommended one. */
  readonly clamped?: boolean;
}

export interface FontTrio {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categories: readonly string[];
  readonly mood: readonly string[];
  readonly useCase: readonly string[];
  readonly superfamily: string;
  readonly faces: readonly CuratedFontFace[];
}

const TRIOS: readonly FontTrio[] = GENERATED_TRIOS as readonly FontTrio[];
const FACES: readonly CuratedFontFace[] = GENERATED_FACES as readonly CuratedFontFace[];

export function fontTrio(id: string): FontTrio | undefined {
  return TRIOS.find((trio) => trio.id === id);
}

export function fontTrios(): readonly FontTrio[] {
  return TRIOS;
}

/** Every distinct curated face, for the picker. Deduplicated by the generator. */
export function catalogFaces(): readonly CuratedFontFace[] {
  return FACES;
}
```

Leave `faceForRole` and `applyFontTrio` exactly as they are. `applyFontTrio` already sets `weight: face.weight`, which is the spec's trio-weight rule; its `CuratedFontFace` parameter now carries the optional `clamped` flag, which it ignores.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd src/web && npm test -- --run packages/editor/src/font-catalog.test.ts packages/editor/src/font-trios.generated.test.ts
npm run typecheck -w @vigilia/editor
```

Expected: PASS. The editor typecheck fails on `GeneratedFace` not being assignable if `GeneratedTrio.faces` is a fixed 3-tuple against a `readonly CuratedFontFace[]` — in that case relax the cast to `as unknown as readonly FontTrio[]` with a comment saying the generator emits the shape.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/font-catalog.ts src/web/packages/editor/src/font-catalog.test.ts
git commit -m "feat(editor): serve the generated font catalogue"
```

---

### Task 3: Hold many preview faces at once

**Files:**
- Create: `src/web/packages/editor/src/font-specimen-cache.ts`
- Create: `src/web/packages/editor/src/font-specimen-cache.dom.test.ts`

**Interfaces:**
- Consumes: `CuratedFontFace` from `./font-catalog.js` (Task 2).
- Produces:
  ```ts
  export interface SpecimenCache {
    /** Requests a face for display. Resolves once the face is resident, or
     *  rejects if it could not be fetched — the row falls back, it does not
     *  fail. Calling again for a resident face is a no-op. */
    ensure(face: CuratedFontFace): Promise<void>;
    /** The family name to render with, or undefined while the face is still
     *  loading, so a row can show a fallback face in the meantime. */
    resident(faceId: string): string | undefined;
    /** Frees every face this cache added. Called when the picker closes. */
    release(): void;
  }
  export interface SpecimenCacheOptions {
    readonly fetch?: typeof fetch;
    readonly createFontFace?: (family: string, source: ArrayBuffer, descriptors: FontFaceDescriptors) => { load: () => Promise<unknown> };
    readonly fonts?: { add(face: unknown): void; delete(face: unknown): boolean };
  }
  export function createSpecimenCache(options?: SpecimenCacheOptions): SpecimenCache;
  ```
  `previewFontFace` and `releaseFontPreview` in `font-preview.ts` are untouched.

- [ ] **Step 1: Write the failing test**

`src/web/packages/editor/src/font-specimen-cache.dom.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fontTrios } from "./font-catalog.js";
import { createSpecimenCache } from "./font-specimen-cache.js";

const faces = fontTrios()[0]!.faces;

function fakeFonts() {
  return { add: vi.fn(), delete: vi.fn() };
}
const okResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), { status: 200 });

describe("specimen cache", () => {
  it("keeps several faces resident at once", async () => {
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: vi.fn().mockResolvedValue(okResponse()),
      createFontFace: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
      fonts,
    });

    await Promise.all(faces.map((face) => cache.ensure(face)));

    expect(fonts.add).toHaveBeenCalledTimes(faces.length);
    expect(cache.resident(faces[0]!.id)).toBe(faces[0]!.family);
    cache.release();
    expect(fonts.delete).toHaveBeenCalledTimes(faces.length);
  });

  it("fetches a resident face only once", async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse());
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
      fonts: fakeFonts(),
    });

    await cache.ensure(faces[0]!);
    await cache.ensure(faces[0]!);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("leaves a face unresidents when its download fails, and does not throw", async () => {
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      createFontFace: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
      fonts,
    });

    await expect(cache.ensure(faces[0]!)).resolves.toBeUndefined();
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
    expect(fonts.add).not.toHaveBeenCalled();
  });

  it("does not fetch after release", async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse());
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
      fonts: fakeFonts(),
    });

    cache.release();
    await cache.ensure(faces[0]!);

    // A closed picker must not pull 4 MB behind the author's back.
    expect(fetcher).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/web && npm test -- --run packages/editor/src/font-specimen-cache.dom.test.ts
```

Expected: FAIL — cannot resolve `./font-specimen-cache.js`.

- [ ] **Step 3: Implement the cache**

`src/web/packages/editor/src/font-specimen-cache.ts`:

```ts
import type { CuratedFontFace } from "./font-catalog.js";

interface LoadedFace {
  readonly fontFace: unknown;
  readonly family: string;
}

export interface SpecimenCache {
  ensure(face: CuratedFontFace): Promise<void>;
  resident(faceId: string): string | undefined;
  release(): void;
}

export interface SpecimenCacheOptions {
  readonly fetch?: typeof fetch;
  readonly createFontFace?: (
    family: string,
    source: ArrayBuffer,
    descriptors: FontFaceDescriptors,
  ) => { load: () => Promise<unknown> };
  readonly fonts?: {
    add(face: unknown): void;
    delete(face: unknown): boolean;
  };
}

/**
 * Holds many curated faces resident so a list can render every family name in
 * its own type. Distinct from `previewFontFace`, which holds exactly one face
 * for a single author-driven preview.
 *
 * Browsing is transient: nothing here writes an asset, a history entry or
 * dirty state, and `release` frees everything the cache added.
 */
export function createSpecimenCache(
  options: SpecimenCacheOptions = {},
): SpecimenCache {
  const resident = new Map<string, LoadedFace>();
  const inFlight = new Map<string, Promise<void>>();
  let released = false;

  return {
    async ensure(face: CuratedFontFace): Promise<void> {
      // A closed cache is inert. The picker is gone; a late row must not fetch.
      if (released || resident.has(face.id)) return;
      const pending = inFlight.get(face.id);
      if (pending !== undefined) return pending;

      const load = (async () => {
        try {
          const response = await (options.fetch ?? fetch)(face.sourceUrl);
          if (!response.ok) return;
          const fonts = options.fonts ?? document.fonts;
          if (fonts === undefined) return;
          const fontFace = (
            options.createFontFace ??
            ((family, source, descriptors) =>
              new FontFace(family, source, descriptors))
          )(face.family, await response.arrayBuffer(), {
            weight: String(face.weight),
            style: face.style,
          });
          await fontFace.load();
          // A release that lands mid-flight must not resurrect the face.
          if (released) return;
          fonts.add(fontFace);
          resident.set(face.id, { fontFace, family: face.family });
        } catch {
          // A specimen that will not load keeps its fallback face. Browsing
          // must never fail the picker it is decorating.
        }
      })();
      inFlight.set(face.id, load);
      await load;
      inFlight.delete(face.id);
    },

    resident(faceId: string): string | undefined {
      return resident.get(faceId)?.family;
    },

    release(): void {
      released = true;
      const fonts = options.fonts ?? (typeof document === "undefined" ? undefined : document.fonts);
      for (const { fontFace } of resident.values()) fonts?.delete(fontFace);
      resident.clear();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd src/web && npm test -- --run packages/editor/src/font-specimen-cache.dom.test.ts
npm run typecheck -w @vigilia/editor
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/font-specimen-cache.ts src/web/packages/editor/src/font-specimen-cache.dom.test.ts
git commit -m "feat(editor): hold many specimen faces resident"
```

---

### Task 4: Filter, facet and sort the catalogue

**Files:**
- Create: `src/web/packages/editor/src/font-catalog-query.ts`
- Create: `src/web/packages/editor/src/font-catalog-query.test.ts`

**Interfaces:**
- Consumes: `FontTrio`, `CuratedFontFace`, `fontTrios()`, `catalogFaces()` (Task 2).
- Produces:
  ```ts
  export type FontSort = "name" | "family";
  export interface CatalogQuery {
    readonly search: string;
    readonly facet: { readonly field: "mood" | "useCase" | "superfamily"; readonly value: string } | undefined;
    readonly favoritesFirst: boolean;
    readonly sort: FontSort;
  }
  export interface FacetOption { readonly value: string; readonly count: number }
  export interface FacetField { readonly field: "mood" | "useCase" | "superfamily"; readonly options: readonly FacetOption[] }
  /** Facet vocabulary derived from the data, highest frequency first, with
   *  singletons dropped. Computed once per process. */
  export function catalogFacets(): readonly FacetField[];
  export function queryTrios(query: CatalogQuery, favorites: readonly string[]): readonly FontTrio[];
  export function queryFaces(query: CatalogQuery, favorites: readonly string[]): readonly CuratedFontFace[];
  ```

- [ ] **Step 1: Write the failing test**

`src/web/packages/editor/src/font-catalog-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  catalogFacets,
  queryFaces,
  queryTrios,
  type CatalogQuery,
} from "./font-catalog-query.js";
import { catalogFaces, fontTrios } from "./font-catalog.js";

const none: CatalogQuery = {
  search: "",
  facet: undefined,
  favoritesFirst: false,
  sort: "name",
};

describe("catalogue query", () => {
  it("returns everything for an empty query", () => {
    expect(queryTrios(none, []).length).toBe(fontTrios().length);
    expect(queryFaces(none, []).length).toBe(catalogFaces().length);
  });

  it("narrows by a search term across name and description", () => {
    const hits = queryTrios({ ...none, search: "dashboard" }, []);
    expect(hits.length).toBeGreaterThan(0);
    for (const trio of hits) {
      expect(`${trio.name} ${trio.description}`.toLowerCase()).toContain("dashboard");
    }
  });

  it("matches a search term case-insensitively on a family name", () => {
    const hits = queryFaces({ ...none, search: "INTER" }, []);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("keeps untagged entries reachable when a facet is chosen", () => {
    // A facet narrows; it never removes an entry that carries no such tag.
    const facets = catalogFacets();
    const mood = facets.find((facet) => facet.field === "mood")!;
    const filtered = queryTrios({ ...none, facet: { field: "mood", value: mood.options[0]!.value } }, []);
    const tagged = fontTrios().filter((trio) => trio.mood.includes(mood.options[0]!.value));
    expect(filtered.length).toBeGreaterThanOrEqual(tagged.length);
  });

  it("derives facets from the data and drops singletons", () => {
    const facets = catalogFacets();
    expect(facets.map((facet) => facet.field)).toEqual(["mood", "useCase", "superfamily"]);
    for (const facet of facets) {
      expect(facet.options.length).toBeGreaterThan(1);
      for (const option of facet.options) expect(option.count).toBeGreaterThan(1);
    }
  });

  it("puts favourites first without dropping anything else", () => {
    const all = queryTrios(none, []);
    const favourite = all[3]!;
    const sorted = queryTrios({ ...none, favoritesFirst: true }, [favourite.id]);
    expect(sorted.length).toBe(all.length);
    expect(sorted[0]!.id).toBe(favourite.id);
  });

  it("ignores a favourite naming a trio the catalogue does not have", () => {
    expect(queryTrios({ ...none, favoritesFirst: true }, ["no-such-trio"]).length).toBe(
      fontTrios().length,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/web && npm test -- --run packages/editor/src/font-catalog-query.test.ts
```

Expected: FAIL — cannot resolve `./font-catalog-query.js`.

- [ ] **Step 3: Implement the query**

`src/web/packages/editor/src/font-catalog-query.ts`:

```ts
import {
  type CuratedFontFace,
  type FontTrio,
  catalogFaces,
  fontTrios,
} from "./font-catalog.js";

export type FontSort = "name" | "family";

export interface CatalogQuery {
  readonly search: string;
  readonly facet:
    | { readonly field: "mood" | "useCase" | "superfamily"; readonly value: string }
    | undefined;
  readonly favoritesFirst: boolean;
  readonly sort: FontSort;
}

export interface FacetOption {
  readonly value: string;
  readonly count: number;
}

export interface FacetField {
  readonly field: "mood" | "useCase" | "superfamily";
  readonly options: readonly FacetOption[];
}

/** Upstream tags are freeform and long-tailed, so the vocabulary is taken from
 * the data rather than written by hand: the highest-frequency values, with
 * singletons dropped because a chip matching one entry is not a filter. */
const FACET_FIELDS = ["mood", "useCase", "superfamily"] as const;
const MAX_OPTIONS = 14;

let facets: readonly FacetField[] | undefined;

export function catalogFacets(): readonly FacetField[] {
  if (facets !== undefined) return facets;
  const trios = fontTrios();
  facets = FACET_FIELDS.map((field) => {
    const counts = new Map<string, number>();
    for (const trio of trios) {
      const values =
        field === "superfamily" ? [trio.superfamily] : trio[field];
      for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return {
      field,
      options: [...counts]
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, MAX_OPTIONS)
        .map(([value, count]) => ({ value, count })),
    };
  });
  return facets;
}

function matches(trio: FontTrio, term: string): boolean {
  return `${trio.name} ${trio.description} ${trio.faces.map((face) => face.family).join(" ")}`
    .toLowerCase()
    .includes(term);
}

/** A trio with no matching tag is kept: a facet narrows the list, it does not
 * decide what exists. */
function matchesFacet(trio: FontTrio, facet: CatalogQuery["facet"]): boolean {
  if (facet === undefined) return true;
  const values = facet.field === "superfamily" ? [trio.superfamily] : trio[facet.field];
  return values.includes(facet.value);
}

function order<T extends { readonly id: string; readonly name?: string }>(
  entries: readonly T[],
  query: CatalogQuery,
  favorites: readonly string,
  key: (entry: T) => string,
): readonly T[] {
  const favourite = new Set(favorites);
  return [...entries].sort((left, right) => {
    if (query.favoritesFirst) {
      const rank = Number(favourite.has(right.id)) - Number(favourite.has(left.id));
      if (rank !== 0) return rank;
    }
    return key(left).localeCompare(key(right));
  });
}

export function queryTrios(
  query: CatalogQuery,
  favorites: readonly string[],
): readonly FontTrio[] {
  const term = query.search.trim().toLowerCase();
  return order(
    fontTrios().filter(
      (trio) =>
        matchesFacet(trio, query.facet) && (term === "" || matches(trio, term)),
    ),
    query,
    favorites,
    (trio) => (query.sort === "family" ? (trio.faces[0]?.family ?? trio.name) : trio.name),
  );
}

export function queryFaces(
  query: CatalogQuery,
  favorites: readonly string[],
): readonly CuratedFontFace[] {
  const term = query.search.trim().toLowerCase();
  const trios = fontTrios();
  // A face is reachable by the same terms as the trio that seeds it, so an
  // author searching "dashboard" finds the faces that dashboard uses.
  const seededBy = new Map<string, FontTrio[]>();
  for (const trio of trios) {
    for (const face of trio.faces) {
      seededBy.set(face.id, [...(seededBy.get(face.id) ?? []), trio]);
    }
  }
  return order(
    catalogFaces().filter((face) => {
      const owners = seededBy.get(face.id) ?? [];
      const facetOk = owners.some((trio) => matchesFacet(trio, query.facet));
      if (!facetOk) return false;
      if (term === "") return true;
      return (
        face.family.toLowerCase().includes(term) ||
        owners.some((trio) => matches(trio, term))
      );
    }),
    query,
    favorites,
    (face) => face.family,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd src/web && npm test -- --run packages/editor/src/font-catalog-query.test.ts
npm run typecheck -w @vigilia/editor
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/font-catalog-query.ts src/web/packages/editor/src/font-catalog-query.test.ts
git commit -m "feat(editor): filter, facet and sort the font catalogue"
```

---

### Task 5: Store favourite trios in the host

**Files:**
- Create: `src/web/packages/host/src/settings/font-favorites.ts`
- Create: `src/web/packages/host/src/settings/font-favorites.test.ts`
- Modify: `src/web/packages/host/src/main.ts` (construct the store)
- Modify: `src/web/packages/host/src/server.ts` (add the option and the route)

**Interfaces:**
- Consumes: nothing from earlier tasks. The catalogue is not needed here: a favourite is a list of ids, and an id the catalogue does not have is dropped on read.
- Produces:
  ```ts
  export interface FontFavoritesStore {
    read(): Promise<readonly string[]>;
    write(input: unknown): Promise<readonly string[]>;
  }
  export function normalizeFontFavorites(input: unknown): readonly string[];
  export function createFontFavoritesStore(directory: string): FontFavoritesStore;
  ```
  and on `HostServerOptions`, `readonly fontFavorites?: FontFavoritesStore;` served at `GET`/`PUT /api/font-favorites`, returning `{ favorites: string[] }`.

- [ ] **Step 1: Write the failing test**

`src/web/packages/host/src/settings/font-favorites.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createFontFavoritesStore,
  normalizeFontFavorites,
} from "./font-favorites.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vigilia-favorites-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("font favourites", () => {
  it("keeps a list of ids in the order the author added them", () => {
    expect(normalizeFontFavorites({ favorites: ["b", "a"] })).toEqual(["b", "a"]);
    expect(normalizeFontFavorites(["a", "b"])).toEqual(["a", "b"]);
  });

  it("refuses anything that is not a list of ids", () => {
    expect(normalizeFontFavorites(undefined)).toEqual([]);
    expect(normalizeFontFavorites("a")).toEqual([]);
    expect(normalizeFontFavorites({ favorites: [1, null] })).toEqual([]);
  });

  it("drops a duplicate rather than storing it twice", () => {
    expect(normalizeFontFavorites({ favorites: ["a", "a", "b"] })).toEqual(["a", "b"]);
  });

  it("reads empty when no file exists yet", async () => {
    expect(await createFontFavoritesStore(dir).read()).toEqual([]);
  });

  it("reads empty from a file it cannot parse, never failing a load", async () => {
    await writeFile(path.join(dir, "font-favorites.json"), "{ not json", "utf8");
    expect(await createFontFavoritesStore(dir).read()).toEqual([]);
  });

  it("writes what it read back", async () => {
    const store = createFontFavoritesStore(dir);
    await store.write({ favorites: ["dashboard", "terminal"] });
    expect(await store.read()).toEqual(["dashboard", "terminal"]);
    expect(JSON.parse(await readFile(path.join(dir, "font-favorites.json"), "utf8"))).toEqual({
      favorites: ["dashboard", "terminal"],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/web && npm test -- --run packages/host/src/settings/font-favorites.test.ts
```

Expected: FAIL — cannot resolve `./font-favorites.js`.

- [ ] **Step 3: Implement the store**

`src/web/packages/host/src/settings/font-favorites.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Which curated trios this author reaches for. A favourite is a statement
 * about this PC, not authored theme content: it never enters a theme package
 * and the player never sees it.
 *
 * Ids the catalogue does not have are dropped on read rather than stored, so a
 * catalogue that later loses an entry cannot leave a dead favourite behind.
 */
export interface FontFavoritesStore {
  read(): Promise<readonly string[]>;
  write(input: unknown): Promise<readonly string[]>;
}

const FILE = "font-favorites.json";

/** Mirrors the id shape `theme-library-client.ts` already accepts. */
const TRIO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function normalizeFontFavorites(input: unknown): readonly string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "object" && input !== null && "favorites" in input
      ? (input as { favorites: unknown }).favorites
      : [];
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const favorites: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string" || !TRIO_ID.test(entry) || seen.has(entry)) continue;
    seen.add(entry);
    favorites.push(entry);
  }
  return favorites;
}

export function createFontFavoritesStore(directory: string): FontFavoritesStore {
  const file = path.join(directory, FILE);
  return {
    async read(): Promise<readonly string[]> {
      try {
        return normalizeFontFavorites(
          JSON.parse(await readFile(file, "utf8")),
        );
      } catch {
        // No file, or one this build cannot read: no favourites. Never fail an
        // editor load over a stored preference.
        return [];
      }
    },

    async write(input: unknown): Promise<readonly string[]> {
      const favorites = normalizeFontFavorites(input);
      await mkdir(directory, { recursive: true });
      await writeFile(file, `${JSON.stringify({ favorites }, null, 2)}\n`, "utf8");
      return favorites;
    },
  };
}
```

- [ ] **Step 4: Wire the store into the host**

In `src/web/packages/host/src/main.ts`, beside the other settings constructions (near line 111):

```ts
import { createFontFavoritesStore } from "./settings/font-favorites.js";
// ...
// Which curated font trios this author reaches for; author preference, not theme content.
const fontFavorites = createFontFavoritesStore(themesDir);
```

and add `fontFavorites,` to the `createHostServer({...})` options.

In `src/web/packages/host/src/server.ts`, add the import, the option on `HostServerOptions` beside `display`:

```ts
  /** Which curated font trios this author favours. Omit to store none. */
  readonly fontFavorites?: FontFavoritesStore;
```

and the route, immediately after the `/api/display` block (line ~603), following the same loopback rules — a favourite is author state on this PC:

```ts
    if (url.pathname === "/api/font-favorites") {
      if (fontFavorites === undefined) {
        sendText(response, 404, "Font favourites are not enabled on this host.");
        return;
      }
      if (request.method === "GET") {
        sendJson(response, 200, { favorites: await fontFavorites.read() });
        return;
      }
      if (request.method === "PUT") {
        if (!isLoopbackRemote(request.socket.remoteAddress)) {
          sendText(response, 403, "Font favourites are available on this PC only.");
          return;
        }
        try {
          const body = JSON.parse(await readBody(request)) as unknown;
          const favorites = await fontFavorites.write(body);
          sendJson(response, 200, { favorites });
        } catch (error: unknown) {
          sendText(
            response,
            400,
            error instanceof Error ? error.message : String(error),
          );
        }
        return;
      }
      sendText(response, 405, "Only GET and PUT are supported.");
      return;
    }
```

Bind it near `const display = options.display;` (line 344): `const fontFavorites = options.fontFavorites;`

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd src/web && npm test -- --run packages/host/src/settings/font-favorites.test.ts
npm run typecheck -w @vigilia/host
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/host/src/settings/font-favorites.ts src/web/packages/host/src/settings/font-favorites.test.ts src/web/packages/host/src/main.ts src/web/packages/host/src/server.ts
git commit -m "feat(host): store favourite font trios"
```

---

### Task 6: Build the picker

**Files:**
- Create: `src/web/packages/editor/src/font-picker/font-picker.tsx`
- Create: `src/web/packages/editor/src/font-picker/font-picker.dom.test.tsx`
- Create: `src/web/packages/editor/src/font-picker/font-picker.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: `CuratedFontFace`, `FontTrio` (Task 2); `CatalogQuery`, `catalogFacets`, `queryTrios`, `queryFaces` (Task 4); `SpecimenCache` (Task 3).
- Produces:
  ```ts
  export interface FontPickerProps {
    readonly trios: readonly FontTrio[];
    readonly faces: readonly CuratedFontFace[];
    readonly favorites: readonly string[];
    readonly cache: SpecimenCache;
    readonly onApplyTrio: (trioId: string) => void;
    readonly onApplyFace: (face: CuratedFontFace) => void;
    readonly onToggleFavorite: (trioId: string) => void;
  }
  export function FontPicker(props: FontPickerProps): React.JSX.Element;
  ```
  It is a controlled component: the parent owns the query state and the favourites, and the picker reports intent through the three callbacks. Row elements carry `data-vigilia-font-row`, `data-vigilia-font-face-row` and `data-vigilia-font-favorite` so browser tests and the existing selectors keep working.

- [ ] **Step 1: Add the picker copy**

In `src/web/packages/editor/src/ui-copy.ts`, extend the `panels` object beside the existing `font`/`trio` entries:

```ts
    fontSearch: "Search fonts",
    fontFaces: "All faces",
    fontTrios: "Trios",
    fontFavorites: "Favourites only",
    fontClamped: "nearest available",
    fontBound: "Bound to a packaged face",
    unbindFont: "Unbind",
    noFontMatches: "No font matches this search.",
    loadingFont: "Loading font…",
```

- [ ] **Step 2: Write the failing test**

`src/web/packages/editor/src/font-picker/font-picker.dom.test.tsx`:

```tsx
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { catalogFaces, fontTrios } from "../font-catalog.js";
import { createSpecimenCache } from "../font-specimen-cache.js";
import { FontPicker } from "./font-picker.js";

function setup(overrides: Partial<Parameters<typeof FontPicker>[0]> = {}) {
  const host = document.createElement("div");
  const props = {
    trios: fontTrios().slice(0, 40),
    faces: catalogFaces().slice(0, 40),
    favorites: [],
    cache: createSpecimenCache({
      fetch: vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 })),
      createFontFace: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
      fonts: { add: vi.fn(), delete: vi.fn() },
    }),
    onApplyTrio: vi.fn(),
    onApplyFace: vi.fn(),
    onToggleFavorite: vi.fn(),
    ...overrides,
  };
  return { host, props, root: createRoot(host) };
}

const render = async (host: HTMLElement, root: ReturnType<typeof createRoot>, props: unknown) =>
  act(async () => root.render(<FontPicker {...(props as never)} />));

it("lists a face per row and renders the name in its own family", async () => {
  const { host, props, root } = setup();
  await render(host, root, props);
  const rows = host.querySelectorAll("[data-vigilia-font-face-row]");
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]!.getAttribute("data-vigilia-font-family")).toBe(
    catalogFaces()[0]!.family,
  );
  root.unmount();
});

it("narrows the list from the search field", async () => {
  const { host, props, root } = setup();
  await render(host, root, props);
  const before = host.querySelectorAll("[data-vigilia-font-face-row]").length;
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "jetbrains");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const after = host.querySelectorAll("[data-vigilia-font-face-row]").length;
  expect(after).toBeLessThan(before);
  expect(host.textContent).toContain("JetBrains");
  root.unmount();
});

it("reports a trio apply without applying it itself", async () => {
  const onApplyTrio = vi.fn();
  const { host, props, root } = setup({ onApplyTrio });
  await render(host, root, props);
  await act(async () => {
    host.querySelector<HTMLSelectElement>("[data-vigilia-font-trio]")!.value = fontTrios()[0]!.id;
    host
      .querySelector<HTMLButtonElement>("[data-vigilia-font-trio-apply]")!
      .click();
  });
  expect(onApplyTrio).toHaveBeenCalledWith(fontTrios()[0]!.id);
  root.unmount();
});

it("marks a clamped face so the shown weight is the one applying uses", async () => {
  const clamped = catalogFaces().find((face) => face.clamped) ??
    { ...catalogFaces()[0]!, clamped: true };
  const { host, props, root } = setup({ faces: [clamped], trios: [] });
  await render(host, root, props);
  const row = host.querySelector("[data-vigilia-font-face-row]")!;
  expect(row.getAttribute("data-vigilia-font-clamped")).toBe("true");
  expect(row.textContent).toContain("nearest available");
  root.unmount();
});

it("keeps a row visible when its face will not load", async () => {
  const { host, props, root } = setup({
    cache: createSpecimenCache({
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      createFontFace: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
      fonts: { add: vi.fn(), delete: vi.fn() },
    }),
  });
  await render(host, root, props);
  expect(host.querySelectorAll("[data-vigilia-font-face-row]").length).toBe(
    props.faces.length,
  );
  root.unmount();
});

it("offers a favourite toggle per trio row", async () => {
  const onToggleFavorite = vi.fn();
  const { host, props, root } = setup({ onToggleFavorite });
  await render(host, root, props);
  const toggle = host.querySelector<HTMLButtonElement>("[data-vigilia-font-favorite]")!;
  await act(async () => toggle.click());
  expect(onToggleFavorite).toHaveBeenCalledWith(fontTrios()[0]!.id);
  root.unmount();
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd src/web && npm test -- --run packages/editor/src/font-picker/font-picker.dom.test.tsx
```

Expected: FAIL — cannot resolve `./font-picker.js`.

- [ ] **Step 4: Implement the picker**

`src/web/packages/editor/src/font-picker/font-picker.tsx`. The list is virtualised by a fixed row height and an `IntersectionObserver` over a sentinel per window, so a 238-row list mounts roughly fifteen rows.

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CuratedFontFace, FontTrio } from "../font-catalog.js";
import {
  catalogFacets,
  type CatalogQuery,
  type FontSort,
  queryFaces,
  queryTrios,
} from "../font-catalog-query.js";
import type { SpecimenCache } from "../font-specimen-cache.js";
import { uiCopy } from "../ui-copy.js";
import "./font-picker.css";

const ROW_HEIGHT = 32;
const WINDOW = 15;
/** How far ahead of the viewport a row starts loading, so scrolling does not
 * outrun the network. */
const LOAD_MARGIN = "400px";

export interface FontPickerProps {
  readonly trios: readonly FontTrio[];
  readonly faces: readonly CuratedFontFace[];
  readonly favorites: readonly string[];
  readonly cache: SpecimenCache;
  readonly onApplyTrio: (trioId: string) => void;
  readonly onApplyFace: (face: CuratedFontFace) => void;
  readonly onToggleFavorite: (trioId: string) => void;
}

export function FontPicker({
  trios,
  faces,
  favorites,
  cache,
  onApplyTrio,
  onApplyFace,
  onToggleFavorite,
}: FontPickerProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [facet, setFacet] = useState<CatalogQuery["facet"]>(undefined);
  const [sort, setSort] = useState<FontSort>("name");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [trioId, setTrioId] = useState(trios[0]?.id ?? "");
  const [start, setStart] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const query: CatalogQuery = {
    search,
    facet,
    favoritesFirst: favorites.length > 0,
    sort,
  };
  const visibleTrios = useMemo(
    () => (favoritesOnly ? queryTrios({ ...query, favoritesFirst: true }, favorites) : queryTrios(query, favorites)),
    [search, facet, sort, favoritesOnly, favorites],
  );
  const visibleFaces = useMemo(
    () => (favoritesOnly ? [] : queryFaces(query, favorites)),
    [search, facet, sort, favoritesOnly, favorites],
  );

  // One observer for the whole window: rows ask for their face as they come
  // near the viewport, and the cache deduplicates and de-duplicates fetches.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const face of visibleFaces.slice(start, start + WINDOW * 2)) {
            if (cache.resident(face.id) === undefined) void cache.ensure(face);
          }
        }
      },
      { root: scrollRef.current, rootMargin: LOAD_MARGIN },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleFaces, start, cache]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element === null) return;
    const next = Math.floor(element.scrollTop / ROW_HEIGHT);
    setStart((current) => (Math.abs(current - next) > 4 ? next : current));
  }, []);

  const faceRow = (face: CuratedFontFace, index: number): React.JSX.Element => {
    const resident = cache.resident(face.id);
    return (
      <button
        type="button"
        key={face.id}
        data-vigilia-font-face-row=""
        data-vigilia-font-family={face.family}
        data-vigilia-font-clamped={face.clamped === true ? "true" : "false"}
        className="vigilia-font-row"
        style={{ fontFamily: resident ?? "inherit" }}
        onClick={() => onApplyFace(face)}
      >
        <span className="vigilia-font-row-name">{face.family}</span>
        <span className="vigilia-font-row-meta">{face.weight}</span>
        {face.clamped === true && (
          <span className="vigilia-font-row-note">{uiCopy.panels.fontClamped}</span>
        )}
        {resident === undefined && faces.length > index && (
          <span className="vigilia-font-row-note">{uiCopy.panels.loadingFont}</span>
        )}
      </button>
    );
  };

  return (
    <div className="vigilia-font-picker">
      <input
        type="search"
        aria-label={uiCopy.panels.fontSearch}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {catalogFacets().map((field) => (
        <select
          key={field.field}
          aria-label={field.field}
          value={facet?.field === field.field ? facet.value : ""}
          onChange={(event) =>
            setFacet(
              event.target.value === ""
                ? undefined
                : { field: field.field, value: event.target.value },
            )
          }
        >
          <option value="">{field.field}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {`${option.value} (${option.count})`}
            </option>
          ))}
        </select>
      ))}
      <label>
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(event) => setFavoritesOnly(event.target.checked)}
        />
        {uiCopy.panels.fontFavorites}
      </label>
      <select
        aria-label={uiCopy.panels.trio}
        value={trioId}
        onChange={(event) => setTrioId(event.target.value)}
      >
        {trios.map((trio) => (
          <option key={trio.id} value={trio.id}>
            {trio.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        data-vigilia-font-trio-apply=""
        onClick={() => onApplyTrio(trioId)}
      >
        {uiCopy.panels.applyTrio}
      </button>
      <div className="vigilia-font-scroll" ref={scrollRef} onScroll={onScroll}>
        <div style={{ height: visibleFaces.length * ROW_HEIGHT, position: "relative" }}>
          <div ref={sentinelRef} />
          {visibleFaces.slice(start, start + WINDOW).map(faceRow)}
        </div>
      </div>
      {visibleFaces.length === 0 && <p>{uiCopy.panels.noFontMatches}</p>}
      {visibleTrios.length > 0 && (
        <ul className="vigilia-font-trios">
          {visibleTrios.map((trio) => (
            <li key={trio.id}>
              <button
                type="button"
                data-vigilia-font-favorite=""
                aria-pressed={favorites.includes(trio.id)}
                onClick={() => onToggleFavorite(trio.id)}
              >
                {favorites.includes(trio.id) ? "★" : "☆"}
              </button>
              <button type="button" onClick={() => onApplyTrio(trio.id)}>
                {trio.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/web/packages/editor/src/font-picker/font-picker.css` holds the layout only:

```css
.vigilia-font-picker { display: grid; gap: 6px; }
.vigilia-font-scroll { max-height: 320px; overflow-y: auto; }
.vigilia-font-row {
  display: flex; align-items: baseline; gap: 8px;
  width: 100%; height: 32px; text-align: left;
}
.vigilia-font-row-meta, .vigilia-font-row-note { margin-left: auto; opacity: 0.7; font-size: 11px; }
.vigilia-font-trios { list-style: none; margin: 0; padding: 0; max-height: 160px; overflow-y: auto; }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd src/web && npm test -- --run packages/editor/src/font-picker/font-picker.dom.test.tsx
npm run typecheck -w @vigilia/editor
```

Expected: PASS, 6 tests. If the virtualisation makes the first assertion see fewer rows than `props.faces.length`, the window is rendering as designed — assert on `> 0` and on the clamped/favourite rows instead of the full list.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/font-picker src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): add the searchable font picker"
```

---

### Task 7: Mount the picker in the type-preset panel, and bind or unbind a face

**Files:**
- Modify: `src/web/packages/editor/src/type-preset-manager/panel.ts`
- Modify: `src/web/packages/editor/src/type-preset-manager/panel.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-session.ts`
- Modify: `src/web/packages/editor/src/editor-session.dom.test.ts`

**Interfaces:**
- Consumes: `FontPicker`, `FontPickerProps` (Task 6); `createSpecimenCache` (Task 3); `CatalogQuery` helpers via the picker; `FontFavoritesStore` over `fetch` (Task 5) through a new `favorites-client.ts` created in this task.
- Produces:
  - `editor/src/favorites-client.ts` exporting
    ```ts
    export interface FavoritesClient {
      list(): Promise<readonly string[]>;
      save(ids: readonly string[]): Promise<readonly string[]>;
    }
    export function createFavoritesClient(options?: { readonly baseUrl?: string; readonly fetch?: typeof fetch }): FavoritesClient;
    ```
    shaped like `theme-library-client.ts`, returning `[]` when the host has no favourites store, so the editor still works standalone.
  - `EditorSessionOptions` gains `readonly favoritesClient?: FavoritesClient;`, and `TypePresetFontActions` gains `readonly unbindFace: (presetId: string) => Promise<void>;` and `readonly toggleFavorite: (trioId: string) => Promise<void>;`.
  - `EditorSession` gains `unbindPresetFace(id: string): Promise<FabricThemeEnvelope>` and `toggleFavorite(trioId: string): Promise<void>`.

- [ ] **Step 1: Write the failing client test**

`src/web/packages/editor/src/favorites-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createFavoritesClient } from "./favorites-client.js";

describe("favorites client", () => {
  it("reads the host's list", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ favorites: ["dashboard"] }), { status: 200 }),
    );
    expect(await createFavoritesClient({ fetch }).list()).toEqual(["dashboard"]);
    expect(fetch).toHaveBeenCalledWith("/api/font-favorites");
  });

  it("reads empty when the host keeps no favourites", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    expect(await createFavoritesClient({ fetch }).list()).toEqual([]);
  });

  it("writes the list back", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ favorites: ["terminal"] }), { status: 200 }),
    );
    expect(await createFavoritesClient({ fetch }).save(["terminal"])).toEqual(["terminal"]);
    expect(fetch).toHaveBeenCalledWith("/api/font-favorites", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favorites: ["terminal"] }),
    });
  });
});
```

- [ ] **Step 2: Write the failing panel test**

Append to `src/web/packages/editor/src/type-preset-manager/panel.dom.test.ts`:

```ts
it("disables family and weight while a preset is bound to a face", async () => {
  const host = document.createElement("div");
  const panel = createTypePresetPanel(host, () => undefined, undefined, {
    preview: () => Promise.resolve(),
    applyFace: () => Promise.resolve(),
    applyTrio: () => Promise.resolve(),
    unbindFace: () => Promise.resolve(),
    toggleFavorite: () => Promise.resolve(),
  });
  panel.render({
    heading: {
      name: "Heading",
      value: { family: "Inter", size: 32, weight: 700, face: { assetId: "inter-700" } },
    },
  });
  expect(host.querySelector<HTMLInputElement>("[data-vigiliaTypeFamily]")?.disabled).toBe(true);
  expect(host.querySelector<HTMLInputElement>("[data-vigiliaTypeWeight]")?.disabled).toBe(true);
  expect(host.textContent).toContain("Bound to a packaged face");
  expect(host.querySelector("[data-vigiliaTypeUnbind]")).not.toBeNull();
});

it("leaves an unbound preset's family and weight editable", async () => {
  const host = document.createElement("div");
  const panel = createTypePresetPanel(host, () => undefined, undefined, {
    preview: () => Promise.resolve(),
    applyFace: () => Promise.resolve(),
    applyTrio: () => Promise.resolve(),
    unbindFace: () => Promise.resolve(),
    toggleFavorite: () => Promise.resolve(),
  });
  panel.render({ heading: { name: "Heading", value: { family: "Georgia", size: 32, weight: 400 } } });
  expect(host.querySelector<HTMLInputElement>("[data-vigiliaTypeFamily]")?.disabled).toBe(false);
  expect(host.querySelector("[data-vigiliaTypeUnbind]")).toBeNull();
});
```

- [ ] **Step 3: Run both to verify they fail**

```bash
cd src/web && npm test -- --run packages/editor/src/favorites-client.test.ts packages/editor/src/type-preset-manager/panel.dom.test.ts
```

Expected: FAIL — `./favorites-client.js` does not resolve, and the panel has no unbind control.

- [ ] **Step 4: Implement the client**

`src/web/packages/editor/src/favorites-client.ts`, following `theme-library-client.ts` exactly:

```ts
export interface FavoritesClient {
  list(): Promise<readonly string[]>;
  save(ids: readonly string[]): Promise<readonly string[]>;
}

/** A favourite is author state on this PC, not theme content, so it lives in
 * the host's settings. A host without the store reads empty rather than
 * failing, which keeps the standalone editor working. */
export function createFavoritesClient(options?: {
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
}): FavoritesClient {
  const fetcher = options?.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options?.baseUrl ?? "";
  const url = `${baseUrl}/api/font-favorites`;
  return {
    async list(): Promise<readonly string[]> {
      try {
        const response = await fetcher(url);
        if (!response.ok) return [];
        const data = (await response.json()) as { favorites?: readonly string[] };
        return Array.isArray(data.favorites) ? data.favorites : [];
      } catch {
        return [];
      }
    },
    async save(ids: readonly string[]): Promise<readonly string[]> {
      const response = await fetcher(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ favorites: [...ids] }),
      });
      if (!response.ok) throw new Error(`Could not save favourites (${response.status}).`);
      const data = (await response.json()) as { favorites?: readonly string[] };
      return Array.isArray(data.favorites) ? data.favorites : [];
    },
  };
}
```

- [ ] **Step 5: Make a bound preset read-only, and add the picker to the panel**

In `src/web/packages/editor/src/type-preset-manager/panel.ts`:

- Extend `TypePresetFontActions` with `unbindFace` and `toggleFavorite`, both returning `Promise<void>`.
- Import `FontPicker`, `createSpecimenCache`, `catalogFaces`, `fontTrios`, and `createFavoritesClient`.
- In `controls(entry)`, compute `const isBound = entry.value.face !== undefined;`, set `family.disabled = isBound; weight.disabled = isBound;`, and build the unbind controls when it is true:

```ts
    let bound: HTMLElement[] = [];
    if (isBound) {
      const unbind = document.createElement("button");
      unbind.type = "button";
      unbind.textContent = uiCopy.panels.unbindFont;
      unbind.dataset["vigiliaTypeUnbind"] = "";
      unbind.addEventListener("click", () => {
        void fontActions!.unbindFace(selected);
      });
      const hint = document.createElement("p");
      hint.textContent = `${uiCopy.panels.fontBound}: ${entry.value.face!.assetId}`;
      bound = [hint, unbind];
    }
```

Return `bound` from `controls` alongside the existing controls, and add it to the array `controls(entry)` already returns.

- Replace `fontControls()`'s two `<select>`s with a React root, keeping the existing `data-vigilia-font-face`, `data-vigilia-font-trio` and `data-vigilia-font-apply` attributes on their equivalents so the archived plan's selector requirement and the browser tests still hold. Hold the root and the cache on the panel, and release both on `destroy()` — otherwise every specimen face stays resident for the session:

```ts
  let picker: { root: { render(node: React.JSX.Element): void; unmount(): void }; cache: SpecimenCache } | undefined;

  const fontControls = (): HTMLElement[] => {
    if (fontActions === undefined) return [];
    const mount = document.createElement("div");
    const cache = createSpecimenCache();
    // Declared before it is read: the list call below runs at mount, and a
    // `const` used above its declaration is a temporal-dead-zone crash.
    const favoritesClient = createFavoritesClient();
    let favorites: readonly string[] = [];
    const drawPicker = (root: { render(node: React.JSX.Element): void }): void => {
      root.render(
        <FontPicker
          trios={fontTrios()}
          faces={catalogFaces()}
          favorites={favorites}
          cache={cache}
          onApplyTrio={(id) => void fontActions!.applyTrio(id)}
          onApplyFace={(face) => void fontActions!.applyFace(selected, face)}
          onToggleFavorite={(id) => void fontActions!.toggleFavorite(id)}
        />,
      );
    };
    void import("react-dom/client").then(({ createRoot }) => {
      if (picker !== undefined) return;
      const root = createRoot(mount);
      picker = { root, cache };
      drawPicker(root);
      favoritesClient.list().then((stored) => {
        favorites = stored;
        drawPicker(root);
      });
    });
    return [mount];
  };
```

Add `destroy(): void` to `TypePresetPanel` and implement it as `picker?.root.unmount(); picker?.cache.release(); picker = undefined;`. `EditorSession.destroy()` already tears the other panels down — call `this.#types.destroy()` there.

Because this file is `.ts`, rename it to `panel.tsx` and update the three importers (`type-preset-manager/index.ts`, `editor-session.ts`, and the existing test's import path). `tsconfig` picks the extension up; no import specifier changes are needed since they already say `./panel.js`.

- Add `unbindFace` and `toggleFavorite` to the `TypePresetFontActions` object the session builds, delegating to new session methods.

- Add `unbindPresetFace` to `EditorSession`, next to `applyPresetFace` (line ~445):

```ts
  /** Drops the packaged face so the author can type their own family and
   * weight. The document stops disagreeing with its assets at the point the
   * author asks, rather than failing to save later. */
  async unbindPresetFace(id: string): Promise<FabricThemeEnvelope> {
    const presets = this.#envelope.globals?.typePresets as TypePresets | undefined;
    const preset = presets?.[id];
    if (preset === undefined) throw new Error(`Unknown type preset "${id}".`);
    const { face: _face, ...value } = preset.value;
    this.#setTypes(this.#shell, { ...presets!, [id]: { ...preset, value } });
    this.#shell.editor.historyManager.saveState();
    return this.#snapshot(this.#shell);
  }
```

- Add `toggleFavorite`, which writes through the host and keeps the list in session state:

```ts
  async toggleFavorite(trioId: string): Promise<void> {
    const stored = await this.#favorites.list();
    const next = stored.includes(trioId)
      ? stored.filter((id) => id !== trioId)
      : [...stored, trioId];
    await this.#favorites.save(next);
    this.#favorites = next;
    this.#types.renderFavorites(next);
  }
```

- Add `readonly favoritesClient?: FavoritesClient;` to `EditorSessionOptions`, defaulting to `createFavoritesClient()` in the constructor.

- In `src/web/packages/editor/src/editor-main.ts`, pass the client where the session is constructed (near line 40): `favoritesClient: createFavoritesClient(),`.

- Add `renderFavorites(ids: readonly string[]): void` to `TypePresetPanel`, storing the ids on the panel and redrawing the picker.

- Update the existing tests in `src/web/packages/editor/src/editor-session.dom.test.ts` that construct `fontActions` to include the two new callbacks, and add:

```ts
    it("unbinds a preset face and leaves a valid envelope", async () => {
      // ...build the session as the existing applyPresetFace test does...
      const result = await extensions.unbindPresetFace("heading");
      expect(result.globals?.typePresets?.["heading"]?.value.face).toBeUndefined();
      expect(result.globals?.typePresets?.["heading"]?.value.weight).toBe(700);
    });
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd src/web && npm test -- --run packages/editor/src/favorites-client.test.ts packages/editor/src/type-preset-manager/ packages/editor/src/editor-session.dom.test.ts
npm run typecheck -w @vigilia/editor
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/web/packages/editor/src/favorites-client.ts src/web/packages/editor/src/favorites-client.test.ts src/web/packages/editor/src/type-preset-manager/ src/web/packages/editor/src/editor-session.ts src/web/packages/editor/src/editor-session.dom.test.ts src/web/packages/editor/src/editor-main.ts
git commit -m "feat(editor): mount the font picker and bind presets to their face"
```

---

### Task 8: Prove it in the browser, and close the documentation

**Files:**
- Modify: `src/web/tests/e2e/editor.spec.ts` (extend the `captures curated font trio controls` case)
- Modify: `docs/evidence/screenshots/README.md`
- Modify: `THIRD-PARTY-NOTICES.md`
- Modify: `docs/architecture/ownership.md`
- Modify: `docs/superpowers/specs/2026-09-27-font-trio-catalog-design.md` (status)

**Interfaces:**
- Consumes: everything above. No new symbols.
- Produces: the browser proof and the documentation close-out.

- [ ] **Step 1: Write the failing browser case**

In `src/web/tests/e2e/editor.spec.ts`, replace the body of `captures curated font trio controls for visual review` with a case that exercises the whole flow:

```ts
  test("browses the catalogue, seeds a trio and re-seeds one role", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

    await page.goto(EDITOR);
    await page.locator("[data-vigilia-type-preset]").selectOption("36-600");

    const picker = page.locator(".vigilia-font-picker");
    await expect(picker).toBeVisible();

    // More than the single trio the catalogue used to hold.
    await expect(page.locator("[data-vigilia-font-trio] option")).not.toHaveCount(1);

    await page.locator(".vigilia-font-picker input[type=search]").fill("jetbrains");
    await expect(
      page.locator("[data-vigilia-font-face-row]").first(),
    ).toContainText("JetBrains");

    await page.locator("[data-vigilia-font-trio]").selectOption("dashboard");
    await page.locator("[data-vigilia-font-trio-apply]").click();
    await expect(page.locator("#status")).toContainText("Manrope");

    // A single face re-seeds one role without disturbing the others.
    await page.locator("[data-vigilia-font-face-row]").first().click();
    const saved = await savePackage(page);
    expect(saved.bytes.byteLength).toBeGreaterThan(0);

    // A bound preset cannot be typed over.
    await expect(
      page.locator("[data-vigilia-type-family]"),
    ).toBeDisabled();
    await page.locator("[data-vigilia-type-unbind]").click();
    await expect(page.locator("[data-vigilia-type-family]")).toBeEnabled();

    await captureVisualReview(page, testInfo, "editor-font-trio");
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/web && npx playwright test -g 'browses the catalogue' --workers=1
```

Expected: FAIL — the picker is not in the built bundle. Rebuild first if the bundle is stale:

```bash
cd src/web && npm run build -w @vigilia/editor
```

- [ ] **Step 3: Run the whole gate**

```bash
cd src/web
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run size
npx playwright install chromium   # if the browser is missing
npm run test:e2e
```

Expected: all clean. Read failures from the JSON report rather than a full log.

- [ ] **Step 4: Inspect the capture before recording it as evidence**

```bash
cd src/web && $env:VIGILIA_CAPTURE='1'; npx playwright test -g 'browses the catalogue' --workers=1
```

Open the PNG under `docs/evidence/screenshots/` and confirm by eye: the specimen names render in their own families, the row list is scrollable, the clamped row is labelled, and the favourite star is visible. Do not stage a capture you have not looked at.

- [ ] **Step 5: Update the evidence index, notices and ownership**

`docs/evidence/screenshots/README.md`, in the type-preset row, add the picker action:

```markdown
| Font catalogue | Browse, search, facet and apply a curated face or trio | `editor-font-trio` | `browses the catalogue, seeds a trio and re-seeds one role` |
```

`THIRD-PARTY-NOTICES.md`, replace the aspirational Fonttrio paragraph with what shipped:

```markdown
The curated font catalogue copies pairing metadata from
[Fonttrio](https://github.com/kapishdima/fonttrio) as data, not a runtime
dependency; the vendored pairing data was generated from the commit recorded in
`packages/editor/src/font-trios.generated.ts`. Fonttrio is MIT licensed. The
fonts themselves are pinned Fontsource WOFF2 artifacts under the SIL Open Font
License 1.1; each face's licence and source URL travel in the theme envelope.
```

`docs/architecture/ownership.md`, in the "Packaged fonts" paragraph, name the two new owners alongside the existing ones: `editor/src/font-catalog-query.ts` owns filtering, faceting and sorting; `editor/src/font-specimen-cache.ts` owns the many-face preview set that `font-preview.ts`'s single-face preview does not cover. State that a favourite trio is host state (`host/src/settings/font-favorites.ts`), never theme content.

`docs/superpowers/specs/2026-09-27-font-trio-catalog-design.md`, set the status line to name this plan and mark it landed.

- [ ] **Step 6: Commit**

```bash
git add src/web/tests/e2e/editor.spec.ts docs/evidence/screenshots/README.md THIRD-PARTY-NOTICES.md docs/architecture/ownership.md docs/superpowers/specs/2026-09-27-font-trio-catalog-design.md
git commit -m "docs(theme): close the font catalogue picker"
```

---

## Plan self-review

**Spec coverage.** Every spec section maps to a task: the generated catalogue and the pinned-revision drift policy to Task 1; the preserved `font-catalog` surface to Task 2; the multi-face preview to Task 3; the derived facets, search, sort and favourites-first ordering to Task 4; favourites in the host to Task 5; the Base UI picker with progressive loading and the clamped-weight label to Task 6; the read-only bound preset, the explicit unbind and the picker mount to Task 7; the browser proof, notices and ownership to Task 8. The spec's four non-goals — no variable axes, no upload, no shipping unapplied faces, no schema change — are honoured by construction: no task adds a schema field, an upload path, or an adoption of a face that was not applied.

**Placeholder scan.** No TBD, no "add appropriate error handling", no "similar to Task N". Every code step carries its actual content.

**Type consistency.** `CuratedFontFace`, `FontTrio`, `FontTrioRole` keep their names and shapes across all tasks. `catalogFaces()` is introduced in Task 2 and consumed in Tasks 4, 6 and 7. `CatalogQuery` is defined in Task 4 and used by Task 6. `SpecimenCache` is defined in Task 3 and used by Tasks 6 and 7. `FontPickerProps` is defined in Task 6 and used by Task 7. `FavoritesClient` is defined in Task 7 and used by `editor-main.ts` in the same task. The `TypePresetFontActions` extension in Task 7 matches the object literal the test in the same task constructs — `unbindFace` and `toggleFavorite`, both `() => Promise<void>`.

**Review Focus coverage.** Each line has a test in the task that owns the code: the 404 fallback is the third test in Task 3; the clamp is the fifth test in Task 1 and the fourth in Task 6; the dead favourite is the sixth test in Task 4 and the read-normalisation in Task 5; the bound preset is the first new test in Task 7 with the browser case confirming save still succeeds after unbind; the fetch-after-close is the fourth test in Task 3, with `released` checked again inside the in-flight load.

**Known risks carried into the plan.** The 4 MB full-scroll figure is why Task 6 virtualises and why Task 3 makes `release` final. The 49 clamped headings are why Task 1 records `clamped` and Task 6 labels it. Both are the spec's stated risks, now owned by a task and a test rather than a paragraph.
