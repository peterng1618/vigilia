# Vigilia design language

**Normative.** Every editor surface is built from what is written here, and a
new surface that needs something absent from it changes this file in the same
commit rather than inventing a local exception. The design record for *why* is
[`../superpowers/specs/2026-10-08-editor-design-language-design.md`](../superpowers/specs/2026-10-08-editor-design-language-design.md);
this file is what that spec produced and what later work reads instead of
re-deriving.

Scope: **the editor**. The player has its own chrome rules, and the canvas —
inside the artboard — is the author's design, not ours.

## 1. The one rule

**The editor is quiet so the dashboard is loud.** The themes this product makes
are dark, saturated and dense with data. Every part of the editor that is not
the artboard recedes: one accent, used for one thing at a time, and no surface
of its own competing with the artboard for attention.

Two consequences that decide most arguments:

- **Chrome does not decorate.** If a border, shadow or colour does not
  distinguish one thing from another, it is not there.
- **Text is not the interface.** A control that can be a glyph is a glyph; a
  label appears where a glyph would be ambiguous, and in a tooltip where the
  glyph is standard.

## 2. Type

Three families, each with one job.

| Family | Job | Where |
|---|---|---|
| UI sans (`system-ui` stack) | Everything a person reads as language | Labels, menus, headings, panel copy |
| UI mono (`ui-monospace` stack) | Everything a machine produced or will parse | Values, coordinates, token names, chord marks, counts |
| Theme fonts | The author's typography | Inside the artboard only; never in chrome |

**Values are mono; labels are sans.** This is the single largest difference from
a form-shaped panel and it is not decorative: a mono value is scannable by
column and cannot be mistaken for prose. A number a person types is mono. A
number that is prose ("three parts") is sans.

### The scale

| Token | Size | Line height | Used for |
|---|---|---|---|
| `--text-2xs` | 10px | 1.2 | Section eyebrows, badge marks |
| `--text-xs` | 11px | 1.3 | Panel rows, hints, status bar |
| `--text-sm` | 12px | 1.4 | Control text, menu items, list rows |
| `--text-md` | 13px | 1.3 | The selection's title, panel titles |
| `--text-lg` | 15px | 1.3 | Dialog titles |
| `--text-xl` | 19px | 1.2 | Empty-state headings |

Uppercase is reserved for **section eyebrows** — Content, Position, Layer,
Paint, Spends, and the group headings in the Add pane. An eyebrow is
`--text-2xs`, `600`, `letter-spacing: .11em`, muted, and it always labels a
region, never a control. Nothing else is uppercase: a chord is printed as the
platform prints it, and a menu row is sentence case.

Weights: `400` body, `500` emphasis inside a row, `600` titles and eyebrows,
`650`–`700` only for the brand mark and a primary button. Nothing is bolder than
`700`.

## 3. Space, radius, elevation

### Spacing

A 4px base. The named steps are the only ones a surface may use:
`4, 6, 8, 10, 12, 14, 16, 20, 24, 32`. A one-off `7px` is a signal that the
layout is being tuned by eye and should be re-derived.

| Step | Use |
|---|---|
| 4 | Inside a control (well padding, icon button) |
| 6 | Between the rows of one section |
| 8 | Between a label and its control |
| 12–14 | Section padding, panel gutter |
| 16 | Between sections |
| 20–24 | Between regions; dialog padding |
| 32 | Empty-state breathing room |

Row rhythm: a control row is **26px** tall in a panel, **30px** in a dialog,
**32px** in the settings surface. Density does not vary by taste — it varies by
which of those three a surface is.

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Swatches, inline chips, the slider thumb's container |
| `--radius-md` | 6px | Controls, menu rows, small tiles |
| `--radius-lg` | 8px | Panels, cards, tiles in a grid |
| `--radius-xl` | 10px | Floating clusters (dock, view controls, identity chip) |
| full | 999px | Pills and toggles only |

### Elevation

Four levels, and a surface sits at exactly one.

