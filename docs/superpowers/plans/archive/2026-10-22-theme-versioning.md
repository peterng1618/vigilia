# Theme Versioning and Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a theme under a version computed from the published package by a machine-checkable ladder, identify every theme by a UUID, and credit the theme a remix was forked from.

**Architecture:** One pure classifier in `theme-package` is the only owner of "what changed, and how big it is"; the host and the catalogue's CI both call it, from opposite sides of the wire. Identity is minted at document creation, and provenance is recorded once, at the fork, then frozen.

**Tech Stack:** TypeScript, Vitest, Biome, Node 22+, React 19; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-22-theme-versioning-design.md`

## Global Constraints

- `metadata.version` matches `^\d+\.\d+\.\d+$`; prerelease and build tags are illegal and the ladder never produces one.
- A catalogue id is a lowercase UUID matching `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. A library id keeps `^[A-Za-z0-9_-]{1,64}$`.
- The ladder's interface is the union of bound `semanticKey`s and the artboard's `width`/`height`; everything else is content. The classifier errs upward on anything it does not know.
- The host writes the computed version into the stored document; the CI re-derives the same number from the base commit. The app never trusts a client-supplied version.
- `remixOf` is the immediate parent only, is accepted on first publication, and is frozen afterwards.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on: optional fields are omitted, never set to `undefined`.
- No new dependencies. No new HTTP route: submission stays on `POST /api/themes/submit`, behind the existing loopback and `isForeignOrigin` guard.
- Copy strings quoted in this plan are used verbatim.
- Conventional Commit titles; stage explicit paths; never `git add -A` or `git commit -a`.
- Before each task's commit, replace `STATUS.md`'s "Last completed change" and run `npm run status:check` from `src/web/`.

## Review Focus

1. A published `item.json` exists but its package is missing or unreadable — a submit must refuse, never fall back to `1.0.0`.
2. A theme whose local `metadata.version` disagrees with the catalogue — the published version decides; a first publish ignores a local `0.9.0`.
3. A save lands on the theme while a submit is between its read and its write — the store refuses the write and nothing is uploaded.
4. A remix whose parent is absent from the index — the credit renders as text, with no link and no crash; present — it opens the parent item.
5. An envelope member a future schema adds — the coverage test is red until it is classified, and at runtime it is `major`.

## File structure

- `theme-package/src/version-ladder.ts` — the classifier, arithmetic, and the version helpers. New.
- `theme-package/src/index.ts` — re-exports the ladder's public surface.
- `renderer-core/src/theme/catalogue-index.ts` — `isCatalogueId`, `ThemeRemix` on the item and index types, parser.
- `renderer-core/src/theme/document.ts` — `ThemeRemix`, `ThemeMetadata.remixOf`.
- `renderer-core/src/theme/fabric-envelope-validate.ts` — `remixOf` shape checks.
- `schema/theme-document.schema.json` — `remixOf`.
- `host/src/themes/published-item.ts` — reads the catalogue's current item and package. New.
- `host/src/themes/github-item.ts` — the submit decision and the files it builds.
- `host/src/themes/validate-item.ts` — the CI arm, with the previous item and package.
- `host/src/server.ts` — the submit answer gains the version facts.
- `editor/src/store-mode/use-submit.ts`, `item-modal.tsx`, `region.tsx`, `ui-copy.ts` — the author-facing version sentence and the re-listing.
- `editor/src/theme-library-dialog.tsx`, `theme-library-manager/index.ts` — Remix.
- `editor/src/new-fabric-theme.ts` — UUID minting.
- `editor/src/store-mode/item-modal.tsx` — the remix credit line and its link.

---

## Phase 1 — The ladder

### Task 1.1: Version arithmetic

**Files:**
- Create: `src/web/packages/theme-package/src/version-ladder.ts`
- Create: `src/web/packages/theme-package/src/version-ladder.test.ts`
- Modify: `src/web/packages/theme-package/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type VersionLevel = "initial" | "none" | "patch" | "minor" | "major";
  export type ChangeReason =
    | "schema" | "canvas" | "sensor-removed" | "sensor-added"
    | "structure" | "backdrop" | "metadata" | "content";
  export interface ThemeChange {
    readonly level: VersionLevel;
    readonly reasons: readonly ChangeReason[];
  }
  export function isSemanticVersion(text: string): boolean;
  export function bumpVersion(
    previous: string,
    level: "patch" | "minor" | "major",
  ): string | undefined;
  export function versionFor(
    previous: string | undefined,
    change: ThemeChange,
  ): string | undefined;
  ```

- [ ] **Step 1: Write the failing test**

