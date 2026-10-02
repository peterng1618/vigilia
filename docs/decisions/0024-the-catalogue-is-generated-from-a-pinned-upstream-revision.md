# 0024 — The font catalogue is generated from a pinned upstream revision, and committed

- **Date:** 2026-10-02
- **Status:** accepted
- **Paths:** `src/web/scripts/generate-font-trios.mjs`

## The problem

380 upstream pairings × 3 roles = **1140 role faces**, which deduplicate to
**261 distinct (family, weight) faces** across **174 families**. Each face needs a
pinned Fontsource artifact URL, a `latin` subset, a real licence, and a weight
the family actually ships. None of those facts live in the pairing document: a
pairing names a family and an `h1` weight, and says nothing about which cuts
exist, which subsets, what npm version to pin, or under what licence. So the
shape is not "copy some JSON" — it is **joining a designer-curated pairing graph
against a per-family registry, clamping every request to what the registry
actually publishes, and emitting a module whose every field is traceable to a
fetched document.**

The hazard is quiet in the exact place it matters. Nothing throws if a weight is
wrong: the picker renders a specimen at 700 and the apply produces 400. Nothing
throws if a licence is wrong either: the URL 200s, the font loads, and
`THIRD-PARTY-NOTICES.md` under-declares a licence for the life of the product.
Both are invisible until someone audits the notices or a specimen disagrees with
the canvas.

## Rung 1 — Vigilia

Searched: `scripts/` (seven `.mjs`), `src/web/packages/host/scripts/`,
`src/web/packages/player/scripts/`, `*.generated.*` across `src/` (none),
`font-catalog.ts` and `font-catalog.test.ts`, `docs/engineering/dependencies.md`.

Found: **one in-repo precedent for the shape, and it is `vendor-lhm.mjs`.** It
pins a version, refuses when the digest does not match the pin, writes a
`PROVENANCE.txt` beside the staged bytes, and is run by hand. That is the same
discipline — a pinned input, a loud refusal on drift, provenance in the output,
never wired into a build. It stages binary output rather than emitting
TypeScript, so it is a precedent for the *stance*, not reusable code.

`font-catalog.ts:21` holds `FONTSOURCE_LICENSE`, a hardcoded OFL constant with
`url: "https://openfontlicense.org/"`, used by the three hand-written trios.
That constant is the thing this replaces for generated faces, and its shape —
`{ name, url }` per face — is why the generated `license` field is a pair and not
a code: the notices work downstream can read a name without a lookup table.

There is **no codegen in this repo**. Every existing `.mjs` is a gate or a
check, and none emits a source file. So the "what does a generated artefact look
like here" question has no in-repo answer and must be settled rather than copied.

## Rung 2 — dependencies

Searched: `src/web/package.json` and every `packages/*/package.json` for
codegen-adjacent tooling — `json-schema-to-typescript`, `quicktype`,
`prettier`, `jsonc-parser`, `ts-morph`, `unbuild`, `openapi-typescript`.

Found: **nothing that generates a module from JSON.** The workspace carries
`typescript` 7.0.2 (for `typecheck`, and it emits nothing from a schema),
`@biomejs/biome` 2.5.14, vitest, playwright, vite, jsdom, canvas. `AGENTS.md`
requires licence review in `THIRD-PARTY-NOTICES.md` and
`docs/engineering/dependencies.md` before adding a shipped dependency; adding one
to a **manual, run-once** script is the expensive kind of wrong — it becomes
permanent maintenance for a script that runs when a human refreshes the
catalogue.

`biome` is the exception worth having, and it is already there: it is invoked as
a child process at the end of the run, not imported, because `biome.json`
includes only `src/web/**/*.ts|json|css` and would otherwise never see the
emitted module. Measured: `JSON.stringify(x, null, 2)` is **not** biome-clean —
biome unquotes object keys, collapses arrays that fit, and adds trailing
commas — so the generator formats its own output or `npm run format:check` goes
red on the next run.

## Rung 3 — platform

Searched: Node 22+ global `fetch`, `node:fs/promises`, `JSON.stringify`,
`String.prototype.localeCompare`, `import ... with { type: "json" }`, and
`node --experimental-strip-types` for emitting typed output.

Found: **the platform covers the transport and the file write outright, and it
covers the typing by omission.** 554 HTTPS requests (1 registry + 380 pairing
documents + 174 family documents) run in a bare `node` process with no
dependency. `import ... with { type: "json" }` works — probed on Node 24.13.0,
not assumed — and would let the generator read the pairings without a fetch at
all, but only from a checkout it does not have and must not clone: it fetches by
commit over HTTP so the pin *is* the checkout. Strip-types is the wrong tool:
the output is consumed by the editor's `tsc`, which needs real syntax, not a
runtime type strip.

