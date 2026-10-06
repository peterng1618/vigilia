# 0028 — The descriptor table gains what the surface reads from it, rather than a second table or a form library

- **Date:** 2026-10-06
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/charts/`,
  `src/web/packages/renderer-core/src/theme/`

## The problem

One schema, many surfaces. `renderer-core/src/charts/settings-fields.ts` already
owns *which scalar settings exist* per chart family, and that ownership was won
on purpose: the header records that the question previously had five unrelated
encodings, and that the editor's was "none at all", which is why no chart
setting was editable despite four fully typed and validated families. What the
table cannot say is what a field is **for**. It has no section, so no surface can
group it; `hint` is optional, so "every field carries a hint" is a review habit
rather than a type rule; it addresses only a flat property name, so a setting one
level down cannot be reached at all; and it cannot express an optional block, an
advanced field, or a field that only applies when another has a particular value.

The consequence is measurable, not aesthetic. Two settings below the top level
have no descriptor and therefore no control, so no author can reach them:
`PieSettings.total` (a `{kind:"sum"} | {kind:"fixed",value}` union — `vg-121`)
and the optional `AnimationSettings` block on all four families (`vg-122`).
`NON_SCALAR_SETTINGS` is the allowlist that named them "not editable here, and
why" and thereby made their absence deliberate-looking. The completeness test
that exists enumerates `Object.keys(default*Settings)`, which cannot see an
optional key the defaults never set — so the gap is invisible to the gate whose
job is to catch exactly this.

The non-obvious part is not the missing fields. It is **where the metadata that a
new surface reads belongs** — added to the one owner, or built beside it — and
how much mechanism two nested settings justify.

## Rung 1 — Vigilia

Searched: `renderer-core/src/charts/settings-fields.ts` in full (its header,
`SettingsFieldDescriptor`/`ChartPaintFieldDescriptor`, `CHART_SETTINGS_FIELDS`,
`settingsFieldsFor`, `chartPaintFieldsFor`, `settingsKeyFor`, `NON_SCALAR_SETTINGS`);
its test `settings-fields.test.ts`; every non-test consumer of both accessors
(`rg` over `src/web`); `charts/pie.ts` (`PieTotal`, `PieSettings`),
`charts/animation.ts` (`AnimationSettings`, `defaultAnimationSettings`,
`toEngineAnimation`), `charts/{line,bar}.ts`; `docs/architecture/ownership.md`;
`docs/product/backlog.jsonl` rows `vg-121` / `vg-122`.

Found: **the table already owns the question, and it is the only owner.** It
declares **34 scalar descriptors** across the four families (gauge 7, line 11,
bar 9, pie 7) and 9 paint descriptors. Crucially, the non-test consumer count is
**one** for the settings accessor and **three** for the paint accessor — a
distinction worth stating because the plan says "exactly one non-test consumer":

- `settingsFieldsFor`: `editor/src/chart-manager/panel.ts:204` only.
- `chartPaintFieldsFor`: `editor/src/chart-manager/panel.ts:258`,
  `editor/src/chart-manager/index.ts:36` and `:70`,
  `editor/src/selection-inspector/appearance.ts:68`.

So the paint half is read by three editor modules, but all three are in the
editor and none re-declares the list; the question is still owned once. Nothing
in the repo is a second table, a schema renderer, or a per-surface curation list.

`NON_SCALAR_SETTINGS` lists `animation` for all four families and `total` for pie.
Its doc comment ("Exported so a test can assert this list and the editable list
together account for every property") is the assertion that let `vg-122`
through: the test that used it proved the *union* was accounted for, never that
the excluded keys were reachable. `ownership.md:152` gives "Chart setting
descriptors" the row `renderer-core/src/charts/`, so a second table would be a
second owner for one concept, against the file's own rule.

The header's **"range duplication that is still open"** section records that
`min`/`max` here agree with `validate.ts`'s `validateSettingsRange` "by
inspection, not by construction", and that the validator is not a `switch` — a
fifth family would be range-checked as a pie. That is the third gap the full
plan closes, and it is recorded in the header already rather than rediscovered
here. It does **not** change this decision: the table gains metadata, and the
validator stays a separate invariant owner (the plan decides against driving
validation from descriptor bounds, because authoring bounds and validation
invariants are different things).

`vg-121` and `vg-122` are the fixture-checked evidence for the two holes: the
pie's other ten keys are present, and `animation` has no descriptor on any
family. Both are open in the live register at the time of writing.

## Rung 2 — dependencies

Searched: `src/web/package.json` (`dependencies`, `devDependencies`),
`packages/editor/package.json`, `docs/engineering/dependencies.md`'s declared
table and vendored list, `THIRD-PARTY-NOTICES.md`'s index.

Found: **no form or schema-rendering library is installed, and none is
proposed.** The installed set is `echarts`, `fabric`, `lucide-react`, `fflate`,
`@biomejs/biome`, `vite`, `typescript`, `vitest`, `@playwright/test`, `jsdom`,
`canvas`, `@types/node` at the workspace root, and in the editor `react`/
`react-dom` 19, `@base-ui/react`, `@radix-ui/react-popover`, Tailwind, `clsx`,
`class-variance-authority`, `tailwind-merge`. There is no react-jsonschema-form,
no JSON Forms, no Formik/RHF-schema adapter, no `uiSchema`-style layer of any
kind. The only vendored source is `@anu3ev/fabric-image-editor` (MIT), copied not
installed, for movement-snapping — nothing to do with forms.

The editor's own `package.json` carries a standing note: *"Still no UI framework:
one is worth adding when the inspector surface is real enough to judge the
trade."* React is present for the shell and this plan does not add a framework
anywhere new — which is the point of rejecting a React form renderer below.

## Rung 3 — platform

Searched: the DOM's own disclosure element (`<details>`/`<summary>`), its
`open` attribute and toggle/keyboard behaviour, and `aria-describedby` as the
accessible-description binding.

Found: the platform **gives** the entire disclosure mechanism — expanded/
collapsed state, keyboard activation (Enter/Space on the summary), and the
accessible name taken from the summary's own text — with no JavaScript and no
hand-rolled ARIA. This is why the plan puts `<details>`/`<summary>` in the
section control rather than a button-and-panel pair, and why the count must
render *inside* the summary: the summary is the accessible name, so a section
that said only "4" would be an unnamed region.

What it **leaves to us**: everything about *identity and policy* — that a section
has a stable id, that the five sections are ordered by `SETTINGS_SECTIONS`, that
Position alone starts closed, and how many fields the section holds. The platform
has one disclosure; it has no concept of "this section is not the question this
kind asks", so a kind that has no applicable field must render no `<details>` at
all rather than an empty one. And it does not connect a field to its hint:
`aria-describedby` points at an element we must create and give an id, which is
the same id-uniqueness problem the flat `vigilia-chart-setting-${property}` scheme
already has once a nested property can collide with a top-level one.

## Rung 4 — ecosystem

The searches are the evidence. Four queries were run through the Exa MCP web
search; the result URLs are recorded so the sweep is re-runnable.

**Query 1 — `react-jsonschema-form ui:order ui:group ui:widget UI schema ordering
and grouping fields`.** Read: the RJSF `uiSchema` reference
(`rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema/`), the
Objects usage page (`react-jsonschema-form.readthedocs.io`), and the
StackOverflow question *How to divide object properties into titled groups in
RJSF without modifying schema*. **Found: the shape is the closest of the four and
it is what ours would grow into if it were generalised.** RJSF splits one schema
into a *data* layer and a parallel *UI* layer: order is `ui:order` (an array with
a `"*"` wildcard for the unlisted remainder), widget choice is `ui:widget`, and
grouping is **not a first-class keyword at all** — the accepted answer is to
override `ObjectFieldTemplate` or a theme. Dependent visibility is not in the
`uiSchema` either; it is JSON Schema's `dependencies`/`if-then-else`, which
RJSF documents as applying "regardless of whether the condition's data matches"
(that quote is JSON Forms' wording, but RJSF's behaviour is the same: the schema
hides nothing).

*How its shape compares to ours:* **same idea, opposite conclusion.** RJSF
supports the general nested-tree-plus-UI-layer because it must render arbitrary
JSON Schema; we have one closed table of 34 scalars and would be adopting the
general case to use two fields of it. And its vertical split — `section`/`order`
in one layer, `hint` in yet another — is precisely the split our one-file table
exists to collapse.

**Query 2 — `VS Code settings contribution schema "order" "group"
"enumDescriptions" settings editor grouping`.** Read: `contributes.configuration`
in the VS Code API docs and, as the authoritative source,
`configurationExtensionPoint.ts`. **Found: the closest published analogue to our
exact requirement, and it confirms every metadata key we propose except the
nested one.** A setting carries an integer `order` *relative to its siblings*
(and, tellingly, sorts lexicographically — "not the order in which they are
listed" — when `order` is absent), a `group` for the category, an `enum` +
`enumDescriptions` array so each option carries its own explanation, and a
`tags` vocabulary in which **`advanced` is one tag: "Advanced settings are hidden
by default in the Settings editor unless the user chooses to show advanced
settings"** — the same rule our `advanced?: true` encodes. `scope` is a
per-setting enum with `enumDescriptions`.

*How its shape compares to ours:* **the shape matches, and it validates the
metadata choice rather than contradicting it.** The one thing VS Code does not
have to solve is the nested write: its settings are a flat object of dotted keys,
so a dependent value is a string convention, not a structural path. Our `total`
and `animation` are structural, which is exactly why `path` is ours to invent and
why no VS Code setting corresponds to it. (A toggle that materialised the
optional `animation` block was considered alongside it and rejected — see the
Decision.)

**Query 3 — `Blender RNA property description subtype properties editor tooltip
widget metadata`.** Read: `bpy.types.Property` (the `description` and `subtype`
fields), `RNA_types.h` (`PropertySubType`, `PropertyFlag`, `EnumPropertyItem`),
and `_rna_info.py`'s `GetInfoPropertyRNA`. **Found: a schema-driven property
inspector from a comparable tool, and it is a *flat* model in the same way ours
is.** RNA declares a property with a type, a `subtype` ("semantic interpretation
of the property", e.g. `PROP_ANGLE`, `PROP_PERCENTAGE`, `PROP_COLOR`), a
`description` "for tooltips", `min`/`max`/`soft_min`/`soft_max`, `default`, and a
`PropertyFlag` vocabulary including `PROP_HIDDEN` and — directly relevant — an
`advanced`-style treatment where the UI filters rather than removes. An enum
carries `EnumPropertyItem {identifier, name, description}` — a label *and* a
description per value, the same shape as VS Code's `enum` + `enumDescriptions`.
The Properties editor reads all of it and picks a widget from type+subtype.

*How its shape compares to ours:* **matches on metadata, differs on nesting.**
Blender's pointer/collection properties exist, but they are rendered as
sub-panels by a hand-written draw function, not generated from a descriptor tree
— the closest analogue to what our nested `animation.*` fields and our per-kind
column are doing. So the comparable tool also declines to build a generic nested
descriptor renderer.

**Query 4 — `JSON Schema UI schema conditional field visibility dependencies
if-then show field when another set`.** Read: `json-schema.org`'s
*Conditionals* reference, JSON Forms' advanced UI-schema docs and its community
thread *Required, not visible field are blocking the validation*. **Found:
dependent visibility is universally a *second* concern bolted onto the UI layer,
and the two layers are known to disagree.** JSON Schema's `if`/`then`/`else` and
`dependencies`/`dependentRequired` govern *validation*, never visibility; JSON
Forms states plainly that "JSON Schema validation and visibility are evaluated
separately from each other, therefore the visibility can not influence the
validation", so the standard pattern is a `rule` object on a UI element
(`{effect: "SHOW", condition: {scope, schema}}`) that duplicates the schema's own
condition. The recurring bug — a hidden required field blocking submit — is the
two layers drifting.

*How its shape compares to ours:* **the opposite of what we want.** The ecosystem's
norm is a *general* condition over a whole schema, expressed twice (once for
validation, once for visibility), and it is a known source of drift. Our
`visibleWhen?: { path, equals }` is deliberately the smallest thing that expresses
the one case we have — "show `total.value` when `total.kind === "fixed"`" — living
on the same descriptor as the field it shows, so there is nothing to drift from.

**Plainly: nobody solves this exact shape.** Two of the four (RJSF, JSON Forms)
solve a superset for arbitrary schemas and pay for it with a parallel UI layer
and a duplicated condition; one (VS Code) solves the metadata half on a flat
settings object and has no nested write to solve; one (Blender) solves the
metadata half with a hand-written renderer and declines the generic nested tree.
The vertical split they all have is the thing our one table exists to avoid, and
none of them writes a nested field that materialises its optional parent from
that parent's own defaults. There is nothing to reuse, and the useful
finding is the *convergence on metadata keys* (`section`/`group`/`order`, a
required `description`/`hint`, `advanced` as a tag, per-value descriptions) and
the *divergence on nesting*.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Extend `SettingsFieldDescriptor` in place** | the table already owns the question (`ownership.md:152`), already has the one settings consumer, and is the same file the two holes belong to | five new descriptor fields and no new `SettingsFieldKind` on one interface; the existing consumer keeps working because every addition is additive except `hint` | `hint` becomes required, so every descriptor must gain one — a one-time edit the compiler enforces; `exactOptionalPropertyTypes` means each new field is spelled exactly once | **chosen** |
| **A parallel editor-side table** | could carry `section`/`group` without touching `renderer-core` | a second list of 34 keys, keyed by the same property strings | **a second owner for one concept** — the exact failure the table's header was written to end; the two lists drift and the editor wins silently; violates *one owner per concept* | rejected |
| **A generic nested-descriptor tree** (children arrays, recursive render) | would express `total.value` and `animation.*` without `path`, and any future nesting | recursion in `renderer-core` (must stay Fabric- and DOM-free), a node type distinct from a field, an id-uniqueness scheme for arbitrary depth, and a render walk that must terminate per open section | **the machinery outlives the need**: exactly **two** settings need nesting — `PieSettings.total` (pie only) and the optional `AnimationSettings` block (four families, one shape). General recursion for two cases is a framework where a `path` array does the job | rejected — `path` + `visibleWhen` |
| **Adopt a form/schema-rendering library** (RJSF, JSON Forms, or a React renderer) | it already has grouping, order, widgets and conditional visibility — rung 4 confirms the vocabulary | a new shipped dependency + its transitive graph, a licence review, a UI-schema file beside the data, and rewriting the panel body as components | **puts a framework boundary where the repo has none**: `chart-manager/panel.ts` builds 24 `document.createElement` calls and imports no React; the panel body is imperative DOM by design, and the RJSF/JSON Forms model *is* the parallel UI layer this decision rejects, plus the duplicated condition rung 4 shows drifting | rejected |

## Rung 6 — probe

What this repo can actually measure, and what it cannot.

- **The consumer count is a measurement, not an assertion.** `rg` over `src/web`
  for `settingsFieldsFor` / `chartPaintFieldsFor` / `CHART_SETTINGS_FIELDS` /
  `CHART_PAINT_FIELDS` returns: one non-test consumer of the settings accessor
  (`panel.ts:204`) and three of the paint accessor (`panel.ts:258`,
  `chart-manager/index.ts:36,70`, `selection-inspector/appearance.ts:68`). This is
  why a parallel table would be *one more reader of one concept*, not a clean
  second owner — the paint half already has more than one reader and still no
  second list.
- **The two holes are countable.** The table declares 34 scalar descriptors; the
  settings types declare two keys with no descriptor reachable from it —
  `PieSettings.total` and `animation` — the latter on all four families.
- **The panel body is imperative DOM, measurably.** `chart-manager/panel.ts`
  contains 24 `document.createElement` occurrences and no React import, and
  `chart-manager/` holds no `.tsx` file (`panel.ts`, `index.ts`, two `.dom.test.ts`).
  A React renderer would therefore introduce a boundary, not extend one.
- **The gate's own answer is probeable, and was probed** — see the note in the
  plan's Task 1 report; the outcome is not asserted here.
- **Cannot be probed here:** that a section's `<details>`/`<summary>` is
  keyboard-reachable and that a closed section still announces its count are
  claims about rendered behaviour. They need a jsdom/browser test in the tasks
  that build the control, not a decision note. Rung 3 states what the platform
  *provides*; it does not claim the control uses it correctly yet. Likewise the
  claim that "descriptor `min`/`max` are authoring bounds and the validator's are
  invariants" cannot be settled by inspection alone — it is asserted from the
  header and the validator's shape, not measured, and the plan defers the
  equivalence question rather than probing it.

## Decision

**Extend `SettingsFieldDescriptor` and `ChartPaintFieldDescriptor` in place.**

The table already owns the question, `ownership.md` already gives it the row, and
it is the file the two unreachable settings live in. `settingsFieldsFor` and
`chartPaintFieldsFor` keep their signatures and their order, so
`chart-manager/panel.ts` keeps working unchanged while the metadata is added
around it.

The descriptor interfaces gain, precisely — the first three on both the settings
and the paint descriptor; `path` and `visibleWhen` on the settings descriptor,
where a nested write exists:

- **`section: SettingsSection`** (required) — `"content" | "position" | "layer" |
  "paint" | "spends"`, the ordered vocabulary whose one owner is
  `SETTINGS_SECTIONS`. A chart's own settings answer Content; paint answers
  Paint; an animation block answers Layer.
- **`hint: string`** (required) — "every field carries a hint" becomes a **type
  rule**: a descriptor without one does not compile. It says what the setting
  *does*, in the author's language, not what it is called.
- **`advanced?: true`** — present or absent, never `false`, so a descriptor
  cannot come to carry a negative that means nothing. The collapsed-and-counted
  treatment matches VS Code's `advanced` tag.
- **`path?: readonly string[]`** — the write target inside the settings object,
  defaulting to `[property]`. This is the smallest thing that reaches
  `total.value` and `animation.durationMs`; a generic nested tree is rejected
  because only two settings need it.
- **`visibleWhen?: { readonly path: readonly string[]; readonly equals: string }`**
  — the one dependent-visibility case we have, on the descriptor it qualifies, so
  it cannot drift from the validation layer the way rung 4 shows the ecosystem's
  duplicated conditions do.

`SettingsFieldKind` is **unchanged**: the four nested `animation.*` descriptors
are ordinary `number`/`select` fields, and the first write to one materialises
their parent from `defaultAnimationSettings` — the owner that already declares
those defaults, so the table still declares none.

**Why no animation toggle.** An on/off control that materialised the
`AnimationSettings` block, and a field kind to express it, were considered and
rejected: `toEngineAnimation(settings, animate)` takes `animate` as a parameter
that defaults to `true` at all four call sites, so an **absent** `animation`
block means *the defaults apply*, not *this chart is static*. The flag that
decides whether a chart animates at all comes from the build, not from the
settings object — so a toggle would be a capability nobody filed, and it would
give the editor an on/off distinction the renderer does not read.

**Why not the generic nested tree.** Exactly **two** settings need nesting:
`PieSettings.total` (a union, pie only) and the optional `AnimationSettings`
block (four families, one shape). A recursive node type, a render walk and an
id-uniqueness scheme at arbitrary depth are machinery that would outlive the two
fields that motivated it, in a package that must stay Fabric- and DOM-free.

**Why not a form library.** The panel body is imperative DOM by design — 24
`createElement` calls and no React — and, as rung 4 shows, the form libraries'
model *is* the parallel UI layer and the duplicated visibility condition this
decision rejects. A React renderer would put a framework boundary where the repo
has none, to render 34 scalars.

The cost of being wrong: `hint` becoming required is a compile error on every
descriptor until all 34 gain one, which is the intended shape — the compiler, not
a reviewer, is what enforces it. And the ecosystem has **not** solved this
exact shape: the two libraries that come closest (RJSF, JSON Forms) solve a
superset for arbitrary schemas and pay with a second UI layer, and the two
inspectors (VS Code, Blender) solve the metadata half on flat data and hand-roll
the nesting. So the metadata keys are conventional and the nested mechanism is
ours — which is a reason to keep `path`/`visibleWhen` minimal and let
the implementation tasks grow them only if a third nested setting appears.
