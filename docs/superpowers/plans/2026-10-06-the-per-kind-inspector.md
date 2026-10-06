# The per-kind inspector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The right column answers the question the selected thing actually raises — a card
answers *which sensor*, a shape answers its own questions — and every authorable setting of
that thing has a control, ordered and grouped rather than trimmed.

**Architecture:** The descriptor table in `renderer-core/src/charts/settings-fields.ts`
stays the one owner of "which settings exist", and grows the metadata the surface needs
(`section`, a required `hint`, `advanced`, and a nested write path).
The editor gains two shared controls — a disclosure section and a descriptor-driven field —
and the inspector column is rebuilt from them as a per-kind plan, so the column's shape is
data the tests can read rather than a render function nobody can enumerate.

**Tech Stack:** TypeScript, Fabric 7.4.0, React 19 (shell only; the panel body stays
imperative DOM), Base UI, Vitest + jsdom, Playwright.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 3 of 9. Read §4 *The right column describes what the thing is*, §*Convenience is not
a smaller surface* (and the measured audit inside it), and §*The case that proves it* to its
end. The last of those is a test, not a mood: *does this change remove a step, or does it
remove a freedom?*

## Global Constraints

- **Convenience is ordering and grouping. Removal is not.** Every authorable setting is
  present, none locked to a default, none hidden. The obscure ones are collapsed and
  counted, and the count is visible.
- **`hint` becomes required on a descriptor.** "Every field carries a hint" is a type rule
  here, not a review item — a descriptor without one does not compile.
- **The completeness check is a test.** A key in a settings type with no descriptor fails a
  gate. `NON_SCALAR_SETTINGS` is an escape hatch and it is what hid `vg-122`; it does not
  survive this plan.
- **One owner per concept.** The descriptor table and its accessors stay in
  `renderer-core/src/charts/`; no second table in the editor, and no per-surface curation of
  which settings exist.
- **The section vocabulary is one list:** `content · position · layer · paint · spends`,
  in that order, each answering one question. `Position` and `Layer` are separate because
  moving a thing and scaling it are different mistakes.
- **A property an object's kind does not have is not shown.** That is a statement about
  which questions apply, not about which objects may exist.
- **Nothing here makes a thing impossible** — not a section, not a collapse, not a kind.
- Fabric stays imperative behind the editor boundary; React never mirrors an object. The
  panel body keeps building DOM imperatively, as it does today.
- **`renderer-core` stays Fabric- and DOM-free.** A descriptor is data plus, at most, an
  equality predicate. No element, no canvas object.
- **Persist authored state only.** Which sections are open, and which object was selected,
  are transient (§67). They never enter the document and never grow history.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse invalid numeric
  input rather than coercing it to zero. 500 lines is a signal and 800 a stop:
  **`selection-inspector/runs.ts` is already 817 and must not grow**, and
  `selection-inspector/index.ts` is 655, so this plan's structure lands in new modules and
  `index.ts` shrinks or holds.
- **Two watchlisted paths are touched** — `renderer-core/src/charts/` and
  `renderer-core/src/theme/`. `scripts/reuse-gate.mjs` refuses the first write until a
  decision note claims them. Task 1 is that note, and it is first for that reason.
- **Verify `npm run typecheck` by exit code**, never by reading for the word "error".
  **Verify lint and format with `./node_modules/.bin/biome lint ..` / `format ..`**;
  `npm run lint` exits 1 on this box for a PATH reason.
- **`npm run test:e2e` runs with `--workers=1`.** Another session shares this machine and its
  Playwright MCP browser — never use that browser; launch Chromium directly with
  `ignoreDefaultArgs: ["--hide-scrollbars"]`. **A single sample of a flaky spec is not a
  measurement:** re-run it against a previous sample of the same commit before reporting.
- Stage explicit paths; never `git add -A`. No licence headers. Conventional Commits.
  `npm run status:check` from `src/web/` before any commit that touches `STATUS.md`.

## Review Focus

The spec implies these and no step below exercises them by name. Each is pinned by a test in
the task named.

1. **A setting whose control exists but writes where the renderer never reads.** The gate
   this plan adds proves a key has a *descriptor*; it cannot prove the descriptor's write
   path is the one the renderer reads. A field that satisfies the completeness test and
   changes nothing on the canvas is the same unreachability defect wearing a control.
   Pinned in Task 3.
2. **Collapsing geometry by default breaks every helper and spec that drives a hidden
   geometry input**, and the tempting repair is to stop collapsing — which would drop the
   spec's own rule. Pinned in Task 7 by opening the section in the shared driver and
   asserting, in a spec, that a fresh selection has it closed.
3. **A nested write committed as `{...settings, [property]: value}`.** The two holes this
   plan closes both live one level down; a flat spread writes a key the validator accepts
   and the renderer ignores, so the author's choice survives the click and dies on reopen.
   Pinned in Task 3.
4. **Retiring the Data tab while something still routes the author to it** — the shell's
   "Chart settings are under Data." hint, a doc, or a spec — leaves a panel naming a place
   that no longer exists. Pinned in Task 9 by asserting the string is gone.
5. **A kind nobody considered.** A `Wedge`, an image, an `ActiveSelection` spanning two
   kinds, a locked object: any of them silently loses the fields it used to have, which is
   the original defect with a new cause. Pinned in Task 8 by a test that enumerates every
   kind the editor can select and fails on an empty column.

---

## Phase 1 — The descriptor contract

The table already claims "every scalar setting, per family" and mostly is. It cannot say
what a field is *for*, and two settings below its top level are unreachable. Phase 1 makes
the table say both, and makes the gap between a settings type and the table a red gate
rather than a review habit.

