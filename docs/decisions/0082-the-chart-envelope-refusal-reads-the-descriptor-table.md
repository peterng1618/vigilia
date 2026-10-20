# 0082 — The chart envelope refusal reads the descriptor table, rather than re-deciding each scalar's range

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`,
  `src/web/packages/renderer-core/src/charts/settings-fields.ts`

## The problem

A v2 envelope persists a chart as a Fabric object with a `family` and a `settings`
bag, and the loader that turns bytes into an envelope —
`renderer-core/src/theme/fabric-envelope-validate.ts` — walks the scene for
*references* and nothing else. It reads a chart's settings for the paint fields
(`track`, `progress`, `stroke`, `area`, `palette`, `fill`, `remainderFill`) and
checks each is a palette reference. It never reads a **scalar**.

So a stored document whose saved numbers are impossible — a gauge whose `min` is
above its `max`, a line whose `windowSeconds` is 0, a pie whose
`innerRadiusPercent` is above its `outerRadiusPercent`, a fixed total that is
`null` — loads as `ok: true`, and what the author saved and what the renderer
draws are two different things. The pie's `clampPercent` at render time is the
existing answer, and it is the failure mode rather than the fix: it makes the
disagreement invisible instead of refusing the document that carries it.

The shape of the problem is not "add a range check". It is **where the range
lives**. `charts/settings-fields.ts` already owns which scalar settings exist per
family and already carries each one's `min`; a validator that writes its own
second list of bounds is a second owner for one concept, and the two drift. But
the table's own header says the opposite — *"Why the validator does not read this
table"* — and records that consuming descriptor bounds was decided against
because authoring bounds and validation invariants are different questions. That
is the tension this note resolves.

## Rung 1 — Vigilia

Searched: `theme/fabric-envelope-validate.ts` in full (`chartPaintReferences`,
its `isRecord` guard, the six call sites in `validateFabricThemeEnvelope`);
`charts/settings-fields.ts` in full (both descriptor interfaces,
`CHART_SETTINGS_FIELDS`, `CHART_PAINT_FIELDS`, `settingsFieldsFor`,
`chartPaintFieldsFor`, `settingsKeyFor`, and the header's own *"Why the validator
does not read this table"*); every non-test consumer of both accessors (`rg` over
`src/web`); the settings types that must agree with the table (`types.ts`
`GaugeSettings`, `charts/line.ts` `LineSettings`, `charts/bar.ts` `BarSettings`,
`charts/pie.ts` `PieSettings` + `PieTotal`, `charts/animation.ts`
`AnimationSettings`); the render paths that *recover* instead of refusing
(`charts/pie.ts` `clampPercent`, `data/store.ts`'s window floor);
`schema/theme-document.schema.json`; the register row `vg-348`.

Found: **the owner exists, the refusal does not.** The table declares 34 scalar
descriptors and 9 paint descriptors across four families, and its `min`/`max` are
read today by one non-test consumer (`editor/src/chart-manager/panel.ts`) — the
inspector's control bounds. No path reads them as a document contract. The v1
validator that did (`theme/validate.ts`, `validateSettingsRange`) **is gone**:
`git ls-files` has no `theme/validate.ts`, and `grep -rn validateSettingsRange
src/web --include=*.ts` hits only the descriptor table's own header comment. So
the ruling's premise is exact — deleting the v1 validator removed the refusal and
moved the ownership nowhere.

Three facts that shape the implementation, each read rather than assumed:

- `bound: "drawnBox" | "halfDrawnBox"` is **not** a number. It says the ceiling is
  the chart's own drawn box, which the envelope cannot know. A descriptor
  carrying `bound` therefore must not become a numeric `max`, and the fields
  whose only ceiling is a bound (`thickness`, `lineWidth`, `markerSize`,
  `barWidth`, `cornerRadius`, `trackCornerRadius`) impose a floor and no ceiling.
- `gauge.min`/`gauge.max` and `bar.min`/`bar.max` carry **no** numeric bound — a
  gauge's range is the author's. `line.min`/`line.max` are optional Y-axis bounds.
  The only numeric bounds on these names are absent, so a range check on either
  half is not the rule; the **pair** is.
- `PieSettings.total` is a union with a `path` (`["total", "value"]`) and a
  `visibleWhen`, so the table reaches one level down. A key-set derivation that
  read `property` alone would treat `total.value` as a top-level key and miss it.

## Rung 2 — dependencies

Searched: `src/web/package.json` (`dependencies` and `devDependencies`),
`packages/editor/package.json`, `docs/engineering/dependencies.md`'s declared
table, `THIRD-PARTY-NOTICES.md`'s index.

Found: **no schema validator and no runtime type library is installed.** The
installed set is `@biomejs/biome`, `@google/design.md`, `@playwright/mcp`,
`@playwright/test`, `canvas`, `jsdom`, `jsqr`, `typescript`, `vite`, `vitest`.
There is no `ajv`, no `zod`, no `valibot`, no `io-ts`, no `typebox`. The only
shipped runtime dependency this package reaches is `fabric` and `echarts` (the
option builders). Adding a validator would be a new shipped dependency for a
check that is four `if`s over a table already in memory — which rung 5 rejects.

## Rung 3 — platform

Searched: JSON Schema as the platform's own validation vocabulary (the repo
already publishes one at `schema/theme-document.schema.json`), and what
JavaScript itself gives for the finiteness half.

Found: **the platform's schema cannot carry this bound, and that is checkable
rather than arguable.** `grep -c settings schema/theme-document.schema.json` is
**0**: a v2 scene is opaque Fabric JSON, so the published schema has no
`settings` property to constrain and no JSON-Schema bound can exist for these
scalars. The schema validates the envelope's *own* fields; the scene is decided
by `fabric-envelope-validate.ts`, which is exactly where this check belongs. What
JavaScript gives is `Number.isFinite` for "a number that is not NaN/Infinity" —
the whole of the type half.

## Rung 4 — ecosystem

Searched: how the tools that own this shape answer it — ECharts' own option
validation, `deck.gl-community`'s descriptor-backed `SettingsManager`,
Chartbuddy's embed validator, Szum's validation contract, and `openalgo-charts`'
persisted `ChartState`. Queries run through the Exa MCP web search; the result
URLs are recorded so the sweep is re-runnable.

- **`echarts` has no option validator at all, and that is the maintainer's
  answer.** Issue `apache/echarts#19046` (open since 2023-08-28) asks for
  `echarts.validateOption`; the reply is *"There is not such checker, I'm
  afraid."* So the renderer Vigilia builds options for cannot refuse a bad
  scalar — it draws it, or warns in a dev build. The refusal has to be ours, at
  the boundary where the document is read.
