# Gates and the Control Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor's quality gates actually cover the code the redesign touches, give the design language a machine-checkable definition, and build the one React control set every later plan composes surfaces from.

**Architecture:** Three things land here and nothing else: Biome starts seeing `.tsx` (it currently sees none), the bible's scales become real tokens in the theme stylesheet with a **ratchet guard** that fails on literals in already-converted files, and the bible §5 control vocabulary becomes React components in `packages/editor/src/components/ui/` built on the existing Base UI primitive library (`0038`). A Playwright spec renders the control set, asserts the language mechanically, and writes the image that a plan's mockup-parity gate compares.

**Tech Stack:** TypeScript, React 19, Base UI, Tailwind v4 (`@theme`), Biome 2.x, Vitest (jsdom), Playwright, Node ESM scripts.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §1, §2.2, §2.4, §9, §13
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §2, §3, §4, §5, §6
**Reference:** [`docs/design/mockups/inspector-controls.html`](../../design/mockups/inspector-controls.html)
**Decision:** [`0039`](../../decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)

## Global Constraints

- **No behaviour changes.** This plan adds gates and components. It changes no editor behaviour, no field, no eligibility rule.
- **No new dependency.** React 19, Base UI and Tailwind v4 are present. Adding any package is a plan failure.
- **`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.** A prop that may be absent is declared `| undefined`, never passed `undefined` through an optional field.
- **Refuse invalid numeric input; never coerce it to zero.**
- **No licence headers in source files.** Comments are 1–3 lines and explain *why*.
- **500 lines is a signal and 800 is a stop** for a normal source file.
- **Stage explicit paths.** Never `git add -A` or `git commit -a`.
- Run everything from `src/web/`. The scripts are `package.json`'s — read them there.
- **Biome is run as `./node_modules/.bin/biome`, not `npm run lint`** when a task needs its exit code, because the npm script is a bare `biome lint ..` with no reporter control.
- **Playwright previews built bundles.** Rebuild after any source change and after reverting a deliberate break.
- **`VIGILIA_CAPTURE=1` and `--workers=1`** for any capture; capture only actions registered in `docs/evidence/screenshots/README.md`.
- **A new test must be shown to fail when the behaviour it guards is disabled**, before it is trusted. Every task below states its red proof.

## Review Focus

The spec implies these and no task's tests exercise them. Each is pinned to the task that owns its code.

1. **A guard that fires on legitimate literals.** `1px` borders, `0`, `100%`, `#0000004d` in a shadow token definition, and the palette definitions themselves are all correct and all look like violations. A guard that cannot distinguish them gets disabled within a week. → Task 2.
2. **A repo-wide reformat hiding a real change.** Turning formatting on for 23 never-formatted files produces a diff where a semantic edit is invisible. → Task 1.
3. **A control with no accessible name.** Bible §5.5 makes it a defect; a component set is exactly where it gets reintroduced, because a glyph button looks finished. → Task 3.
4. **Focus invisible on a light palette.** The accent ring is defined once and must clear contrast on all six palettes, not just on `graphite`. → Task 3.
5. **A parity gate that silently no-ops.** If the capture spec matches nothing, Playwright reports success with zero tests — the vacuous-gate failure `vg-149` itself is an instance of. → Task 4.

---

### Task 1: Biome covers `.tsx` (`vg-149`)

**Files:**
- Modify: `biome.json` (repo root, `files.includes`)
- Modify: the 23 tracked `.tsx` files (formatting only, by running the formatter)
- Test: none — the deliverable *is* the gate, and its proof is a planted violation.

**Interfaces:**
- Consumes: nothing.
- Produces: `./node_modules/.bin/biome lint ..` and `npm run format:check` now cover `src/web/**/*.tsx`. Later tasks in this plan depend on this: every component they add is a `.tsx` file, and a task whose gate is vacuous is not gated.

- [ ] **Step 1: Confirm the gap, so the change is measured rather than assumed**

```bash
cd src/web
./node_modules/.bin/biome lint .. --reporter=summary 2>&1 | tail -20
git ls-files '*.tsx' | wc -l
git ls-files '*.ts'  | wc -l
```