`version-ladder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  isSemanticVersion,
  versionFor,
} from "./version-ladder.js";

describe("isSemanticVersion", () => {
  it.each(["0.0.0", "1.4.0", "10.20.30"])("accepts %s", (text) =>
    expect(isSemanticVersion(text)).toBe(true));
  it.each(["v1.4.0", "1.4", "1.4.0-beta.1", "1.4.0+build", ""])(
    "refuses %s",
    (text) => expect(isSemanticVersion(text)).toBe(false),
  );
});

describe("bumpVersion", () => {
  it.each([
    ["1.4.0", "patch", "1.4.1"],
    ["1.4.0", "minor", "1.5.0"],
    ["1.4.0", "major", "2.0.0"],
    ["0.9.9", "minor", "0.10.0"],
    ["1.9.9", "patch", "1.9.10"],
    ["9.9.9", "major", "10.0.0"],
  ] as const)("%s + %s = %s", (previous, level, expected) =>
    expect(bumpVersion(previous, level)).toBe(expected));
  it("answers undefined for a previous that is not a version", () =>
    expect(bumpVersion("v1.4", "patch")).toBeUndefined());
});

describe("versionFor", () => {
  it("mints 1.0.0 for a first publication", () =>
    expect(versionFor(undefined, { level: "initial", reasons: [] })).toBe(
      "1.0.0",
    ));
  it("keeps the published version when nothing changed", () =>
    expect(versionFor("1.4.0", { level: "none", reasons: [] })).toBe("1.4.0"));
  it("bumps the published version by the level", () =>
    expect(versionFor("1.4.0", { level: "minor", reasons: [] })).toBe("1.5.0"));
  it("answers undefined for a previous that is not a version", () =>
    expect(versionFor("v1", { level: "patch", reasons: [] })).toBeUndefined());
  it("answers undefined for initial without a previous", () =>
    expect(versionFor("1.4.0", { level: "initial", reasons: [] })).toBeUndefined());
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/theme-package/src/version-ladder.test.ts`
Expected: FAIL — cannot resolve `./version-ladder.js`.

- [ ] **Step 3: Implement the module**

`bumpVersion` parses the three integers with one regex and rebuilds the string
from numbers; `versionFor` answers `"1.0.0"` for `initial` with no previous,
the previous for `none`, `bumpVersion` otherwise, and `undefined` where the
signature says so. Re-export all four names from `theme-package/src/index.ts`.

- [ ] **Step 4: Run it green**

Run: `npx vitest run packages/theme-package/src/version-ladder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/theme-package/src/version-ladder.ts \
  src/web/packages/theme-package/src/version-ladder.test.ts \
  src/web/packages/theme-package/src/index.ts STATUS.md
git commit -m "feat(theme-package): semver arithmetic restricted to the document's own shape"
```

### Task 1.2: The classifier's interface members and its coverage test

**Files:**
- Modify: `src/web/packages/theme-package/src/version-ladder.ts`
- Modify: `src/web/packages/theme-package/src/version-ladder.test.ts`

**Interfaces:**
- Consumes: Task 1.1's types and `bumpVersion`.
- Produces:
  ```ts
  export const CLASSIFIED_ENVELOPE_KEYS: readonly string[];
  export const IGNORED_ENVELOPE_KEYS: readonly string[];
  export function classifyThemeChange(
    previous: FabricThemeEnvelope | undefined,
    next: FabricThemeEnvelope,
  ): ThemeChange;
  ```

- [ ] **Step 1: Write the failing tests**

Add to `version-ladder.test.ts`, importing `envelopeKeysFor` from
`@yunari/renderer-core` and a base envelope helper:

```ts
describe("classifyThemeChange", () => {
  it("is initial with no published package", () => {
    expect(classifyThemeChange(undefined, base())).toEqual({
      level: "initial",
      reasons: [],
    });
  });
  it("is none when only ignored fields move", () => {
    const next = base({
      fabricVersion: "7.5.0",
      scene: { ...base().scene, version: "7.5.0" },
      editorMetadata: { zoom: 2 },
      metadata: { ...base().metadata, version: "9.9.9", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(classifyThemeChange(base(), next)).toEqual({ level: "none", reasons: [] });
  });
  it("is major when the schema version changes", () => {
    expect(classifyThemeChange(base(), base({ schemaVersion: 3 }))).toEqual({
      level: "major",
      reasons: ["schema"],
    });
  });
  it("is major when the artboard's width or height changes", () => {
    const next = base({ artboard: { ...base().artboard, width: 1920 } });
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "major",
      reasons: ["canvas"],
    });
  });
  it("is major when a bound sensor is no longer bound", () => {
    const withSensor = base({ bindings: { chart: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] } });
    const next = base({ bindings: {} });
    expect(classifyThemeChange(withSensor, next)).toEqual({
      level: "major",
      reasons: ["sensor-removed"],
    });
  });
  it("is minor when a sensor is added", () => {
    const next = base({ bindings: { chart: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] } });
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "minor",
      reasons: ["sensor-added"],
    });
  });
  it("is patch when a binding moves between objects and keeps its sensor", () => {
    const before = base({ bindings: { a: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] } });
    const after = base({ bindings: { b: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] } });
    expect(classifyThemeChange(before, after)).toEqual({
      level: "patch",
      reasons: ["content"],
    });
  });
  it("is major for a member no rule knows", () => {
    const next = { ...base(), futureThing: {} } as unknown as ReturnType<typeof base>;
    expect(classifyThemeChange(base(), next)).toEqual({
      level: "major",
      reasons: ["schema"],
    });
  });
});

it("classifies every envelope member the schema can carry", () => {
  const known = new Set([...CLASSIFIED_ENVELOPE_KEYS, ...IGNORED_ENVELOPE_KEYS]);
  expect([...envelopeKeysFor("envelope")].sort()).toEqual([...known].sort());
});
```

