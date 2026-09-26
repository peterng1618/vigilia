### Task 1 — fix round 1

One Critical and one Important from the task review, plus one comment correction. **The Critical is a
mistake in my brief, not in your work** — you implemented exactly what the brief specified. Fixing it
is still this task's job, because the half of the change that matters shipped inert.

---

#### Fix 1 (Critical): `IGNORED_IDS = ["scene"]` excludes nothing

I need to state this plainly, because the brief asserted the opposite with a line citation and the
citation was wrong.

`new-fabric-theme.ts:320-330` calls:

```ts
rect("background", 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly, "scene"),
```

and the helper's signature is
`rect(id, left, top, width, height, fill, radius, interaction, paletteId?)`. So **`"background"` is the
`id` and `"scene"` is the ninth argument**, which becomes `vigiliaPaint: { fill: "palette.scene" }`.
The brief cited `:329` — the `paletteId` line — as if it were the id argument.

Verified three ways:

- `new-fabric-theme.test.ts:64` asserts the plate's object has `id: "background"`.
- Grepping `id: "scene"` across `src/web/packages/*/src/` returns **one** hit: your own fixture at
  `index.dom.test.ts:181`. No product object has it.
- The fork's list at `9efdd78a:src/editor/utils/object-filter.ts:3` is
  `['montage-area', 'background', 'interaction-blocker']` — it ignores a background id literally.

**Consequence, and why the change is currently inert.** The plate is `{ id: "background", left: 0,
top: 0, width: 1280, height: 720, visible: true, selectable: false, evented: false }`, so today
`shouldIgnoreObject` returns `false` for it and it is admitted as a snap candidate. The artboard's own
synthetic source supplies the same 0/1280/640/360 positions at `domain-boundary` category, and
`MOVEMENT_CANDIDATE_CATEGORY_PRIORITY` ranks `domain-boundary` above `edge`, so exact ties are masked —
which is why nothing went red. What is not masked:

- The plate's edges are at **±0.5** (Fabric's default `strokeWidth: 1`), nearer than the artboard's
  exact 0/1280, so an object near a boundary resolves to `-0.5`/`1280.5`. `isBetterMovementCandidate`
  compares distance before category is consulted.
- The plate enters `spacingSources` spanning the whole artboard, so it is "aligned" with every object
  on the cross axis and can emit spurious equal-spacing guides. That is the silent-winner failure.

**Fix:** `IGNORED_IDS` becomes `["background"]`. Correct the constant's comment to name the plate's
real id and say *why* the id — not `selectable` — is the arm that excludes it.

Do **not** reintroduce a `selectable` clause anywhere. Relaxing `isSnapTarget` to the fork's rule is
correct and is the other half of this task; keep it.

#### Fix 2 (Important): the plate test shares the constant's wrong string, so it cannot catch Fix 1

`index.dom.test.ts`'s plate fixture hardcodes `id: "scene"` — the same string as `IGNORED_IDS[0]`. The
test is armed by the id list (emptying the list does redden it), but it proves only that *some* string
in the list is honoured, not that the list names a real object. A fixture that matches the
implementation's own mistake.

**Fix: derive the fixture's id from the theme**, so the two cannot drift apart again. `scene` is typed
`Readonly<Record<string, unknown>>` on `FabricThemeEnvelope`, so `scene.objects` is `unknown` and needs
the same cast the repo already uses at `new-fabric-theme.test.ts:61-63` — copy that idiom rather than
inventing one:

```ts
const objects = createNewFabricTheme().scene.objects as readonly Readonly<
  Record<string, unknown>
>[];
const plateId = objects.find((object) => object["selectable"] === false)?.["id"];
expect(plateId).toBeTypeOf("string");
```

Import `createNewFabricTheme` from `../new-fabric-theme.js`. The `expect` is the vacuity guard: if the
theme ever stops emitting a non-selectable object, the test fails loudly instead of comparing against
`undefined`. Keep the fixture's own geometry (`left: 40, top: 30, width: 240, height: 180`) and its
omitted `selectable` — that omission is what makes the *id* the excluding arm, and it is still correct.

Assign the derived id to the fixture's `id` property. `assert` (or the `expect` above) must run before
the `Rect` is constructed, so the fixture can never be built from `undefined`.

#### Fix 3 (doc comment, one line): the production comment claims a predicate parity that no longer holds

`editor-session.ts` — the comment above `selectableObjects` ends "`selectable === true` also excludes
locked objects, which matches `snap-manager`; a locked object must not join a selection the author can
then drag."

The second sentence is right and is the reason to keep the filter. The first is now false: this task
deleted `selectable === true` from `snap-manager`'s `isSnapTarget` on purpose, because a locked object
**should** be alignable against. Say the distinction rather than the parity — a snap target may be
locked; a selection member may not.

---

### Teeth checks, and report the measured output

1. **Empty `IGNORED_IDS` and rerun.** The plate test must fail on its own assertion line. Restore.
2. **Reintroduce the `selectable` gate in `isSnapTarget` and rerun.** The locked-neighbour test must
   fail. This is the check that proves the relaxation is still load-bearing. Restore.
3. **Point the derived fixture at the wrong object** (e.g. `find((o) => o["selectable"] === true)`) and
   confirm the plate test fails — that is what proves the derived id is the one doing the work.
   Restore.

A check that stays green when its mechanism is deleted is not a check. Report each measured line
verbatim.

### Verify

```bash
cd src/web
npx vitest run packages/editor/src/snap-manager
npm run typecheck && npm run lint && npm run format:check
npm run status:check
```

Then run the browser check the original brief's Step 6 called for, which has still not been run and is
the one check that would have caught this:

```bash
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
  --grep "snaps a dragged object" --workers=1
```

Open the capture and report what you see: guides against real content, and none against the plate
except at the true artboard edges. Do not report this step as passing without the capture existing and
having been opened — a capture on disk that nobody looked at is not evidence.

### Also update `STATUS.md`

`npm run status:check` is in the gate list. Replace "Last completed change" with a 1–5 bullet summary
covering this task, and stage `STATUS.md` with the rest.

### Commit

```bash
git add src/web/packages/editor/src/snap-manager/excluded-objects.ts \
  src/web/packages/editor/src/snap-manager/index.dom.test.ts \
  src/web/packages/editor/src/editor-session.ts \
  STATUS.md
git commit -m "fix(editor): name the artboard plate's real id in the ignore list"
```

End the commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

Then append a fix report to your report file: what changed, every command you ran, the raw output of
all three teeth checks, the browser-test result, and what the capture shows. Reviewers do not re-run
tests for you; your report is the test evidence.

### Not in scope

- The spec and plan files already carry their corrections (I made them). Do not edit docs.
- Fabric's `originX/originY` default being `center`, which makes the explanatory comments in the two
  newer tests describe the wrong edges. Geometrically they still derive the asserted numbers, so the
  tests are valid. Leave them; the file has enough churn.
- Any change to `shouldIgnoreObject`'s body. It is already line-for-line the fork's function.
