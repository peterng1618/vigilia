# Theme Store: Origin and Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the two theme-store phases that need nothing but the library phase behind them — provenance (the `theme-origins.json` consumer record and the *Installed* badge) and style tags (the format's `metadata.tags` shape rule, the Style facet, and the editor's pick-or-propose field).

**Architecture:** Two independent additions on top of phase A's gallery. Provenance is **consumer state**: a file beside `active-theme.json` and `theme-answers.json`, joined onto the existing `/api/themes` listing so the client still makes one fetch, swept when a theme is removed, and never written into `theme.json`. Style tags are **authored state**: a field in `theme.json`'s `metadata`, enforced by the schema and the validator, derived into the one facet record `renderer-core` already computes, and picked in the document pane rather than typed freely.

**Tech Stack:** TypeScript (npm workspace under `src/web/`), React 19 for the pane and the gallery, Vitest, Biome, Node 22.12+. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-12-theme-store-design.md` — accepted 2026-10-21. Read its sections *Finding a theme: the five facets*, *Provenance: what makes "Installed" true* and *Open questions 8* (the aspect ruling) with this plan.

## Scope, and why it is these two phases

The spec's landing order names A–G. **A landed 2026-10-20. C–F cannot start**, and not because of size:

- **C** needs a public catalogue repository and a GitHub Action — infrastructure an agent cannot create.
- **D** needs C, and is gated on open question 1, which the owner **deferred to phase D's own plan**, which must open with the `download_count` probe.
- **E** needs D and a registered OAuth app for the device flow.
- **F** needs E, plus the ffmpeg licence read that the bundling decision moved to a precondition of shipping.

**B needs only A. G needs only A, and the spec requires G before C** so the first `index.json` the Action generates already carries tags. So this plan is B then G, in that order, as one plan that produces working, testable software on its own: after it, a person can tag a theme, filter their library by style, and see which of their themes came from the store.

**What B ships, exactly.** The record and the *Installed* badge. **Not** *Update available*, which needs the catalogue's version to compare against and therefore lands with C. The record still stores the installed version, because that is the half C needs.

**Out of scope, and named so nobody adds it:** the online vocabulary (C supplies the catalogue's own tags; this plan ships the seed), *modified locally* (the spec leaves it behind a `contentId` probe), and any change to import.

## Global Constraints

- Node 22.12+, Node 24 or 26+. Vitest for unit tests; Playwright previews built bundles, so rebuild after source changes.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on: an optional key is **omitted**, never present as `undefined`. Follow the existing `...(x === undefined ? {} : { x })` idiom.
- **`theme.json` is the exchange unit.** Tags are authored and travel inside it; provenance is consumer state and must never reach it. Getting this backwards is the one mistake in this plan that costs a format change to undo.
- **Persist authored state only.** The facet record and the `Installed` badge are derived on read; there is no cache and no stored copy.
- **Decision notes precede the first write to a watchlisted path** (`scripts/reuse-gate.mjs`). Claims are **per file**: a `- **Paths:**` bullet naming `\`src/...\`` exactly. A claim ending in `/` claims nothing (`docs/decisions/0059`). Three are owed, and each task below says which one it writes.
- `npm run gate` is **RED at `design:check`** on the pre-existing `vg-626` ceiling and stops before `typecheck` and `test`. Never record it as a passed gate: run `npm run typecheck` and `npm run test` and cite their own exit codes. Never raise `remainderCeiling`.
- `STATUS.md` is replaced, not appended: at most 6/5/5/5 bullets, one item per line. `npm run status:check` from `src/web/`.
- No new dependency. No new `utils`/`helpers`/`shared` folder.
- Screenshots need `VIGILIA_CAPTURE=1` and `--workers=1`, and only for actions registered in `docs/evidence/screenshots/README.md`.

## Review Focus