| Level | Treatment | Use |
|---|---|---|
| 0 — flat | No shadow, 1px `--edge` border | Panels, rail, header, inspector |
| 1 — raised | `0 8px 20px #00000059` | Floating clusters over the canvas |
| 2 — overlay | `0 18px 44px #00000099` | Menus, popovers, tooltips |
| 3 — modal | `0 24px 60px #000000b3` + scrim `#00000073` | Dialogs |

**Floating clusters blur their backdrop** (`backdrop-filter: blur(6px)`) and are
never fully opaque: the canvas must read through them, because they sit on the
artboard the author is judging.

## 4. Colour

Colour is a **runtime palette**, not a set of literals. Six palettes ship
(`editorial`, `graphite`, `ember`, `moss`, `plum`, `light`); the OS appearance
picks the default and the author may override it in Settings.

A surface never writes a hex value. It writes one of these roles, and the
palette resolves it:

| Role | Meaning |
|---|---|
| `--bg` | The window behind everything |
| `--stage` | The area around the artboard |
| `--panel` / `--panel-2` | A panel, and a control inside it |
| `--hdr` | The header and the dock chrome |
| `--edge` / `--edge-2` | A boundary, and a fainter one (dividers inside a section) |
| `--text` | Primary text |
| `--muted` | Secondary text, labels, inactive icons |
| `--faint` | Tertiary: counts, hints, disabled glyphs |
| `--accent` | The one thing the author should do or has done |
| `--warn` | Something needs attention; not an error |
| `--hot` | Destructive. Delete, and only delete |

**`--accent` is rationed.** At most one accent-filled element is visible in a
region at a time: the selected rail slot, the focused control, the selected row,
the primary button. Two accents in one region means neither is the accent.

**`--hot` marks destructive affordances only.** It never marks "important", and
a disabled destructive control stays `--faint` rather than dimming red.

## 5. Controls

The vocabulary is closed. A control is one of these, or it is not a control.

| Control | Looks like | Means |
|---|---|---|
| **Well** | `--panel-2` fill, 1px `--edge`, `--radius-md`, text or value inside | You can change this |
| **Well with chevron** | A well, plus a `▼` in `--faint` | Opens a list |
| **Well with unit** | A well, value right-aligned in mono, unit in `--faint` at the right edge | A number with a fixed unit |
| **Slider + well** | A 3px track, an accent fill, a 10px thumb, and a 36px well | A bounded number |
| **Swatch well** | A well containing an 11px radius-4 swatch, then the token name, then a chevron | A paint reference |
| **Toggle** | A 26×14 pill, accent when on | A boolean that applies immediately |
| **Segmented** | A `--panel-2` well holding 2–4 labels, the active one lifted to `--stage` | A small exclusive choice where both options must be readable |
| **Icon button** | A 26–30px square at `--radius-md`, glyph only | An action whose glyph is unambiguous |

**Rules that make it readable:**

1. **A value inside a well means editable.** Structural borders on panels and
   disclosures do not mean editable. A value row with no well is read-only, and
   it says so in its section header — never in a tooltip, never inferable only
   from absence. `Spends` is the standing example.
2. **Read-only rows are label + mono value, baseline-aligned, right-aligned.**
   They share the grid with controls so a section does not jump between shapes.
3. **A refused capability renders with its reason.** A property the kind does
   not have is omitted (§7.4); an existing capability this selection cannot use
   keeps its row. The reason is visible and connected with `aria-describedby`.
   `aria-disabled` alone blocks nothing: pointer, keyboard, scrub and commit
   paths must all refuse mutation. A natively disabled control is acceptable
   only when its reason remains readable without focusing it. The dock's
   registry-filtered object actions remain the explicit exception (§7.5).
4. **Keyboard focus is an accent boundary, not only a translucent halo.** Keep
   the 3px accent-at-18% halo as decoration; the solid focus boundary must have
   at least 3:1 contrast against adjacent colours in all six palettes. Never
   remove the browser outline without a visible replacement. In forced-colours
   mode use a system-colour outline; a box shadow may disappear. Focus cannot
   be clipped by a scroller or covered by a floating cluster.
5. **Every control has a label, a programmatic name, and an id.** A control with
   neither `aria-label` nor a `<label for>` is a defect, not a style choice.
6. **Hover raises `--edge` to `--muted`.** Nothing moves, nothing scales.

