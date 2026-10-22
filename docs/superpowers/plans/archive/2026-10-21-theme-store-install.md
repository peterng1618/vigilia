# The theme store's install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person presses Install — or Update — on a catalogue item, the host downloads and validates that item's package, writes it into the theme library and records where it came from, so the item reads *Installed* and offers *Update* when the catalogue moves on.

**Architecture:** The editor's **browser cannot download the package**, so the **host** does. One new route fetches `packageUrl`, hands the bytes to the `readThemePackage` reader and `ThemeStore.write` the import route already uses, and then records the origin in the existing `theme-origins.json`. The install *decision* stays where phase C put it: `installState.ts` owns what a control says, and this plan gives that control a body rather than a second opinion.

**Tech Stack:** TypeScript, Node 22.12+ (ESM), Vitest + jsdom, Playwright, Biome. npm workspace under `src/web/`.

**Spec:** `docs/superpowers/specs/2026-10-12-theme-store-design.md` — phase **D** of § "Landing order", § "Import lands in the library", § "Provenance: what makes *Installed* true", and open question 1. Read the spec with this plan; the plan argues from it.

## What already exists, and must not be rebuilt

Phase C and B left most of this phase's surroundings in place. **Reuse, and do not restate:**

- `host/src/themes/import.ts` — `importThemePackage` and the spec's id rule (`importIdCandidates`: the package's own id, then a name slug, then suffixes; never overwrites).
- `host/src/themes/store.ts` — `ThemeStore.write(id, content, { overwrite })`, `ThemeIdTakenError`.
- `host/src/settings/theme-origins.ts` — `ThemeOriginsStore` over `theme-origins.json`, already wired into `server.ts` and **already joined onto `/api/themes`**, so *Installed* and *Update* read live data today.
- `theme-package/src/index.ts` — `readThemePackage`, `MAX_ARCHIVE_BYTES` (64 MiB), `MAX_EXPANDED_BYTES` (128 MiB).
- `editor/src/store-mode/install-state.ts` — `installStateOf`, the one owner of `none | install | installed | update`.
- `editor/src/theme-import.ts` — the editor's client for `POST /api/themes/import`, and the shape a refusal travels in.

## Global Constraints