1. **A theme that declares no tags.** Expect: the Style facet offers no value for it, it matches no style selection, the listing does not crash, and the badge area is unchanged. (Task 6)
2. **An `theme-origins.json` naming a theme that is not in the library.** Expect: the theme is simply not listed; no origin is invented for anything else, and the listing answers 200. (Task 3)
3. **A sixth tag, or an uppercase one, typed into the field.** Expect: a visible refusal naming the rule — never a silent drop, and never a theme saved with the invalid value. (Task 7)
4. **A 4:1 artboard (3840×960) and a 2.35:1 one.** Expect: `4:1` buckets as `4:1`; 2.35:1 stays `other` rather than landing in 19.5:9 or 21:9. (Task 1)
5. **A theme deleted from the library.** Expect: its origin entry goes with it, so re-creating a theme under that id does not inherit the deleted theme's provenance. (Task 3)

---

## File Structure

| File | Responsibility |
|---|---|
| `renderer-core/src/theme/facet-record.ts` | The one derived record: adds `tags` and the two ruled aspect buckets. |
| `renderer-core/src/theme/document.ts` | `ThemeMetadata.tags`, the authored field. |
| `renderer-core/src/theme/envelope-keys.ts` | `metadata`'s known-key list gains `tags`, so the typo diagnostic can suggest it. |
| `renderer-core/src/theme/fabric-envelope-validate.ts` | The shape rule: lowercase, `[a-z0-9-]{1,24}`, at most five. |
| `schema/theme-document.schema.json` | The published schema, kept in step with the validator. |
| `host/src/settings/theme-origins.ts` | **New.** The consumer-state record: read, write, remove one theme. |
| `host/src/server.ts` | Joins origins onto `/api/themes`; sweeps one when a theme is deleted. |
| `host/src/main.ts` | Constructs the origins store from `settingsDir`, beside `themeSettings`. |
| `editor/src/theme-library-client.ts` | `ThemeLibraryEntry.origin`. |
| `editor/src/store-mode/{local-source,region,gallery,item-modal}.ts(x)` | `StoreItem.origin`, the Style facet, the *Installed* badge, the modal's provenance line. |
| `editor/src/panes/document/tags-field.tsx` | **New.** Pick-or-propose control. |
| `editor/src/panes/document/metadata-fields.tsx` | Mounts it. |
| `editor/src/theme-tag-seed.ts` | **New.** The vocabulary offered offline. |

---

### Task 1: The aspect buckets the owner ruled

**Spec:** *Finding a theme: the five facets* → Shape, and Open question 8 (`vg-673`): **add both 19.5:9 and 4:1, and keep the set addable as an entry plus its label.**

**Files:**
- Create: `docs/decisions/0085-aspect-buckets-are-data-beside-the-rule.md` (claims `src/web/packages/renderer-core/src/theme/facet-record.ts`)
- Modify: `src/web/packages/renderer-core/src/theme/facet-record.ts`
- Modify: `src/web/packages/renderer-core/src/theme/facet-record.test.ts`
- Modify: `src/web/packages/editor/src/store-mode/local-source.ts` (`SHAPE_RATIO`, which rejected `19.5:9`)
- Modify: `src/web/packages/editor/src/store-mode/local-source.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AspectBucket` gains the members `"19.5:9"` and `"4:1"`; `ASPECT_BUCKETS` gains one entry for each. No other task depends on these names.

- [ ] **Step 0: Write the decision note.** Follow `docs/decisions/README.md`'s template and work all seven rungs; state what was searched and what was not. Include exactly this bullet:

  ```
  - **Paths:** `src/web/packages/renderer-core/src/theme/facet-record.ts`
  ```

  The hook refuses the edit in Step 2 until this note exists.

- [ ] **Step 1: Write the failing tests** in `facet-record.test.ts`, beside the existing aspect cases:

```ts
it("buckets the two shapes the owner ruled", () => {
  expect(facetRecordOf(envelopeWithBoard(3840, 960)).aspect).toBe("4:1");
  expect(facetRecordOf(envelopeWithBoard(2340, 1080)).aspect).toBe("19.5:9");
});

it("refuses to file a 2.35:1 artboard under its nearest bucket", () => {
  expect(facetRecordOf(envelopeWithBoard(2350, 1000)).aspect).toBe("other");
});

it("orders the buckets by ascending ratio", () => {
  // A misplaced entry steals its neighbour's artboards, because the reader takes
  // the first bucket within tolerance. A *missing* entry is a compile error (the
  // type-level table in Step 3); this is the *misordered* one.
  const ratios = ASPECT_BUCKETS.map((e) => e.ratio);
  expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
});
```

  Export `ASPECT_BUCKETS` from `facet-record.ts` for that last case, and use whatever envelope helper the file already has rather than inventing one.

- [ ] **Step 2: Run them and watch them fail.**

  Run: `npx vitest run src/web/packages/renderer-core/src/theme/facet-record.test.ts`
  Expected: FAIL — `3840x960` reports `other`, and the exported `ASPECT_BUCKETS` does not exist.

- [ ] **Step 3: Add the members and the entries.** `"19.5:9"` sits between `"16:9"` and `"21:9"`; `"4:1"` after `"32:9"`. `aspectOf` returns the **first** bucket within `ASPECT_TOLERANCE`, so the array stays in ascending ratio order — a bucket declared out of order silently steals its neighbour's artboards.

  Add a type-level table beside the array — `{ … } satisfies Record<Exclude<AspectBucket, "other">, true>` — so a bucket added to the union without its entry fails `tsc`. A runtime equality against a hardcoded list cannot do that: both sides move together and a missing entry passes.

  Leave `ASPECT_TOLERANCE` at `0.005`. The bound that actually binds is **2.35:1, which sits 0.712% from 21:9** — anything at or above `0.0071` starts filing it under 21:9. The tightest half-gap between adjacent buckets is still 3.2% (3:2 against 16:10), which is a true but different statement: with 19.5:9 added, its neighbour half-gaps are 9.89% and 3.70%.

- [ ] **Step 4: Widen `SHAPE_RATIO`** in `src/web/packages/editor/src/store-mode/local-source.ts` to `/^\d+(?:\.\d+)?:\d+$/`, and add a matcher case asserting that selecting `19.5:9` returns a 2340×1080 theme. There is no aspect label table to extend: the row builds each option from `item.facets.aspect` itself, so a new bucket is a new value it reads. Without the widening the new bucket is offered and matches nothing.

- [ ] **Step 5: Run the focused tests.**

  Run: `npx vitest run src/web/packages/renderer-core/src/theme/facet-record.test.ts src/web/packages/editor/src/store-mode`
  Expected: PASS.

- [ ] **Step 6: Commit.**

  ```bash
  git add docs/decisions/0085-aspect-buckets-are-data-beside-the-rule.md \
    src/web/packages/renderer-core/src/theme/facet-record.ts \
    src/web/packages/renderer-core/src/theme/facet-record.test.ts \
    src/web/packages/editor/src/store-mode/region.tsx
  git commit -m "feat(store): the two aspect buckets the owner ruled, and a test that keeps the set extendable"
  ```

---

### Task 2: `theme-origins.ts`, the consumer-state record

**Spec:** *Provenance: what makes "Installed" true* → "The record is consumer state, beside `active-theme.json` and `theme-answers.json`".

**Files:**
- Create: `src/web/packages/host/src/settings/theme-origins.ts`
- Create: `src/web/packages/host/src/settings/theme-origins.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, for Tasks 3 and 4:

```ts
export interface ThemeOrigin {
  /** The catalogue's own id for the item, not the library id. */
  readonly catalogueId: string;
  /** The catalogue version this copy was installed from. */
  readonly version: string;
  /** An ISO instant. */
  readonly installedAt: string;
}

export interface ThemeOriginsStore {
  /** Every entry, keyed by library theme id. */
  read(): Promise<Readonly<Record<string, ThemeOrigin>>>;
  write(themeId: string, origin: ThemeOrigin): Promise<void>;
  /** One theme's entry, for a theme that has been deleted. */
  removeTheme(themeId: string): Promise<void>;
}

