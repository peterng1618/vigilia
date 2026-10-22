# The theme store's online tab — phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Themes mode its Online half — a read-only browse of a public GitHub-hosted catalogue whose listing is one static `index.json`, filtered and sorted by the same five facets the local half uses, with the item modal gaining the catalogue's own facts.

**Architecture:** The catalogue is one static file the product publishes to a public repo. The editor's **browser** fetches it from `raw.githubusercontent.com` and thumbnails come from jsDelivr, because the browser's HTTP cache revalidates conditionally for free against a server measured to answer `304`, while Node's `fetch` has no HTTP cache at all (`docs/decisions/0088`). The index's **wire shape has one owner in `renderer-core`**, because the Action that writes it and the editor that reads it are the two producers the spec's own facet-record sentence is about. The online half is a second `ItemSource` — the seam phase A built for exactly this — so the gallery, the facet row, the pager and the modal are reused rather than re-implemented.

**Tech Stack:** TypeScript, React 19, Vitest + jsdom, Playwright, Biome. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-12-theme-store-design.md` — accepted 2026-10-21. Read its sections *Architecture: GitHub is the whole backend*, *The store mode*, *Finding a theme: the five facets*, *The gallery, and paging*, *The item's own surface*, *Landing order* (phase C's row) and *Measured 2026-10-21* with this plan.

**Decision:** `docs/decisions/0088-the-catalogue-index-is-fetched-by-the-browser.md`.

**Drawings:** `docs/design/mockups/current/store-browse.html` is the online half and is part of the design contract; `store-themes.html` is the local half whose cell the online cell deliberately shares (`store-browse.html:35-40`); `store-detail.html` is the modal. Where this plan's prose and a drawing disagree, the drawing wins.

## Global Constraints

- **The catalogue repo is `peterng1618/yunari-store`**, public. `index.json` is at its root on `main`; items are `catalogue/<id>/`. The index URL is `https://raw.githubusercontent.com/peterng1618/yunari-store/main/index.json` and thumbnails are joined against `https://cdn.jsdelivr.net/gh/peterng1618/yunari-store@main/`.
- **No new dependency.** `renderer-core` keeps `echarts` as its only one, and it gains **no network code** — `fetch` is called from `store-mode/`, in the editor.
- **`renderer-core` stays Fabric-free and DOM-free.**
- **Persist authored state only.** The catalogue listing is derived on read; nothing about it is stored, and no ECharts option or view state enters any file.
- **One owner per concept.** The index's shape is `renderer-core`'s; the fetch is the online source's; the five facets, the pager, the cell and the modal are phase A's and are reused.
- **Copy lives in `ui-copy.ts`.** Every user-visible sentence this plan adds goes there, and the online cell's words are the drawing's.
- **The kind is a wire identifier and a display word is separate.** The skipped-kind line quotes the **identifier** (`store-browse.html:347-352`); the cell's badge reads the display word.
- **No `cache:` option, no `ETag` store, no TTL, no retry, no timeout.** Freshness is the origin's `max-age=300`; the app cannot force revalidation even if it wanted to (`docs/decisions/0088`, rung 6).
- **A failed listing is not a fact about the catalogue.** `region.tsx`'s existing rule holds for the online half too: the listing stays unset rather than drawing an empty catalogue.
- 500 lines is a signal and 800 is a stop for a source file. `region.tsx` is already 640+ and this plan adds to it — see Task 7's own constraint.

## Review Focus

The five input classes and failure modes the spec implies but no task's happy path exercises, most likely to bite a person first. Each gets its test in the task that owns the code.

1. **The catalogue is unreachable, or answers a 404.** The half must draw neither an empty catalogue nor a spinner forever, and a 404 must not start a retry loop — it is never negatively cached (rung 6). → Task 3.
2. **An entry this build cannot read.** A malformed entry must be skipped and counted rather than failing the listing, and a `kind` this build does not ship must be skipped *and named* (`store-browse.html:347-352`). → Tasks 1 and 3.
3. **An item installed from the catalogue, at the same version and at an older one.** The cell's action slot is a **mark** when there is nothing to do and a button when there is — `Install`, `Update`, or no action at all. → Tasks 5 and 7.
4. **A theme in the library that the catalogue does not carry**, and the reverse. Neither half may claim the other's fact; the local cell's `From the store` badge and the online cell's `Installed` mark are two views of one fact and must never both be read off one record. → Task 7.
5. **The listing arriving after the mode was left, or a second fetch starting before the first answered.** Phase A's rule is that state which arrives late must not be written. → Task 3.

---