- [ ] **Step 2: Run and watch the new cases fail**

Run: `npx vitest run packages/theme-package/src/version-ladder.test.ts`
Expected: FAIL — `classifyThemeChange` is not exported.

- [ ] **Step 3: Implement the dispatch**

`classifyThemeChange` walks the envelope's top-level members against a rule
table. `CLASSIFIED_ENVELOPE_KEYS` is every member with a rule — including
`metadata` and `scene`, which have their own readers. `IGNORED_ENVELOPE_KEYS` is
`fabricVersion`, `editorMetadata` and `id`; `id` is ignored because the diff is
only run between documents proven to be the same item by their callers. The two
lists together equal `envelopeKeysFor("envelope")`, which is what keeps a new
schema member from arriving unclassified. Collection is a max by level, then
`reasons` deduplicated in the enum's order.

- [ ] **Step 4: Run it green**

Run: `npx vitest run packages/theme-package/src/version-ladder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/theme-package/src/version-ladder.ts \
  src/web/packages/theme-package/src/version-ladder.test.ts STATUS.md
git commit -m "feat(theme-package): classify interface changes and hold the envelope's member set closed"
```

### Task 1.3: The classifier's content members

**Files:**
- Modify: `src/web/packages/theme-package/src/version-ladder.ts`
- Modify: `src/web/packages/theme-package/src/version-ladder.test.ts`

**Interfaces:**
- Produces: the same `classifyThemeChange`, now total over the envelope's members.

- [ ] **Step 1: Write the failing tests**

One case per row, in the same style as Task 1.2:

- object added or removed at any depth → `minor` / `structure`; an object whose
  id is unchanged but whose paint, text, geometry or position changed → `patch` /
  `content`; the array reordered with the same ids → `patch` / `content`.
- an asset `id` added or removed → `minor` / `structure`; an asset's reference
  fields changed → `patch` / `content`.
- a palette token or type preset added or removed → `minor` / `structure`; a
  kept token's value changed → `patch` / `content`.
- `metadata.tags` membership changed → `minor` / `metadata`; reordered → `none`.
- `artboard.backgroundMedia` added, removed or changed → `minor` / `backdrop`.
- `metadata.name`, `author`, `description`, `themeLanguage` or `remixOf`
  changed → `patch` / `metadata`; `artboard.background` changed → `patch` /
  `content`.
- a document differing in a major and a minor member at once → `major`, with
  both reasons in enum order.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/theme-package/src/version-ladder.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the member readers**

Objects are matched by `id` at every depth and by index when a document carries
no id; a different id is a removal plus an addition. Tags compare as sets.
`bindings` contributes to the sensor set only; every other bindings difference
is `content`. Unknown keys inside a known member are `patch` — only an unknown
top-level member is `major`.

- [ ] **Step 4: Run the whole package green**

Run: `npx vitest run packages/theme-package`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/theme-package/src/version-ladder.ts \
  src/web/packages/theme-package/src/version-ladder.test.ts STATUS.md
git commit -m "feat(theme-package): grade content changes as patch, structure changes as minor"
```

---

## Phase 2 — Identity

### Task 2.1: Mint a UUID at document creation

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts`
- Modify: `src/web/packages/editor/src/new-fabric-theme.test.ts`
- Modify: any test asserting the old document ids (grep `yunari-new-theme` and
  `yunari-demo-dashboard`)

**Interfaces:**
- Produces: `createNewFabricTheme()` and `createBlankFabricTheme(size)` return a
  document whose `id` is `crypto.randomUUID()`.
- Keeps: `STARTER_ENVELOPE_ID` as the template's *choice* id; it no longer
  appears in a document's `id`.

