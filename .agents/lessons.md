# Lessons

Things that cost real time here, written down so they cost it once. Durable —
unlike [`status.md`](status.md), nothing in this file goes stale.

Each one is here because it actually happened, and each is stated as the rule
rather than the anecdote.

## Verifying

**A fix recorded in a handoff is not a fix.** A previous revision described a
credential gap as fixed — `.gitignore` blocking a stray Claude config home and
`**/.credentials.json`. `git check-ignore` showed neither rule present, and the
78 MB token directory had reappeared. It sat wrong for a whole revision behind a
confident sentence. **Check the claim, not the note.**

**A test can assert the bug.** Three instances in one session:

- A browser test resized a group and checked only the group's *own* bounding
  box — passing throughout while every child stayed put.
- A regression test for gesture corruption **passed with its own fix disabled**,
  because the corrupt and correct paths land on the same pixel. The
  discriminating signal was mid-gesture, not final state.
- A fix comment claimed corners "are never ambiguous at any size". They are, at
  2×2, where `se` resolved to `sw`.

**Disable the fix and re-run before believing a test.**

**A guard that compares freshly-built objects by identity is not a guard.**
`mount.ts` skipped an update when `previous.style !== node.style` — and
`resolveStyleMap` returns a new object on every build, so the comparison was
true on every tick and the write it "guarded" happened unconditionally. The
comment three lines above it said, correctly, that "the plan rebuilds these
objects every frame, so identity says nothing and the fields have to be
compared". The sibling `sameBox` did compare fields. It sat there for months,
green, doing nothing, next to a working example of itself and an explanation of
why it could not work. Two more of the same shape were found in the same hour:
the text branch had no guard at all, and the map every guard compared against
**was never seeded at mount**, so the first update after mount rewrote the whole
scene regardless.

**An unasserted optimisation is indistinguishable from a broken one.** All three
of those were found only because a test was written for the third — the first
unit test that had ever mounted an 800-line module. If nothing asserts that work
is skipped, nothing notices when it stops being.

**A test-harness API that sounds like it stops time may not.** Playwright's
`page.clock.install({ time })` pins where the clock *starts* and then lets it
run at wall speed; only `pauseAt` stops it. The whole browser suite was written
believing otherwise, `playwright.config.ts` said so in a comment, and the result
was three tests failing intermittently for months with the flakes recorded as
"unexplained". Two minutes of measurement — read `Date.now()`, sleep, read it
again — settled it. **Measure the harness's own guarantee before building
assertions on it**, especially the ones a comment asserts confidently.

**And then check what that harness bug was hiding.** "Any frame with a chart in
it is not byte-reproducible" had been measured on both ECharts renderers and
written into three documents as a limitation of the engine. It was a limitation
of the clock: each capture happened at a different instant. With the clock
actually stopped, the frames are identical. A measurement is only as true as the
harness it was taken through, so when the harness turns out to be wrong, the
things it "measured" are open again — not just the tests that failed.

**When in doubt, render it and look.** Every defect worth fixing in the editor
was found by driving a browser, not by reading code — and several sat under a
fully green suite. Unit tests prove the decisions; only rendering proves the
wiring.

**A whole new renderer passed 1,214 unit tests and 158 browser tests, and five
things were visibly wrong the first time anyone put it beside the old one.**
Spec 0013 stage 2, all five found in one screenshot comparison, none by a test:

- **Every text run that inherited its colour was invisible.** Per-character
  styles carried a style function's *defaults*, and a per-character entry
  overrides the object rather than falling back to it. A run with its own
  colour drew; the value beside it vanished.
- **A group with no authored size culled its entire subtree.** Canvas skips a
  0×0 object before drawing its children, where a 0×0 `div` simply does not
  clip. Three levels of nested group disappeared — and a group with no size is
  the *normal* case in this format, not an edge one.
- **Every image inside a group was dropped**, because the "is this node still
  in the plan?" guard on an async callback compared against the top-level id
  list only.
- **Vector icons drew mangled fragments at 1x and nothing at 4x**, because the
  browser will not draw an intrinsically-sized-less SVG through the
  source-rectangle form of `drawImage`.
- A corner radius clamped per axis rather than proportionally, turning a capsule
  into an ellipse.

Three rules fell out of it, and they are the transferable part:

- **The tests asserted everything except what it looked like.** Object counts,
  geometry, matrices, identity, disposal, ordering — all correct, all green,
  over a scene with holes in it. Asserting *where* something is says nothing
  about whether it was drawn.
- **"Some ink somewhere" is not a rendering assertion.** The first ink measure
  counted non-transparent pixels, and the artboard paints a background — so
  every region scored 1.0, including one whose image was missing. Then coverage
  *per node* still could not separate a mangled icon (0.2344) from a correct one
  (0.2126). What discriminates shape is where the ink sits: a coarse spatial
  profile, compared against the same asset drawn by the browser itself, is ~10x
  apart between correct and broken.
- **Port a renderer one fixture at a time, looking each time.** Four of the five
  were invisible in the fixture that was checked first and obvious in the next
  two.

