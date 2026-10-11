# 0041 — Retire schema v1 by deletion, keeping the shared checks the v2 envelope borrows

- **Date:** 2026-10-11
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/`

## The problem

Two persisted-theme formats live in this tree and only one of them is published. `schema/theme-document.schema.json` describes a **v2** Fabric envelope (`:3` `"$id": …/theme-document/2.json`, `:10` `"schemaVersion": { "const": 2 }`), and it is what the editor writes and the host serves. Beside it, `renderer-core/src/theme/document.ts:9` still declares `export const SUPPORTED_SCHEMA_VERSION = 1` for an in-memory `ThemeDocument`, with its own validator (`validate.ts:362 validateThemeDocument`), its own writer (`serialize.ts:79 serializeThemeDocument`), a v1→v2 converter (`fabric-envelope.ts:44 fabricEnvelopeInputFor`), seven committed v1 fixtures, and a player path that renders them.

The user has asked to **deprecate every trace of schema v1.** The non-obvious part is not the deletion — it is that **the v2 validator is not independent of the v1 one**: `fabric-envelope-validate.ts:747` calls `validateThemeDocument({ schemaVersion: 1, … nodes: [] })` to reuse the v1 validator's semantic checks (unknown keys, asset references, artboard, globals). Delete the v1 validator naively and the v2 envelope silently loses its shared validation — a failure that renders wrong rather than failing, which is the shape this gate exists for.

The second non-obvious part is what "deprecate" should mean at all, given this repo has **no version-migration mechanism** and a recorded habit of not building one.

## Rung 1 — Vigilia

Searched: the whole tree for the v1 vocabulary (`SUPPORTED_SCHEMA_VERSION`, `schemaVersion: 1`, `ThemeDocument`, `validateThemeDocument`, `serializeThemeDocument`, `fabricEnvelopeInputFor`), both backlog registers, `docs/decisions/`, and `docs/architecture/`.

Found: **the format and its whole apparatus exist and are live** — the validator is user-reachable through the player (`player/src/main.ts:73`) and through the v2 validator's reuse above; the fixtures are real files the player renders; the About tab prints the version to a person (`editor-shell/settings.tsx:80` renders `SUPPORTED_SCHEMA_VERSION`, so the product tells the user it is schema **1**). Also found: **no deprecation mechanism of any kind** — no status field, no warning path, no migration function — and **no backlog row** owns this work.

## Rung 2 — dependencies

Searched: `src/web/**/package.json` for a schema/migration library (ajv, zod, json-schema-to-ts, any `migrate*`/`upcast*` package).

Found: **nothing.** Validation in this repo is hand-written against hand-maintained key lists (`validate.ts`'s `KNOWN_KEYS`, the note `vg-095` records that list being maintained twice), so there is no dependency whose migration capability could be reused. There was nothing to discharge here.

## Rung 3 — platform

Searched: whether JSON Schema itself offers version dispatch — i.e. a way for one schema document to accept or route versions, and what `$id`/`$ref` give.

Found: a schema can *describe* a version but cannot *choose* between versions; dispatch is the loader's job. `schema/theme-document.schema.json:10` already expresses the decision as a constraint (`"const": 2`), which means the platform's contribution is **refusal, not migration** — exactly what the code does today (`validate.ts:461`, `fabric-envelope-validate.ts:50`). Rung 3 passing does not discharge rungs 4–5, so both were run.

## Rung 4 — ecosystem

Searched: how other projects of this shape retire a persisted format — the standing practice for schema versioning in document formats (JSON Schema's own versioning guidance, "schema evolution" / "upcasting" prior art, and the common event-sourcing pattern of an upcaster chain feeding a latest-version validator).

Found: **three shapes exist and none of them is ours.** (1) An **upcaster chain** — N→N+1 functions composed into a migration path; this is the standard answer and it is what "deprecate" usually means. (2) **Version dispatch at the loader** — parse, read the version, route to the matching schema. (3) **Dual-reader with a write-forward** — accept both, always write latest. **This repo has already rejected (1) and (3) in writing, twice**: `docs/decisions/0017-…:83` records migration of existing ZIPs as *"rejected by the user — start clean"* and `:108` *"Existing archives are ignored rather than migrated"*; `docs/decisions/0022-…:124` records *"Clean break, no migration."* So the ecosystem's default is answered by two prior rulings here, and adopting it now would contradict both.

**The rung-4 finding that matters is not a library — it is that the reuse question is internal.** The v2 envelope already *has* working semantic validation, borrowed from the v1 validator. Any retirement that reimplements those checks would be rebuilding something that exists, which is the failure this gate names.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Upcaster chain v1→v2 | None: no v1 document exists outside fixtures, and both validators already refuse rather than upgrade | High — a migration path for data with no instances | Keeps a format alive to migrate *from* | **Rejected** — contradicts ADR 0017 and 0022 |
| Mark v1 deprecated, keep it | Partial: it is what "deprecate" literally says | Low now | The format stays live, and the About tab keeps telling people the schema is 1 | **Rejected by the user's instruction** ("all traces") |
| **Delete v1, extracting the shared checks into the v2 path** | Complete: one format, one validator, one writer | Medium — the extraction must be proved by the v2 envelope's existing tests | The extraction is where a silent loss could hide | **Chosen** |
| Delete the v1 validator without extracting | Looks cheapest | Low | **The v2 envelope loses unknown-key, asset-reference, artboard and globals validation with nothing failing** | **Rejected** — the mechanism-boundary failure |

## Rung 6 — probe

Measured by reading, because the numbers here are call sites rather than timings:

- **The coupling is one call site**: exactly one production reuse, `fabric-envelope-validate.ts:747`. That is the whole extraction surface, and it is why this note exists.
- **The v1 writer has no production caller**: `serializeThemeDocument` is called only by tests, so retiring it costs no shipped path.
- **The converter has no production caller**: `fabricEnvelopeInputFor` is exported (`index.ts:280`) and called only by its own test.
- **The fixtures are seven**: three valid and four `invalid/`, all `"schemaVersion": 1`.
- **The player's v1 surface is one gated path**: `FIXTURE_THEME_IDS` (`player/src/main.ts:59`), reachable only through `?theme=stress|portrait-cover|assets`.
- **The user-visible trace is one row**: the About tab's schema-version fact (`settings.tsx:80`).

## Decision

**Retire schema v1 by deletion, and reuse the v1 validator's semantic checks by extracting them rather than by deleting them with their host.**

The specific reasons, in order of weight:

1. **The repo has twice ruled against migration** (ADR 0017, 0022), and the user's instruction is to remove *all traces*. A migration path would be a trace.
2. **The v2 envelope must not lose its shared validation.** The extraction is the point of the change, not a side effect; it is proved by the v2 envelope's existing tests continuing to pass.
3. **The user chose to delete rather than convert.** Asked what becomes of the three valid v1 fixtures the player's `?theme=` path renders — convert them to v2 envelopes, delete them with the path, or convert three and delete the invalid four — the user chose **delete the fixtures and the path**, accepting that the demo themes become unrenderable.

**What this costs, stated plainly:** the editor can no longer open a v1 theme and there is no path back for one, which is consistent with a pre-release product whose own architecture rules say *"no compatibility glue solely to preserve superseded internal designs"*. The About tab's schema row must stop printing `1`, because a product that tells its user the schema is v1 while v1 no longer exists is a false claim. The `vg-279` row already owns how that row sources a version.