export function createThemeOriginsStore(directory: string): ThemeOriginsStore;
```

- [ ] **Step 1: Write the failing tests.** Mirror `theme-settings.test.ts`'s shape — a `tmpDir` per case, no mocks:

```ts
it("writes one theme's origin without disturbing another's", async () => { … });
it("reads an absent file as no origins", async () => { … });
it("drops an entry whose fields are not the three strings", async () => { … });
it("removes one theme's entry and leaves the rest", async () => { … });
it("writes nothing when asked to remove a theme it has no entry for", async () => {
  // The same rule theme-settings.ts states: nothing to remove is no write, so a
  // file that could not be read is not replaced by an empty one.
});
```

- [ ] **Step 2: Run them.**

  Run: `npx vitest run src/web/packages/host/src/settings/theme-origins.test.ts`
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement it** in `theme-origins.ts`, file `theme-origins.json`, shape `{ "<theme id>": { "catalogueId": …, "version": …, "installedAt": … } }`. Reuse `theme-settings.ts`'s three decisions verbatim: the same `THEME_ID` pattern on both the key and the argument, an unreadable or malformed file reading as `{}`, and no write when there is nothing to remove. Entry-level validation drops a bad entry rather than throwing — a hand-edited file must not blank the whole map.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit.**

  ```bash
  git add src/web/packages/host/src/settings/theme-origins.ts \
    src/web/packages/host/src/settings/theme-origins.test.ts
  git commit -m "feat(host): a theme-origins record, kept as consumer state beside the answers"
  ```

---

### Task 3: Origins reach the listing, and leave with the theme

**Spec:** *Provenance* → "The listing route joins origins onto `/api/themes`" and "swept when the theme is removed".

**Files:**
- Create: `docs/decisions/0086-the-listing-joins-origins.md` (claims `src/web/packages/host/src/server.ts`)
- Modify: `src/web/packages/host/src/server.ts` (the `/api/themes` GET, and the theme DELETE)
- Modify: `src/web/packages/host/src/main.ts` (construct the store)
- Modify: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `ThemeOriginsStore`, `ThemeOrigin` (Task 2).
- Produces: `HostOptions` gains `readonly themeOrigins?: ThemeOriginsStore`; each `/api/themes` entry optionally carries `readonly origin?: ThemeOrigin`.

- [ ] **Step 0: Write the decision note**, with exactly:

  ```
  - **Paths:** `src/web/packages/host/src/server.ts`
  ```

- [ ] **Step 1: Write the failing tests** in `server.test.ts`, beside the existing `/api/themes` cases:

```ts
it("joins an origin onto the theme it names", async () => { … });
it("leaves a theme with no origin with no key at all", async () => {
  // Absence is the truth, the same way `author` is absent for a theme that
  // declares none — not a key holding undefined.
});
it("does not fail the listing when an origin names a theme that is gone", async () => { … });
it("removes a theme's origin with the theme", async () => { … });
it("keeps the origin when the removal failed", async () => { … });
```

- [ ] **Step 2: Run them.** Expected: FAIL — nothing joins origins.

- [ ] **Step 3: Wire it.**
  - `main.ts`: `themeOrigins: createThemeOriginsStore(settingsDir)` beside `themeSettings` at its existing construction site.
  - `server.ts`'s `/api/themes` GET: map the store's entries and spread the origin in only where one exists, the file's own `...(x === undefined ? {} : { x })` idiom. **Join against the listed ids**, not against the origins file, so an entry for a deleted theme reaches no response.
  - `server.ts`'s theme DELETE: sweep **only when `themeStore.remove` answered true**, mirroring the display route's unguarded `themeSettings?.removeDisplay(id)` call. A sweep that throws reaches the existing catch and answers 500 with the folder already gone — accepted deliberately, because the neighbour does the same and a silent swallow would hide a real fault. Say so in a comment.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit.**

  ```bash
  git add docs/decisions/0086-the-listing-joins-origins.md \
    src/web/packages/host/src/server.ts src/web/packages/host/src/main.ts \
    src/web/packages/host/src/server.test.ts
  git commit -m "feat(host): the listing carries an origin, and a deleted theme takes its own with it"
  ```

---

### Task 4: The *Installed* badge

**Spec:** *Provenance* → "What it answers in v1: *Installed*".

**Files:**
- Modify: `src/web/packages/editor/src/theme-library-client.ts`
- Modify: `src/web/packages/editor/src/store-mode/local-source.ts`
- Modify: `src/web/packages/editor/src/store-mode/gallery.tsx`
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/store-mode/local-source.test.ts`, `gallery.dom.test.tsx`, `item-modal.dom.test.tsx`