**"That needs a browser" is often "I did not look for the cheap assertion".**
A chart object shipped green and unconstructable: one property was a getter with
no setter, and the library's only way in assigns straight onto the instance, so
every construction threw. The deferral was reasoned — instantiating it needs a
document, a canvas and a live chart engine, and asserting against a fake canvas
proves nothing. But the defect was in the **prototype**, and a prototype is
inspectable in Node. The class object, its statics, its accessor descriptors and
its serialised surface all are. Ask what the failure's *shape* is before
concluding the environment is the blocker.

**A guard that checks names does not check values.** The same object declared
its persisted keys and tested that none of them *sounded* like telemetry. Every
name passed; the live samples were one level down, inside a key called `option`.
A predicate over identifiers cannot see into the thing they identify — so a rule
about what data may exist has to be enforced by what the design permits, not by
what the keys are called.

**The browser suite does not exercise the host.** Playwright previews each
bundle on its own port, so a serving bug — a mount prefix, an asset path, a
redirect — is invisible to a green gauntlet. The editor once shipped unable to
boot at all while five checks passed. Checking a document's HTTP status is not
enough: the HTML arrives either way.

**Rebuild after reverting an experiment.** Temporarily breaking a guard to prove
a test catches it leaves `dist/` holding the broken build. Restoring the source
is not enough; the next Playwright run previews the sabotaged bundle and fails
somewhere unrelated, which reads like a flake.

## Duplication

**An owner nothing imports is not an owner.** A module was created as the
canonical vocabulary while a consumer kept its own hand-typed copy — and the two
had **already drifted on a label within the hour**. Creating the owner felt like
completing the task; it was half of it. Point every consumer at a new owner in
the same commit, and add a test binding them.

**Prefer a mechanism to a reminder.** A comment saying "keep these in sync" *is*
the defect. Derive one from the other, key a `Record` by the union so the
compiler forces exhaustiveness, or add an assertion.

**The severity axis is whether anything catches it.** Duplicated but
compiler-checked is usually fine. Duplicated, stringly-typed and unguarded is
the real problem — a style property name typo'd in a theme passes the schema
*and* the validator and is silently dropped at render time.

**Before writing behaviour a library might already have, read its source for
the hook.** A chart object hand-wrote four things Fabric donates: serialisation
(`static customProperties`), revival (inherited `fromObject`, whose override
skipped the step that turns a serialised clip path back into an object),
defaults (`static ownDefaults`), and invalidation (`set('dirty', true)`, where a
field assignment skips the propagation to an enclosing group and freezes a
grouped live chart). Each hand-written version *looked* right and each was wrong
in a way no test would surface. A dependency taken for what it donates has to be
read for what it donates; the published docs named none of these four.

**Derived state in a persisted format is duplication with a clock on it.** It
agrees at the moment of writing and diverges the first time its inputs change —
and it also smuggles whatever its inputs contained at write time, which is how
telemetry nearly reached a saved document.

## Designing

**Specify what a thing *is* before coding it.** The group transform went through
three implementations — absent, derived-and-editable, structural-only — roughly
500 lines written then deleted, because "what is a group" had not been settled.
A spec would have been a document edit instead of a refactor.

**Test a foundation against the constraint that would disqualify it, first.**
This survived the decision that produced it. Two Fabric-based editors were
rejected on 2026-09-12 because adopting one meant two renderers — correct, and
reached quickly by testing that constraint before anything else. It was reversed
three days later, and the reversal cost a day of measurement rather than a
rewrite, because the *premise* had changed (Fabric became the renderer for both
ends, so there was no second one) rather than the constraint having been
mis-weighed. Naming the disqualifying constraint up front is what made both the
rejection and its reversal cheap.

**A capability that cannot express the distinction you need is the wrong
capability.** One `transform` capability could not say "offers position but not
size", so the design oscillated between giving a group every row and giving it
none. Splitting it into `position` / `size` / `rotation` let the matrix state
the rule directly.

**A row that cannot work must not be drawn.** Offering a control that silently
does nothing is worse than offering fewer controls — and its converse holds too:
if an author can change something, it belongs in the inspector.

**Refuse rather than coerce.** A number input reports the empty string for *any*
content it cannot parse, and `Number('') === 0` — so coercion turned a
half-typed `1e` into a committed zero that made elements vanish.

## Windows and this toolchain

**Bare ignore rules match at any depth**, and this repo has been bitten twice:
`data/` untracked `renderer-core/src/data/`, and `bin/` untracked the CLI entry
point — the one file the host cannot start without. `[Dd]ebug/`, `[Rr]elease/`
and `artifacts/` are still bare.

**`npx <name>` will happily run a stranger's package.** `npx vigilia` fetched an
unrelated file-watcher off the public registry and crashed. Check that a binary
name is actually yours before documenting a command that uses it.

**Node 25 warns and works.** vitest 5 declares `^22.12 || ^24 || >=26`; you get
`EBADENGINE` and a passing suite. Not a failure — do not downgrade.

**`document.fonts.check()` cannot answer "is this font available".** Chromium
returns true for a never-declared family. Availability is metric comparison.

**A chart whose content is entirely animated draws nothing until its animation
progresses.** Screenshots of a fresh mount must advance the clock first.
