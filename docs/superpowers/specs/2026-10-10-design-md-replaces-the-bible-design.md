# The design bible becomes DESIGN.md

**Status:** designed, not started. Queued behind the active plan (plan 4, `the
panes`); `STATUS.md` names the order.

**The decision in one line:** `docs/design/design-language.md` — the bible — is
retired and replaced by a root `DESIGN.md` in the
[DESIGN.md format](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md),
validated by `@google/design.md`, with the `§N` marker system retired along with
it and every citation re-pointed at a section name.

## Why this is not a formatting pass

Three interfaces move at once, and each has an owner today:

- **The `§N` markers are an interface.** 1487 `§` references across `docs/`,
  `src/` and `scripts/` resolve by number into the bible's ten sections and their
  sub-numbers; `AGENTS.md` states as a rule that they are stable and never
  renumbered. Retiring the numbers retires the interface, so the rule is
  replaced by a weaker one that is machine-checked instead of remembered.
- **The values are an interface.** `scripts/design-tokens.mjs` derives the
  spacing steps it enforces and the `biblePx` allowlist from the bible's scale,
  and `editor-shell.tokens.test.ts` calls the bible's scales normative. The new
  file must keep owning the same facts in a place the ratchet can read.
- **The file is named as normative by four other artifact families.** Each plan
  opens with a "Normative companion" line naming it, the mockups README calls
  itself its drawing, `docs/README.md` maps it as the one normative design
  document, and ADRs cite it by section.

## What was measured before designing

| Fact | Value |
| --- | --- |
| `§` references in `docs/`, `src/`, `scripts/` | **1487** (two families: the bible's `§1`–`§10`/`§7.5`, and the redesign spec's `§13`–`§172`) |
| "bible" mentions across those trees | **308**, in **57** files |
| The bible | 448 lines, 10 numbered sections, `§7` subdivided 7.1–7.8 |
| `@google/design.md` | 0.4.0, Apache-2.0, `lint` / `diff` / `export` / `spec` |
| `lint` on the current bible | **0 errors, 1 warning** — only "No YAML content found" |
| `lint` on a file with canonical sections out of order | `warning` (`section-order`), not an error |
| `lint` with `## Iconography` present | **silent** — an unknown heading is preserved |
| `lint` with no `colors` group | **silent**; a declared `omitted` entry reports an `info` |
| `export css-tailwind` output | Tailwind's canonical names (`--color-primary`, `--spacing-sm`, `--text-body-md`) |

The last row is why the front matter is **checked rather than generated**: the
repo's CSS speaks `--space-6`, `--edge`, `--hot` and resolves colour per theme at
runtime (ADR-0035), so generating the theme block would rename every token in the
codebase *and* still could not express a palette that changes per theme.

## Decisions

**D1 — the file is `DESIGN.md` at the repository root.** Not `docs/design/`: a
tool that has to be told where the file is has not been conformed to, and the
standard's consumers look for that name in that place.

**D2 — the `§N` markers retire with the bible.** Citations become section names.
The cost is stated in "What this costs" below and was accepted with it in view.

**D3 — the front matter is authored and checked, never generated.** It carries
the theme-independent scales; a check asserts they equal what
`editor-shell.css`'s `@theme static` declares. No token is renamed, and no
runtime value changes.

**D4 — the two token groups the format cannot honestly hold are declared
omitted, with reasons.** `colors` — the palette resolves per theme at runtime, so
a single YAML value would be false. `components` — the control set is normative
as prose and implemented in `packages/editor/src/components/ui/`; restating it as
tokens would create the second owner this repo's ownership rule exists to
prevent. `omitted` is the format's own mechanism for exactly this, and it turns
each omission into a documented `info` rather than silence.

**D5 — conformance is a gate.** `@google/design.md@0.4.0` is a devDependency
(Apache-2.0; `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` are
updated in the same commit), and `design:check` runs the linter plus the two
checks below, so a future edit that breaks conformance fails CI rather than
drifting.