Expected: the summary reports **0** files linted matching `.tsx` (or reports none at all), and the counts are **23** `.tsx` against **467** `.ts`. Record both numbers in the commit message — they are the before-state.

- [ ] **Step 2: Add `.tsx` to `files.includes`**

```json
"files": { "includes": ["src/web/**/*.ts", "src/web/**/*.tsx", "src/web/**/*.json", "src/web/**/*.css"] }
```

`files.includes` **replaces** Biome's defaults rather than extending them, which is why the glob has to be added rather than omitted — that is the whole defect.

- [ ] **Step 3: Run the linter and read what it found before formatting anything**

```bash
cd src/web
./node_modules/.bin/biome lint .. --reporter=summary 2>&1 | tail -30
```

The enabled rules are `noUnusedImports`, `noUnusedVariables`, `noFloatingPromises`, `noDoubleEquals`. **Fix every finding as a real change, in its own commit or in this one, and say in the commit message what each was** — 23 files that have never been linted is exactly where a genuine unused import or an unawaited promise has been sitting.

If a finding is a false positive, suppress it narrowly with a `// biome-ignore lint/<rule>: <reason>` on the line, naming the reason. A file-level disable is not acceptable.

- [ ] **Step 4: Format, as a separate commit**

```bash
cd src/web
npm run format
git diff --stat
```

**Commit the formatting alone**, with a message that says it is formatting-only and names the file count. If a real change from Step 3 is mixed in, split it out first — a reader must be able to skip this commit entirely.

- [ ] **Step 5: Prove the gate is no longer vacuous — this is the step that matters**

```bash
cd src/web
# Plant a violation in a .tsx file that Biome previously could not see.
printf '\nconst unusedProbe = 1;\n' >> packages/editor/src/editor-shell/canvas-dock.tsx
./node_modules/.bin/biome lint .. ; echo "EXIT=$?"
git checkout -- packages/editor/src/editor-shell/canvas-dock.tsx
```

Expected: **EXIT is non-zero** and the finding names `canvas-dock.tsx`. If the exit is 0, the glob did not take effect and the rest of this plan is unguarded.

Then confirm the revert is clean:

```bash
git status --short packages/editor/src/editor-shell/canvas-dock.tsx
```

Expected: no output.

- [ ] **Step 6: Close the register row and commit**

`vg-149` is `verified` only with a `check` naming a word from its own title and `artefacts` naming a sha that resolves and is an ancestor of HEAD. Move the row from `docs/product/backlog.jsonl` to `docs/product/backlog-archive.jsonl` in this commit.

```bash
git add biome.json packages/editor/src/editor-shell/*.tsx docs/product/backlog.jsonl docs/product/backlog-archive.jsonl
git commit
```

---

### Task 2: The scales exist, and a ratchet guard keeps them consumed

**Files:**
- Modify: `packages/editor/src/editor-shell/editor-shell.css` (the `@theme static` block)
- Create: `scripts/design-tokens.mjs`
- Create: `scripts/design-tokens.gated.json` (the ratchet: the file list the guard enforces)
- Modify: `src/web/package.json` (add the `design:check` script)
- Test: `scripts/design-tokens.self-test.mjs` (the guard's own proof, in the style of the repo's other `--self-test` scripts)

**Interfaces:**
- Consumes: Task 1 (the guard is a `.mjs` script, and the gated list will later include `.tsx`).
- Produces: the CSS custom properties named in bible §2–§4 — `--text-2xs`, `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, `--text-xl`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--space-1` … `--space-8` (4,6,8,10,12,14,16,20,24,32 as named steps), `--elev-1`, `--elev-2`, `--elev-3` — and `npm run design:check`. **Task 3 consumes every one of these names.**

- [ ] **Step 1: Extend the `@theme static` block with the bible's scales**

Read bible §2 and §3 and add exactly those names and values. Keep the existing `--spacing`, `--radius-*`, `--text-*` and `--shadow-*` entries that are already there and add what the bible names and they lack; **do not delete an existing token in this task** — removal happens when its last consumer moves.

**Do not rename anything yet.** The existing 106 `var(--shell-*)` uses are colour and are unaffected.

- [ ] **Step 2: Write the guard's failing test first**

Create `scripts/design-tokens.self-test.mjs` asserting, at minimum:

```js
// A hex colour in a gated file is a violation.
assert.equal(check("a.css", ".x { color: #ff0000; }").length, 1);
// A role reference is not.
assert.equal(check("a.css", ".x { color: var(--text); }").length, 0);
// An off-scale px spacing is a violation; on-scale is not.
assert.equal(check("a.css", ".x { padding: 7px; }").length, 1);
assert.equal(check("a.css", ".x { padding: 12px; }").length, 0);
// A hairline border, a zero, and a percentage are NOT violations (Review Focus 1).
assert.equal(check("a.css", ".x { border: 1px solid var(--edge); }").length, 0);
assert.equal(check("a.css", ".x { margin: 0; opacity: 100%; }").length, 0);
```

Run: `node scripts/design-tokens.self-test.mjs`
Expected: **FAIL** — `check` is not defined.

- [ ] **Step 3: Write the guard**

`scripts/design-tokens.mjs` exports `check(relPath, source)` and, when run directly, walks `scripts/design-tokens.gated.json`'s file list and reports violations.

Rules, in order:

1. A `#rgb`/`#rrggbb`/`#rrggbbaa` literal in a gated file is a violation **unless** the file is `editor-shell.css`'s palette-definition block (the palettes *are* the hex values — that is the one place they are allowed to exist).
2. A `px` length is a violation unless the value is `0`, `1`, or on the bible's scale. `1px` is exempt because a hairline border is not a spacing decision.
3. Percentages, `em`, `rem`, `fr`, and `calc()` are not checked.

The guard reads the allowlist from the JSON file, so adding a file to the ratchet is a one-line change a reviewer can see.

- [ ] **Step 4: Run the guard's test to green, then prove the guard is not vacuous**

```bash
node scripts/design-tokens.self-test.mjs ; echo "EXIT=$?"
```

Expected: exit 0, no output.

Now the red proof — Review Focus 5's risk is a guard that passes because it looked at nothing:

```bash
# An empty gated list must FAIL, not pass.
printf '[]' > /tmp/gated.json
node scripts/design-tokens.mjs --gated /tmp/gated.json ; echo "EXIT=$?"
```

Expected: **non-zero**, with a message saying the gated list is empty. A guard over zero files reporting success is the defect this plan exists to remove.

- [ ] **Step 5: Wire the script and seed the ratchet**

Add to `src/web/package.json`:

```json
"design:check": "node ../../scripts/design-tokens.mjs"
```

Seed `scripts/design-tokens.gated.json` with the files this plan has actually converted — at this point, **none**, so the list is `[]` and the guard's empty-list rule makes it fail. That is correct and deliberate: the ratchet starts red, and Task 3 turns it green by converting its first files. **Do not seed it with files known to be violating.**

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/editor-shell/editor-shell.css scripts/design-tokens.mjs scripts/design-tokens.self-test.mjs scripts/design-tokens.gated.json src/web/package.json
git commit
```

---

### Delivered-state reconciliation — Tasks 1–2 are complete

Do not re-execute Tasks 1–2. Their landed contract supersedes historical steps
above: `design-tokens.gated.json` is `{ biblePx, gated }`, the proof is
`node ../../scripts/design-tokens.mjs --self-test` from `src/web/`, and no
separate `design-tokens.self-test.mjs` exists. The guard is importable and its
CLI runs only at entry. CSS spacing is checked against spacing steps; other px
dimensions use `biblePx`; definition blocks are exempt. `[]` remains supported
for the negative empty-list probe, but production updates use `gated`.

Tokens being present is not proof of use. The source guard does not enforce
variable references for an on-scale literal, cannot see numeric React style
props, and skips rem/calc. Report those limits honestly; rendered/browser
checks cover treatment, and review covers use of named tokens. Do not claim
this lexical guard alone proves all design decisions. `--stage`, `--hdr` and
`--edge-2` arrive with their first consumers.

### Task 3: The control set

**Files:**
- Create: `packages/editor/src/components/ui/control-well.tsx`
- Create: `packages/editor/src/components/ui/control-text.tsx`
- Create: `packages/editor/src/components/ui/control-swatch.tsx`
- Create: `packages/editor/src/components/ui/control-select.tsx`
- Create: `packages/editor/src/components/ui/control-number.tsx`
- Create: `packages/editor/src/components/ui/control-slider.tsx`
- Create: `packages/editor/src/components/ui/control-toggle.tsx`
- Create: `packages/editor/src/components/ui/control-segmented.tsx`
- Create: `packages/editor/src/components/ui/control-icon-button.tsx`
- Create: `packages/editor/src/components/ui/inspector-section.tsx`
- Create: `packages/editor/src/components/ui/control.test.tsx` (jsdom)
- Modify: `scripts/design-tokens.gated.json` (add every file above)

**Interfaces:**
- Consumes: Task 2's CSS custom properties by name, and its `design:check`.
- Produces, for later plans to compose surfaces from:

```ts
export type ControlProps = {
  readonly label: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly refused?: string;
  readonly data?: Readonly<Record<`data-${string}`, string>>;
};

