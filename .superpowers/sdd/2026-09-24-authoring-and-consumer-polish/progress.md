# SDD ledger — plan: docs/superpowers/plans/2026-09-24-authoring-and-consumer-polish.md

Spec: docs/superpowers/specs/2026-09-24-authoring-and-consumer-polish.md

No prior ledger for this plan. State established from the code at `2929f87`, not from the checkboxes
(the queue's standing ruling: an unticked box proves nothing in either direction).

## State per task

| Task | State | Evidence / what is missing |
|---|---|---|
| 1 — Selection geometry fields | **landed** | `selection-inspector/index.ts` geometry rows; committed by Plan B's fix wave `2929f87` (per-action arrange gating + paired inspector geometry), which is this task's deliverable reached from the other plan. `index.dom.test.ts` covers it. |
| 2 — Appearance fields (opacity, paint reference, type preset) | **landed elsewhere** | Superseded by `2026-09-24-author-journey` Tasks 2 and 5, both landed (`9306fbd..49a9d77`, `49a9d77..045d08e`). Do not re-execute. |
| 3 — Text editing in place | **landed** | `ab9a6c7` (`text-manager`), recorded in the author-journey ledger as verified in git with tests present. |
| 4 — Inspector routing and tab behaviour | **partial** | The routing half landed (Design tab renders the selection inspector; no selection renders document panels). The **tab reset half is not implemented** — see the ruling below. |
| 5 — Style tab shows the resolved appearance | **landed elsewhere** | author-journey Task 5 (`045d08e`): the placeholder sentence is gone, the panel renders the resolved appearance. |
| 6 — Integration proof | **open** | Gate, full e2e, the four selection-state captures, and the spec acceptance annotation. |

## Ruling: Task 4's tab-reset half is real work (carried from `plan-queue.md`)

Spec §4 ("Rail and inspector agree on one state") requires the inspector's tab to reset to Design on
a new selection, "so a chart's Data tab does not linger over a shape". Measured at `2929f87`:
`editor-shell/shell-layout.tsx:402` renders `<Tabs.Root defaultValue="design">` — **uncontrolled**, so
nothing can reset it. The only tab test (`shell-layout.dom.test.tsx:201-233`) clicks Data and asserts
the chart panel becomes reachable, which is tab *reachability*, not the reset rule.

**What the fix is.** Make the tab controlled (`value` + `onValueChange`) with the value held in the
shell's state, and reset it to `"design"` when the selection identity changes. `SelectionStore`
already derives selection, so the reset is a subscription, not a new state owner.

**Cost if wrong:** one controlled-`Tabs.Root` change plus one test, against an author whose chart's
Data tab stays open over the shape they select next.

## Ruling: Task 6's capture set is largely satisfied by existing evidence; do not re-capture blindly

Task 6 asks for "each selection state (shape, text, chart, none)". The browser suite already captures
all four action classes — `editor-layer-arrange`, `editor-text-reads`, `editor-chart-binding`, and the
no-selection state — and Plan B registered them. The gate and the spec acceptance annotation are the
genuine gaps. Cost if wrong: one duplicate capture, which the screenshot registry would reject anyway
(capture only affected actions registered in `docs/evidence/screenshots/README.md`).

## Sequencing

Task 4's fix touches `shell-layout.tsx` and `shell-layout.dom.test.tsx`. Task 6 touches no source.
Both are free of `src/web/tests/e2e/editor.spec.ts`, so this plan does not contend with snapping
Tasks 2, 7 or 9 — but it must not run concurrently with the active plan (queue ruling: never two
plans active at once).

## Task 1's acceptance items verified item by item (2026-09-26)

Task 1 was recorded as landed above; checked against its own four bullets rather than against the
existence of the file:

- Geometry fields present: `selection-inspector/index.ts:43` `GEOMETRY_FIELDS` keyed record, consumed
  at `:259-270` (left, top, width, height, angle).
- Refusal rather than coercion: `number-field.ts:63-66` — `accepted()` requires `Number.isInteger`
  and range; a refused edit restores the last accepted value and never reaches a commit (`:76-90`).
  Note this is **stricter** than the bullet's "reject non-finite": it rejects fractional input too,
  which is the right call for a canvas at integer scene units and is what the artboard panel does.
- One history entry per commit: asserted by the fix wave's history-entry test (`history.saveState`
  exactly once for a committed pair edit, with `rect.width * rect.scaleX === 80`).
- Nothing renders with no selection: the routing half of Task 4 (document panels render instead).

The one bullet with no direct evidence is the rendered before/after capture of "change X, capture the
canvas". That is Task 6's job in this plan and is covered by the existing `editor-layer-arrange`
capture class; no separate capture is owed.

## Correction: Task 6's gate step names a capture whose producing test no longer exists (2026-09-26)

The plan's Task 6 Step 5 `git add` (plan tail) names
`docs/evidence/screenshots/editor-desktop-chromium.png`. Measured at `2929f87`:

- The PNG is on disk **and already tracked** — committed by `5b9b386` (Plan B's Task 10). This `git
  add` is therefore a no-op, not an orphan-producing mistake; an earlier version of this note claimed
  the file was unregistered and untracked, and was wrong on the first count.
- Its registration row in `docs/evidence/screenshots/README.md:27` reads `editor` /
  `captures the mounted editor`, and **no test calls**
  `captureVisualReview(page, testInfo, "editor-desktop")` — `grep` over `src/web/tests/e2e/` returns
  nothing. The artifact carries a stale capture name that no longer matches its registry entry.
- `AGENTS.md` requires capture only for affected actions registered in that README, and the README's
  own header says "Show the action's result, not merely a mounted editor."

**Ruling: this is a Plan B finding, not an AC-polish one.** Plan B's Task 10 committed a capture
under a name its registry row does not use and no test produces. It is Minor — the image is real
evidence of the mounted editor, and the row's regex still resolves `editor` — and it is recorded here
because AC-polish's Task 6 is the next step that touches the same file. Fix it in whichever plan next
runs a capture pass: either rename the artifact to match the registry, or update the registry row.

**Task 6 itself should not stage that PNG** — it changes no editor source, so it affects no capture,
and staging an already-tracked, unchanged file is noise in the diff. Cost if wrong: one file listed in
a `git add` that had nothing to add.