## Task 1: The index's shape, one owner

**Files:**
- Create: `src/web/packages/renderer-core/src/theme/catalogue-index.ts`
- Modify: `src/web/packages/renderer-core/src/index.ts` (the barrel, beside `facetRecordOf`)
- Test: `src/web/packages/renderer-core/src/theme/catalogue-index.test.ts`

**Interfaces:**
- Consumes: `FacetRecord` and `facetRecordOf` (`renderer-core/src/theme/facet-record.ts`).
- Produces, all exported from the barrel:

```ts
export interface CatalogueEntry {
  readonly id: string;          // the catalogue's own id, not a library id
  readonly kind: string;        // the wire identifier, e.g. "dashboard-theme"
  readonly name: string;
  readonly version: string;
  readonly createdAt: string;   // an ISO instant
  readonly updatedAt: string;
  readonly downloads: number;
  readonly favorites: number;
  readonly packageUrl: string;  // the browser download URL, as item.json records it
  readonly thumbnail: string;   // a path inside the repo, joined with the CDN base by the reader
  readonly facets: FacetRecord;
}
export interface CatalogueIndex {
  readonly generatedAt: string;
  readonly entries: readonly CatalogueEntry[];
}
export interface CatalogueRefusal {
  /** The identifier the entry declared, or `undefined` for an entry that is not
   *  the shape at all and therefore declares nothing readable. Required and
   *  possibly absent, as `StoreItem.origin` is. */
  readonly kind: string | undefined;
  readonly reason: "unknown-kind" | "malformed";
  readonly count: number;
}
export function parseCatalogueIndex(
  value: unknown,
  knownKinds: readonly string[],
): { readonly entries: readonly CatalogueEntry[]; readonly refused: readonly CatalogueRefusal[] };
```

- The parser takes `knownKinds` because the spec's "a client that cannot parse an item must skip it and say so, not fail the listing" is **two** refusals, and they are different facts: a well-formed entry of a kind this build does not ship, which is named by its **identifier** (`store-browse.html:347-352`), and an entry that is not the shape, which has no identifier to name.

- [ ] **Step 1: Write the failing test** — one fixture with two readable `dashboard-theme` entries, two `widget-preset` entries and one entry missing `name`. Assert `entries.length === 2`; `refused` is `[{ kind: "widget-preset", reason: "unknown-kind", count: 2 }, { kind: undefined, reason: "malformed", count: 1 }]`; and the two refusals are ordered by first appearance. A second case: the same malformed entry but declaring `kind: "widget-preset"` refuses as `{ kind: "widget-preset", reason: "malformed", count: 1 }` — a kind is not what makes an entry unreadable.
- [ ] **Step 2: Run it and watch it fail** — `npx vitest run packages/renderer-core/src/theme/catalogue-index.test.ts` from `src/web/`.
- [ ] **Step 3: Implement `parseCatalogueIndex`** — strict and total. Refuse the whole document (`entries: []`, everything counted as malformed) for a non-object, a missing or non-string `generatedAt`, or an `entries` that is not an array. Read each entry's fields off `Object.hasOwn` rather than a bare read, the habit `theme-origins.ts` follows, so a `__proto__` key is data rather than an inherited value.
- [ ] **Step 4: Add the cases the Review Focus names** — a non-object; `entries` not an array; an entry whose `facets` is not a record; `downloads` non-numeric; a `__proto__` entry id. Then run the file green and `npx tsc --noEmit`.
- [ ] **Step 5: Export from the barrel** and commit.

## Task 2: The generator, as a command on the host binary

**Amended 2026-10-21, before dispatch** — the original version put the generator in `scripts/*.mjs` and was unbuildable. `@yunari/renderer-core`'s `exports` points at `./src/index.ts`, the package has no build, and `packages/host/bin/yunari.js`'s own docblock states the exact reason a plain Node script cannot import it: *"Node can strip types but cannot resolve `renderer-core`'s bundler-style `.js` specifiers from source."* CI runs `npm ci` then `npm run gate` with no build between, so a script importing the package would fail `gates:self-test` on a clean checkout. **The host is the one Node runtime here that is built and can import it**, and `run(argv)` is already its CLI entry.

**Files:**
- Create: `src/web/packages/host/src/catalogue/build-index.ts`
- Create: `src/web/packages/host/src/catalogue/build-index.test.ts`
- Modify: `src/web/packages/host/src/main.ts` (one line at the top of `run`, plus the import)