- **`deck.gl-community`'s `SettingsManager`** (`visgl.github.io/deck.gl-community`)
  is the closest published analogue to *descriptor-backed settings with
  persistence*, and its shape is the **opposite** of this decision: stored values
  are **overlaid onto** a caller-provided snapshot and resolved through the
  descriptor, i.e. it recovers rather than refuses. Same input (a descriptor
  table), opposite contract — worth recording because it is the answer this
  decision declines.
- **Chartbuddy's embed validator** (`chartbuddy.io/embed/docs/.../validation`)
  matches our *issue shape* exactly: `validateChartData()` returns issues with
  `code`, `path`, `expected`, `received`, `severity`, and "errors reject at the
  API boundary". But the bounds come from a **JSON Schema shipped in the
  package** (`@chartbuddy.io/embed/chart-schema.json`), not from the editor's
  descriptor table — its validator and its editor are two readers of one schema
  file, which is a different integration from ours.
- **Szum** (`szum.io/docs/validation`) states the same doctrine we are landing —
  "validate chart semantics before rendering or saving", errors block, JSON
  Pointer paths, stable diagnostic codes — and implements it as a **bespoke
  semantic pass** over its own document type. Nothing is shared with an editor
  descriptor table.
- **`openalgo-charts`' `chart-state.ts`** persists chart-owned state and
  documents that `restoreState` **does not validate**: it restores and reports
  what it saw. This is the status quo `vg-348` measured.