// Styling container, not a fake editable value. Child owns focus and its id.
export function ControlWell(props: { readonly children: React.ReactNode }): React.JSX.Element;
export function ControlText(props: ControlProps & { readonly value: string;
                               readonly onCommit: (value: string) => void }): React.JSX.Element;
// Swatch is an adornment of ControlSelect, not a second selection mechanism.
export function ControlSwatch(props: ControlProps & { readonly value: string;
                               readonly options: readonly {id: string; name: string}[];
                               readonly swatch: React.ReactNode;
                               readonly onChange: (id: string) => void }): React.JSX.Element;
export function ControlSelect(props: ControlProps & { readonly value: string; readonly options: readonly {id: string; name: string}[];
                               readonly onChange: (id: string) => void }): React.JSX.Element;
export function ControlNumber(props: ControlProps & { readonly value: number | undefined; readonly unit?: string;
                               readonly min?: number; readonly max?: number;
                               readonly onCommit: (value: number) => void;
                               readonly onClear?: () => void }): React.JSX.Element;
export function ControlSlider(props: ControlProps & { readonly value: number; readonly min: number; readonly max: number;
                               readonly onPreview?: (value: number) => void;
                               readonly onCancel?: () => void;
                               readonly onCommit: (value: number) => void }): React.JSX.Element;
export function ControlToggle(props: ControlProps & { readonly checked: boolean; readonly onChange: (v: boolean) => void }): React.JSX.Element;
export function ControlSegmented<T extends string>(props: ControlProps & { readonly value: T; readonly options: readonly {id: T; name: string}[];
                               readonly onChange: (id: T) => void }): React.JSX.Element;
export function ControlIconButton(props: ControlProps & { readonly destructive?: boolean;
                               readonly shortcut?: { readonly printed: string; readonly spoken: string };
                               readonly onClick: () => void; readonly children: React.ReactNode }): React.JSX.Element;