### Editing and recovery

- **Draft is not authored state.** Text and number fields retain the draft
  while typing, including an empty string, a minus sign and an incomplete
  decimal. Enter or blur commits one valid changed value; Enter followed by
  blur cannot commit twice. Escape restores the last authored value without
  history. IME composition is not an Enter commit.
- **Validation belongs to the field's owner.** Finite numbers and the owner's
  bounds are required; invalid input is never coerced to zero or silently
  clamped. Show the reason beside the field, mark `aria-invalid`, and preserve
  the rejected draft until corrected or cancelled. Optional numeric fields
  distinguish clearing the authored key from writing zero.
- **Gestures have one undo boundary.** Sliders and scrubs may preview through
  the existing imperative write funnel. Release commits one changed value;
  cancellation restores the start value and adds no history. A selected object
  disappearing or changing mid-gesture cancels; it never edits its successor.
- **Stable identity keeps work in place.** A telemetry update cannot replace a
  focused input, reset its draft or caret, reopen a section, or move its scroll
  position. A genuine target change may end editing, with no stale commit.

### Keyboard and target size

- Tab order follows visible reading order. Composite controls use their
  installed primitive's keyboard model, not one Tab stop per decorative child.
  Section headers are buttons exposing `aria-expanded`; toggles expose their
  checked state; every icon-only action works without hover.
- Escape closes the innermost active layer or cancels the active edit, once.
  Closing a popup returns focus to its trigger. If that trigger was removed,
  focus returns to the nearest surviving control in its owning region.
- Dense chrome targets have at least a 24×24 CSS-pixel hit area. A small glyph
  may sit inside a larger target; adjacent targets must not overlap. No
  drag-only route to an action already reachable through commands is accepted.
- Required labels, refusals and selected-state text meet 4.5:1 contrast for
  normal text; essential control boundaries meet 3:1. `--faint` is decorative
  or genuinely inactive, never the sole carrier of required information.

## 6. Icons

**Glyphs are stroke-based, 1.6–1.8px, `currentColor`, drawn on a 24px grid.**
One family, one weight, everywhere. A filled glyph appears only where a stroke
would be illegible at 12px (the record dot, the live check).

Rules:

- **An icon replaces a word only when the word is unambiguous from the glyph.**
  Where it is not, the glyph carries a tooltip and the label is in the accessible
  name. Where even that is ambiguous, it stays a word.
- **Every icon-only control has an `aria-label`, and the tooltip is that label.**
  One string, one owner — a glyph button whose tooltip and accessible name can
  disagree is a defect.
- **An icon set is closed when the kind list is closed.** The object-kind glyphs
  are exactly the insertable kinds; a new kind adds one glyph or the set is
  wrong.
- **A group gets a generic glyph.** A card on the canvas is an arbitrary group of
  elements, so its row cannot depict it. It gets the stack glyph and its name.
  A *card unit* in the Add pane is not arbitrary — the card library is a fixed
  set of eight — so a unit tile may carry a diagram of what it builds.
- **Destructive actions use `--hot`, never `--accent`.**

## 7. Layout

```
┌───────────────────────────────────────────────────────────────┐
│ header     brand · File · Edit · View ·············· ⌘⇧P Publish│
├────┬──────────────┬───────────────────────────┬───────────────┤
│rail│ pane         │        stage              │  inspector    │
│ 46 │ expanding    │  ┌ chip ─────── view ┐    │               │
│    │              │  │      artboard     │    │               │
│    │              │  │      [dock]       │    │               │
│    │              │  └───────────────────┘    │               │
│ ⚙  │              │                           │               │
├────┴──────────────┴───────────────────────────┴───────────────┤
│ status bar        counts · ··············· saved · live        │
└───────────────────────────────────────────────────────────────┘
```

### 7.1 The header

**Document-level and editor-level actions only.** A command that has a rightful
home elsewhere is not repeated here — Insert lives in the Add pane, so the
header has no Insert menu.

- Left: brand mark, then `File`, `Edit`, `View`.
- Right: the publish chord, then the **primary button**. `Publish` is the only
  filled, accent-coloured button in the editor.