**Plainly: nobody drives document validation from the editor's descriptor
table.** The two closest shapes ship a JSON Schema beside the validator
(Chartbuddy) or hand-write a semantic pass (Szum); the one that shares our
descriptor-table input (deck.gl-community) resolves instead of refusing; and the
renderer we target refuses nothing. There is nothing to reuse, and the useful
finding is the *convergence on the issue shape* (stable code + JSON Pointer path
+ human message) — which our `ValidationIssue` already is.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Read the descriptor table in the envelope validator** | the table already owns each scalar and its `min`; the validator is already the one place a document is refused; no new owner, no new dependency | one pass over the scene that already happens, plus a key-set derivation from `path ?? [property]` | the table's `min`/`max` were authoring bounds; consuming them makes an authoring bound a document contract, so a bound tightened for the inspector can start refusing stored documents | **chosen** — with the binding constraint below |
| Write the bounds into the validator (a second table) | keeps the two bound sets separate, which is what the table's header argues for | a second list of the same numbers, in a second file, keyed by the same property names | **a second owner for one concept** — the exact failure `settings-fields.ts`'s header was written to end, and the two drift silently | rejected |
| Add a JSON Schema for `settings` and an `ajv` dependency | declarative, and the repo already publishes a schema | a new shipped dependency + licence review + `THIRD-PARTY-NOTICES.md`, and a schema that must be kept in step with the table | **two owners again, with a dependency on top**; rung 3 shows the published schema deliberately has no `settings` (opaque Fabric JSON), so this would be a *second* schema for a scene the first declines to describe | rejected |
| Add a runtime type library (`zod`/`valibot`) for the settings bag | expresses the union (`total`) and optionality compactly | a new shipped dependency; the types would be re-declared in the schema DSL, so the table stops being the owner | the descriptor table is the declared owner; a schema DSL beside it is the parallel-list failure with a nicer syntax | rejected |
| Leave it: clamp at render, as pie already does | zero code | zero | **the authored-versus-derived split this repo forbids** — `vg-348`'s ruling, and the reason the row exists | rejected |

## Rung 6 — probe

Measured on this box, 2026-10-21, by building `renderer-core` to `dist`
(`npx tsc -p packages/renderer-core/tsconfig.json`) and calling the real
`validateFabricThemeEnvelope` from Node — not inferred from the source.

**The six cases `vg-348` measured all still read `ok: true` before the change**
(the same six the row lists, reproduced first-hand): `gauge {min:10,max:1}`,
`line {windowSeconds:0}`, `line {maxPoints:-5}`,
`pie {innerRadiusPercent:80,outerRadiusPercent:20}`,
`pie {total:{kind:"fixed",value:null}}`, `settings: ["windowSeconds"]`.

**Eighteen `theme.json` documents exist on disk under the repo** (excluding
`node_modules`). Three carry a chart and read `ok: true` today —
`src/web/.e2e-display-app/themes/vigilia-new-theme/theme.json`,
`src/web/.e2e-host-app/themes/e2e-chart/theme.json` and
`.e2e-host-app/themes/vigilia-demo-dashboard/theme.json`. Four read `ok: false`
today for reasons that have nothing to do with chart settings (`metadata.locale`,
`artboard.barColor`, `backgroundMedia.fit`), so they are the control: the change
must add no chart-settings issue to any of them. The remaining eleven carry no
chart and are unaffected. Every chart settings bag on disk is inside the
descriptor table's own key set and inside every descriptor's range — which is
what the binding constraint below turns into a re-runnable check.

## Decision

**The envelope validator reads `charts/settings-fields.ts`, and the descriptor
table stays the one owner of which scalars exist and what range each has.**

