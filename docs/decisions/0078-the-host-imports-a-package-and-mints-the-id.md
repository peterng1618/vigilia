# 0078 — The host imports a package, and mints the id it lands under

- **Date:** 2026-10-20
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`

## The problem

A `.vigilia-theme` package the author brings in has to land in the library as a
**host write** — it must survive the editor closing (the spec's *Import lands in
the library*) — and it must **never overwrite**. Two mechanisms had to be chosen,
and neither is obvious:

1. **Who reads the package and mints the id.** The withdrawn attempt had the
   browser parse the package, validate its id against the editor's regex and
   call `save`; the spec rules the opposite. The host owns the folder the bytes
   land in, and the reader (`readThemePackage`) is already its dependency.
2. **How "this id is free" is claimed.** A listing followed by a save is a
   window in which a theme the author already holds is replaced — the exact data
   loss the no-overwrite rule exists to prevent. The store's `write` has a
   concurrency guard, but it is a *base* guard: it fires only when the caller
   names the document it descends from, and a base-less save onto a taken id
   still replaces silently (vg-642, open, not this note's to fix).

## Rung 1 — Vigilia

Searched: `theme-import.ts`, `parseThemePackage` / `serializeThemePackage`
(`editor/src/persist.ts`), `readThemePackage` (`@vigilia/theme-package`),
`ThemeLibraryClient.save`, `ThemeStore.write` and its `base` / `overwrite`
options, `isValidThemeId`, `THEME_ID_REGEX`, `fileNameFor`, `mintedDisplayId`
(`settings/displays.ts`), `createThumbnailStore`, `repairScratch`.

Found:

- The reader exists and is already a host dependency (`readThemePackage`), and
  `editor/src/persist.ts`'s `parseThemePackage` is a thin wrapper over the same
  function — so there is one parser, not two, and moving the call to the host
  adds no new parsing.
- The id *shape* has three spellings: `isValidThemeId` (host),
  `THEME_ID_REGEX` (editor client) and the literal in `fileNameFor`. R137 picks
  the host's.
- **Nothing on the host mints a library id**, and nothing claims one is free.
  The nearest precedent is `mintedDisplayId` (display ids), which mints from a
  monitor's own facts — a different question (no name, no collision).
- `repairScratch` already answers "is this name occupied" with a `fs.stat`
  probe; that is the same question the free-id claim asks.

## Rung 2 — dependencies

Searched: `src/web/package.json`, `packages/*/package.json`, and
`src/web/node_modules` for `slug`, `nanoid`, `uuid`, `unique`, `filenamify`.

Found: `nanoid` is in the tree (transitive), but it generates random ids rather
than name-derived ones, and a random id would not be the name the author
recognises in the library. **No slug or unique-name library is a direct
dependency**, and none is in the tree. `@vigilia/theme-package` is a direct host
dependency and exports `readThemePackage` from its `src/index.ts`.

## Rung 3 — platform

Searched: `node:fs` promises — `mkdir`, `rename`, `stat`, `cp`, `writeFile` —
and probed the three that matter (numbers in rung 6).

Found:

- `fs.mkdir(path)` **without** `recursive` fails `EEXIST` on an existing
  directory: the platform does have an atomic exclusive create.
- `fs.rename` onto an existing **non-empty directory** fails `EPERM` on
  Windows, which is why the store's save is two renames (`.retired-`, then the
  swap) rather than one.
- What the platform does **not** give is an exclusive create that composes with
  that swap: the theme folder is not created by `mkdir`, it is renamed into
  place, so an `EEXIST` `mkdir` cannot *be* the write.

## Rung 4 — ecosystem

Searched (Exa, 2026-10-20):

- `"import into a library without overwriting" numbered suffix collision`
- `pnpm importIndexedDir EEXIST exclusive mkdir staged rename`
- `slugify npm name to identifier unique counter`

Found:

- **pnpm `fs/indexed-pkg-importer/src/importIndexedDir.ts`** — the closest shape
  anywhere: import a directory into a store, non-destructively, with a staged
  rename. Its freeness claim is a **non-destructive `mkdir` and `EEXIST`
  dedup**, not a listing; it can do that because the target directory is
  created, not swapped.
- **Alumio `resolveDestination`** — check-then-suffix (`foo.json` →
  `foo-2.json`), explicitly a check against the live filesystem with no atomic
  claim.
- **localpress `pull` (#151)** — per-run `usedNames` set plus numeric suffix,
  `--force` to overwrite; the fix exists because the previous behaviour was
  silent data loss on collision.
- **slskd (#407)** — numbered suffix, and the maintainer's own note that
  counting existing files races under concurrency; they moved to a
  tick-derived suffix instead.
- **`@sindresorhus/slugify`'s `slugifyWithCounter`** — the ecosystem's answer to
  "slug plus counter", and it is a **per-process** counter (`reset()` clears
  it). It does not answer "free in *this* library", which is the whole question.

So the convention for the *name* is settled (base, then `-2`, `-3`), and nobody
in the ecosystem has a freeness claim that survives a second process without
being part of the write.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Browser parses and saves, refusing a taken id | Opposite of the spec; two clients would repeat the id rule | — | The window the rule exists to close | Rejected (R133) |
| Host lists, then saves the free id | Small | A second pass over the library | Replaced theme between the two calls (R136) | Rejected |
| Host claims the id with an exclusive `mkdir` | Atomic on this platform | Restructures the store's staged swap into a create | Touches vg-642's territory in the general write | Rejected for this task |
| Host passes `expectFree` into the write it already makes | One flag on an existing call | The check is not atomic against a concurrent import | A microseconds-wide race, versus a window that is user-visible | **Chosen** |

## Rung 6 — probe

`C:\tmp\vigilia-a7-probe.mjs`, Node 22, Windows 11 (NTFS):

- `fs.mkdir` onto an existing directory → **`EEXIST`** (the exclusive create is
  real).
- `fs.rename` onto an existing non-empty directory → **`EPERM`** (so the swap
  must stay two renames).
- 1000 `fs.stat` existence probes → **66.1 ms**, ~66 µs each: the suffix scan is
  not a cost that needs a design.

The gate itself: `printf '{"tool_input":{"file_path":"…/host/src/server.ts"}}' |
node scripts/reuse-gate.mjs` exits **0** — notes 0009, 0010, 0018, 0019 and 0043
already claim that file, and the gate checks presence only. The control probe,
`…/renderer-core/src/charts/grid.ts`, exits **2**. So this note is owed by the
rule, not enforced by the hook.

## Decision

**The host parses the package and mints the id.** `readThemePackage` runs in the
import route, and the browser's whole half is a POST of bytes and a mapping of
the answer — because the id rule and the no-overwrite rule are the folder's
rules, and a second client would have to repeat both (R133).

**The id rule reuses `isValidThemeId`**, the host's own spelling of the shape
(R137), and tries candidates in the spec's order: the envelope's own id when the
shape admits it, else the next free id derived from `metadata.name`, else a
suffixed one.

**Freeness is a flag on the write, not a listing before it** (R136):
`ThemeWriteOptions.expectFree` makes the claim and the write one step, checked
before anything is created on disk. It refuses when the *folder* is occupied —
not merely when a readable theme is there — because a folder whose `theme.json`
does not validate is still the author's work, and replacing it is the same data
loss as replacing a listed one. `overwrite` is not this flag's expression and is
not touched; a base-less save onto a taken id stays vg-642's.

**Cost accepted:** the claim is not atomic against a *second* concurrent import
of the same package. Making it atomic means the store's swap becomes a create,
which belongs to the general write and to vg-642 — not to the import path.