- [ ] **Step 1: Write the failing test**

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
it("mints a fresh id for every new document", () => {
  const first = createNewFabricTheme();
  const second = createNewFabricTheme();
  expect(first.id).toMatch(UUID);
  expect(second.id).toMatch(UUID);
  expect(first.id).not.toBe(second.id);
});
it("mints a fresh id for a blank document too", () => {
  expect(createBlankFabricTheme({ width: 800, height: 480 }).id).toMatch(UUID);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run packages/editor/src/new-fabric-theme.test.ts`
Expected: FAIL — ids are the literals.

- [ ] **Step 3: Replace the two literals**

`crypto.randomUUID()` in the returned object of each factory. `STARTER_ENVELOPE_ID`
stays, used only by `STARTER_TEMPLATE`.

- [ ] **Step 4: Run the editor unit suite**

Run: `npx vitest run packages/editor`
Expected: PASS after updating tests that asserted the literals as document ids.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/new-fabric-theme.ts \
  src/web/packages/editor/src/new-fabric-theme.test.ts STATUS.md
git commit -m "feat(editor): a new document's id is a UUID, not a shared literal"
```

### Task 2.2: The catalogue id rule

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/catalogue-index.ts`
- Modify: `src/web/packages/renderer-core/src/theme/catalogue-index.test.ts`
- Modify: `src/web/packages/renderer-core/src/index.ts` (export the predicate)
- Modify: `src/web/packages/host/src/themes/github-item.test.ts` and
  `src/web/packages/host/src/server.test.ts` (fixture ids move to UUIDs)

**Interfaces:**
- Produces: `export function isCatalogueId(text: string): boolean` and
  `export const CATALOGUE_ID_PATTERN: RegExp` in `catalogue-index.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
it("accepts a lowercase UUID", () =>
  expect(isCatalogueId("3f2a1c9e-8b7d-4c6a-9e0f-1a2b3c4d5e6f")).toBe(true));
it.each(["aurora", "3F2A1C9E-8B7D-4C6A-9E0F-1A2B3C4D5E6F", "3f2a1c9e-8b7d-4c6a-9e0f"])(
  "refuses %s",
  (id) => expect(isCatalogueId(id)).toBe(false),
);
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/renderer-core/src/theme/catalogue-index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add the pattern and predicate to `catalogue-index.ts`.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/renderer-core/src/theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/renderer-core/src/theme/catalogue-index.ts \
  src/web/packages/renderer-core/src/theme/catalogue-index.test.ts STATUS.md
git commit -m "feat(store): a catalogue id is a lowercase UUID"
```

### Task 2.3: `validate-item` requires a catalogue id

**Files:**
- Modify: `src/web/packages/host/src/themes/validate-item.ts`
- Modify: `src/web/packages/host/src/themes/validate-item.test.ts`

**Interfaces:**
- Consumes: `isCatalogueId` (Task 2.2).
- Produces: the first refusal for a directory whose name is not a catalogue id:
  `the directory name "x" is not a catalogue id; a catalogue id is a lowercase UUID.`

- [ ] **Step 1: Write the failing test**

```ts
it("refuses a directory whose name is not a catalogue id", async () => {
  const directory = await itemDir("aurora");
  expect(await validateCatalogueItem(directory)).toEqual({
    ok: false,
    id: "aurora",
    reason:
      'the directory name "aurora" is not a catalogue id; a catalogue id is a lowercase UUID.',
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run packages/host/src/themes/validate-item.test.ts`
Expected: FAIL — the slug directory validates.

- [ ] **Step 3: Implement and move fixtures**

Check `isCatalogueId(id)` before reading `item.json`. Move every fixture id in
`validate-item.test.ts` to a fixed UUID constant.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/host/src/themes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/themes/validate-item.ts \
  src/web/packages/host/src/themes/validate-item.test.ts STATUS.md
git commit -m "feat(store): the catalogue validator admits only UUID ids"
```

---

## Phase 3 — Publishing

### Task 3.1: Read the published item

**Files:**
- Create: `src/web/packages/host/src/themes/published-item.ts`
- Create: `src/web/packages/host/src/themes/published-item.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PublishedItem {
    readonly version: string;
    readonly createdAt: string;
    readonly downloads: number;
    readonly favorites: number;
    readonly envelope: FabricThemeEnvelope;
  }
  export type PublishedItemResult =
    | { readonly ok: true; readonly item?: PublishedItem }
    | { readonly ok: false; readonly message: string };
  export async function readPublishedItem(
    id: string,
    options?: { readonly fetch?: typeof globalThis.fetch },
  ): Promise<PublishedItemResult>;
  ```

- [ ] **Step 1: Write the failing tests**

With an injected fetch keyed on URL:

- `item.json` answering `404` → `{ ok: true }` with no `item`.
- a `500`, a thrown fetch, or a body that is not JSON → `{ ok: false, message: "The store's copy of this theme could not be read; submit again when it is reachable." }`.
- `item.json` whose `version` is `"v1"` → `{ ok: false, message: 'The store\'s copy of this theme records version "v1", which cannot be bumped.' }`.
- a package URL answering `404`, or bytes `readThemePackage` refuses, or a package whose envelope id differs → `{ ok: false, message: "The store's copy of this theme cannot be opened, so its version cannot be computed." }`.
- the happy path returns version, createdAt, downloads, favorites and envelope.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run packages/host/src/themes/published-item.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Fetch `${CATALOGUE_RAW_BASE}/catalogue/${id}/item.json` with
`AbortSignal.timeout(15_000)`, parse with `parseCatalogueItemFile`, then fetch
`cataloguePackageUrl(id)` and read it with `readThemePackage`. Every refusal is
one of the two sentences above; never include a URL, a path or a response body.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/host/src/themes/published-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/themes/published-item.ts \
  src/web/packages/host/src/themes/published-item.test.ts STATUS.md
git commit -m "feat(store): read the published package a submission bumps from"
```

### Task 3.2: `submissionFiles` computes, refuses and writes the version

**Files:**
- Modify: `src/web/packages/host/src/themes/github-item.ts`
- Modify: `src/web/packages/host/src/themes/github-item.test.ts`

**Interfaces:**
- Consumes: `readPublishedItem` (3.1), `classifyThemeChange` / `versionFor` (Phase 1).
- Produces:
  ```ts
  export interface SubmissionFiles {
    // existing fields unchanged
    readonly version: string;
    readonly from: string | undefined;
    readonly level: VersionLevel;
  }
  export async function submissionFiles(
    themeId: string,
    store: ThemeStore,
    options?: {
      readonly thumbnails?: ThumbnailStore;
      readonly now?: () => Date;
      readonly fetch?: typeof globalThis.fetch;
    },
  ): Promise<{ ok: true; files: SubmissionFiles } | { ok: false; message: string }>;
  ```

- [ ] **Step 1: Write the failing tests**

- no published item → package and `item.json` carry `1.0.0`; `level: "initial"`, `from: undefined`.
- no published item and the stored document already says `metadata.version: "0.9.0"` → still publishes `1.0.0`; the local field never chooses the version.
- a published `1.4.0` and a changed scene → `1.4.1`; the library document's
  `metadata.version` is written, and the package holds it.
- an unchanged document → `{ ok: false, message: "Version 1.4.0 is published and this theme has not changed since it." }`, and no store write (assert the stored `contentId` is unchanged).
- `readPublishedItem` refuses → the refusal passes through verbatim.
- a conflicting write (a save lands between read and write) → `{ ok: false }`, and the stored document keeps the save's version.
- `item.json` carries the published `createdAt` and counts, and `remixOf` only when the envelope has one.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/host/src/themes/github-item.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Order: read theme → read published item → when `item` present, check
`isSemanticVersion(item.version)` and the envelope id → classify → `none`
refusal → `versionFor` → `store.write(themeId, { envelope: withVersion, assets }, { base: theme.base })` → build the package and `item.json` from the
written envelope. A refused write is the refusal; nothing is uploaded. Remove
`FIRST_VERSION`; the version now always comes from the ladder.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/host/src/themes/github-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/themes/github-item.ts \
  src/web/packages/host/src/themes/github-item.test.ts STATUS.md
git commit -m "feat(store): submission computes the version from the published package"
```

### Task 3.3: The answer the author sees

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Modify: `src/web/packages/host/src/server.test.ts`
- Modify: `src/web/packages/editor/src/store-mode/use-submit.ts`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx`
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Modify: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.test.ts`

**Interfaces:**
- Produces: the submit route answers `{ url, version: { from: string | null, to: string, level: VersionLevel } }`.
- Produces: `useSubmit` options gain `onSubmitted?: () => void`; its state gains
  `version`; `SubmitFooter` renders the version sentence.
- Produces: `uiCopy.store.submit.version(version): string`, where `version` is
  `{ from: string | null; to: string; level: VersionLevel }`:
  `"1.4.0 → 1.5.0 · minor"`, `"1.0.0 · first release"` for `initial`, and
  `"1.4.1 → 1.4.1 · none"` for `none` (never reached in practice).

- [ ] **Step 1: Write the failing tests**

Host route: a submit whose store write bumps answers `200` with the three
version facts. Editor DOM: a routed submit answers those facts, the footer shows
`1.4.0 → 1.5.0 · minor`, and the library listing is read again (`list` fetch
count grows by one). `ui-copy` pins the sentence for `initial`, `minor` and
`major`.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/host/src/server.test.ts packages/editor/src/store-mode/region.dom.test.tsx packages/editor/src/store-mode/item-modal.dom.test.tsx packages/editor/src/ui-copy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Server: include the version facts in the 200 body. `use-submit`: parse them,
keep them on the `submitted` state, call `onSubmitted` on success. Region: pass
`onSubmitted: () => void source.list().then(setItems, () => undefined)`. Footer:
render the sentence under the PR link.

- [ ] **Step 4: Run green**

Run the three suites above plus `packages/editor/src/store-mode/item-modal.dom.test.tsx`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/server.ts src/web/packages/host/src/server.test.ts \
  src/web/packages/editor/src/store-mode/use-submit.ts \
  src/web/packages/editor/src/store-mode/item-modal.tsx \
  src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx \
  src/web/packages/editor/src/store-mode/region.tsx \
  src/web/packages/editor/src/store-mode/region.dom.test.tsx \
  src/web/packages/editor/src/ui-copy.ts src/web/packages/editor/src/ui-copy.test.ts STATUS.md
git commit -m "feat(store): a submission tells its author the version it published"
```

---

## Phase 4 — Attribution

### Task 4.1: `remixOf` in the document format

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/document.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`
- Modify: `schema/theme-document.schema.json`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ThemeRemix {
    readonly catalogueId: string;
    readonly name: string;
    readonly version: string;
  }
  export interface ThemeMetadata { /* … */ readonly remixOf?: ThemeRemix }
  export function isThemeRemix(value: unknown): value is ThemeRemix;
  ```

- [ ] **Step 1: Write the failing tests**

Validator: an envelope with a well-formed `remixOf` validates; each of a
non-UUID `catalogueId`, a missing `name`, a non-semver `version`, and an extra
key inside `remixOf` is refused with an issue at `/metadata/remixOf…`. Schema
sync: `metadata.properties.remixOf` exists and is closed.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/renderer-core/src/theme`
Expected: FAIL.

- [ ] **Step 3: Implement**

Type and predicate in `document.ts`; validator branch beside `styleTags`;
schema `$defs.remix` with `additionalProperties: false`, all three required, the
UUID pattern on `catalogueId`, `minLength: 1` on `name`, the version pattern.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/renderer-core/src/theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/renderer-core/src/theme/document.ts \
  src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts \
  src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts \
  src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts \
  schema/theme-document.schema.json STATUS.md
git commit -m "feat(theme-format): a document can name the theme it was remixed from"
```

### Task 4.2: The Remix action

**Files:**
- Modify: `src/web/packages/editor/src/theme-library-dialog.tsx`
- Modify: `src/web/packages/editor/src/theme-library-dialog.dom.test.tsx`
- Modify: `src/web/packages/editor/src/theme-library-manager/index.ts`
- Modify: `src/web/packages/editor/src/theme-library-manager/index.test.ts`

**Interfaces:**
- Produces: `ThemeLibraryChoice` gains
  `{ readonly kind: "remix"; readonly id: string; readonly remixOf: ThemeRemix }`.
- Produces: `ThemeLibraryManager.open()` handles that kind by reading the theme,
  minting `crypto.randomUUID()`, dropping `metadata.version`, `createdAt`,
  `updatedAt` and `author`, appending `" (remix)"` to `metadata.name`, setting
  `remixOf`, and mounting with no base.

- [ ] **Step 1: Write the failing tests**

Chooser: a theme carrying `origin` draws a `Remix` control; a template does not
(disabled); pressing it settles `{ kind: "remix", id, remixOf: { catalogueId, name, version } }`
built from the entry's origin, its name and origin version. Manager: opening a
remix choice mounts a document whose id is a UUID, whose `metadata.remixOf`
names the parent, whose `metadata.version` and `author` are absent, and whose
base is absent.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/editor/src/theme-library-dialog.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Dialog: `REMIX_LABEL = "Remix"` beside `DELETE_LABEL`; the control is disabled
unless `selectedKind === "theme"` and the selected entry has an origin. Manager:
branch in `open()` after `confirmReplacement`, before `#openStored`.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/editor/src/theme-library-dialog.dom.test.tsx packages/editor/src/theme-library-manager/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/theme-library-dialog.tsx \
  src/web/packages/editor/src/theme-library-dialog.dom.test.tsx \
  src/web/packages/editor/src/theme-library-manager/index.ts STATUS.md
git commit -m "feat(editor): remixing an installed theme mints a new id and credits its parent"
```

### Task 4.3: The catalogue carries the credit

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/catalogue-index.ts`
- Modify: `src/web/packages/renderer-core/src/theme/catalogue-index.test.ts`
- Modify: `src/web/packages/host/src/catalogue/build-index.ts`
- Modify: `src/web/packages/host/src/catalogue/build-index.test.ts`

**Interfaces:**
- Produces: `CatalogueEntry` and `CatalogueItemFile` gain `readonly remixOf?: ThemeRemix`;
  `parseCatalogueItemFile` reads it through `isThemeRemix` and refuses a bad one
  with `"item.json's \"remixOf\" must be { catalogueId, name, version } with a UUID id and a version."`;
  `buildIndex` copies it into the entry.

- [ ] **Step 1: Write the failing tests**

A parsed item with `remixOf` round-trips; a malformed one is refused with that
sentence; a generated index carries `remixOf` for the item that has one and no
key for the item that does not.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/renderer-core/src/theme/catalogue-index.test.ts packages/host/src/catalogue/build-index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run green**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/renderer-core/src/theme/catalogue-index.ts \
  src/web/packages/renderer-core/src/theme/catalogue-index.test.ts \
  src/web/packages/host/src/catalogue/build-index.ts \
  src/web/packages/host/src/catalogue/build-index.test.ts STATUS.md
git commit -m "feat(store): the catalogue listing carries each item's remix credit"
```

### Task 4.4: Credit reaches the header, the validator and the storefront

**Files:**
- Modify: `src/web/packages/host/src/themes/github-item.ts` (+ test)
- Modify: `src/web/packages/host/src/themes/validate-item.ts` (+ test)
- Modify: `src/web/packages/host/src/themes/store.ts` (+ test)
- Modify: `src/web/packages/editor/src/theme-library-client.ts`
- Modify: `src/web/packages/editor/src/store-mode/local-source.ts`
- Modify: `src/web/packages/editor/src/store-mode/online-source.ts`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx` (+ `item-modal.dom.test.tsx`)
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts` (+ test)

**Interfaces:**
- Produces: `submissionFiles` writes `remixOf` into `item.json` from the envelope.
- Produces: `validate-item` refuses a `catalogueId` that is not a UUID, one equal
  to the item's own id, and an item whose `remixOf` differs from the package's
  (compare the three fields; no deep-equal helper needed).
- Produces: `ThemeStoreEntry.remixOf?: ThemeRemix`, derived by `entryFor` from
  the document; `ThemeLibraryEntry.remixOf?: ThemeRemix`; `StoreItem.remixOf?: ThemeRemix`,
  filled by `local-source` and `online-source` alike.
- Produces: `uiCopy.store.item.remixedFrom(name)` → `"Remixed from <name>"`; the
  online modal renders it as a button when the parent is in the listing and as
  text otherwise, the library modal renders it as text, and `ItemModal` gains
  `onOpenItem?: (id: string) => void` and `remixParent?: StoreItem`.

- [ ] **Step 1: Write the failing tests**

Host: a submitted document with `remixOf` yields the same object in `item.json`.
Store: a listing carries `remixOf` for a document that names one and no key for
a document that does not. Validator: the three refusals. DOM: routed index with
a remix and its parent — the modal shows `Remixed from System dashboard`,
pressing it opens the parent's modal; with the parent absent, the line renders
as text and no control; a local item's modal shows the text without a control.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/host/src/themes/github-item.test.ts packages/host/src/themes/validate-item.test.ts packages/host/src/themes/store.test.ts packages/editor/src/store-mode/item-modal.dom.test.tsx packages/editor/src/store-mode/region.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run green**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/themes/github-item.ts \
  src/web/packages/host/src/themes/github-item.test.ts \
  src/web/packages/host/src/themes/validate-item.ts \
  src/web/packages/host/src/themes/validate-item.test.ts \
  src/web/packages/host/src/themes/store.ts \
  src/web/packages/host/src/themes/store.test.ts \
  src/web/packages/editor/src/theme-library-client.ts \
  src/web/packages/editor/src/store-mode/local-source.ts \
  src/web/packages/editor/src/store-mode/online-source.ts \
  src/web/packages/editor/src/store-mode/item-modal.tsx \
  src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx \
  src/web/packages/editor/src/store-mode/region.tsx \
  src/web/packages/editor/src/store-mode/region.dom.test.tsx \
  src/web/packages/editor/src/ui-copy.ts src/web/packages/editor/src/ui-copy.test.ts STATUS.md
git commit -m "feat(store): a remix names, links and defends its parent"
```

---

## Phase 5 — Enforcement and close

### Task 5.1: The CI arm re-derives the version

**Files:**
- Modify: `src/web/packages/host/src/themes/validate-item.ts`
- Modify: `src/web/packages/host/src/themes/validate-item.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function validateCatalogueItem(
    directory: string,
    options?: {
      readonly previousItem?: string;
      readonly previousPackage?: string;
    },
  ): Promise<CatalogueItemCheck>;
  ```
- Produces: `validate-item <catalogueDir> [--previous-item <file> --previous-package <file>]`;
  either flag without the other, or an unknown argument, prints usage and
  answers `1`.

- [ ] **Step 1: Write the failing tests**

Each with two item directories written to a temp dir:

- first submission, no flags → passes only at `1.0.0`.
- first submission at `1.4.0` → refused: `a first submission must be version 1.0.0, not "1.4.0".`
- a major change declared `patch` → refused naming both: `the package changes major but item.json says 1.4.1; the ladder computes 2.0.0.`
- an unchanged repackage → `Version 1.4.0 is published and this package has not changed since it.`
- a package and header that disagree → refused.
- a missing `metadata.version` → refused.
- a `remixOf` that changed from the previous item → refused.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run packages/host/src/themes/validate-item.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Read both previous files, `parseCatalogueItemFile` the item, `readThemePackage`
the package, `classifyThemeChange` + `versionFor`, then compare. The command's
argument parser reads the two flags and passes them through.

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/host/src/themes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/host/src/themes/validate-item.ts \
  src/web/packages/host/src/themes/validate-item.test.ts STATUS.md
git commit -m "feat(store): the catalogue CI re-derives a submission's version from the base commit"
```

### Task 5.2: The catalogue's workflows

**Files:**
- Modify (other repo): `C:\tmp\yunari-store\.github\workflows\validate.yml`
- Modify (other repo): `C:\tmp\yunari-store\.github\workflows\auto-merge.yml`

**Interfaces:**
- Consumes: the `validate-item` flags and behaviours from 5.1.

- [ ] **Step 1: Wire the previous item and package**

In the loop, pass the two flags when the base commit holds the item:

```sh
if git cat-file -e "$base:catalogue/$id/item.json" 2>/dev/null; then
  git show "$base:catalogue/$id/item.json" > "$previous_item"
  git show "$base:catalogue/$id/$id.zip" > "$previous_package"
  node app/src/web/packages/host/bin/yunari.js validate-item "$dir" \
    --previous-item "$previous_item" --previous-package "$previous_package"
else
  node app/src/web/packages/host/bin/yunari.js validate-item "$dir"
fi
```

Use `mktemp` for the two file paths and remove them in the loop.

- [ ] **Step 2: Tighten the auto-merge path regex**

`^catalogue/[A-Za-z0-9_-]{1,64}/[^/]+$` becomes
`^catalogue/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$`,
with a comment saying it is a copy of `isCatalogueId` because the workflow cannot
import it.

- [ ] **Step 3: Move the pinned app commit**

`validate.yml`'s `ref:` becomes the commit at which Task 5.1 landed — the
validator behaviour this workflow calls. Build the host first, and run
`yunari validate-item` against one fixture directory locally to prove the pin's
command still exists.

- [ ] **Step 4: Prove it with a pull request**

Open a PR against `peterng1618/yunari-store` from a UUID-named directory with a
correct bump, watch `validate` and `auto-merge`, then open a second PR that
under-claims its bump and watch `validate` refuse it. **Pushing and opening a PR
are external actions: confirm with the user before the push**, and report both
runs' conclusions.

- [ ] **Step 5: Commit**

The store repo commits in its own tree; this repo's `STATUS.md` records the pin
and the two runs. Nothing in `D:\git-repos\yunari` changes in this task except
`STATUS.md`.

### Task 5.3: Verification, evidence and close

**Files:**
- Modify: `STATUS.md`
- Modify: `docs/superpowers/specs/2026-10-22-theme-versioning-design.md`
- Modify: `docs/superpowers/plans/2026-10-22-theme-versioning.md` (archive move)
- Modify: `docs/evidence/screenshots/README.md` if a new capture is registered

- [ ] **Step 1: Run the gate, read the exit code directly**

```bash
cd src/web
npm run gate > /c/tmp/gate.txt 2>&1; echo "exit=$?"
```

Expected: `exit=0`. A red `design:check` or `capture-freshness` is reported as a
known blocker (`vg-626`, `vg-402`), not worked around.

- [ ] **Step 2: Browser evidence**

Rebuild, then run `npx playwright test tests/e2e/editor-rail.spec.ts --workers=1`
to a file with the exit code read directly. Register and capture the submit
version line and the remix credit if they are new actions, with
`YUNARI_CAPTURE=1 --workers=1`; inspect the images before staging them.

- [ ] **Step 3: Red-proofs**

Break the CI version comparison and watch a lying item pass; break the ignored
field list and watch an editor-metadata-only save compute a patch; break the
parent lookup and watch the credit render as text. Restore each from a copy kept
outside the repo and verify with `cmp`.

- [ ] **Step 4: Close the plan**

Replace `STATUS.md`'s objective and active work; append a landing note to the
spec naming each phase and its evidence; move this plan to
`docs/superpowers/plans/archive/` once no queued plan depends on it.

- [ ] **Step 5: Commit**

```bash
git add STATUS.md docs/superpowers/specs/2026-10-22-theme-versioning-design.md \
  docs/superpowers/plans/2026-10-22-theme-versioning.md \
  docs/evidence/screenshots/README.md
git commit -m "docs(store): the version ladder, UUID ids and remix credit are landed"
```

---

## Self-review notes

- Spec coverage: ladder (1.1–1.3), ignored fields and unknown-member rule (1.2),
  submit computation and write (3.1–3.3), item header carry-forward (3.2), CI
  flags and all four CI checks (5.1), UUID minting and boundary (2.1–2.3), remix
  field and action (4.1–4.2), catalogue carriage and UI (4.3–4.4), workflow pin
  and proof (5.2), evidence and close (5.3).
- The spec's "library keeps its old shape" is honoured: no task narrows
  `store.ts`'s regex.
- Known ordering dependency: 4.4's `submissionFiles` change needs 4.3's
  `CatalogueRemix` typing, and 4.2's action needs 4.1's `ThemeRemix`.
- Task 5.2 is the only task whose files live outside this repo; it is last
  because it consumes the validator's final behaviour.
