# 0048 — A reference into the plans directory resolves, or the check refuses

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/check-doc-references.mjs`

## The problem

`docs/superpowers/plans/archive/` exists so a moved plan stays readable. Nothing resolves a
reference to one, so **a reference that points at the right name in the wrong place makes a reader
conclude the document was deleted** — and the next six-plan move re-breaks the same references
silently. Phase 9 Task 9.3 moved six plans, needed a sweep to find what that broke, and the sweep
lived in a scratch file. `vg-434` is the missing check.

The shape is not "check markdown links". It is narrower and has three parts a generic checker does
not carry: the reference may be **in a code span or in prose**, not only in a link; the target
directory has an **`archive/` fallback**, so a bare filename may resolve in either place; and the
referencing files are **any tracked text file**, not only markdown.

## Rung 1 — Vigilia

Searched: the three gates that already resolve something, and every reader of the plans directory.
Found: `scripts/check-status.mjs` resolves the active-plan slug against `docs/superpowers/plans/`
with no `archive/` fallback; `scripts/design-md.mjs --cite` resolves a `§N` marker against
`DESIGN.md`; `scripts/backlog-check.mjs` validates the register's own fields, including that an
`artefacts` sha resolves. **Nothing resolves a path into `plans/`.** The one sweep that did is in a
scratch file outside the tree, which is why the class returned.

## Rung 2 — dependencies

Searched: `src/web/package.json` and every workspace manifest for a markdown or link tool.
Found: **nothing**. No dependency in the tree parses markdown, and none resolves a relative path.

## Rung 3 — platform

Searched: `node:fs`, `node:path`, `git ls-files`.
Found: `existsSync` answers the resolution and `execFileSync("git", ["ls-files"])` enumerates the
tracked set — which is the right set, because an untracked file is not a reference a clone carries.
**What it leaves to you is the whole rule**: which tokens are references, where a bare name may
resolve, and what to do about one that legitimately resolves to nothing.

## Rung 4 — ecosystem

**Not run.** Two searches were attempted this session (`lychee` / `markdown-link-check` /
`remark-validate-links`, and the archive-fallback question) and the web tool returned the query
echoed rather than results, so no finding is recorded. **This is "not run", not "nobody solved this
shape"** — the named candidates are real and a later session can settle it.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `lychee` | generic; resolves local files | a Rust binary in CI and a second toolchain | knows nothing of the `archive/` fallback, which is the rule here | rejected on fit |
| `markdown-link-check` | links only | a dependency | cannot see a code span or a prose path, which is where `vg-434`'s worst instance was | rejected on fit |
| `remark-validate-links` | links only, markdown only | a dependency and a plugin graph | same gap; and the referencing files are `.ts`, `.mjs` and `.json` too | rejected on fit |
| a check in `scripts/`, beside the three that already resolve something | exact | ~90 lines, no dependency | one more script to keep | **chosen** |

## Rung 6 — probe

Measured 2026-10-16, in node rather than grep, over every tracked `.md`, `.ts`, `.tsx`, `.mjs`,
`.js`, `.json`, `.css`, `.html` and `.yml` file:

- **51 references into `plans/`, 49 resolving, 2 broken.**
- `docs/superpowers/specs/2026-09-27-font-trio-catalog-design.md` → `../plans/archive/2026-09-20-packaged-fonts.md`, <!-- doc-ref-ok: this note quotes the measurement it records -->
  which has **no correct target**: `9135eb47` added that plan at `.agents/plans/`, it was never
  migrated, and `04dc86dd` deleted its SDD workspace.
- `scripts/sdd-checkpoint.mjs:162` → `docs/superpowers/plans/does-not-exist.md`, <!-- doc-ref-ok: quoted, not a reference -->
  which is a **self-test fixture** — a `STATUS.md` body the checkpoint check is supposed to reject.

**`vg-434`'s own counts do not reproduce, and that is the finding**: it reported 82 references and 32
broken on 2026-10-13, and the class has since been repaired to 2. The row's measurement was right
when taken; the number is re-derived here rather than restated, because the counts move with every
commit.

## Decision

**A check in `scripts/`, wired into the gate, that resolves every path token into `plans/` and
refuses a broken one — with an inline escape for a reference that legitimately has no target.**

Chosen because the three-part rule above is the whole work and no generic checker carries it: the
`archive/` fallback is this repo's own convention, and two of the three broken instances sit in a
code span and in a `.mjs` string rather than in a link. A dependency would answer a wider question
badly and this one not at all.

## Extended 2026-10-16 — the scan skips a path the worktree no longer holds

`git ls-files --cached` lists a tracked path whether or not the worktree still holds it, so a file
**deleted and not yet staged** — the normal state during any refactor that deletes one — was listed,
read, and threw `ENOENT` out of the scan loop. **Task 15.4's first gate run died this way**, at
`design-language.spec.ts:138`, with an error naming neither the check nor the cause; the run passed once
the deletion was staged, which is why it read as a staging problem rather than a defect here.

**The scan now skips a listed path that does not exist.** A file that is not on disk carries no
reference to check, so this is the rule's own answer rather than a suppression. Proved both ways on
2026-10-16 by deleting a tracked file with the fix present (exit 0, 873 files) and absent (exit 1,
`ENOENT`), with both the script and the deleted file restored byte-identical under `cmp`.

**The escape is deliberate and is not a loophole.** Two references in this repo resolve to nothing
on purpose — one names a plan that was never migrated, one is a fixture a self-test must feed the
checker. `doc-ref-ok: <reason>` on the line or the line above records which, so the next reader sees
a decision rather than an oversight. **A row whose subject is a broken reference and which carries no
escape fails the gate**, which is what keeps the escape from becoming the fix.
