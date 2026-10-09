# The design bible becomes DESIGN.md

**Status:** designed, not started. Queued behind the active plan (plan 4, `the
panes`); `STATUS.md` names the order.

**The decision in one line:** `docs/design/design-language.md` — the bible — is
retired and replaced by a root `DESIGN.md` in the
[DESIGN.md format](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md),
validated by `@google/design.md`; the sections take the standard's canonical
names, and each carries its old `§N` as a marker in the body, so every existing
citation keeps resolving unchanged.

## Why this is not a formatting pass

Three interfaces move, and each has an owner today:

- **The `§N` markers are an interface.** 1487 `§` references across `docs/`,
  `src/` and `scripts/` resolve by number into the bible's ten sections;
  `AGENTS.md` states as a rule that they are stable and never renumbered. They
  are the one thing this work must not break, and the shape below is chosen to
  keep them.
- **The values are an interface.** `scripts/design-tokens.mjs` derives the
  spacing steps it enforces and the `biblePx` allowlist from the bible's scale,
  and `editor-shell.tokens.test.ts` calls the bible's scales normative. The new
  file must keep owning the same facts in a place the ratchet can read.
- **The file is named as normative by four other artifact families.** Each plan
  opens with a "Normative companion" line naming it, the mockups README calls
  itself its drawing, `docs/README.md` maps it as the one normative design
  document, and ADRs cite it.

## What was measured before designing

| Fact | Value |
| --- | --- |
| `§` references in `docs/`, `src/`, `scripts/` | **1487** — two families: the bible's `§1`–`§10`/`§7.1`–`§7.8`, and the redesign spec's own `§1`–`§172` |
| "bible" mentions across those trees | **308**, in **57** files |
| The bible | 448 lines, 10 numbered sections, `§7` subdivided 7.1–7.8 |
| `@google/design.md` | 0.4.0, Apache-2.0, `lint` / `diff` / `export` / `spec` |
| `lint` on the current bible | **0 errors, 1 warning** — only "No YAML content found" |
| `lint`, canonical sections out of order | `warning` (`section-order`) |
| `lint`, `## Iconography` present | **silent** — an unknown heading is preserved |
| `lint`, `## Colors` after `## Typography` | `section-order` warning — the plain name **is** recognised |
| `lint`, `## 4. Colors` after `## Typography` | **no finding** — the number makes the heading unrecognised |
| `lint`, `## Colour` / `## 4. Colour` | **no finding** — the British spelling is not an alias |
| `lint`, no `colors` group | silent; a declared `omitted` entry reports an `info` |
| `export css-tailwind` output | Tailwind's canonical names (`--color-primary`, `--spacing-sm`, `--text-body-md`) |

Two of those rows decide the design. **A number in the heading text is not an
error — it costs recognition**, which is why the markers go in the body and the
headings keep the names. And **the exporter's vocabulary is not this repo's**:
the CSS speaks `--space-6`, `--edge`, `--hot`, and resolves colour per theme at
runtime (ADR-0035), so the front matter is checked rather than generated.

## Decisions

**D1 — the file is `DESIGN.md` at the repository root.** Not `docs/design/`: a
tool that has to be told where the file is has not been conformed to, and the
standard's consumers look for that name in that place.

**D2 — the sections take the standard's canonical names and keep their `§N` as a
marker in the body.** Each section heading is followed by an HTML comment
carrying its old number:

```markdown
## Layout

<!-- §7 -->

…the bible's Layout section, unchanged…
```

The heading is recognised by the linter; the marker keeps `§7`, `§7.3` and every
citation that names them resolving exactly as they do today. This is the whole
reason the plan is small: **no citation is re-pointed.** What changes in the
prose is only the word "bible", which becomes "DESIGN.md".

**D3 — the markers are declared in one place, and a check enforces them.** The
bible's numbering is `§1`–`§10`, with sub-numbers only under `§7`
(`§7.1`–`§7.8`); no other sub-numbered citation in this repo means the design
language, and every other `§N` in the range belongs to the redesign spec. The
check in D6 uses exactly that rule, so a section that is deleted, merged or
renumbered fails CI instead of silently orphaning citations.

**D4 — the front matter is authored and checked, never generated.** It carries
the theme-independent scales; a check asserts they equal what
`editor-shell.css`'s `@theme static` declares. No token is renamed, and no
runtime value changes.

**D5 — the two token groups the format cannot honestly hold are declared omitted,
with reasons.** `colors` — the palette resolves per theme at runtime, so a single
YAML value would be false. `components` — the control set is normative as prose
and implemented in `packages/editor/src/components/ui/`; restating it as tokens
would create the second owner this repo's ownership rule exists to prevent.
`omitted` is the format's own mechanism for this, and it turns each omission into
a documented `info` rather than silence.

**D6 — conformance is a gate, and the citation rule is a check rather than a
memory.** `@google/design.md@0.4.0` is a devDependency (Apache-2.0;
`THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` updated in the
same commit), and `design:check` runs the linter plus the checks below.

## The file

### Front matter

The values below are the ones `editor-shell.css`'s `@theme static` declares today
(`:287–320`), which the bible's tables already agree with — a transcription, not
a decision. The plan copies them from the file rather than from this spec, and
the sync check holds them together afterwards.

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

Three things the plan settles by measurement, each then held by the sync check:

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
   and deliberately not answered here.

### Section mapping

The standard's sections appear in its order; the bible's content moves into them
without rewriting a rule. Two sections the standard does not know sit **after**
Do's and Don'ts, where an unknown heading is preserved and costs no warning.