### Task 1: The decision note that unblocks the descriptor paths

**Files:**
- Create: `docs/decisions/0028-the-descriptor-table-gains-the-metadata-the-surface-reads.md`

**Constraint:** `AGENTS.md`'s *Reuse before build* rule requires this note before the first
write to a mechanism boundary, and both paths this plan touches are on the watchlist.

**Measured while doing it, and it changes what "evidence" means here:** the reuse gate did
**not** refuse anything, because earlier notes already claim the same directories —
`0005-chart-glow-is-skipped-pending-an-artboard-unit.md` claims
`renderer-core/src/charts/`, and `0022`/`0023` claim `renderer-core/src/theme/`. The gate
answers *has any note ever claimed this path*, not *is this change argued for*, so a
refusal-then-permission pair cannot be produced for either path. Filed as `vg-144`; the note
is written because the rule requires it, not because a hook was going to stop the work.

**What the note must establish, at the rungs `docs/decisions/README.md` sets out:**

- Rung 1 — Vigilia: the table is `renderer-core/src/charts/settings-fields.ts`, its header
  records the range duplication, and `NON_SCALAR_SETTINGS` is the allowlist that let two
  holes through. Cite `vg-121`, `vg-122` and `ownership.md`'s *Chart setting descriptors*
  row.
- Rung 2 — dependencies: `docs/engineering/dependencies.md`; no form library is installed
  and none is proposed.
- Rung 3 — platform: `<details>`/`<summary>` for the disclosure, a native element rather
  than a library or hand-rolled ARIA.