- **No new dependency.** No HTTP client, no unzip package (`fflate` is already the reader's), no retry library.
- **The host validates, not the browser** (spec § "Import lands in the library"): the host owns the folder the bytes land in.
- **One owner per concept.** The install decision is `installStateOf`'s; the id rule is `importIdCandidates`'s; the origin file is `ThemeOriginsStore`'s. This plan adds no second owner for any of them.
- **Loopback only.** Every route that modifies the library refuses a non-loopback remote, as `/api/themes/import` does.
- **Persist authored state only.** The origin record is consumer state and lives beside `active-theme.json`, never inside `theme.json`.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse an invalid number rather than coercing it.
- 500 lines is a signal and 800 a stop for a source file.
- `src/web/packages/host/src/server.ts` is on `scripts/reuse-gate.mjs`'s watchlist: **no write to it before an ADR claims it**.

## Review Focus

The spec is a vision document. These are the five input classes it implies and no task's own tests reach by accident; each gets its test in the task named.

1. **A `packageUrl` that is not a catalogue URL at all.** The host would be fetching an address supplied by a remote document. A `file://`, an `http://`, or a redirect off GitHub is the failure that matters — the host must fetch only the hosts a catalogue can legitimately produce, and must not follow a redirect off them.
2. **A download that is larger than the reader accepts, or that never ends.** The reader refuses > 64 MiB *after* the bytes are in memory; a host that buffers an unbounded body has already lost. The cap must be enforced while reading, and a silent stall must end in a refusal rather than a hung request.
3. **An update that lands beside the copy instead of on it.** `importThemePackage` never overwrites, which is right for a file a person picked and wrong for the catalogue item this PC already installed. Reinstalling an item must replace the library copy the origin names, not mint `name-2`.
4. **An origin recorded for a write that did not happen.** A refused write must leave `theme-origins.json` untouched; a recorded origin pointing at a library id that does not exist is how *Installed* becomes a lie.
5. **A package for a kind this build does not run.** The catalogue carries a `kind`, the library does not. An item whose kind is not `dashboard-theme` must be refused by name rather than installed as though it were.

---

### Task 1: The hosting probe, and the decision it takes

Controller step. No product code.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-theme-store-design.md` (open question 1)

**Interfaces:**
- Produces: the ruling this plan's later tasks build against — whether `item.json`'s `packageUrl` may point at an upstream release asset (**option A**) or at a file in the catalogue repo (**option B**).

- [ ] **Step 1: Measure what is already measured, and finish the one leg that is not.**

The probe is a temporary release in the public catalogue repo, and every number below is read rather than reasoned:

| Measured 2026-10-21 | Result |
|---|---|
| `browser_download_url` with an `Origin` header | **302 to `release-assets.githubusercontent.com`, and neither hop sends `access-control-allow-origin`** |
| the editor's browser fetching it | therefore impossible; the host must fetch |
| `download_count` after 4 real downloads (2 anonymous, 1 API octet-stream, 1 with a UA) | still `0` after ~2 minutes |

The missing leg is the one the spec names: **does `download_count` survive a delete-and-re-upload?** It needs a non-zero count first. Poll the asset's count until it moves (GitHub documents the field with no latency, and the count is known to be eventually consistent), then record the asset's id, delete it, re-upload the same bytes, and record the new id and its count.

- [ ] **Step 2: Rule on the hosting option against that measurement.**

Write the result into open question 1 as prose beneath the existing "DECIDED 2026-10-21: deferred to phase D's plan" sentence: what was measured, what it settles, and which option is chosen. If the re-upload restarts the count, that is option A's advertised gain gone and the ruling says so; if the count survives, A keeps it. Either way the ruling names **one** option and states what it costs.

- [ ] **Step 3: Delete the probe release** — `gh release delete probe-download-count --repo peterng1618/yunari-store --yes` — and confirm `gh release list` no longer names it. A probe left behind is an item in a catalogue that is supposed to be empty.

- [ ] **Step 4: Commit** the spec change with a `docs(spec):` title naming the ruling.

---

### Task 2: The ADR, and the module that fetches one package

**Files:**
- Create: `docs/decisions/0089-the-host-downloads-a-catalogue-package.md`
- Create: `src/web/packages/host/src/themes/download.ts`
- Test: `src/web/packages/host/src/themes/download.test.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `downloadPackage(url: string, options?: DownloadOptions): Promise<DownloadResult>` where

```ts
export interface DownloadOptions {
  /** Injected so a unit test drives this without a network. */
  readonly fetch?: typeof fetch;
  /** Aborts the read when the store's own patience runs out. */
  readonly timeoutMs?: number;
}
export type DownloadResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string };
```

- [ ] **Step 1: Write the ADR first.** `docs/decisions/0089-…` in the shape `0088` uses, because the guard refuses a write to `server.ts` (Task 3) until a note claims it. It must argue the rungs honestly and name the measured facts: no `access-control-allow-origin` on either hop of a release asset (so the browser cannot), the host's existing `fetch` sites are both `127.0.0.1` (so this is its first outbound third-party request), and `ThemeStore`/`theme-origins` already own the write this fetch feeds. The watchlist entry it claims is `host/src/server.ts`.

- [ ] **Step 2: Write the failing tests** in `download.test.ts`, each with an injected `fetch`:

```ts
it("refuses a URL that is not https")
it("refuses a host the catalogue cannot produce")   // e.g. https://example.com/x.zip
it("refuses a redirect off an allowed host")         // 302 → https://example.com
it("follows a redirect between allowed hosts")       // github.com → release-assets.githubusercontent.com
it("refuses a body larger than the reader accepts")  // Content-Length and chunked both
it("refuses a body that stops arriving")             // the injected fetch never resolves past a chunk
it("answers the bytes for a good response")
```

- [ ] **Step 3: Run them and watch them fail** — `npx vitest run packages/host/src/themes/download.test.ts`, exit non-zero with "downloadPackage is not a function".

- [ ] **Step 4: Implement `downloadPackage`.** The allowlist is the hosts a catalogue can legitimately produce: `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com` (release assets, option A) and `raw.githubusercontent.com` (a file in the repo, option B). https only. Enforce `MAX_ARCHIVE_BYTES` (64 MiB, the reader's own) **while reading** — read the body as a stream and stop at the cap rather than buffering first. Follow a redirect only to another allowed host; `redirect: "manual"` and one hop of your own is the way to hold that. A `timeoutMs` default of 60 000 aborts through an `AbortController`.

- [ ] **Step 5: Run the tests, then the package's suite** — `npx vitest run packages/host/src/themes/`, exit 0.

- [ ] **Step 6: Commit** — `feat(store): the host fetches one package, and only from a catalogue`.

---

### Task 3: The install route

**Files:**
- Modify: `src/web/packages/host/src/server.ts` (beside `/api/themes/import`, which it shares its rules with)
- Create: `src/web/packages/host/src/themes/install.ts`
- Test: `src/web/packages/host/src/themes/install.test.ts`, `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: `downloadPackage` (Task 2), `importThemePackage`, `ThemeOriginsStore`, `ThemeStore`.
- Produces: `installCatalogueItem(request: InstallRequest, options: InstallOptions): Promise<InstallResult>` where

```ts
export interface InstallRequest {
  readonly packageUrl: string;
  /** The catalogue's id for the item, never the library id. */
  readonly catalogueId: string;
  readonly version: string;
  readonly kind: string;
}
export type InstallResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly message: string };
```
and the route `POST /api/themes/install` answering `{ ok: true, id }` or a refusal in the owner's own words.

- [ ] **Step 1: Write the failing tests** for `installCatalogueItem`, with an injected `fetch` and a real temporary `ThemeStore`/`ThemeOriginsStore`:

```ts
it("installs an item and records its origin")       // origin { catalogueId, version, installedAt }
it("records no origin when the write was refused")  // a package the reader refuses
it("refuses a kind this build does not run")        // kind: "widget-preset" → the identifier in the message
it("stamps the library id into the document")       // the stored theme's envelope.id is the id it landed under
```

- [ ] **Step 2: Run them and watch them fail.**

- [ ] **Step 3: Implement `installCatalogueItem`.** Refuse `kind !== DASHBOARD_THEME_KIND` first, naming the kind. Then `downloadPackage`, then `importThemePackage` (optionally carrying the thumbnail), and **only on `ok`** write the origin with `installedAt: new Date().toISOString()`. A failed download or a refused write returns the owner's message and writes nothing.

- [ ] **Step 4: Add the route.** `POST /api/themes/install`, matched beside `/api/themes/import` (and before `/api/themes/:id` for the same reason that one is). Loopback only, `405` on another method, `400` on a body that is not three strings plus a kind, and a refusal replied as the owner's words with `502` for a download that failed and `400` for one that was refused.

- [ ] **Step 5: Write the route tests** in `server.test.ts` against the existing harness: a loopback POST installs; a non-loopback POST answers `403`.

- [ ] **Step 6: Run both files, then the host suite** — exit 0.

- [ ] **Step 7: Commit** — `feat(store): install a catalogue item, and record where it came from`.

---

### Task 4: An update lands on the copy, not beside it

**Files:**
- Modify: `src/web/packages/host/src/themes/install.ts`
- Test: `src/web/packages/host/src/themes/install.test.ts`

**Interfaces:**
- Consumes: `ThemeOriginsStore.read()`.
- Produces: no new export; the same `installCatalogueItem` answers differently when the item is already installed.

- [ ] **Step 1: Write the failing tests:**

```ts
it("replaces the copy the origin names")        // origin says library id "aurora" came from catalogue id "aurora-4k";
                                                 // installing that item again leaves one theme, not two
it("bumps the origin's version")                 // installedAt moves, version is the new one
it("still never overwrites a theme the catalogue did not install")  // same name, no origin → a second entry
```

- [ ] **Step 2: Watch them fail** — the first installs a second theme today.

- [ ] **Step 3: Implement the rule.** Before importing, read the origins and find the library id whose `catalogueId` equals the request's. When one exists, write under **that** id with `{ overwrite: true }` rather than going through `importIdCandidates`; the document's id is stamped to it as the import path already does. When none exists, the import path is unchanged — this is the whole of the difference between installing and updating.

- [ ] **Step 4: Run the file, then the host suite** — exit 0.

- [ ] **Step 5: Commit** — `feat(store): an update replaces the copy it came from`.

---

### Task 5: The control gets a body

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/gallery.tsx` (`InstallAction`), `src/web/packages/editor/src/store-mode/item-modal.tsx` (`InstallFooter`), `src/web/packages/editor/src/store-mode/region.tsx` (the action's handler)
- Create: `src/web/packages/editor/src/store-mode/install-item.ts`
- Test: `src/web/packages/editor/src/store-mode/install-item.test.ts`, `region.dom.test.tsx`, `item-modal.dom.test.tsx`

**Interfaces:**
- Consumes: `POST /api/themes/install` (Task 3); `StoreItem.catalogue.packageUrl`.
- Produces: `installItem(item: StoreItem, options?: { readonly fetch?: typeof fetch }): Promise<InstallOutcome>` where `InstallOutcome` is `{ ok: true } | { ok: false, message: string }`.

- [ ] **Step 1: Write the failing tests** for `installItem` with an injected `fetch`: it posts `{packageUrl, catalogueId, version, kind}` to `/api/themes/install`; a non-ok answer carries the host's own sentence out unchanged (the rule `theme-import.ts` already follows).

- [ ] **Step 2: Implement `installItem`** beside `theme-import.ts`'s client, and **replace the `disabled` on both controls** with an `onClick` that calls it. `installed` keeps its mark and stays inert. A press enters a busy state (the control is disabled while one attempt is in flight, so a double-press cannot install twice), and on `ok` the region re-lists so the cell reads *Installed* — the listing is the one source of what is installed.

- [ ] **Step 3: Write the DOM cases:** a press on the cell's Install posts once and the cell then reads `Installed`; a press on the modal's Install does the same; a second press while the first is in flight posts nothing; a refused install leaves the control as it was and states the host's reason in the tree beside it.

- [ ] **Step 4: Run** `npx vitest run packages/editor/src/store-mode/`, exit 0.

- [ ] **Step 5: Commit** — `feat(store): the install control installs`.

---

### Task 6: The boundary — what a browser shows

**Files:**
- Modify: `src/web/tests/e2e/editor-rail.spec.ts`
- Modify: `docs/evidence/screenshots/README.md` (a row per claimed action, in the Theme store section)

**Interfaces:**
- Consumes: everything above. This task changes no product source; a failing claim is a finding to report, not a fix to make.

- [ ] **Step 1: Register the captures before taking them**, per AGENTS.md: one row per claim in `docs/evidence/screenshots/README.md`'s existing three-column table.

- [ ] **Step 2: Add the browser claims**, each against a routed `index.json` **and** a routed `/api/themes/install`:
  1. pressing Install on an online cell draws the item as *Installed* once the host answers `ok`;
  2. the same press for an item the library holds at an older version reads *Update* before and *Installed* after;
  3. a refused install leaves the cell as it was and shows the host's reason.

- [ ] **Step 3: Rebuild before running** — `npm run build`, then `YUNARI_CAPTURE=1 npx playwright test tests/e2e/editor-rail.spec.ts --workers=1`, output to a file and **the exit code read directly, never through a pipe**. Then re-run without `YUNARI_CAPTURE`.

- [ ] **Step 4: Look at each capture and say what it shows** in the task report. An assertion with no image is not this task's evidence and an image with no assertion is not a regression test.

- [ ] **Step 5: Commit** — `test(store): the install, seen in a browser`.

---

### Task 7: The `contentId` probe — is *modified locally* knowable yet

Controller step. No product code; its outcome is a recorded decision, not a third state.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-theme-store-design.md` (§ "Provenance")

- [ ] **Step 1: Probe whether `contentId` survives a store round trip.** Export a theme with the editor's own `serializeThemePackage`, import it back through `readThemePackage`, and compare the two envelopes' `contentId`. Repeat once with an asset present. The question the spec asks is whether that value is stable across a round trip; it is one function call and one comparison, run outside the repo tree.

- [ ] **Step 2: Record the answer in § "Provenance"** — either that *modified locally* is now knowable and the third state is its own decision, or that it is not and the row keeps two states. Do not implement a third state in this plan.

- [ ] **Step 3: Commit** — `docs(spec): contentId across a round trip, measured`.

---

## Plan boundary

This plan ends with an install a person can press, an update that replaces rather than duplicates, an origin record that makes both readings true, and a browser that shows them. It does **not** carry: submission (phase E), the normalizer and its caps (phase F), a *modified locally* state (Task 7 only measures whether one is possible), download counting on the store's own side (Task 1 records what hosting option makes possible), or any change to the catalogue repository's files beyond deleting the probe release.