export function InspectorSection(props: { readonly id: string; readonly title: string; readonly readOnly?: boolean;
                               readonly defaultOpen?: boolean; readonly children: React.ReactNode }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing test for the two rules that are defects, not style**

`control.test.tsx`, jsdom, following the existing `*.dom.test.tsx` conventions:

```tsx
it("gives every control a programmatic name", () => {
  render(<ControlSelect label="Shows" value="cpu.load" options={[]} onChange={() => {}} />);
  expect(screen.getByLabelText("Shows")).toBeTruthy();
});

it("renders a refused control rather than omitting it", () => {
  render(<ControlToggle label="Glass" checked={false} onChange={() => {}} refused="not offered for a group" />);
  expect(screen.getByText("not offered for a group")).toBeTruthy();
  expect(screen.getByLabelText("Glass")).toBeTruthy();
});

it("refuses a non-numeric entry instead of coercing it to zero", () => {
  const onCommit = vi.fn();
  render(<ControlNumber label="Width" value={299} onCommit={onCommit} />);
  fireEvent.change(screen.getByLabelText("Width"), { target: { value: "abc" } });
  expect(onCommit).not.toHaveBeenCalledWith(0);
  expect(onCommit).not.toHaveBeenCalled();
});
```

Run: `npx vitest run packages/editor/src/components/ui/control.test.tsx`
Expected: **FAIL** — the modules do not exist.

- [ ] **Step 2: Build the components to bible §5, one control per file**

Each component:

- Takes its text from a `label` prop and pairs it with the input by a generated id (`useId`) — bible §5.5. A control whose label and input are not programmatically associated fails Step 1.
- Uses **only** the token names from Task 2 for spacing, radius, type and elevation, and **only** colour roles (`var(--panel-2)`, `var(--edge)`, `var(--text)`, `var(--muted)`, `var(--faint)`, `var(--accent)`). No hex, no off-scale px — Task 2's guard enforces this in Step 5.
- Renders `refused` as **visible text in the row**, with the control still present and `aria-disabled` rather than `disabled` (bible §5.3: a disabled control leaves the tab order, so the reason reaches nobody not holding a mouse).
- Uses installed Base UI primitives for Select, Slider and exclusive-choice keyboard semantics where needed. No new component library, hand-rolled listbox or hidden native visible fallback. `ControlWell` supplies styling only; `ControlText` owns editable text; `ControlSwatch` composes Select. Data attributes, labels, ids and refusal descriptions reach the actual focus target, not a wrapper.
- Implements bible §5's Editing and recovery draft/commit/cancel contract. Numeric domains and optional clearing remain the consuming field owner's rules, not one global minimum. Slider preview/release/cancel delegates to the existing imperative write funnel; the `onPreview`/`onCancel` contract above keeps preview separate from history. A consuming field supplies both callbacks together where preview exists. For numbers, `onClear` permits optional-key removal; an absent callback means blank is invalid, not zero. Carry these exact signatures into plan 3 before dispatch.
- `ControlIconButton` owns its name and tooltip from `label` immediately, including teardown and shortcut annotation. Plans 2–5 must not hand-wire a second pair and wait for plan 6 to repair it.

**Required checks within this task:** refused controls cannot mutate via pointer, Space, Enter or arrow keys; each field has a unique id and `aria-describedby` reason; empty/invalid numeric drafts do not commit; Enter then blur commits once; Escape and IME composition do not commit; a slider gesture commits once and cancellation commits none. A mounted browser fixture proves keyboard access, 24px hit areas, all-six-palette focus contrast and forced-colours focus. Plain name tests alone are not acceptance.

- [ ] **Step 3: Run the test to green**

```bash
npx vitest run packages/editor/src/components/ui/control.test.tsx
```

Expected: PASS, and record the collected test count in the commit — a count is evidence that a case was collected.

- [ ] **Step 4: Prove the accessible-name test is not vacuous**

Remove the `htmlFor`/`id` pairing from `ControlSelect` only, and re-run. Expected: the first test **fails**. Restore it. This is the red proof for Review Focus 3.

- [ ] **Step 5: Turn the ratchet green**

Add every file created in this task to `scripts/design-tokens.gated.json`, then:

```bash
npm run design:check ; echo "EXIT=$?"
```

Expected: **exit 0**. If it reports violations, the components are using literals and Step 2 is not done.

Then re-run the empty-list proof from Task 2 Step 4 to confirm the guard still refuses to pass over nothing.

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/components/ui/ scripts/design-tokens.gated.json
git commit
```

---

### Task 4: The parity gate, so every later plan checks the mockup

**Files:**
- Create: `src/web/tests/e2e/design-language.spec.ts`
- Modify: `docs/evidence/screenshots/README.md` (register the new capture action)
- Modify: `docs/superpowers/specs/2026-10-08-editor-design-language-design.md` only if the procedure below differs from §13 as written

**Interfaces:**
- Consumes: Task 3's components, Task 2's tokens.
- Produces: a registered Playwright capture whose screenshot is the thing a plan places beside `docs/design/mockups/`. **Later plans add their own capture to this file; they do not invent a new procedure.**

- [ ] **Step 1: Write the spec so it fails first**

`design-language.spec.ts` must do two things: **assert the language mechanically**, and **write the image** the parity gate compares.

```ts
test("the control set renders in the design language", async ({ page }) => {
  // Build a fixture page from the built editor stylesheet plus the control set,
  // then assert the language, not the pixels.
  await page.setContent(fixtureHtml);
  // Every gated element's computed spacing is on the bible's scale.
  const offScale = await page.evaluate(() => { /* walk gated elements, collect
     computed padding/margin/gap values not in the scale */ });
  expect(offScale).toEqual([]);
  // No gated element resolves a colour to a literal outside the palette roles.
  const literals = await page.evaluate(() => { /* collect computed colours and
     compare against the resolved palette tokens */ });
  expect(literals).toEqual([]);
  await page.screenshot({ path: "docs/evidence/screenshots/<registered-path>/raw/control-set.png", fullPage: true });
});
```

Run: `npm run build && npx playwright test --project=desktop-chromium --grep "renders in the design language" --workers=1`

Expected: **FAIL** — the fixture does not exist.

- [ ] **Step 2: Build the fixture and make it pass**

The fixture mounts the **built React controls**, not HTML strings that imitate them, and loads the built editor stylesheet. Reuse the existing preview/test entry mechanism; register its exact route before using it. The fixture includes every control plus focused, refused and invalid states. `page.setContent` alone does not load CSS or mount React, and `fixtureHtml` is not an implementation.

Computed styles prove resolved geometry and contrast, not token provenance: a hard-coded colour equal to a palette role passes a computed equality check. `design:check` owns source provenance; the browser owns rendered treatment. Scope the spacing assertion to authored layout properties, not browser defaults, glyph bounds, percentages or values after rem conversion. Convert lengths consistently at the tested root font size. Negative proof: plant a literal matching a role and require the source guard to fail; plant off-scale spacing in a mounted control and require the browser assertion to fail.

Only registered screenshot actions with `VIGILIA_CAPTURE=1` write committed evidence; ordinary assertions run without capture. Report collected tests from runner output/JSON, never infer collection from exit 0. Do not assume a no-match Playwright run succeeds on every version.

- [ ] **Step 3: Prove the spec is not vacuous — Review Focus 5**

```bash
npx playwright test --project=desktop-chromium --grep "renders in the design language" --workers=1
```

Read the summary and confirm **1 test ran**, not 0. Then plant a violation — set one control's padding to `7px` — and confirm the spec **fails**. Revert.

A Playwright `--grep` matching nothing exits successfully with zero tests; that is how a parity gate silently stops checking.

- [ ] **Step 4: Register the capture**

Add the action to `docs/evidence/screenshots/README.md`'s editor checklist, with the rule that it captures only affected actions. Registering it is what makes it legal to commit the image.

- [ ] **Step 5: Perform this plan's own parity capture**

Place the produced screenshot beside `docs/design/mockups/inspector-controls.html` in the completion report and **list the differences**. For this plan the expected differences are real and should be stated rather than hidden: the mockup shows controls in a panel context with labels and values from the starter, while the fixture shows them in isolation.

Each difference is either fixed or recorded in the commit as deliberate. **If the list is empty, say so as a finding** — an empty list from a comparison that could not have failed is not evidence.

- [ ] **Step 6: Commit**

```bash
git add src/web/tests/e2e/design-language.spec.ts docs/evidence/screenshots/README.md docs/evidence/screenshots/
git commit
```

---

## Out of scope

Named so a later plan owns them rather than this one growing.

- **Any editor surface.** This plan converts no panel and touches no shell component. The four-slot rail, the trimmed header, the stage's three corners, the dock's re-layering, the Tokens and Document panes, and the Settings surface are plan 2 onward (§12).
- **The `selection-inspector` rewrite** is plan 3; the panels are plan 4.
- **Deleting the old `controls/` primitives** happens when their last consumer moves, not now.
- **Removing existing tokens from `editor-shell.css`** happens the same way.

## Self-review

- **Spec coverage.** §2.4 and §9 and §13 are Tasks 1, 2 and 4. §2.2's control set is Task 3. §1's normative bible is consumed by every task, since each cites it rather than restating it. §12's plan 1 is this document.
- **Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every code step shows code or a command with its expected output.
- **Type consistency.** `onCommit` (not `onChange`) is the name for a control that writes a value and may refuse it, used identically in `ControlNumber` and `ControlSlider`; `onChange` is for controls that always apply. `refused` is a string on every control that can be refused, never a boolean.
- **Review Focus.** Each of the five is pinned above to a task, and each has a red proof that the guard can fail.