**Interfaces:**
- Consumes: the `origin` key on the wire (Task 3).
- Produces: `ThemeLibraryEntry.origin?: ThemeOrigin` and `StoreItem.origin: ThemeOrigin | undefined`.

- [ ] **Step 1: Write the failing tests** — one in `local-source.test.ts` (an entry with an origin maps to an item carrying it, one without maps to `undefined`), one in `gallery.dom.test.tsx` (a cell with an origin draws the *Installed* badge; a cell without draws none — assert the badge's absence, not just the other cell's presence), one in `item-modal.dom.test.tsx` (the modal names the catalogue id and the installed version).

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** Add the optional field to the client entry, carry it through `localThemeSource`, and draw it where the cell's existing badges are drawn. Copy goes in `ui-copy.ts` — no literal sentence in a component.

- [ ] **Step 4: Run the three files.** Expected: PASS.

- [ ] **Step 5: Commit.**

  ```bash
  git add src/web/packages/editor/src/theme-library-client.ts \
    src/web/packages/editor/src/store-mode/ src/web/packages/editor/src/ui-copy.ts
  git commit -m "feat(store): the gallery says which themes came from the store"
  ```

---

### Task 5: `metadata.tags`, and the shape rule the format enforces

**Spec:** *Finding a theme* → "the format validates the shape and the store owns the vocabulary".

**Files:**
- Create: `docs/decisions/0087-tags-are-shaped-not-enumerated.md` (claims the four paths below)
- Modify: `src/web/packages/renderer-core/src/theme/document.ts`
- Modify: `src/web/packages/renderer-core/src/theme/envelope-keys.ts`
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`
- Modify: `schema/theme-document.schema.json`
- Test: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ThemeMetadata.tags?: readonly string[]`, and `TAG_PATTERN = /^[a-z0-9-]{1,24}$/` exported from `document.ts` so the editor's field refuses exactly what the validator refuses. Task 6 and Task 7 both consume both names.

- [ ] **Step 0: Write the decision note**, with exactly:

  ```
  - **Paths:** `src/web/packages/renderer-core/src/theme/document.ts`
    `src/web/packages/renderer-core/src/theme/envelope-keys.ts`
    `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`
    `src/web/packages/renderer-core/src/theme/facet-record.ts`
  ```

  The fourth path is Task 6's; claim it here so that task needs no second note. The note's rungs cover why the vocabulary is **not** enumerated — that is the decision, and `docs/decisions/0043` is the model for how a refusal document reads.

- [ ] **Step 1: Write the failing tests:**

```ts
it("accepts a well-formed tag list", () => { … });                       // ["retro", "neon-2"]
it("refuses an uppercase tag", () => { … });                             // ["Retro"]
it("refuses a tag with a space or an underscore", () => { … });          // ["science fiction"]
it("refuses a tag longer than 24 characters", () => { … });
it("refuses an empty tag list member", () => { … });                      // [""]
it("accepts five tags and refuses a sixth", () => { … });
it("refuses tags that are not strings", () => { … });
```

  Each refusal must name the offending value the way this file's other refusals do — assert the message, not only the throw.

- [ ] **Step 2: Run them.** Expected: FAIL — `tags` is an unknown property under `metadata`'s `additionalProperties: false`.