**D6 — the "never renumber" rule is replaced by a check, not by trust.**
`AGENTS.md` loses the `§N` sentence and gains: headings are the stable
references; renaming a section or subheading is a sweep; and a script asserts
that every `DESIGN.md → …` citation in the repo names a heading that exists.

## The file

### Front matter

The values below are the ones `editor-shell.css`'s `@theme static` declares today
(`:287–320`), which the bible's tables already agree with — so this is a
transcription, not a decision. The plan copies them from the file rather than
from this spec, and the sync check is what holds them together afterwards.

```yaml
---
name: Vigilia
description: The editor's visual language — the one normative design document.
version: alpha
spacing:            # --space-* — the steps a surface may write
  4: 4px
  6: 6px
  8: 8px
  10: 10px
  12: 12px
  14: 14px
  16: 16px
  20: 20px
  24: 24px
  32: 32px
rounded:            # --radius-*
  sm: 4px
  md: 6px
  lg: 8px
  xl: 10px
typography:         # --text-* with their stated line-height companions
  text-2xs: { fontSize: 10px, lineHeight: 1.2 }
  text-xs:  { fontSize: 11px, lineHeight: 1.3 }
  text-sm:  { fontSize: 12px, lineHeight: 1.4 }
  text-md:  { fontSize: 13px, lineHeight: 1.3 }
  text-lg:  { fontSize: 15px, lineHeight: 1.3 }
  text-xl:  { fontSize: 19px, lineHeight: 1.2 }
omitted:
  - section: colors
    reason: The palette resolves per theme at runtime (ADR-0035); one YAML value per role would be false. The roles and their per-theme values are normative in the Colors section below.
  - section: components
    reason: The control vocabulary is normative as prose and implemented in packages/editor/src/components/ui/; tokens would be a second owner of it.
---
```

Three things the plan must settle by measurement, and each is a decision the
sync check then holds:

1. **`fontFamily`.** The format's `Typography` requires it and the bible names
   three families by job (UI sans, UI mono, theme fonts). The plan measures what
   the CSS declares for those stacks: where a stack is a token, the entry
   references it; where it is written inline at the use site, the plan states the
   stack in the front matter and says so in the commit.
2. **`rounded.full`.** The bible names `999px` for pills and toggles and the CSS
   declares no such token (measured: no `--radius-full` exists). Either the plan
   declares it and re-points its consumers in the same commit, or it stays in
   prose — decided by measuring whether any site hard-codes the literal.
3. **Elevation has no token group.** The format's groups are `colors`,
   `typography`, `rounded`, `spacing` and `components`; there is no shadow or
   elevation group, so the Elevation & Depth section is prose and its ladder
   stays in the stylesheet. A drift found while designing this — the ladder is
   declared twice, as `--elev-1..3` and as `--shadow-raised`/`--shadow-overlay`,
   with three of the five names consumed by nothing — is filed as **`vg-261`**
   and is deliberately not answered here.

### Section mapping

The standard's sections appear in its order; the bible's content moves into them
without rewriting a rule. Two sections the standard does not know sit **after**
Do's and Don'ts, where an unknown heading is preserved and costs no warning.

| DESIGN.md section | Carries | From |
| --- | --- | --- |
| `## Overview` | the one rule; what the language is for | §1 |
| `## Colors` | the palette tables, the roles, per-theme resolution | §4 |
| `## Typography` | the type scale and its use | §2 |
| `## Layout` | the spacing scale; the shell's layout: header, rail, panes, inspector, stage, status bar, overflow and motion, the reference's character | §3 (spacing), §7, §7.1–7.8 |
| `## Elevation & Depth` | the elevation ladder and where depth is tonal | §3 (elevation) |
| `## Shapes` | the radius scale, and what is square by rule | §3 (radius) |
| `## Components` | the control set, states, sizes, the editing and recovery rules, the keyboard and target-size rules; the icon vocabulary | §5, §5's subsections, §6 |
| `## Do's and Don'ts` | what is forbidden, and why | §10 |
| `## Density and disclosure` | density rules | §8 |
| `## Copy` | the copy rules | §9 |