**Interfaces:**
- `catalogueIndexOf(items: readonly CatalogueItem[], generatedAt: string): CatalogueIndex` — pure, using `facetRecordOf` and `CatalogueIndex` from `@yunari/renderer-core`. `CatalogueItem` is `{ readonly id: string; readonly item: unknown; readonly theme: unknown }` — what the walk read, not yet validated.
- `buildCatalogueIndexCommand(argv: readonly string[]): Promise<number | undefined>` — returns `undefined` unless `argv[0]` is `--build-catalogue-index`, so `run` falls through to `parseArgs` untouched and **no option parser changes**.
- `run()` gains, as its first statement: `const catalogue = await buildCatalogueIndexCommand(argv); if (catalogue !== undefined) return catalogue;`
- CLI: `node packages/host/bin/yunari.js --build-catalogue-index <catalogueDir> --out <file> --generated-at <ISO>`.

**`--generated-at` is required and never `Date.now()`.** A generator that stamps the clock produces a different file every run, which makes the Action's diff dirty on every push and the output untestable. The Action passes the catalogue commit's own timestamp.

- [ ] **Step 1: Write the failing Vitest test** (`build-index.test.ts`, in `packages/host`) — a temp catalogue of two items: one valid `item.json` + `theme.json` pair, one whose `theme.json` fails validation. Assert the output's `entries` has one entry, that entry's `facets` deep-equals `facetRecordOf(theme)`, and that `parseCatalogueIndex(output, ["dashboard-theme"]).refused` is empty — the generator validates its own output with the reader's parser, which is what keeps the two producers one shape.
- [ ] **Step 2: Run it and watch it fail** — `npx vitest run packages/host/src/catalogue/build-index.test.ts` from `src/web/`.
- [ ] **Step 3: Implement the walk and the write** — every `catalogue/*/item.json`, its sibling `theme.json` validated by `validateFabricThemeEnvelope`, refused items reported on stderr and **excluded** rather than failing the run; output written with two-space indent and a trailing newline so the Action's diff is stable.
- [ ] **Step 4: The command must not be silently absent** — an unknown flag after `--build-catalogue-index`, or a catalogue directory that does not exist, exits non-zero with a message naming the argument. A generator that wrote an empty index over a mistyped path would publish an empty catalogue.
- [ ] **Step 5: Green, `npx tsc --noEmit`, `npx biome check ..` from `src/web/`, commit.** No change to `gates:self-test`: the command is tested by Vitest like every other host module.

## Task 3: The catalogue repo (controller step — external, not delegated)

**Not a subagent task.** Creating a public repository is an outward-facing action, authorised by the user on 2026-10-21 for exactly this.