The one platform hazard is `localeCompare`. Sorting the 261 faces by it makes
the emitted bytes a function of the machine's ICU collation, so the same commit
can produce a different file on a different host — which is exactly the
guarantee the pin is supposed to buy. Code-point comparison (`a < b`) is the
deterministic option and is what the generator uses.

## Rung 4 — ecosystem

Searched: the five routes that actually exist for this shape — `@fontsource/*`
as npm dependencies; `next/font/google` build-time fetching; the Google Fonts
metadata API and `google-webfonts-helper`; the jsDelivr package API
(`data.jsdelivr.com/v1/package/npm/@fontsource/inter`); and **Fonttrio's own
per-family documents**, which this rung originally missed. The first four were
written without live web search — the search tools were not loadable in the
session that produced the note — so each claim about them is about the
mechanism, and a reviewer wanting live evidence should check
`@fontsource/*@5.3.0` (one package per family) and the `next/font` build path
directly. The fifth was found by the reviewer and probed directly; it is
recorded below on that evidence.

Found: **five answers, and every one of them solves a different problem.**

- *`@fontsource/*` as dependencies.* Gives exactly what is wanted — pinned
  artifacts, `latin` subsets, per-family licence — and costs 174 packages (or
  261, per weight). It carries **no pairing metadata at all**: there is no
  upstream product where 174 OFL packages discover that Anton pairs well with
  Libre Franklin. The curated half of this catalogue would have to be
  hand-written anyway, and 174 dependencies is a licence-review surface the
  repo does not want.
- *`next/font/google`.* Fetches at build time and self-hosts — genuinely solved,
  genuinely inapplicable. It is Next-only, it emits into Next's own module
  graph, and it wants the Google Fonts catalogue, which has no pairing notion
  and no Fontsource `id`/`npmVersion` to pin against.
- *Google Fonts metadata / `google-webfonts-helper`.* Per-family categories,
  licences and weights, so it covers the *registry* half. It does not cover the
  pairing half, its ids are not Fontsource ids, and its licence answer is a
  per-family string with no URL — which is precisely the field that has to be
  right.
- *jsDelivr package API.* Versions and file listings for a published npm
  package: real, but it answers "which versions exist", not "which weights and
  subsets does this family publish, under what licence".
- *Fonttrio's own per-family documents* —
  `GET https://www.fonttrio.xyz/r/{family}.json`. **This is the closest thing to
  the shape, and it is the one this rung originally missed.** Probed directly
  during review: `https://www.fonttrio.xyz/r/geist.json` answers 200 with
  `weight[]`, `subsets[]`, `category` and `variable`. So upstream ships the
  *registry* half as well as the pairing half, and a generator could have taken
  all 554 documents from one host instead of joining against a second API.

  It is still not usable, for two measured reasons, and both are load-bearing:

  - **No `npmVersion`.** Nothing in that document can be pinned, and pinning is
    the entire purpose of the artefact URL — an unpinned `latest` artifact is
    the one thing `font-trios.generated.test.ts` exists to refuse.
  - **No licence field at all.** A registry that cannot answer "under what
    licence" cannot be the one R2 depends on; 10 of the 261 faces are UFL-1.0 or
    Apache-2.0, and a generator that had to guess would get them wrong in the
    exact direction the ruling was issued to prevent.

  A second upstream that cannot answer "which version" and "under what licence"
  is not a cheaper way to build this; it is a way to build the half that was
  never the hard part.

**Nobody in this search publishes the shape we have**: a curated pairing graph
joined against a per-family registry, with the request clamped to what the
registry ships and the result emitted as a version-pinned, licence-carrying typed
module. The closest existing products each own part
of it — Fonttrio owns the pairing graph and a partial registry, Fontsource owns
the registry, Google Fonts metadata a third registry — and the join, the clamp
and the licence attribution are exactly the three steps that have no
off-the-shelf answer.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Hand-write 261 faces and 380 trios | none of the per-family facts are hand-authorable | unbounded | licence and weight errors are invisible; a Fontsource version bump silently strands 261 URLs | rejected |
| Depend on `@fontsource/*` | registry half solved; **pairing half unsolved** | 174–261 packages, licence review each | no pairing metadata exists to import; dependency surface for a catalogue that changes twice a year | rejected |
| `next/font/google` at build time | solves fetch-and-self-host for one framework | Next coupling | inapplicable outside Next; pins nothing and emits nothing Vigilia can read | rejected |
| **Generate a committed module from a pinned revision** | whole shape, and the join/clamp/licence steps are ours either way | one 261-line script, run by hand | the generated file is 261+380 records and must be regenerated on any upstream change — the point of the pin | **chosen** |

## Rung 6 — probe

Measured 2026-10-02 against Fonttrio commit `8af7098ada0b90f076fbfe260244d11b05dd2403`:

- 380 pairing documents fetched; uniform shape; **0** unparseable `--font-*` vars.
- 1140 role faces → **174 distinct families**. Every family resolves directly
  against `api.fontsource.org/v1/fonts/:id`: **0** 404s, **0** without a `latin`
  subset. The name-based fallback the plan sketched was taken **zero** times in
  1140, so it was deleted rather than kept as dead insurance.
- Upstream `h1` weight recommendation: **700 × 238, 600 × 77, 800 × 45, 400 × 20**
  — 380 pairings that do not agree about what a heading is. **49** headings
  clamp to a cut their family does not ship; 20 families publish no 700 at all.
- Faces: **261** clamping each heading to the pairing's own recommendation,
  against **238** clamping every heading to a uniform 700. The 23-face gap is
  the price of ignoring 142 upstream recommendations, and it is paid into a
  number the picker displays.
- Licences over those 261 faces: **251 OFL-1.1, 7 UFL-1.0, 3 Apache-2.0**. The
  10 non-OFL faces — Roboto Slab, Yellowtail and five Ubuntu families — reach
  **15 pairings**. A generator that hardcoded OFL would ship 15 trios whose
  declared licence is wrong.
- 554 requests, one `node` process, no dependency. `biome format` disagrees with
  raw `JSON.stringify(x, null, 2)` output, measured.

## Decision

**A hand-run Node script generates a committed TypeScript module from a pinned
Fonttrio revision, and the pin is the reproducibility guarantee.**

Concretely:

1. `src/web/scripts/generate-font-trios.mjs`, run by hand as
   `npm run fonts:generate`, never by a build or a test. Its output is committed;
   the test asserts the output's shape, so a bad refresh is caught by the suite
   rather than by a user looking at a specimen.
2. **A heading is clamped to the pairing's own `h1` recommendation**, not to a
   uniform 700. 142 of 380 pairings recommend something else and the picker will
   render the clamped weight, so a uniform clamp would mislabel the author's
   choice as the clamp's. The catalogue therefore carries 261 faces where the
   design doc's measured 238 assumed the uniform rule — recorded here because the
   number moved and the reason must survive.
3. **Every face carries its own licence name and URL**, taken from Fontsource and
   mapped through a table that *throws* on an unrecognised code. A fallback to
   OFL would be a silent misattribution, which is the failure this whole note
   exists to prevent. The check is `Object.hasOwn`, not a truthiness test: the
   table is a bare object, so `LICENSES["constructor"]` is `Object` and would
   pass a plain guard, after which `JSON.stringify` drops the function and the
   catalogue ships faces with **no licence field at all**. Measured, both ways:
   the truthiness form emits all 261 faces licence-less and exits 0; the
   `Object.hasOwn` form throws and exits 1.
4. **`role` and `clamped` belong to a pairing's request, not to the face.**
   `faceFor` re-stamps both on the way out, because the same `(family, weight)`
   can be a clamp for a pairing that recommends a weight the family does not
   ship and not a clamp for one that recommends the weight it does. A value
   cached on first touch put the wrong flag on 9 of the 380 trios in both
   directions — including a body face claiming to be a clamp — and threw
   nothing. `GENERATED_FACES` keeps the first-touch value for both fields and
   the generated header says so, because nothing may read them off a
   standalone face.
5. **An unknown family is a loud throw.** The fallback the plan sketched is
   measured to be dead code; a Fontsource rename should fail generation, not
   resolve through a second lookup path nothing else uses.
6. **Fetches are bounded-concurrent and index-ordered, and the output is sorted
   by code point**, so the emitted bytes are a function of the commit and not of
   arrival order or the host's ICU collation.
7. The generator formats its own output with the workspace's `biome` before
   writing, so `npm run format:check` stays green on a regenerated catalogue.
8. **The emitted module is a deliberate, recorded exception to the 800-line
   stop**, and `AGENTS.md` asks for the exception to be recorded rather than
   assumed. The number that decides it: **807 KB raw is 28.5 KB brotli**
   (measured, `zlib.brotliCompressSync` quality 11), the file is read once and
   never hand-edited, and `npm run size` gates the **player**, not the editor —
   so nothing about shipping this reaches a bundle-size budget. The obvious
   alternative, emitting the 261 faces once and having trios reference them by
   id, would cut the 696 KB trio block to roughly 110 KB, at the price of a
   second shape and a resolution step in every consumer. Not taken: the file is
   read once and the simpler module is the cheaper thing to reason about. The
   same paragraph is repeated in the generated file's own header, because the
   next person to open a 28,000-line file in `packages/editor/src/` should see
   the exemption rather than re-derive it.

What this gives up: the catalogue is a snapshot, and refreshing it is a manual
act that produces a large diff. A Fontsource version bump does not fail a build.
The shape test is what catches a bad refresh — which is why it asserts the count,
the pin, the clamp and the licence set rather than a spot check.