Sub-structure survives as **named `###` headings** — `### Pane widths` under
Layout, `### The three state controls` under Components — so a citation still
has something specific to name.

### Citation convention

One form, everywhere: **`DESIGN.md → <Section>`**, with a subheading appended
when the precision is needed — `DESIGN.md → Layout → Pane widths`. Prose may read
`DESIGN.md's Layout`. The check in D6 resolves the arrow form, so the convention
is enforced rather than hoped for. `§` does not appear in a citation again.

## The sweep

- **1487 `§` references**: every one that resolves into the bible is re-pointed
  by section name. References into the *redesign spec*'s `§13`–`§172` are a
  different family and are **not** touched — that spec keeps its numbering.
- **308 "bible" mentions** in 57 files become "DESIGN.md" or are rewritten.
- **The readers**: `scripts/design-tokens.mjs` (`biblePx` → a name that says what
  it holds; its "Bible §3" comments), `editor-shell.tokens.test.ts`,
  `docs/README.md`, `docs/design/mockups/README.md`, the ADRs that cite sections,
  and the plans.
- **Plans 5 and 6 are queued and unstarted**, so their citations and their
  "Normative companion" lines move for free, including the two steps that
  currently say "amend bible §5/§6 in the same commit" — those become amendments
  to DESIGN.md.
- **`AGENTS.md`** trades the `§N` sentence for D6's rule.

## The checks

1. **`design:md:lint`** — `@google/design.md lint DESIGN.md`; the gate is
   **0 errors and 0 warnings**. Infos are allowed and their content is recorded
   in the task that lands the file.
2. **`design:md:sync`** — every `spacing`, `rounded` and `typography` value in
   the front matter equals what `editor-shell.css`'s `@theme static` declares.
   Direction of authority: the front matter is written from the CSS, and this
   check is what keeps the two from parting.
3. **`design:md:cite`** — every `DESIGN.md → …` citation in the repo resolves to
   a heading in the file. A citation that names nothing fails.
4. All three run inside `design:check`, which the existing gate already runs.

Each check is red-proofed before it is trusted: a wrong scale value, an unknown
heading, and a renamed heading must each be shown to fail.

## What this costs

- **Citations lose sub-number precision.** `§5.3` becomes `DESIGN.md →
  Components → <the subheading>`. Longer, and a renamed subheading breaks
  citations silently — which is why check 3 exists rather than a convention.
- **One large mechanical commit series** across 57 files, most of it comment
  text. It is deliberately sequenced after plan 4 so no running task's brief
  changes under it.
- **A new devDependency** and a new gate step, both of which this repo treats as
  real decisions rather than conveniences.

## Out of scope

- **No runtime value changes.** Every scale, colour and size stays what it is;
  the front matter is written from the CSS, not the other way round.
- **No token renames.** `--space-6` stays `--space-6`; the exporter's canonical
  vocabulary is not adopted.
- **The redesign spec's numbering** (`§13`–`§172`) is untouched — that is a
  requirement marker system for a different document, and `AGENTS.md`'s rule
  about it stays in force.
- **No new design rules.** This retires a file and a numbering system; it does
  not amend the language.

## Acceptance

1. `DESIGN.md` exists at the root and `docs/design/design-language.md` does not.
2. `design:md:lint` reports 0 errors and 0 warnings on it.
3. `design:md:sync` and `design:md:cite` pass, and each was shown to fail before
   its fix.
4. `grep -rn "§" docs src scripts` returns only references into the redesign
   spec's own numbering, and `grep -rin "bible" docs src scripts` returns
   nothing that means this document.
5. `AGENTS.md` carries D6's rule and no longer the never-renumber sentence.
6. `docs/README.md`, the mockups README and every plan's "Normative companion"
   line name `DESIGN.md`.
7. `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` list
   `@google/design.md` 0.4.0 with its Apache-2.0 licence.