- [ ] **Step 1: Create `peterng1618/yunari-store` as public**, with a `README.md` saying what the repo is, `catalogue/.gitkeep`, and the workflow below.
- [ ] **Step 2: The Action**, `.github/workflows/index.yml` — regenerates `index.json` on every push to `main` that touches `catalogue/**`, checking out **this** app repo at a pinned commit (the spec's own choice, `:510-512`):

```yaml
name: index
on:
  push:
    branches: [main]
    paths: ["catalogue/**"]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: peterng1618/yunari
          ref: <the pinned commit>
          path: app
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
        working-directory: app/src/web
      - run: npm run build
        working-directory: app/src/web
      - run: |
          node app/src/web/packages/host/bin/yunari.js \
            --build-catalogue-index catalogue --out index.json \
            --generated-at "$(git log -1 --format=%cI)"
      - run: |
          git config user.name  "yunari-index"
          git config user.email "yunari-index@users.noreply.github.com"
          git add index.json
          git diff --cached --quiet || git commit -m "chore(index): regenerate"
          git push
```

- [ ] **Step 3: Push, and read the raw URL back** — `curl -sS -o /dev/null -w '%{http_code}\n' https://raw.githubusercontent.com/peterng1618/yunari-store/main/index.json` must answer `200`, and the body must be an index with zero entries. An empty catalogue is the honest starting state; items arrive with phase E.
- [ ] **Step 4: Record the pinned commit and the raw URL in the ledger**, because the Action's `ref` is a fact nothing else carries.

## Task 4: The online source

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/local-source.ts` (`StoreItem` gains `catalogue`; `ItemSource` gains `refused()`; `localThemeSource` answers both)
- Create: `src/web/packages/editor/src/store-mode/catalogue-location.ts`
- Create: `src/web/packages/editor/src/store-mode/online-source.ts`
- Test: `src/web/packages/editor/src/store-mode/online-source.test.ts`

**Interfaces:**
- `StoreItem` gains, beside `origin` and with the same required-but-possibly-absent spelling:

```ts
/** The catalogue's own facts about this item, or `undefined` for an item the
 *  library holds and the catalogue does not. `installedVersion` is the one
 *  field a source cannot fill: it is a fact about the library, so the source
 *  leaves it absent and the join sets it. */
readonly catalogue: CatalogueFacts | undefined;
```
```ts
export interface CatalogueFacts {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly downloads: number;
  readonly favorites: number;
  readonly packageUrl: string;
  readonly installedVersion: string | undefined;
}
```
- `ItemSource` gains `refused(): readonly CatalogueRefusal[]`; `localThemeSource` answers `() => []`, so a caller reads one shape rather than asking which source it holds.
- **`CatalogueFacts` is not a second copy of `CatalogueEntry` and a third must not appear.** It is the entry's own facts **minus the two `StoreItem` already carries** (`facets` and `thumbnail`, which arrive as `item.facets` and `item.thumbnailUrl`) **plus `installedVersion`**, which is a fact about the library rather than the catalogue. The wire shape stays in `renderer-core`; the item's view of it stays in `store-mode/`.
- `catalogue-location.ts` exports `CATALOGUE_INDEX_URL`, `CATALOGUE_CDN_BASE` and `catalogueThumbnailUrl(path: string): string` — **the one place the catalogue's address lives**, so pointing the product at another repo is one edit.
- `onlineThemeSource(options: { readonly url?: string; readonly fetch?: typeof fetch }): ItemSource` — the injectable `fetch` is `font-specimen-cache.ts`'s own pattern, and the reason a jsdom case can drive it.

- [ ] **Step 1: Write the failing test** — an injected `fetch` returning the Task 1 fixture. Assert the mapped `StoreItem`: `catalogue.id` is the entry's id, `facets` deep-equals the entry's, `thumbnailUrl` is the CDN join of the entry's `thumbnail`, `origin` is `undefined`, and `catalogue.installedVersion` is `undefined`. Then the Review Focus cases: a non-ok response rejects; a 404 rejects rather than answering an empty listing; a malformed body rejects; and `refused()` reports the fixture's skip.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Implement `onlineThemeSource`** — one `fetch(url)` with **no `cache:` option, no `ETag`, no TTL, no retry, no timeout** (`docs/decisions/0088`), `parseCatalogueIndex(body, [DASHBOARD_THEME_KIND])`, and the mapping. A failed read throws; the region's existing rule turns that into a listing that stays unset.
- [ ] **Step 4: Green, then `npx tsc --noEmit`** — the `StoreItem` change reddens `local-source.ts` until `catalogue: undefined` is set there too, which is the point of the field being required.
- [ ] **Step 5: Commit.**

## Task 5: The online cell

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/gallery.tsx`
- Create: `src/web/packages/editor/src/store-mode/install-state.ts`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/store-mode/gallery.dom.test.tsx`

**The drawing's exact values** (`store-browse.html:116-172`): the facts band is `height:26px` and holds the **kind badge** (10px, weight 500, `--muted`, 1px `--edge`, full radius, `padding:4px 8px`), the **download count** (mono 11px, `--muted`, a download glyph, thousands-separated — the drawing reads `1,204`), a spacer, and the action slot. The badge word is **`Theme`** in both drawings (`store-browse.html:122`, `store-detail.html:79`).

**Two drifts the drawings settle, fixed here rather than filed** — both are one line in one owner, the drawing specifies the answer, and the regression test is obvious:

1. `ui-copy.ts`'s `store.cell.kinds["dashboard-theme"]` reads `"Dashboard theme"` where both drawings draw `"Theme"`.
2. `ui-copy.ts`'s `store.halves` reads `local: "Local"`, `online: "Online"` where both drawings label the tabs `"Your themes"` and `"Store"`.

- [ ] **Step 1: Write the failing tests** — a cell whose item carries `catalogue` draws the badge reading the literal `Theme` and the count `1,204` for `downloads: 1204`; a cell without `catalogue` draws neither. Then `install-state.ts`'s four cases as a table: no `catalogue` → `"none"`; `installedVersion === version` → `"installed"`; `installedVersion` present and different → `"update"`; `installedVersion` absent → `"install"`.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement `installStateOf(item)`** as the one owner of that decision, then the cell's two additions.
- [ ] **Step 4: The action slot** — `installed` draws the drawing's **mark**, not a button: a check glyph and the word in `--accent`, with no control, because there is nothing to do. `install` and `update` draw the drawing's buttons **disabled with their reason**, which is R164's pattern for an action no phase in the landing order owns — phase D owns install. The reason is the existing `uiCopy.store.cell.unavailable`.
- [ ] **Step 5: The two copy fixes**, each pinned by a case in `ui-copy.test.ts` against the literal the drawing draws. Run the store-mode suites and `npx biome check ..` from `src/web/`, then commit.

## Task 6: The modal's online facts

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/store-mode/item-modal.dom.test.tsx`

**The drawing** (`store-detail.html`): the caption's own line carries the name, the author and the kind; the version and the date sit at its other end; and `:42` says the online half's footer carries **Install, Installed or Update in place of the library's four actions**.

- [ ] **Step 1: Write the failing tests** — a modal for an item carrying `catalogue` shows its `downloads` and `favorites` as counts on the caption line, and its footer carries the same install reading the cell does (`Install` disabled with its reason, the `Installed` mark, or `Update`); a modal for a library item is unchanged, footer and all.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement** — the footer's action set becomes a function of the item's install state rather than the constant `FOOTER_ACTIONS`, and the counts join the caption line. **The library item's four actions must not change**, which is the case Step 1's second half guards.
- [ ] **Step 4: Green, `npx tsc --noEmit`, commit.**

## Task 7: The region wiring

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/region.tsx`
- Test: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`

**Constraint: `region.tsx` is 751 lines and 800 is the stop.** This task adds a second listing, the join and the refusal line. If the file would cross the stop, extract the online half's own reading into `store-mode/online-listing.ts` in this same task rather than letting the file grow past it.

- [ ] **Step 1: Write the failing tests** — the online tab lists the catalogue's items where it currently lists nothing, and the local tab is unchanged; an item the library holds at the same version reads `Installed`, one at an older version reads `Update`, one the library does not hold reads `Install`; a `widget-preset` entry produces the line naming `widget-preset`; and a failing catalogue read leaves the online half listing nothing rather than drawing an empty catalogue.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement** — a second `useState` for the online listing, both sources built once, `listed` reading the active half, the online listing passed through the join against the **local** listing's origins, and the refusal line below the grid.
- [ ] **Step 4: The join is one owner** — `install-state.ts` (Task 5) decides, and the region only supplies the map. A second copy of the comparison in the region is the defect this step exists to prevent.
- [ ] **Step 5: Green, `npx biome check ..`, `wc -l` the region, commit.**

## Task 8: The boundary — the rendered claims

**Files:**
- Modify: `src/web/tests/e2e/editor-rail.spec.ts`

Route the index, do not reach the network: `page.route("**/index.json", …)` is the move `editor.spec.ts` already makes for the font CDN, and it intercepts **before** the HTTP cache, so a claim about a re-read is deterministic rather than five minutes long.

- [ ] **Step 1: Five claims, each asserted *and* looked at**, with a screenshot and a sentence in the report saying what was seen:
  1. the online half lists the catalogue's items, with the kind badge reading `Theme` and a thousands-separated download count;
  2. a facet narrows the online grid, and a tag only one item holds is still offered;
  3. an item the library holds at the same version draws the `Installed` **mark**, one at an older version draws `Update` **disabled with its reason**, and one absent draws `Install` likewise;
  4. the skipped-kind line names the **identifier** `widget-preset` and not a display word;
  5. the modal for an online item shows its counts and its install action.
- [ ] **Step 2: Red-proof each** — break the thing it guards, watch the case fail, restore with **`cmp`, never `git checkout`** (a Windows text-mode write leaves CRLF and git normalises, so only `cmp` shows the file is back). At minimum: the badge word, the install-state comparison, and the refusal line's identifier.
- [ ] **Step 3: Rebuild before every run** — Playwright previews built bundles. `npm run build`, then `npx playwright test tests/e2e/editor-rail.spec.ts --workers=1`, output to a file, **never an exit code through a pipe**.
- [ ] **Step 4: Report what could not be verified.** The real catalogue is empty until phase E, so no claim here is against the live origin — every one is against a routed fixture, and the report must say so.

---

## Not built, and why

- **Install, Update, Export and Delete.** Phase D owns install; phase A left export and delete drawn-disabled with their reason (R164). C draws the three it adds the same way.
- **The status bar.** Both drawings fix one and neither half has it; it carries catalogue facts, so it could not be built before this phase. Filed as `vg-690` rather than folded in, because C's landing-order row does not name it.
- **`Update available`, and the re-home's download counter.** The spec's open question 1 is not C's to answer; `installedVersion` records what C needs for D.
- **Any freshness mechanism beyond the origin's `max-age=300`** — no TTL, no `ETag` store, no retry, no timeout, per `docs/decisions/0088`.