- **The header never shows the document's identity** and never shows a
  per-document readout. Both are on the canvas (§7.5).

Why `View` stays: the things in it — preview/source, chart refresh, run display
— are changed *while* designing, many times a session. Settings is for
once-in-a-while choices. A frequently changed control one level deeper is a tax
paid on every use.

### 7.2 The rail

A 46px vertical strip of glyph slots at the window's left edge, with the
settings gear pinned to the foot. **Four slots:**

| Slot | Glyph | Holds |
|---|---|---|
| Composition | stack | The scene tree, and the object actions that act on it |
| Add | plus | Everything insertable, and placing a file |
| Tokens | palette | The theme's paints and type presets — created and edited here |
| Document | page | Artboard, background, metadata, references |

**At most one slot is open at a time.** Asking for the open slot closes it;
asking for another replaces it. The pane occupies its own layout track beside
the rail. Opening it may resize the available stage, but never translates
objects or writes authored coordinates; the viewport owner handles fitting.
The existing open/close layout behaviour survives the rewrite, rather than
introducing an overlay that hides artwork or controls. The selected slot carries the accent glyph, an accent
wash, and a 2px accent bar on the rail's inner edge.

The rail replaces the horizontal pane bar. A second horizontal bar under the
header is forbidden: two stacked rows of navigation make the first one read as
chrome rather than as a choice.

### 7.3 Panes

Width 246px by default. Structure, top to bottom:

1. **Title bar** — glyph, title, and the count or a single pane-level action.
2. **Body** — scrolls. Sections use the §2 eyebrow.
3. **Footer toolbar** — optional, and present where a pane's items have a set of
   actions. Icon buttons at 26px, from the same registries the dock uses.

**A pane footer is bounded by its pane.** The scene tree's footer holds the
object actions; it is not a place for global commands, and the status bar is not
a place for tools.

### 7.4 The inspector

Right column, 276px. **The selection's column answers the question the selected
thing actually raises**, and describes what the thing *is*:

| Section | The question |
|---|---|
| **Content** | What is it, and what does it show? |
| **Position** | Where does it sit, and how big? |
| **Layer** | How does it present? |
| **Paint** | What ink? |
| **Spends** | Read-only: what does it resolve to? |

- The column opens with **the subject**: its name at `--text-md`, and one line
  naming its kind. It does not open with a chrome label.
- **A section with nothing in it is not rendered** — no header, no zero count.
- Geometry is collapsed by default; the binding is what changes constantly.
- **A property a kind does not have is not shown as a field.** Where the
  capability exists but this selection cannot carry it, the row renders refused
  with the reason (see §5.3).
- **There is no per-card column.** A card is a `Group`; groups get name,
  transform, opacity, and their children's effective appearance. The question
  "which sensor" is asked on the element that carries the binding.
- With nothing selected the column is empty and says where to choose from.

### 7.5 The stage

The artboard sits centred on the `--stage` ground and **is never drawn inside
a device frame**. The stage is the author's whole surface. Preserve the
reference's artwork-led composition, fine chrome and restrained depth. Subtle
palette-derived stage texture is permitted when it stays behind the artwork
and does not obscure controls; neither texture nor a flat ground is mandatory.
The warm gradient is illustrative authored artwork, not a shell background to
hard-code into every document. A lens changes the view rectangle, never
authored artboard dimensions.

**Three corners, one question each:**

| Corner | Question | Contents |
|---|---|---|
| Top-left | *What am I?* | The document's identity chip: record dot, theme name, edited state |
| Top-right | *How am I shown?* | The display lens chips, and zoom − / value / +, and fit |
| Bottom-centre | *What can I do?* | The selection dock |

The separation is not cosmetic: **the dock acts on the selection, the corners
act on the view.** A view control that appears only when something is selected
teaches an author that the view is a property of the selection.

**The dock renders the action registries and decides nothing itself.** The
object half is *filtered* — an action this selection cannot run is absent. The
arrange half is *greyed* — it needs two or more and stays discoverable. Both
halves ask the registry for eligibility the same way, so the surface never
re-derives what an action can do.

Floating clusters are `--radius-xl`, `--panel` at ~95% with backdrop blur, 1px
`--edge`, elevation 1, and sit 14–16px in from the stage's edges.

