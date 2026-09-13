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

**When in doubt, render it and look.** Every defect worth fixing in the editor
was found by driving a browser, not by reading code — and several sat under a
fully green suite. Unit tests prove the decisions; only rendering proves the
wiring.

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

## Designing

**Specify what a thing *is* before coding it.** The group transform went through
three implementations — absent, derived-and-editable, structural-only — roughly
500 lines written then deleted, because "what is a group" had not been settled.
A spec would have been a document edit instead of a refactor.

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