- [ ] **Step 3: Implement**, all four together — a format change lands as one edit or not at all:
  - `document.ts`: `readonly tags?: readonly string[]` on `ThemeMetadata`, with `TAG_PATTERN` and `MAX_TAGS = 5` exported beside it.
  - `envelope-keys.ts`: `"tags"` in `KNOWN_KEYS.metadata`, so the typo diagnostic can suggest it. **The tag *values* get no enum anywhere.**
  - `fabric-envelope-validate.ts`: the rule above. Do **not** refuse duplicate values — the spec says the shape and the count are "the whole of what they enforce", and the facet dedupes.
  - `schema/theme-document.schema.json`: `tags` in `$defs.metadata.properties` as `{ "type": "array", "maxItems": 5, "items": { "type": "string", "pattern": "^[a-z0-9-]{1,24}$" } }`.

- [ ] **Step 4: Run the validator's tests and the schema drift test.**

  Run: `npx vitest run src/web/packages/renderer-core/src/theme`
  Expected: PASS, including whatever case keeps the schema and `KNOWN_KEYS` in step.

- [ ] **Step 5: Commit.**

  ```bash
  git add docs/decisions/0087-tags-are-shaped-not-enumerated.md \
    src/web/packages/renderer-core/src/theme/document.ts \
    src/web/packages/renderer-core/src/theme/envelope-keys.ts \
    src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts \
    src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts \
    schema/theme-document.schema.json
  git commit -m "feat(format): style tags are shaped, not enumerated"
  ```

---

### Task 6: The Style facet

**Spec:** *Finding a theme* → the facet table, and "Style tags are the one thing this adds to the format".

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/facet-record.ts` (claimed by 0087)
- Modify: `src/web/packages/renderer-core/src/theme/facet-record.test.ts`
- Modify: `src/web/packages/editor/src/store-mode/region.tsx` (the style options)
- Modify: `src/web/packages/editor/src/store-mode/local-source.ts` (the matcher)
- Test: `src/web/packages/editor/src/store-mode/local-source.test.ts`

**Interfaces:**
- Consumes: `ThemeMetadata.tags` (Task 5).
- Produces: `FacetRecord.tags: readonly string[]` — **required and possibly empty**, because every record was derived from a document.

- [ ] **Step 1: Write the failing tests:**

```ts
// renderer-core, beside the other facet cases
it("reads a document's tags into its record", () => { … });
it("reads a document with no tags as an empty list", () => { … });