### 7.6 The status bar

26px, mono, `--faint`, readouts only: object and selection counts on the left,
save state and the live indicator on the right. **No tools, no buttons, no
menus.** Anything actionable belongs to a region that owns it.

### 7.7 Overflow, scrolling and motion

- **Content survives density.** Names may ellipsize in lists, but their full
  value remains in the accessible name and is available on focus as well as
  hover. Refusals, validation messages, units and numeric edits never
  ellipsize. Read-only references may wrap with `overflow-wrap: anywhere`.
  A long name cannot widen a pane or hide its row actions.
- **Chrome stays still.** Pane title and footer stay outside the scrolling body;
  inspector sections share one vertical scroller. Preserve per-pane offsets and
  disclosure state across routine updates. Use native scrollbars and reserve
  their gutter where necessary; no custom scrollbar or scroll-jacking owner.
- **Clusters cannot collide.** Identity may truncate its name; view controls
  may wrap or use the existing labelled lens chooser. Never omit a lens, zoom
  command or focused target to fit a screenshot. Pointer events belong to the
  controls, not an invisible full-stage overlay.
- **Desktop density has a proof, not a guessed minimum.** Check the full shell
  at 1280×720 and 1440×900 CSS pixels, then at 200% browser zoom. Keep every
  control reachable through scrolling or compact composition. The phone
  layout remains a separately recorded limitation (`vg-172`), not a claim
  that this desktop pass fixes it.
- **Motion explains change, never delays it.** No animated pane width, artboard
  travel, hover scaling or automatic smooth scrolling during editing. Optional
  opacity transitions are short and disappear under `prefers-reduced-motion`.
  Saving, validation and focus changes remain immediate.

### 7.8 Preserve the reference's character

The original visual direction is a constraint, not disposable presentation.
Keep artwork dominant, controls compact, glyph tiles quick to scan, dividers
fine, and floating clusters restrained. Palette choices retain visual swatches.
Accessibility strengthens that treatment; it does not authorize replacing it
with large generic buttons, text-only tiles or a blank placeholder artboard.

Four-column insert grids remain the reference. Measure labels, hit areas and
contrast at the real pane width before changing column count; reduce columns
only for an observed overflow or readability failure. Preserve glyph-led shape
and chart tiles, with full accessible names and focus/hover descriptions. Lens
chips remain compact where they fit; overflow composition preserves the full
choice set without dictating a permanently larger chooser.

## 8. Density and disclosure

- **Every authorable setting is present** — nothing is hidden to make a panel
  look simpler. Convenience is ordering and grouping, never a smaller surface.
- **Order and group by what a person needs**, most likely first, obscure last,
  each field with a hint where the name is not self-evident.
- **Disclosure is for the once-in-a-while, not the frequent.** A frequently used
  control stays visible; a collapsed section is for what is adjusted rarely.
  Choosing wrong here is the mistake §7.1 exists to prevent.
- **A section header says what the section is**, and a read-only section says so.

## 9. Copy

- **Sentence case** for menu rows, section eyebrows excluded (they are
  uppercase by §2).
- **The platform's mark for a chord, the platform's name for its announcement.**
  `⌘⇧P` is printed; "Command Shift P" is what a screen reader says.
- **A refusal states the reason in the selected thing's own terms.** "Not
  offered for a group" — not "invalid", not silence.
- **Never assert a capability the code does not have.** A control that announces
  a dismissal it cannot perform is a defect in copy, not a cosmetic one.
- A missing reading is **a gap, stated once, quietly**. Never a zero, never a
  dash that could read as data.

## 10. What is forbidden

- A hex value in a surface. Colour comes from a role.
- A second horizontal navigation bar.
- A tool in the status bar; a global command in a pane footer.
- A per-card inspector column, or a glyph that claims to depict an arbitrary group.
- A device frame or notch around the artboard.
- Hiding an existing capability because this selection cannot use it, instead of refusing it in words; inventing a property its kind does not have is equally wrong.
- Removing a frequently used control to a settings surface.
- Inventing a control not in §5, or an icon not in §6, without amending this file
  in the same commit.