- Rung 4 — **the rung that gets skipped, so record the queries.** Search for how others
  solve "one schema, many surfaces, grouped and ordered fields with dependent visibility":
  JSON Schema + a UI-schema layer (react-jsonschema-form's `ui:order`/`ui:group`), VS Code's
  settings schema (`order`, `group`, `enumDescriptions`), and a schema-driven property
  inspector from a comparable editor (Blender's RNA `description`/`subtype`, KiCad or
  Godot's inspector). **Say what was searched, what was found, and for each whether its
  shape matches ours** — a list of libraries without the queries is not evidence.
- Rung 5 — comparison table: extend the existing table; a parallel editor-side table; a
  generic nested-descriptor tree; adopt a form library.
- Rung 6 — probe: which of these the repo can actually verify. If a claim cannot be probed
  in this repo, say so rather than asserting it.
- **Decision:** extend `SettingsFieldDescriptor` in place — the table already owns the
  question, `settingsFieldsFor` already has exactly one non-test consumer
  (`chart-manager/panel.ts:204`) and `chartPaintFieldsFor` has three, and a parallel
  editor-side table would be a second owner for one concept. Record why the generic nested tree was rejected (two
  settings need nesting; the machinery would outlive the need) and why no form library was
  adopted (the panel body is imperative DOM by design, and a React renderer would put a
  framework boundary where the repo has none).

**Verification:** the note parses with the gate's own regex and claims both paths —
`printf '{"tool_input":{"file_path":"<path>"}}' | node scripts/reuse-gate.mjs` exits 0 for
each of them. Record in the note's report that the gate was already satisfied before the
note existed, so the next reader does not mistake the exit code for the argument.

**Commit:** `docs(decisions): the descriptor table gains what the surface reads from it`

### Task 2: Every descriptor says which question it answers, and what it means

**Files:**
- Modify: `src/web/packages/renderer-core/src/charts/settings-fields.ts`
- Test: `src/web/packages/renderer-core/src/charts/settings-fields.test.ts`

**Interfaces:**
- Produces: `SettingsSection = "content" | "position" | "layer" | "paint" | "spends"`;
  `SETTINGS_SECTIONS`, the ordered list with each section's author-facing label — the one
  place section order is decided.
- Produces: on `SettingsFieldDescriptor` — a required `section: SettingsSection`, a required
  `hint: string`, and an optional `advanced?: true`.
- Produces: the same three on `ChartPaintFieldDescriptor`.
- Keeps: `settingsFieldsFor(family)` and `chartPaintFieldsFor(family)` returning the same
  shape in the same order, so `chart-manager/panel.ts` keeps working unchanged.

**Constraints:** A chart's own settings all answer **Content** — they are what the chart
shows; the paint descriptors answer **Paint**; an animation block answers **Layer**. Do not
invent a fifth taxonomy for charts. Order within a family is the likelihood order, and it is
the array order: the table is already written that way, so preserve it rather than
re-sorting. A hint is in the author's language and says what the setting does, not what it
is called — *that* is what makes a long list navigable.

**Failure modes to design against:** a `hint` that restates the label; a section assignment
made by which struct declares the field rather than by the question it answers; a new
required field that quietly changes the array's runtime identity for a consumer holding a
reference.

**Verification:**
- Unit: every descriptor in every family has a section, and every section used is one of
  `SETTINGS_SECTIONS`.
- Unit: **every descriptor has a non-empty hint, and no hint equals its own label.**
  **This is a degenerate guard and the plan will not pretend otherwise** — measured on
  `b5046f2`, a hint that restates its label in other words ("The angle the arc starts at."
  for "Start angle") passes it. Whether a hint *adds information* is not mechanically
  decidable, so the strong half of the rule stays a review judgement and the test catches
  only the copy-paste case. An earlier draft of this plan called it "the assertion that makes
  restating a failure rather than a taste"; that was false and the independent review said so.
- Unit: **at least one descriptor is marked `advanced`, per family that has one — and it is
  not an animation field.** The spec's "obscure ones at the end, in a collapsed section" had
  zero members at `b5046f2`, which makes the rule untested and the treatment unreachable. As
  first written this assertion was **vacuous**: Task 3 marked `animation.appearMs` and
  `appearEasing`, so "at least one" already held at `378e0f64` and the test would have passed
  before a single mark was added. The shipped form excludes the animation block, and is red
  before the marks. The four families' obscure settings are: gauge `gradientSegments`; line
  `sampling` and `maxPoints`; bar `trackCornerRadius` and `categoryGapPercent`; pie
  `padAngle`, `cornerRadius` and the `startAngle`/`endAngle` pair. **The list is a judgement,
  not a measurement** — an author who disagrees moves a field, and nothing but the list
  changes.
- Unit: the descriptor order within each family is unchanged from before this task, pinned
  against the order as it is today rather than against a list re-derived from the new code.
- Unit: a section not in `SETTINGS_SECTIONS` fails to typecheck (this is a compile-time
  claim; assert it by construction, not at runtime).
- Unit: `ChartPaintFieldDescriptor.section` is the **literal** `"paint"`, not the five-way
  union — the Paint rule should be a type, not a runtime convention.

**Commit:** `feat(charts): every setting says which question it answers, and what it means`

### Task 3: The two settings one level down become reachable

**Files:**
- Modify: `src/web/packages/renderer-core/src/charts/settings-fields.ts`
- Create: `src/web/packages/renderer-core/src/charts/settings-path.ts`
- Test: `src/web/packages/renderer-core/src/charts/settings-path.test.ts`,
  `src/web/packages/renderer-core/src/charts/settings-fields.test.ts`

**Interfaces:**
- Produces: on `SettingsFieldDescriptor` — `path?: readonly string[]` (the write target
  inside the settings object; defaults to `[property]`) and
  `visibleWhen?: { readonly path: readonly string[]; readonly equals: string }`.
- Produces in `settings-path.ts`: `readSetting(settings, path)` and
  `writeSetting(settings, path, value)`, returning a new settings object and never mutating
  the argument.
- Produces: pie descriptors for `total` (a `select` over `sum | fixed`) and `total.value`
  (a `number` with `path: ["total","value"]`, `visibleWhen` `total.kind === "fixed"`), for
  **every** family; and four `animation` descriptors — `animation.durationMs`,
  `animation.easing`, `animation.appearMs`, `animation.appearEasing` — for **every** family,
  the two `appear*` fields marked `advanced`.
- Closes: `vg-121`, `vg-122`.

**Constraints:** `writeSetting` writes the shape the renderer already reads. `PieTotal` is a
union, so writing `total.kind = "sum"` **drops** `total.value` rather than leaving a sibling
the union does not have; the validator accepts either today, which is exactly why this needs
a test rather than care. `AnimationSettings` is a **required whole object**, so
`writeSetting` materialises an absent parent from the block's own owner —
`defaultAnimationSettings`, the object `toEngineAnimation` already falls back to — and then
applies the one field. `readSetting` on an absent parent returns `undefined`, never a
fabricated default.

**Do not invent an on/off animation toggle.** `toEngineAnimation(settings, animate)`
defaults `animate` to true (`pie.ts:166` and its three siblings), so an absent `animation`
block means *the defaults apply*, not *this chart is static*; the flag that decides whether a
chart animates at all is supplied by the build, not by the settings object. A presence
toggle would be a capability nobody filed, and the descriptor table is not where new
capabilities are invented.

**Failure modes to design against:** the flat-spread commit of Review Focus 3 — the two
blocks this task writes into are one level down, so `{...settings, animation: value}` writes
a shape the renderer ignores while the validator shrugs; a `visibleWhen` that hides
`total.value` while the property is set, so the author cannot see what they authored; a
partial `AnimationSettings` written because only one of its four fields was materialised;
`total.value` accepted while `total.kind` is `sum`.

**Verification:**
- Unit: **`computeComposition` shows a remainder only after the author's `total` choice
  reaches the settings the renderer reads** — set a fixed total through `writeSetting`, run
  the real composition, and assert `remainder` is the fixed total minus the known total.
  This is Review Focus 1: a descriptor that exists and writes nowhere fails here.
- Unit: writing `total.kind = "sum"` leaves no `value` key; writing it back to `fixed`
  without a new value leaves the field absent rather than zero.
- Unit: writing one animation field onto settings with **no** `animation` key produces a
  complete `AnimationSettings` — the author's field plus `defaultAnimationSettings` for the
  other three — and the existing "declares no default values" test still passes, because the
  defaults come from their owner and not from the table.
- Unit: the animation descriptors the renderer's option builders read resolve to what
  `writeSetting` wrote — a round-trip through the real option builder, not a restatement.
- Unit: `readSetting` on a path whose parent is absent returns `undefined` and does not
  throw, including for a path two levels deep.
- Unit: the descriptors for `total` and `total.value` resolve, through `readSetting`, to the
  same values the validator accepts.

**Commit:** `feat(charts): a pie can be given a total, and a chart can be animated`

### Task 4: The gap between a settings type and the table is a red gate

**Files:**
- Modify: `src/web/packages/renderer-core/src/charts/settings-fields.ts` (delete
  `NON_SCALAR_SETTINGS`)
- Modify: `src/web/packages/renderer-core/src/charts/settings-fields.test.ts`
- Modify: `src/web/packages/renderer-core/src/theme/validate.ts`
- Modify: `src/web/packages/renderer-core/src/index.ts` (drop the removed export)
- Test: `src/web/packages/renderer-core/src/theme/validate.test.ts` (checked, **not edited** —
  `validateSettingsRange`'s control cases pass unmodified, because the `never` default is a
  compile-time claim and `CHART_FAMILIES` cannot produce a fifth value at runtime)

**Interfaces:**
- Produces: one coverage record per family, typed
  `Record<keyof GaugeSettings, "setting" | "paint">` (and line, bar, pie), plus
  `Record<keyof AnimationSettings, "setting">` — **the type is the gate**: a key added to a
  settings interface and not classified here fails to compile, and a key classified that the
  interface does not have fails to compile too.
- Produces: a runtime test asserting every key classified `"setting"` resolves to a
  descriptor — through its `path` prefix for a nested key — and every key classified
  `"paint"` resolves to a paint descriptor, **in both directions**.
- Removes: `NON_SCALAR_SETTINGS`, the allowlist whose comment "excludes only paint and
  animation, and says so" was the assertion that let `vg-122` through.

**Constraints:** the current coverage test enumerates `Object.keys(default*Settings)`, which
cannot see an optional key the defaults do not set — that is the blind spot, and the typed
record replaces it rather than supplementing it. The `validate.ts` change is **narrow**:
`validateSettingsRange` becomes an exhaustive `switch (family)` with a `never` default, so a
fifth family cannot fall through to the pie block. **Do not make validation consume the
descriptor bounds in this plan** — descriptor `min`/`max` are authoring bounds and the
validator's are invariants the adapter cannot recover from; conflating them would start
rejecting documents that validate today. Record that finding in the `settings-fields.ts`
header, replacing the "driving it from this table is the next step" claim, which this plan
resolves by deciding against it and saying why.

**Failure modes to design against:** a coverage record that classifies a key and never
asserts anything (the compile-time half looks done while the runtime half is missing);
deleting `NON_SCALAR_SETTINGS` and leaving a stale import; the `never` default being
satisfied by an `any` cast somewhere upstream, which would make the exhaustiveness check
decorative.

**Verification:**
- Unit: **remove the `total` descriptors and the suite fails; remove the animation
  descriptors and the suite fails.** Run both, show both, restore. A gate that has never
  been red is not evidence.
- Unit: every family's defaults satisfy the coverage record; every key the record classifies
  has a descriptor; `settingsFieldsFor(family)` returns no key outside the record.
- Unit: `validateSettingsRange` rejects the same documents it rejected before this task —
  the existing cases are the control, not a new expectation.
- Unit: a synthetic fifth family reaches the `never` branch at compile time rather than at
  runtime in a pie-shaped block (assert by construction; the compiler is the test).

**Commit:** `test(charts): a setting with no descriptor is a failing gate`

---

## Phase 2 — The column

The table can now say what exists, which question it answers, and what it means. Phase 2
spends that on the surface: two shared controls, then the column they compose, then the
per-kind plan that decides which of them a given selection sees.

### Task 5: A section is a native disclosure, ordered by its own list

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/controls/property-section.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Test: `src/web/packages/editor/src/editor-shell/controls/controls.dom.test.ts` (extend
  the existing control suite rather than adding a fourth file beside it)

**Interfaces:**
- Produces: `propertySection(options: PropertySectionOptions): PropertySection`, where the
  options carry `{ id, title, body: readonly HTMLElement[], defaultOpen: boolean }` and the
  handle carries `{ root: HTMLElement, isOpen(): boolean, open(): void, setBody(next): void }`.
  **There is no `count` option** — see the correction below.
- Produces: a stable hook for tests and specs — `data-vigilia-section="<id>"` on the
  `<section>`, and the disclosure's own `open` state readable from the DOM.

**Corrections from the independent review of `a4028d55`/`29fa4e4c`** — three, all measured:

1. **The count had two rules and they disagreed.** Construction honoured a caller-supplied
   `count` that could differ from the body; `setBody` rewrote it to the body's length. A
   header could therefore still claim more than it held, which is the defect the follow-up
   commit set out to kill, half-killed. **One rule: the count is the body's length,
   always** — so the option goes, and a section's header cannot lie by construction.
2. **`aria-labelledby` on the summary removed the count from the accessible name**, which is
   the opposite of "collapsed is not hidden": a disclosure announced as "Paint" rather than
   "Paint, 3". Name-from-content already yields both. Drop the attribute and the generated
   `id`, and keep the title and the count separated so the name is not "Paint3".
   *(Reasoned from the mechanism — jsdom computes no accessible name, so no test here can
   settle it; say so rather than claiming it was measured.)*
3. **The keyboard test's name did not match what it asserted.** It focuses the summary and
   then calls `.click()`, which proves focusability and click-toggling; jsdom implements no
   keyboard activation for `<summary>` at all. Rename it to what it measures.

**Constraints:** **`<details>`/`<summary>`, not a hand-rolled button and panel.** The
disclosure's expanded state and the accessible name are the platform's job; this control's
job is the section's identity, its order and its count. A `hint`-style tooltip on a section
header is not needed. `defaultOpen` is the only per-section policy, and it is supplied by the
caller — this control knows no section semantics. The count renders inside the summary so a
**collapsed** section still says how much is in it: collapsed is not hidden.

**Failure modes to design against:** a body that is removed from the DOM when closed (which
would make a subsequent `replaceChildren` from a re-render silently drop fields); a section
that renders empty and still shows a header with a count of zero.

**Verification:**
- Unit: a closed section's summary contains its count and its title, and the body is
  reachable after opening — asserted through the real control, not by reading attributes.
- Unit: **the summary is focusable and toggles** — which is what a jsdom test can measure,
  since the platform does keyboard activation for `<summary>` and jsdom implements none.
  Name the test for that, not for keyboard activation.
- Unit: `setBody` replaces the body, keeps the count equal to the body's length, and leaves
  the open state untouched; an emptied body removes the section and a later non-empty
  `setBody` rebuilds it at `defaultOpen`.
- Unit: a section with no body renders nothing at all rather than an empty header.

**Commit:** `feat(editor): a section is a disclosure that says how much it holds`

### Task 6: One control renders a descriptor

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/controls/settings-field.ts`
- Modify: `src/web/packages/editor/src/chart-manager/panel.ts` (the settings loop at
  `:204-257` renders through the new control)
- Test: `src/web/packages/editor/src/editor-shell/controls/controls.dom.test.ts`,
  `src/web/packages/editor/src/chart-manager/index.dom.test.ts`

**Interfaces:**
- Produces: `settingsField(descriptor, options): HTMLElement`, where the options carry
  `{ value: unknown, onChange(next: unknown): void, disabledReason?: string }`.
- Produces: the same id and dataset the chart panel uses today —
  `id = vigilia-chart-setting-${descriptor.property}`,
  `dataset["vigiliaChartSetting"] = descriptor.property` — so existing specs and
  screenshots address the same controls they address now.
- **Consumes, in the caller rather than the control:** `readSetting`/`writeSetting` from
  Task 3, and an exported `isSettingVisible(descriptor, settings)` for `visibleWhen`. An
  earlier draft said the control consumes the settings object; it cannot — its options carry
  a value and a callback, and nothing else. Making the panel evaluate visibility also makes
  "renders nothing" observable where the other fields are, which is where a test can see it.
- Consumes: `tooltip` (`editor-shell/controls/tooltip.ts`) for the hint.

**Constraints:** the hint is presented **twice on purpose**: as a tooltip for a pointer and
as an `aria-describedby` description for a screen reader, matching the pattern
`artboard-panel.ts` already uses. A disabled field renders its reason through the same
`aria-disabled` + tooltip idiom `glass.ts` uses — a control that refuses without saying why
is the defect that idiom was written for. A `visibleWhen`
descriptor that does not match renders nothing — it is genuinely not a question for this
state, unlike a disabled field, which is a question being refused.

**Failure modes to design against:** a number field that coerces an empty string to `0`
(the repo's rule is to refuse, and `numberField` already implements the refusal — reuse it
rather than re-deriving the parse); a hint rendered as a `title` attribute only, which no
keyboard-only author reaches; an id collision between a nested property and a top-level one.

**An optional setting must be un-settable, and today it is not.** Six hints landed at
`b5046f2` promising the *absent* state — `min`/`max` ("empty lets the data choose it"),
`barWidth` ("empty sizes it to the category"), `trackCornerRadius` ("empty leaves it
square"), pie `endAngle` ("empty closes it into a full circle") — and no control can reach
it: the panel writes `Number("")` = `0`, and the repo's rule would refuse the empty input
instead. **Absent means the renderer decides; an explicit value overrides it.** That is a
real authorable state, and the spec's rule that nothing is locked to a default cuts both
ways. So: descriptors for optional settings carry `optional?: true`, and clearing one of
those fields **removes the key** rather than refusing. A non-optional setting still refuses,
because an empty required number is not a state the renderer can read.

**Ordering note.** This task runs **before** Task 4, out of numeric order, because `84b11f51`
left the Data tab rendering five new controls per chart through the panel's flat
`{...settings, [property]: value}` commit — picking "A fixed total" writes `total: "fixed"`
and an animation edit writes a literal `"animation.durationMs"` key. The plan always owned
the fix here; the review of Task 3 is what set the order. Task 4 does not depend on this one.

**Verification:**
- Unit: each kind renders the control the platform provides — `number` an `<input
  type="number">` carrying min/max/step, `boolean` a checkbox, `select` a `<select>` with its
  options in descriptor order.
- Unit: **clearing a non-optional number field leaves the setting unchanged and reports it**,
  rather than writing `0`.
- Unit: **clearing an `optional` field removes the key**, and the value the renderer then
  reads is its own fallback — asserted through the option builder, not from the settings
  object.
- Unit: **a nested descriptor commits through `writeSetting`** — set `total.kind` to `fixed`
  and `animation.durationMs` through the control and assert the settings object the panel
  hands on is a legal `PieSettings`/`LineSettings` (a string where a union belongs, or a
  literal `"animation.durationMs"` key, fails this and passes a naive assertion).
- Unit: a field's hint reaches the DOM as an `aria-describedby` target and the description
  text is the descriptor's hint.
- Unit: a disabled field's tooltip text is the `disabledReason`, and the control is
  `aria-disabled`.
- Unit: the chart panel's controls keep their existing ids and datasets after the refactor —
  the existing chart-panel tests are the control and must pass unmodified except where the
  section structure moved them.

**Commit:** `refactor(editor): one control renders a chart setting descriptor`

### Task 7: The column is five questions, and geometry is the one that starts closed

**Files:**
- Create: `src/web/packages/editor/src/selection-inspector/per-kind-column.ts`
- Modify: `src/web/packages/editor/src/selection-inspector/index.ts` (render delegates the
  surface; `target()`, the write funnel and the commit path are untouched)
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Test: `src/web/packages/editor/src/selection-inspector/index.dom.test.ts`,
  `src/web/packages/editor/src/selection-inspector/panel.dom.test.ts`

**Interfaces:**
- Produces: `perKindColumn(target, context): readonly ColumnSection[]`, where a
  `ColumnSection` is `{ section: SettingsSection | "advanced", root: HTMLElement,
  defaultOpen: boolean, count?: number }` — the plan as data, so a test can enumerate it
  without rendering.
- Consumes: everything the inspector already builds — `createNameField`,
  `createOpacityField`, `createPanelFields`, `createGlassFields`, `createCropRow`,
  `createBleedField`, `createRunEditor`, `createResolutionLine`, `createTypePresetReveal`,
  and the geometry pair/rotation controls.
- Consumes: `propertySection` from Task 5.
- Produces: with nothing selected the selection column renders **one line naming where to
  choose from** — reusing `uiCopy.inspectorFields.nothingSelected`, which exists and is
  unused today — rather than an empty root.

**Constraints:** the five sections appear in the spec's order and a section with nothing in
it does not render. **Position is closed by default and every other section is open** — the
spec's rule is that geometry is adjusted once while the binding is chosen constantly, so
`defaultOpen: false` belongs to Position alone, including for a shape. The locked-object
policy is preserved exactly as it is: **only the fields that write the object are withheld**,
and the read-only sections still render. `index.ts` holds or shrinks; the plan lives in the
new module.

**Failure modes to design against:** Review Focus 2 — every existing geometry helper now
drives a hidden input; the fix is in the shared driver (`tests/e2e/rebuild-driver.ts`'s
`place()` and the geometry readers in `editor.spec.ts`), **not** in the default; a section
that renders a field the object's kind cannot use (that is Task 8's gate, but the mapping is
built here, so build it as data); a re-render that resets an open section back to its
default and moves the field the author was typing into.

**Verification:**
- Unit: **a fresh selection renders Position closed and the other four open**, and the
  closed section's summary names its count.
- Unit: **re-rendering the column does not change which sections are open** — the state is
  the section's own, not rebuilt from the default each pass.
- Unit: the existing field-level assertions still pass for the kinds they covered before,
  with the fields found inside their section rather than at the column root.
- Unit: the locked note still prints and the withheld set is unchanged — the existing test
  that names "withholds only the fields that write the object" is the control.
- Unit: a section with no applicable field renders no header at all.
- Browser: on the starter, selecting a card shows the sections in the spec's order with
  Position closed, and opening Position reveals the same X/Y/W/H pair as before.

**Commit:** `feat(editor): the right column is five questions, not one list`

### Task 8: Every kind gets a column that fits it

**Files:**
- Modify: `src/web/packages/editor/src/selection-inspector/per-kind-column.ts`
- Modify: `src/web/packages/editor/src/selection-inspector/runs.ts` (only where a control
  moves into a section; the file is at the 800-line stop and must not grow)
- Test: `src/web/packages/editor/src/selection-inspector/index.dom.test.ts`

**Interfaces:**
- Consumes the existing per-kind gates rather than re-deriving them: `supportsPanelFields`
  (`panel.ts:84`), `supportsGlassControl` (`glass.ts:84`), `canCrop` (`crop.ts:70`),
  `isTextObject` (`index.ts:86`), `typePresetOf` (`appearance.ts:170`), and the shape's own
  fields (`createShapeFields`, `panel.ts:397`).
- Produces: the per-kind rules — **shape**: its own material fields and geometry at the same
  density as a card's, not a lesser selection; **text**: typography by reference plus its
  runs and layout; **chart**: content and paint (Task 9 mounts the chart's own fields);
  **group / `ActiveSelection`**: bounds plus the children's effective appearance;
  **image**: crop and bleed; **locked**: the writing fields withheld with the reason shown.

**Constraints:** a card is a group, and a group is not a card — nothing here may assume the
starter's naming convention or count. A property a kind does not have renders **nothing**,
not a disabled control: a card has no border radius and a text run has no sensor. This is
the task where the spec's own test applies hardest — *does this remove a step, or a
freedom?* — so a kind that would lose any field it has today is a failure of this task, and
the inventory is enumerable: for every kind, the set of fields rendered before this plan is
a subset of the set rendered after.

**Failure modes to design against:** Review Focus 5; a shape kind added to Fabric without a
rule here (make the kind dispatch total over the kinds the editor can select, so an
unhandled one is a compile error rather than an empty column); group children's appearance
reported from a stale snapshot after the child changes.

**Verification:**
- Unit: **every kind the editor can select renders a non-empty column**, driven from a list
  of kinds rather than from an example object — a `Wedge`, an image, a two-kind
  `ActiveSelection`, a locked rect. This is Review Focus 5.
- Unit: **the field inventory is a superset of the pre-plan inventory, per kind** — walk the
  column for each kind and assert every field that existed before exists now, in a section.
  The list is written from the pre-change DOM, not from the new code.
- Unit: a group shows bounds and the children's effective appearance, and shows no panel
  material, no crop and no typography — the negative half is what "not a lesser selection"
  means for a kind that genuinely lacks the question.
- Unit: `runs.ts` does not exceed its current length, asserted by the repo's own source-size
  check rather than by inspection.
- Browser: a card, a free shape, a text box and a chart each open a column that answers
  their own first question, photographed for the evidence table.

**Commit:** `feat(editor): every kind answers its own questions`

### Task 9: A chart answers in its own column, and the Data tab goes

**Files:**
- Modify: `src/web/packages/editor/src/chart-manager/panel.ts` (export its field
  construction for the column to mount; it keeps ownership of chart selection, settings and
  bindings — `ownership.md` row 75)
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` (the `data` tab and
  the "Chart settings are under Data." hint at `:590-596`)
- Modify: `src/web/packages/editor/src/ui-copy.ts` (`inspector.data` becomes unused and is
  removed)
- Modify: `src/web/tests/e2e/rebuild-driver.ts`, `rebuild-composition.ts`,
  `editor.spec.ts`, `author-journey-rebuild.spec.ts`, `reference-theme.spec.ts` (the ~15
  call sites that open or assert the Data tab)
- Test: `src/web/packages/editor/src/chart-manager/index.dom.test.ts`,
  `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `settingsField` (Task 6) and `propertySection` (Task 5).
- Produces: the chart's bindings and family settings render **inside the chart's own
  column**, in Content and Paint, with the same ids and datasets as today so the specs and
  screenshots that address them keep addressing them.

**Constraints:** **the two sources are not a quality setting** — Preview and Live keep both
their names and their switch, and nothing here renames either. The Data tab is removed
because a per-kind column makes it a second door to one room, which is the thing §4 exists
to stop; the *Style* tab stays exactly as it is (its document mode is plan 4's to relocate
to the left column, and moving it now would leave plan 4 with nothing to move). Moving the
panel is a move, not a rewrite: the binding controls and the paint pickers keep their
behaviour and their owner.

**Failure modes to design against:** Review Focus 4 — a leftover string, doc or spec still
naming the Data tab; a spec that opens the Data tab and now silently asserts nothing; the
chart column rendering the fields twice because both the shell host and the column mount
them.

**Also owned here — `vg-145`, the bound Task 6 put under an author's number.** Task 7 found
`author-journey-rebuild.spec.ts:516` red and filed it rather than fixed it, correctly: *which
side is wrong is a design decision*, and the decision is this task's because the spec is
already in this task's file list. The chain, each link measured: the journey fills
`[data-vigilia-chart-setting="endAngle"]` with **405** for `ram-gauge` and asserts the object
carries it; `settings-fields.ts:279-280` bounds gauge `endAngle` at ±360; `numberField`'s own
doc comment says it "lands an out-of-range value on the **bound** it crossed instead of
reverting it"; and `f254259b` (Task 6) moved the Data tab's loop onto `settingsField`, where
the loop it replaced wrote `Number(input.value)` with **no bound check at all**. So Task 6
turned this assertion red without touching the assertion.

**What is not yet measured, and is this task's first step:** whether `endAngle: 405` draws
anything a canonical angle cannot. `gauge.ts:82-83` passes both angles to ECharts **raw**, so
the sweep is the engine's arithmetic and not this repo's — which means the answer is a canvas
measurement, not a reading of the descriptor. The hypothesis to test: 135 → 405 is a
**270°** clockwise sweep, which is what a three-quarter memory ring is, and ECharts does not
reduce either angle modulo 360, so ±360 is narrower than what the document format and the
renderer both accept. **Decisive on the validator side and already measured:**
`validateSettingsRange` bounds **no** `endAngle` in any family — it requires a finite number
and `max > min` and nothing else — so a document carrying `endAngle: 405` **validates today**.
That is ADR-0028's own distinction applied to itself: descriptor bounds are authoring bounds,
and an authoring bound narrower than the format silently rewrites an author's number.

Resolve it in one of two directions and **say which, with the measurement**: widen the gauge
`endAngle` authoring bound so a value the format accepts survives the control, or correct the
journey to a canonical angle — in which case the journey was asserting an angle the engine
reduces, and the row records that. Either way the spec at `:516` is green before this task
commits, and `vg-145` is closed in Task 11 against the check that closed it.

**Verification:**
- Unit: selecting a chart renders its family settings and its bindings in the Design
  column, and the Data tab is not in the tab list.
- Unit: **the literal "Chart settings are under Data." appears nowhere in the source tree**
  — the assertion that makes Review Focus 4 mechanical.
- Browser: selecting the starter's chart and changing a family setting changes the canvas,
  and reopening the theme keeps the setting — the round-trip that proves the write path is
  the read path.
- Browser: the specs that previously opened the Data tab pass after being pointed at the
  chart column, with no test deleted to make them pass.

**Commit:** `feat(editor): a chart answers where it is, and the Data tab is gone`

---

## Phase 3 — Proof

### Task 10: The evidence a reviewer can re-run

**Files:**
- Create: `src/web/tests/e2e/inspector-sections.spec.ts`
- Modify: `docs/evidence/screenshots/README.md` (register any capture this plan adds)
- Modify: the capture list in `src/web/tests/e2e/editor.spec.ts` where the evidence table
  points at it

**Interfaces:**
- Consumes: `openInspectorTab`, `geometryPairBoxes`, `place`, `choose` from the existing e2e
  helpers, plus the `openPosition` helpers Task 7 added — an exported one in
  `tests/e2e/rebuild-driver.ts` and a local one in `tests/e2e/editor.spec.ts`; a new helper
  only if two specs need the same interaction.
- **`activeGeometry` is not one of them, and this plan said it was.** Task 7 measured it: it
  reads through `window.vigiliaEditorBridge` and never touches a DOM geometry input, so
  collapsing Position cannot break it and it needed no change. Only `geometryPairBoxes`, the
  Size-pair spec and the polygon spec reach a geometry input and needed opening first. The
  correction is recorded because the wrong version sends a later reader to edit a helper that
  is already correct.

**Constraints:** capture requires `VIGILIA_CAPTURE=1` and `--workers=1`, and an action not
registered in `docs/evidence/screenshots/README.md` is not captured. Screenshots are
evidence, not cross-platform golden files — the assertions are numeric or textual and the
image is for a human. One sample of a flaky spec is not a measurement.

**Verification (browser, against the built bundle):**
- The starter: eight layer rows, a card selected, sections in the spec's order, Position
  closed, and **opening it reveals the same numbers as before this plan**.
- **A pie with a fixed total shows a remainder slice whose size is the fixed total minus the
  known total** — measured on the rendered canvas, not read from the settings object.
- Animation durations and easings on a line chart are reachable, settable, survive save and
  reopen, and the reopened document shows the author's values rather than the defaults —
  read through the option builder the renderer runs, not from the settings object.
- A free shape, a text box, an image and a group each open a non-empty column, and no kind
  shows a property it does not have.
- Nothing selected: the column names where to choose from, and the string comes from the
  existing `uiCopy.inspectorFields.nothingSelected` rather than a new literal.
- Screenshots: the sectioned column for a card and for a shape, and the chart's column.
- Gates: `npm run typecheck` exit 0, `./node_modules/.bin/biome lint ..` clean, the full
  vitest suite, and the affected Playwright specs with `--workers=1`.

**Commit:** `test(inspector): the sections, the kinds and the two settings that were lost`

### Task 11: The register, the status, and the plan's close

**Files:**
- Modify: `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl` (`vg-121`,
  `vg-122` → `verified`, moved to the archive)
- Modify: `STATUS.md`
- Move: this plan to `docs/superpowers/plans/archive/` once nothing depends on it

**Constraints:** a `verified` row needs a `check` naming a word from its own `title` — a
check of a capability *nearby* is not a check of this finding — and `artefacts` naming a sha
that resolves and is an ancestor of `HEAD`. **Both halves, or it is not closed**: the check
proves the named problem was addressed, the sha proves the commit is still on the mainline.
`STATUS.md` gets the 1–5 bullet "Last completed change", one item per line, never wrapped,
and `npm run status:check` runs from `src/web/` before the commit.

**Verification:** `node scripts/backlog-check.mjs` passes; the archive greps for both ids;
the named sha is an ancestor of `HEAD` (`git merge-base --is-ancestor`); `STATUS.md` names
plan 4 — the composition panel — as the next work, with its landmarks.

**Commit:** `docs(status): the per-kind inspector is closed and plan 4 is next`

---

## Resolved here, open in the spec

The spec is binding and silent on the mechanism. These four were handed to the plan and are
decided above, each with the reason it was decided that way:

1. **The descriptor table is extended, not replaced or paralleled.** It already owns the
   question, already has one non-test consumer, and `ownership.md` gives it the row. A
   parallel editor-side table would be a second owner; a generic nested-descriptor tree
   would outlive the two settings that need nesting. Argument and searches: ADR-0028.
   **One file, re-ruled at 675 lines.** Task 4 measured `settings-fields.ts` at 677 before it
   and 675 after — past the repo's 500-line signal, well under its 800-line stop. The brief
   named ~650 as the point to revisit the one-file decision, so it is revisited here and
   **kept**: the completeness gate works only while the data and the types it must exhaust sit
   in one place, and a split for line count would put the coverage record in a different file
   from the keys it classifies. The split to make, if 800 arrives, is per-family data against
   the types and `SETTINGS_SECTIONS` — not one family per file.
2. **"Grouped and hinted" is `section` plus a required `hint` plus `advanced`.** Grouping by
   the question the field answers, order by array position, hints as a type rule. The one
   place section order is decided is `SETTINGS_SECTIONS`.
3. **The completeness test is a typed coverage record.** `Record<keyof XSettings, "setting"
   | "paint">` makes a new key a compile error and a misclassification a compile error, and
   the runtime half proves each classification resolves to a real descriptor. It replaces
   both the old key-enumeration test and `NON_SCALAR_SETTINGS`.
4. **`vg-121` and `vg-122` close by gaining descriptors, not by amending the surface's
   curation.** `total` becomes a select plus a dependent number; `animation` becomes four
   fields one level down, materialising their parent from `defaultAnimationSettings`. Both
   need nested writes, which is why `path` and `visibleWhen` exist and nothing more general
   does. **An animation on/off toggle was considered and rejected**: `animate` defaults to
   true and is supplied by the build, so absence means *defaults apply*, not *static*, and
   the finding asks only that the timings be reachable.

## Out of scope

Named so a later phase is not asked to prove them here:

- **The left column and the composition panel** (plan 4) — thumbnails, roles, keys, quiet
  lock and eye. The selection-mode References line becomes this plan's **Spends** section;
  its document mode stays in the Style tab until plan 4 relocates it to the left column's
  Document pane, which is where the spec puts it.
- **The right column emptying completely when nothing is selected.** The selection column
  does; the document/artboard panel stays mounted in the same tab until plan 4 moves it
  left. The acceptance item is split, and the split is recorded in `STATUS.md`.
- **Units alongside primitives** (5), **the publish loop** (6), **keyboard** (7),
  **player chrome** (8), **chrome and appearance** (9).
- **Arc and wedge as primitives, and the `bleeds` flag** — already landed; the arc's angle
  controls exist in `panel.ts` and are re-homed into Position by Task 7, not rebuilt.
- **`vg-128`** — whether a card should map onto the theme's palette rather than being
  refused. The user's ruling, untouched here.
- **Driving `validateSettingsRange` from the descriptor bounds.** Decided against in Task 4
  with the reason recorded in the header: descriptor bounds are authoring bounds, validation
  bounds are invariants, and conflating them would reject documents that validate today.
