# Frontend redesign — one design, four surfaces

- **Status:** draft
- **Amends:** §35 (application shell), §47 (small display bundle), §64 (rulers/grid/guides
  and snapping), §145 (hosting and settings), §172 (layer tree and one action owner),
  §173 (authored density over decoration), §174 (canvas navigation)
- **Proposes three new requirements** — the display is the design target; one contextual
  toolbar; chrome follows the system appearance. `docs/product/requirements.md` allocates
  the `§N` markers; this spec names the topics and does not number them.

## Why

Driven, not read. The host ran on `127.0.0.1:8831` with the starter theme; the editor,
the settings page and the player were each opened in a real browser at 1512×900 and at
390×844. Everything below was observed in that session on 2026-10-02.

| # | Observed | Where |
|---|---|---|
| A | On a 390×844 phone the 1672×941 artboard renders as a ~390×190 strip: **22% of the screen height, 78% black**. Live figures are ~10px tall. | player, 390×844 |
| B | The host binds loopback only. Reaching a phone needs `--host 0.0.0.0` on a command line. **No pairing UI, no QR, no LAN address, no device preview** — zero matches for any of them in `host/public/` or the editor. | host, settings page, editor |
| C | The layer panel lists **52 rows, every one `aria-level="1"`**, with 165 icons and 127 buttons in one 280px column. `ram-card`, `ram-card-title`, `ram-card-icon`, `ram-value` and `ram-gauge` are indistinguishable but for a 12px glyph. | editor, Layers pane |
| D | **18 unlabelled icons sit on the canvas at once**: 9 in the dock, 9 in the arrange toolbar, two arrow-ups and two arrow-downs adjacent. | editor, stage |
| E | The chrome is warm cream glass; the dashboards it makes are dark and neon. `editor-shell.css` holds **50 hex colours, 35 px literals, 8 radii and 0 spacing/radius/type/elevation tokens**. The 16 `--vigilia-*` tokens are declared only under `[data-shell-palette="editorial"]` and are defined nowhere else in the tree, so under the other five palettes every reference resolves to nothing. `index.html` declares `content-scheme="light dark"`; there is no `prefers-color-scheme` rule in the editor at all. Tailwind 4.3.3 and a shadcn config are installed; **zero utility classes are used**. | editor, source |
| F | `New theme · New from starter · Open package · Save package · Release package · Open library · Save to library`. Three save verbs, unexplained, unseparated. Success is one line of text in the bottom-left of a 1512px window. | editor, File menu |
| G | The Design tab scrolls `SELECTION` (12 fields) → a `Paint:` provenance line → a hint sentence → `THEME SETTINGS`, a different scope, same scroll, no divider. The 280px panel also has a horizontal scrollbar. | editor, inspector |
| H | The settings page is the bar the editor does not reach: *"Only one found — dashboards use NVIDIA GeForce RTX 3080 Ti."* *"Leave one blank to use the name it reports."* Every control explains itself. | host, settings page |

**One defect, four symptoms.** Vigilia has no concept of the display it is designing for.
A says the author never sees the consequence of choosing an orientation. B says there is
nowhere to see it. C says the panel shows the document's innards rather than its
composition. F says saving never says where the result went. Fix the shell and none of
them improve, because the shell is not what is missing.

## The design

**The author's loop closes in one window: make it, see it where it goes, publish it there.**

Everything below serves that. The device the dashboard is for becomes a thing the editor
shows you continuously, the host tells you how to reach it, and publishing names its own
consequence.

## Scope

**In.** Redesign of the editor shell, the player chrome, and the host settings page, plus
the three capabilities the observations prove are missing: a display target the editor
can show, a host path to the phone, and honest save/publish feedback.

**Out.** New product surface nobody asked for — no template gallery, no responsive
artboards, no richer sensor discovery, no theme store, no collaboration. A capability
enters only where an observation above shows its absence. Typography follows the font
trio catalogue plan already in flight; this design does not restate it.

## Invariants that survive the redesign

These are not design decisions and this spec does not touch them.

- Fabric stays imperative behind the editor boundary. React never mirrors a Fabric
  object; panels render the bridge's serializable projection.
- One owner per concept. Object actions keep their registry (§172); this spec changes
  how many surfaces *render* them, not where they are defined.
- `renderer-core` stays Fabric- and DOM-free. The player keeps its import boundary and
  its bundle gate (§47).
- Persist authored state only. Viewport, collapse, selection and device choice are
  transient and never enter authored history (§67).
- Never fabricate a reading. A missing or non-`ok` sample stays a gap.
- Editor-shell theming stays separate from authored theme globals (§35).

## The editor

### Structure — two columns, no rail

The rail is four icons choosing which of four panes fills one 280px column, one of which
holds a single dropdown. That is a navigation level spent on a colour picker.

**Drop the rail.** The stage gains 52px. The left column becomes a single panel with a
segmented header — **Layers · Insert · Assets · Document** — and the right column is the
properties panel. Collapsing the left column still hands the canvas the width; the
existing collapse-and-refit behaviour carries over unchanged.