The specific reason is the one `vg-348`'s ruling gives and the table's own header
records the other side of: the two bound sets *do* answer different questions,
and that is exactly why re-deciding the range in the validator is the wrong
repair — it puts a number that is only correct in one place into a second place.
The table already carries `min` for `windowSeconds` (1), `maxPoints` (2),
`lineWidth`/`markerSize`/`thickness`/`barWidth`/`cornerRadius`/`trackCornerRadius`
(0), `innerRadiusPercent`/`outerRadiusPercent`/`categoryGapPercent` (0–100),
`startAngle`/`endAngle`/`padAngle` (−360–360 / 0–360), `gradientSegments` (2–256)
and `total.value` (0). Reading it is one import and one loop; writing it again is
a second owner.

Four rules the implementation settles, and why each is not the obvious reading:

- **`bound` is not a number.** A descriptor carrying `bound` contributes its
  numeric `min` and **no** `max`: the ceiling is the drawn box, which the
  envelope cannot know, and inventing one would refuse a document for a reason
  the loader cannot see.
- **Absent is an authorable state.** `optional: true` and an absent key are
  legitimate — the renderer decides and an explicit value overrides it — so only
  a value that is **present** and out of range is refused.
- **The pair is refused where the pair is complete.** `gauge`/`bar` `min` ≥ `max`
  and pie `innerRadiusPercent` ≥ `outerRadiusPercent` are refused only when both
  halves are present and numeric; a half on its own is not a range. This is the
  same rule the deleted v1 validator held (`gauge`/`bar` `max > min`), read from
  the family's own descriptors rather than restated.
- **The allowed key set is derived, not listed.** A chart's settings keys are
  `(descriptor.path ?? [descriptor.property])[0]` over both tables — which is how
  `total` and `animation` (nested, dotted `property`) stay in the set without the
  validator carrying a list of its own.

**The binding constraint, and it is the whole risk of this change:** a document
that validates today must not become unloadable. Phase 23 states it, and this
decision is the one that could break it, because a key set derived from the table
is only as complete as the table. The mitigation is not a narrower rule but a
measurement: every chart-carrying `theme.json` on disk, and every document the
suite already asserts validates (the starter dashboard, the card library), is
re-validated after the change and must still read `ok: true` — rung 6's sweep
re-run, plus the existing tests that assert the starter and cards validate.

**Two things this decision does not do.** It does not touch
`charts/pie.ts`'s `clampPercent`: that stays as defence for the in-memory path
that never passes through the envelope, and it stops being the *only* thing
between an impossible document and a drawing. And it does not update
`settings-fields.ts`'s header section *"Why the validator does not read this
table"*, which this change makes false — that file is the read owner here and the
correcting sentence is owed to it (see *Verified, and what is not*).

## What implements it

- `renderer-core/src/theme/fabric-envelope-validate.ts` — `chartPaintReferences`
  becomes the one pass that reads a chart's settings, paint and scalars together
  (no second traversal), reading `CHART_SETTINGS_FIELDS` and
  `CHART_PAINT_FIELDS` from `../charts/settings-fields.js`.
- `renderer-core/src/theme/fabric-envelope-validate.test.ts` — the regression
  cases: the six `vg-348` shapes refused, and the in-range and absent shapes
  still accepted.

## Verified, and what is not

- **The refusal**: the six measured shapes read `ok: false` after the change and
  `ok: true` before it, from the same probe (rung 6). The regression test fails
  when the refusal is reverted.
- **The binding constraint**: the on-disk sweep is green on every document that
  was green before, and the four that were already red gain no chart-settings
  issue. The starter dashboard and the card library keep their existing
  `ok: true` assertions.
- **Not done, and owed**: the header section in `charts/settings-fields.ts`
  headed *"Why the validator does not read this table"* is now **false** and was
  left standing, because Task 23.4's brief names that file as read-only. It is a
  contradictory current doc, which `AGENTS.md` says to propagate with the change
  — the correcting edit belongs in the file's owner and is the next writer's.
