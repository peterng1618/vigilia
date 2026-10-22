# 0086 — The listing carries an origin, and a deleted theme takes its own with it

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`

## The problem

Two stores now describe one library theme. `ThemeStore` owns the folder and answers
`list()`; `ThemeOriginsStore` (Task 2) owns a consumer-state file beside the answers,
recording where a copy came from. `/api/themes` answers `themeStore.list()` directly,
so the origin has no path to the editor, and nothing sweeps it when the theme goes.

The shape is a **join between two stores owned by different directories, exposed on a
listing route**, and three things about it are not obvious: which side the join is
keyed on, what a theme with no origin looks like on the wire, and what happens when
the sweep fails after the folder has already been trashed.

## Rung 1 — Yunari

Searched: every `themeStore.list()` call site in `server.ts`; `/api/themes/active`'s
GET and `activeThemeMap`; `assignedThemeFor`; the display DELETE's
`themeSettings?.removeDisplay(id)`; `ThemeStoreEntry`'s optional members; the route
wrapper `route`/`handle`; `settings/theme-origins.ts`.

Found: **both halves already exist here.** `activeThemeMap(store, available)` takes a
listing and joins a second store onto it, keyed by the *listing's* ids through its
`exists` callback — "a list must not show a theme that is gone", as `ActiveThemeStore`
puts it. `ThemeStoreEntry` already models absence as an absent key (`author?`,
`version?`: "a theme that declares none has no key at all, so nothing draws a
separator with nothing after it"). The display DELETE is the precedent for a sweep
after a removal: `themeSettings?.removeDisplay(id)` and `activeTheme?.clear(id)` are
called with no `try` of their own, after `displays.remove(id)` answered true. What
does *not* exist is any route that joins a per-theme settings store onto `/api/themes`
— the origin is the first.

## Rung 2 — dependencies

Searched: `src/web/packages/host/package.json`'s dependencies and `server.ts`'s
imports.

Found: `@yunari/renderer-core`, `@yunari/scene-fabric`, `@yunari/theme-package`,
`node-forge`, `systeminformation`; HTTP is `node:http` with no framework, no router,
no middleware. No ORM, no data-mapper, no `lodash`-style `keyBy`/`merge`. A join here
is `Array.prototype.map` plus an object spread, which the file already does in
eighteen places.

## Rung 3 — platform

Searched: `JSON.stringify`'s handling of an `undefined`-valued key, `sendJson`'s
`body: unknown` parameter, and TypeScript's `exactOptionalPropertyTypes` (on in this
repo) against `{ origin?: ThemeOrigin }`.

Found: **nothing enforces this but the code itself**, which is worth writing down
because the obvious answer is wrong. `JSON.stringify({ a: 1, b: undefined })` is
`{"a":1}`, so an unconditional `{ ...entry, origin }` reaches the browser *identically*
to the conditional spread — measured, not reasoned: with the unconditional key in
place, both the new absence case and the pre-existing exact-object case in
`server.test.ts` still pass. `sendJson` takes `body: unknown`, so the compiler does not
check the literal against `origin?: ThemeOrigin` either, and `tsc` is silent. So the
conditional spread is the file's own idiom (eighteen sites) and the pattern
`exactOptionalPropertyTypes` exists to keep at the source, not a rule a test or the
type-checker can enforce here. What *is* observable, and what the case pins, is that the
route never invents an origin — no `null`, no `{}` — for a theme that has none.

**And the read itself has a prototype to miss.** `origins[entry.id]` on a plain object
reaches `Object.prototype`: `__proto__` is a legal theme id under both `THEME_ID_REGEX`
and the store's own `THEME_ID`, so a theme named `__proto__` with no origin recorded was
answered `Object.prototype` — which stringifies as `{}` and reached the wire as
`{"id":"__proto__","origin":{}}`. `constructor` and `toString` have the same read and
happen to be dropped by `JSON.stringify`, so `__proto__` is the member that shows. The
answer is `Object.hasOwn`, which is what `theme-origins.ts`'s own `removeTheme` already
does for the same reason ("`constructor` is a legal theme id"), and it is the second time
this file family has paid for reading a map by key.

## Rung 4 — ecosystem

Searched: the JSON:API v1.1 format spec (compound documents, `included`, full linkage,
`?include=`); `apisyouwonthate.com` "Making the Most of JSON:API"; leafo's
"PostgreSQL Preloading" (join vs a second `WHERE id IN (…)` query); exa queries
*"API endpoint that joins metadata from a separate store onto a list response,
omitting the key when absent"* and *"JSON:API compound document included sideload
second query"*; `agentic-community/mcp-gateway-registry` PR #1188 and issue #1277 (a
list endpoint joining per-row metadata, and what its read shape does with absence).

Found: the ecosystem's answer for a side table on a listing is a **second query keyed
by the primary listing's ids**, never a join against the side table's own rows —
leafo states the reason plainly: the side table holds rows the listing has no entry
for, and id-keyed preloading is what keeps one canonical object per response. JSON:API
names the same rule **full linkage**: an `included` resource must be reachable from the
primary data, and one no resource links to may not appear at all. So "join against the
listed ids" is the standard rule and not a local preference. The useful counter-example
is #1188, which *coerces* absent metadata to `{}` so no client has to special-case
absent vs empty — the opposite choice to ours, and one this repo has already rejected
for the same field family (`author` is absent, not empty). Nothing searched models a
sweep tied to a deletion, so that half is ours.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Join inside `ThemeStore.list()` | One call for the route | Couples the library owner to a settings file it has no directory for | The store would need the settings dir, which it is deliberately not given | rejected |
| A second route (`/api/themes/origins`) the editor joins | No server join | Two requests per listing | Moves the "an entry for a deleted theme reaches nobody" rule into the editor, and every future caller repeats it | rejected |
| Sideload the whole origins map beside `themes` | One line | The map travels whole | JSON:API's own full-linkage rule forbids an entry no primary row links to; a stale origin reaches the client | rejected |
| Map the listed entries, spread an origin in only where the store holds one | Keyed on the listing, so a stale entry reaches no response | One `read()` and one `map` | none that the tests do not pin | **chosen** |
| Always emit `origin: undefined` | No conditional | none | Invisible on the wire, so nothing would catch it; it states in the object what is not true, and contradicts `author`'s absence convention | rejected |

## Rung 6 — probe

Measured 2026-10-21 on branch `develop` at BASE `773307cd`, from `src/web/`:

| Probe | Result |
|---|---|
| `node -e "console.log(JSON.stringify({a:1,b:undefined}))"` | `{"a":1}` — the wire cannot distinguish an absent key from one holding `undefined` |
| `npx vitest run packages/host/src/server.test.ts -t "handles theme save, list, document fetch, and package fetch"` before any change | `1 passed` — the existing exact-object case is green with no `origin` key |
| the five new cases before the wiring | `2 failed \| 3 passed` — the join and the sweep fail; the three negative cases pass, because they assert an absence the broken build also produces |
| the same five after the wiring | `5 passed` |
| the unconditional `{ ...entry, origin }` put back, then both absence-sensitive cases | `1 passed` and `1 passed` — **the break is not caught**, which is why rung 3's finding is written down rather than assumed |
| a stored theme with id `__proto__` and no origin, against the bare `origins[entry.id]` read | `1 failed` — `expected true to be false` on `Object.hasOwn(entry, "origin")`, which is the `origin: {}` the reviewer measured |
| the same case after `Object.hasOwn` | `1 passed` |

## Rung 7 — build

- `settings/theme-origins.ts` — unchanged; Task 2's store already answers `read()` and
  `removeTheme(id)`.
- `main.ts` — `themeOrigins: createThemeOriginsStore(settingsDir)` beside
  `themeSettings`, from the same directory: both are consumer state about a theme, and
  that is the one place such state lives.
- `server.ts` — `HostServerOptions` gains `readonly themeOrigins?: ThemeOriginsStore`.
  The `/api/themes` GET maps the listed entries and spreads an origin in only where the
  store holds one for that id, read through `Object.hasOwn` so an id naming a prototype
  member is not answered with that member. The theme DELETE sweeps
  `themeOrigins?.removeTheme(rawId)` only where `themeStore.remove` answered true, inside
  the handler's existing `try`, so a sweep that throws answers 500 through the same catch
  that already answers a refused trash — with the folder gone, deliberately, mirroring the
  display route's unguarded `themeSettings?.removeDisplay(id)` rather than swallowing the
  fault.
- `server.test.ts` — six cases: the join, the absent key, a `__proto__` id with no
  origin, an origin naming a theme that is gone, the sweep on success, and no sweep on a
  404.

## Decision

**The route joins the origins store onto the entries the library just listed, and the
theme DELETE sweeps one entry after the removal it belongs to.** The join is keyed on
the listed ids — the same rule `activeThemeMap`'s `exists` callback and JSON:API's full
linkage both apply — so an origin naming a theme that is gone reaches no response
without any pruning step of its own. A theme with no origin has **no `origin` key**,
which is the convention `ThemeStoreEntry.author` already set — the conditional spread
is the file's own idiom, and nothing but that convention holds it, as rung 3 records.
**The map is read with `Object.hasOwn`**, so a legal id that names a prototype member is
answered as a theme with no origin rather than as that member; the id rule is not
narrowed, because `__proto__` is a theme an author may legitimately have.

**The specific reason:** the store already answers the whole map, so the only open
questions were which side the join is keyed on and what absence looks like — and both
had an answer in this codebase and in the ecosystem's own rule, leaving nothing to
invent. The sweep is unguarded for the reason the neighbouring call is: a sweep that
throws is a real fault, and a silent swallow would hide a theme whose origin outlived
it. The cost is accepted and recorded: a failed sweep answers 500 for a request whose
folder has already been trashed, so the client sees a failure for a removal that
happened.