// local-source
it("matches a style selection as OR, unlike sensors and shape", () => {
  // Selecting `retro` and `neon` returns a theme carrying either.
});
it("matches no style selection when the theme carries none", () => { … });
```

  The second local-source case is the OR/AND distinction the spec calls out — write it against the same helper the existing sensor and shape cases use, so the three readings sit side by side.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** `facetRecordOf` copies `envelope.metadata?.tags ?? []`, deduplicated. `region.tsx` builds the style facet's options as each tag with a count, over the local list; a tag carried by one theme still appears, with a count of one. `local-source.ts` gains its matcher in the existing `FACET_MATCHERS` table, OR within the facet like author and colour mode.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit.**

  ```bash
  git add src/web/packages/renderer-core/src/theme/facet-record.ts \
    src/web/packages/renderer-core/src/theme/facet-record.test.ts \
    src/web/packages/editor/src/store-mode/region.tsx \
    src/web/packages/editor/src/store-mode/local-source.ts \
    src/web/packages/editor/src/store-mode/local-source.test.ts
  git commit -m "feat(store): a Style facet, read off the document it already parsed"
  ```

---

### Task 7: The pick-or-propose tag field

**Spec:** *Finding a theme* → "Style tags are … picked, not typed", and "The editor offers the shipped seed list when it is offline".

**Files:**
- Create: `src/web/packages/editor/src/theme-tag-seed.ts`
- Create: `src/web/packages/editor/src/panes/document/tags-field.tsx`
- Create: `src/web/packages/editor/src/panes/document/tags-field.dom.test.tsx`
- Modify: `src/web/packages/editor/src/panes/document/metadata-fields.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`

**Interfaces:**
- Consumes: `TAG_PATTERN`, `MAX_TAGS`, `ThemeMetadata.tags` (Task 5).
- Produces: `<TagsField value={readonly string[]} onCommit={(next: readonly string[]) => void} vocabulary={readonly string[]} />`.

- [ ] **Step 1: Write the seed.** `theme-tag-seed.ts` exports `THEME_TAG_SEED: readonly string[]` holding exactly the seven the spec records — `futuristic`, `retro`, `modern`, `elegant`, `classic`, `nature`, `cityscape` — each asserted well-formed by a test. A comment says what it is: the offline vocabulary, which the catalogue replaces when one is reachable, and which `vg-683` may revise; it is not an enum and nothing validates against it.

- [ ] **Step 2: Write the failing tests** in `tags-field.dom.test.tsx`:

```tsx
it("offers the vocabulary as choices", () => { … });
it("commits a picked tag", () => { … });
it("refuses a sixth tag, and says why", () => { … });
it("refuses an uppercase proposal, and says why", () => { … });
it("refuses a proposal already in the list rather than adding it twice", () => { … });
it("removes a picked tag", () => { … });
it("keeps the committed order the author's, not the vocabulary's", () => { … });
```

- [ ] **Step 3: Run them.** Expected: FAIL — no such module.

- [ ] **Step 4: Implement.** Picking is the primary affordance; the propose input sits below it and is the only path to a new value. A refusal is a visible message beside the field and **the value is not committed** — the document must never hold a tag the validator would refuse. The vocabulary is a list of toggle buttons, each labelled by its tag, drawn in the value's order followed by the vocabulary's; the field's own row and its label/id pairing come from `ControlRow`. Do not add a control to `components/ui/` — that directory is watchlisted, so a new file there owes a decision note for no gain. Mount it in `metadata-fields.tsx` after `description`, and extend `compact()` there so an emptied list is omitted rather than written as `[]`.

- [ ] **Step 5: Run them, and the pane's own tests.**

  Run: `npx vitest run src/web/packages/editor/src/panes/document`
  Expected: PASS.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/web/packages/editor/src/theme-tag-seed.ts \
    src/web/packages/editor/src/panes/document/tags-field.tsx \
    src/web/packages/editor/src/panes/document/tags-field.dom.test.tsx \
    src/web/packages/editor/src/panes/document/metadata-fields.tsx \
    src/web/packages/editor/src/ui-copy.ts
  git commit -m "feat(editor): tags are picked from the vocabulary, and proposed only when nothing fits"
  ```

---

### Task 8: The boundary

Not a code task. Run at the end of the plan, before the final whole-branch review.

- [ ] **Step 1: Whole gate, read honestly.**

  ```bash
  npm run gate > gate.log 2>&1; echo "exit $?"
  ```
  Expected: exit 1 at `design:check` (`vg-626`, pre-existing) with every earlier step green. Then, separately:

  ```bash
  npm run typecheck > typecheck.log 2>&1; echo "exit $?"
  npm run test > test.log 2>&1; echo "exit $?"
  npm run backlog:check > backlog.log 2>&1; echo "exit $?"
  ```
  Expected: all exit 0. **Report the numbers from the log files, never from a piped tail.** A red sample of a flaky file is not a measurement until it is attributed — re-run it before reporting it.

- [ ] **Step 2: The browser claims, each with its own run.** Rebuild the bundles first.

  ```bash
  npm run build
  npx playwright test tests/e2e/<the store spec> --workers=1
  ```
  Three claims need eyes: the *Installed* badge on a cell whose theme has a seeded `theme-origins.json`, a Style facet narrowing the grid, and the Shape popover offering `19.5:9` for a theme whose artboard is that ratio — the last one because Task 1 proved the bucket at record and matcher level only. Visible behaviour needs rendered inspection, not a geometry assertion.

- [ ] **Step 3: Prove the red direction of each new guard**, then restore with `cmp`, not `git checkout` — a Windows text-mode write leaves CRLF and git normalises it, so only `cmp` shows the file is back. Break each guard, watch its test fail, restore, `cmp`, re-run.

- [ ] **Step 4: `STATUS.md`.** Replace *Last completed change* with five bullets or fewer, one item per line; name the two phases, the ruling count, and the gate's real state. Run `npm run status:check` from `src/web/`.