| DESIGN.md section | Marker | Carries | From |
| --- | --- | --- | --- |
| `## Overview` | `§1` | the one rule; what the language is for | §1 |
| `## Colors` | `§4` | the palette tables, the roles, per-theme resolution | §4 |
| `## Typography` | `§2` | the type scale and its use | §2 |
| `## Layout` | `§7` | the shell's layout: header, rail, panes, inspector, stage, status bar, overflow and motion, the reference's character | §7, §7.1–7.8 |
| `## Layout` → `### The scales` | `§3` | the spacing steps and the row rhythms | §3 (spacing) |
| `## Elevation & Depth` | *no marker* | the elevation ladder — prose, because the format has no token group for it | §3 (elevation) |
| `## Shapes` | *no marker* | the radius scale, and what is square by rule | §3 (radius) |
| `## Components` | `§5`, `§6` | the control set, states, sizes, editing and recovery, keyboard and target size; the icon vocabulary | §5, §6 |
| `## Do's and Don'ts` | `§10` | what is forbidden, and why | §10 |
| `## Density and disclosure` | `§8` | density rules | §8 |
| `## Copy` | `§9` | the copy rules | §9 |

`§3` is the one number that splits across three headings, and it is the one place
the marker rule needs care. Ruling: the `§3` marker sits under `### The scales`
in Layout — the spacing steps, which is what the ratchet reads and what nearly
every `§3` citation in the codebase means — and the radius and elevation halves
carry named headings (`### Radius`, `### Elevation`) with no marker of their own.
A `§3` citation still resolves; a citation that means the radius scale says
`DESIGN.md → Shapes`, which is where a reader finds it.

Sub-structure survives as **named `###` headings** — `### Pane widths` under
Layout, `### The three state controls` under Components — so the marker keeps its
precision and a reader keeps the bible's granularity.

### Citation convention

Unchanged from today: **`§N`**, with the sub-number where the bible has one
(`§7.3`). Where a sentence needs to name the document, it says `DESIGN.md §5`.
No citation is rewritten by this work beyond the word "bible" becoming
`DESIGN.md`.

## The sweep

Small, and mostly mechanical:

- **308 "bible" mentions** in 57 files become `DESIGN.md` or are rewritten; the
  strongest form is a citation, so most become `DESIGN.md §5`.
- **The readers**: `scripts/design-tokens.mjs` (`biblePx` → a name that says what
  it holds; its "Bible §3" comments), `editor-shell.tokens.test.ts`,
  `docs/README.md`, `docs/design/mockups/README.md`, the ADRs that cite sections.
- **Plans 5 and 6 are queued and unstarted**, so their "Normative companion"
  lines and their two steps that say "amend bible §5/§6 in the same commit" move
  for free; plan 4's remaining tasks cite `§N` and are untouched by all of this.
- **The redesign spec's own numbering is not touched at all** (`§1`–`§172`).
- **`AGENTS.md`** keeps "`§N` requirement markers are stable; never renumber them"
  and gains the second half: the markers live in `DESIGN.md`, and a check asserts
  every citation resolves.

## The checks

1. **`design:md:lint`** — `@google/design.md lint DESIGN.md`; the gate is **0
   errors and 0 warnings**. Infos are allowed and recorded in the task that lands
   the file.
2. **`design:md:sync`** — every `spacing`, `rounded` and `typography` value in
   the front matter equals what `editor-shell.css`'s `@theme static` declares.
   Direction of authority: the front matter is written from the CSS, and this
   check keeps the two from parting.
3. **`design:md:cite`** — every `§N` citation in the repo whose number is in
   DESIGN.md's declared range (`§1`–`§10`, and `§7.1`–`§7.8`) resolves to a
   marker in the file; every marker is claimed by at least one citation, so a
   section nothing cites is reported rather than forgotten. A number outside that
   range is the redesign spec's and is ignored.
4. All three run inside `design:check`, which the existing gate already runs.

Each check is red-proofed before it is trusted: a wrong scale value, a citation
whose marker was deleted, and a marker no citation claims must each be shown to
fail.

## What this costs

- **The number is no longer in the heading text**, so a rendered DESIGN.md shows
  `## Colors` and the `§4` sits above it as an HTML comment. A reader who wants
  the number has it, one line down.
- **One mechanical commit series** across 57 files, entirely the word "bible" and
  the file's own name — no citation's *number* changes, which is why this can run
  without disturbing a plan mid-flight: it is sequenced after plan 4 regardless,
  but the sequencing is hygiene rather than a necessity.
- **A new devDependency** and three gate steps, which this repo treats as real
  decisions rather than conveniences.

## Out of scope

- **No runtime value changes.** Every scale, colour and size stays what it is;
  the front matter is written from the CSS, not the other way round.
- **No token renames.** `--space-6` stays `--space-6`; the exporter's canonical
  vocabulary is not adopted.
- **No citation re-pointing.** The marker shape exists so that the 1487 `§`
  references keep meaning what they mean today.
- **The redesign spec's numbering** is untouched, and `AGENTS.md`'s rule about it
  stays in force.
- **No new design rules.** This retires a file and adopts a format; it does not
  amend the language.

## Acceptance

1. `DESIGN.md` exists at the root and `docs/design/design-language.md` does not.
2. `design:md:lint` reports 0 errors and 0 warnings on it.
3. `design:md:sync` and `design:md:cite` pass, and each was shown to fail before
   its fix.
4. Every section in the mapping table carries its marker; `§1`–`§10` and
   `§7.1`–`§7.8` all resolve.
5. `grep -rin "bible" docs src scripts` returns nothing that means this document.
6. `AGENTS.md` states where the markers live and that the citation check enforces
   them.
7. `docs/README.md`, the mockups README and every plan's "Normative companion"
   line name `DESIGN.md`.
8. `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` list
   `@google/design.md` 0.4.0 with its Apache-2.0 licence.