The shell palette is not a document property and never was; it moves to the header as a
compact swatch that opens the palette list. That is why the rail's `Settings` entry has
no successor.

Panel scroll offsets survive a pane swap (already implemented, and worth keeping — the
starter's 52 rows make losing your place real).

### The layer panel — composition, not enumeration

Three changes, all of them subtractive:

1. **Groups start collapsed.** The starter's 52 rows become its top-level groups alone.
   A group *is* the composition; expanding it is opting into the innards. Collapsed-by-
   default is a default, not persisted viewport state (§67).
2. **Kind becomes a treatment, not a glyph.** A text row renders its own string in its
   own face at small size — you read what it says *and* that it is text. A chart row
   carries a family mark, a shape row a filled swatch. This is the only way a row's kind
   survives at 280px.
3. **Lock and visibility hide until they are true.** Today all 52 rows carry two icons
   reading "visible, unlocked" — 104 icons saying nothing. They appear on hover, on
   selection, and whenever they differ from the default. The icons remain state
   indicators that happen to be clickable (§172); they just stop shouting.

Drag-to-reorder, inline rename and the refusal of a cross-group drop are unchanged.

### Selection actions — one contextual toolbar

Eighteen unlabelled icons is not a toolbar, it is an icon wall.

**One toolbar, above the selection, rendering from the action registry.** The separate
arrange toolbar goes: arrange actions need a multi-selection and the dock does not care,
so it is a registry eligibility question, not a layout question (§172). The four z-order
arrows collapse into one **Order** menu with four named items — two ups and two downs
beside each other is unreadable at any size. Every remaining icon carries a visible
tooltip on hover; the `controls/tooltip.ts` helper is the owner.

This also removes the hint sentence *"Chart settings are under Data"*, which exists only
because the tab split hid them.

### The properties column — one scope at a time

The Design tab interleaves object properties and document properties in one scroll. They
are different questions and never appear together.

**The Design/Data/Style tabs go.** The right column is one scrolling stack of labelled
sections, scoped to the selection:

- an object shows only the sections that apply to it — geometry, typography, appearance,
  and **data** for a chart;
- **nothing selected shows the document** — artboard, globals, assets, bindings.

Sections are collapsible, so a chart's long list stays navigable. No tab hides a
property; no scope shares a scroll with another.

The field vocabulary stays: `NumberField` and `LinkedPair` are right, and they are what
the panels opt into rather than what CSS forces on them.

### Chrome — a token system, and an honest colour scheme

Four token layers are added where there are none: **spacing, radius, type scale,
elevation**. These replace 35 px literals, 8 radii and 5 font sizes. The 12 `--shell-*`
colour tokens are the one layer that already works and stay.

- `--vigilia-*` moves into `:root`; `editorial` keeps only what it overrides. Every
  palette then resolves.
- `--shell-flat` is wired to its evident purpose — collapsing the 6-selector glass lists
  repeated four times — or deleted if it cannot be.
- **The editor follows the system appearance.** `prefers-color-scheme` picks a default;
  the palette picker is an explicit override on top. `index.html` already claims
  `content-scheme="light dark"`, so this makes the claim true instead of removing it.
- **Tailwind is adopted, not merely installed.** §35 names it, Base UI is already the
  component library, and a token scale is exactly what its theme block expresses. The
  hand-authored spacing, radius and type declarations go as utilities replace them.
  `components.json` is deleted: nothing generates or consumes shadcn, and a config
  implying a component library that does not exist is the same defect as a token that
  resolves to nothing.

Density stays what §173 set: more of it, not less. The reference remains Figma UI3 where
Vigilia has no answer of its own.

### Saving — two verbs, stated consequence

`Save package`, `Release package` and `Save to library` ask an author to learn what a
package is before they have made one.

**Two verbs:**

- **Publish to this PC** — writes the theme to this machine's library *and* makes it what
  the displays show. The consequence is in the verb.
- **Export** — writes a `.zip` to the PC.

`Release package`'s distinct purpose must be **confirmed by reading `#release` before the
plan decides its fate**, not assumed to be one of the two. If it is Export-with-a-
thumbnail it folds into Export; if it is something else it earns its own name or goes.

Feedback moves to **a toast beside the action**, not the status bar — at 1512px wide, a
line of text in the bottom-left corner is not feedback, it is a log. The status bar keeps
ambient state and stops showing developer text: *"Fabric editor ready"* is not a fact
about the author's document. Destructive actions confirm, and confirm with undo.

### The canvas — a display target

Not a second renderer and not a device-preview subsystem: **device presets in the zoom
control**, beside the existing fit and 100%. Selecting *Phone portrait* or *Phone
landscape* frames the artboard in that shape. One canvas, the camera the viewport already
owns (§174), and the consequence of an orientation choice visible in one click.

Transient, per §67. Not an artboard property, because the same theme may be shown on a
wall panel and a phone and the artboard is one document (§51).

### The header — and the loop's last mile

Once LAN is on, the editor header carries the display's address and a QR code. An author
who has just built a theme is one click from the phone showing it, without leaving the
window they built it in.

## The player

**The letterboxing stays.** Orientation is the author's per-theme choice and a mismatched
theme is *contain*-fitted by design (§53). The defect is that choosing was uninformed,
and the editor's device presets fix that. Nothing about rendering changes.

What changes is that **diagnostics stop competing with the theme for the best pixels**:

- The availability strip is currently a **full-bleed amber banner across the top of the
  phone** — roughly 90px of an 844px screen, for a message about a monitoring tool the
  author chose not to run. It becomes a small, quiet, corner-anchored marker carrying a
  count; expanding it is deliberate. `availability-notice.ts` already caps its reasons at
  three, and that cap is right.
- The connection banner gets the same treatment.

Colour keeps its semantic meaning (amber = missing reading, red/cyan = connection) —
that is load-bearing and stays.

`load-failure.ts` is the one real page, it is well made, and it is not touched.

**Legibility at arm's length is not claimed as a defect.** The figures are ~10px on a
390px phone, but whether that is too small depends on viewing distance, which was not
measured. The device presets make it *checkable*, which is the honest fix.

## The host settings page

The copy here already meets the bar the editor should reach (H). It keeps its standard.

**Add a Hosting section.** §145 calls LAN serving "explicit opt-in". Today it is explicit
by absence: you get it by editing a command line. The section carries the toggle, the LAN
address once it is on, and a QR code encoding it.

That is filling a proven gap against an existing requirement, not a new capability. The
threat model is unchanged — §145's "plain LAN HTTP has no confidentiality; never suggest
internet exposure" still governs, and the section must not read as an invitation to
expose anything.

The theme list keeps its thumbnails; the shipped template's placeholder hatch is a real
gap worth a plan task.

## The loop

Compose → edit → **device preset** → **Publish** → **QR** → phone. Six steps, one window,
no menu archaeology.

## Decisions where another was defensible

Recorded so the review can argue with them.

| Decision | Alternative | Why this one |
|---|---|---|
| Drop the rail | Keep it, fix the panes | A navigation level spent on a palette dropdown; 52px of stage for it |
| One properties column, no tabs | Keep tabs, scope each | Tabs *hid* chart data behind a hint sentence; hiding a property is the bug |
| Arrange merges into the dock | Keep two toolbars | The registry already answers eligibility; two floating bars is a layout duplication |
| Groups collapsed by default | Expanded by default | 52 rows is the innards; the composition is ~10 |
| Adopt Tailwind | Remove it, keep hand-authored CSS | §35 names it and it is installed; adopting is smaller than justifying the install |
| Follow the system appearance | Manual palette only | The meta tag already claims `light dark`; the claim is the cheaper thing to honour |
| Device presets in the zoom control | A real device-preview panel | One canvas, the camera that already exists, no second renderer |

## Non-goals

Explicitly declined, so they are not re-raised: no responsive/multi-orientation themes;
no second scene renderer; no new theme-store or sync; no mobile authoring (the editor
stays desktop-only); no decoration, no scroll-driven or staggered motion (§173); no
component library beyond Base UI; no redesign of `renderer-core`, the persistence path,
or the acquisition pipeline.

## Acceptance

Evidence is rendered observation in a real browser, per §33. Each item names what was
seen.

- A 390×844 player shows the starter with the artboard `contain`-fitted and no
  full-bleed diagnostic banner occupying the top of the screen.
- A theme published from the editor is what the host displays without a second save step,
  and the status bar says which theme is live.
- With LAN on, the address and a scannable QR code are visible in both the editor header
  and the settings page, and a phone loading the QR shows that theme.
- The starter's layer panel shows only its top-level groups on open, and expanding
  reaches all 52 rows; lock and visibility icons are absent from rows in their default
  state.
- The left column has no rail; the stage is at least 52px wider at the same window size.
- The properties column shows object sections when an object is selected and document
  sections when nothing is, and never both in one scroll.
- Exactly one contextual toolbar is on the canvas with a selection, and every button in
  it has a hover tooltip.
- Every chrome colour resolves under all six shell palettes — no unresolved
  `--vigilia-*` reference in any palette.
- With the OS in dark mode and no palette override, the editor chrome is dark; with
  `prefers-reduced-motion: reduce`, no motion runs.
- The File menu offers Publish and Export, and publishing raises a toast naming the
  theme that is now live.
- The status bar shows document state only; `Fabric editor ready` is gone.

## For the plan

The plan phase should decompose into at least: **display target** (device presets, then
hosting + QR), **editor structure** (rail removal, properties scoping, toolbar merge),
**layer panel**, **token system and appearance**, **save/publish**, **player chrome**.

One precondition, not a design question: `scripts/reuse-gate.mjs` decides whether the
token-system change needs a note under `docs/decisions/` before its first write. The plan
resolves that before touching CSS.