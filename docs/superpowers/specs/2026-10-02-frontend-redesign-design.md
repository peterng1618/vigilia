# Frontend redesign — the editor leads

- **Status:** draft
- **Amends:** §35 (application shell), §47 (small display bundle), §64 (rulers/grid/guides
  and snapping), §145 (hosting and settings), §172 (layer tree and one action owner),
  §173 (authored density over decoration), §174 (canvas navigation)
- **Proposes three new requirements** — the display is the design target; one contextual
  toolbar; chrome follows the system appearance. `docs/product/requirements.md` allocates
  the `§N` markers; this spec names the topics and does not number them.

## Weighting

**The editor carries this design.** It is where an author spends hours, it is where every
other surface's work becomes visible or invisible, and it is where the observations
landed. The player, the host page and the publishing path get what they need to serve the
editor's loop and no more — each is a section here, not a co-equal one.

## Why

Driven, not read. The host ran on `127.0.0.1:8831` with the starter theme; the editor,
the settings page and the player were each opened in a real browser at 1512×900 and at
390×844. Everything below was observed in that session on 2026-10-02.

Seven of the eight observations are the editor.

| # | Observed | Where |
|---|---|---|
| **C** | The layer panel lists **52 rows, every one `aria-level="1"`**, with 165 icons and 127 buttons in one 280px column. `ram-card`, `ram-card-title`, `ram-card-icon`, `ram-value` and `ram-gauge` are indistinguishable but for a 12px glyph. | editor, Layers pane |
| **D** | **18 unlabelled icons sit on the canvas at once**: 9 in the dock, 9 in the arrange toolbar, two arrow-ups and two arrow-downs adjacent. | editor, stage |
| **E** | The chrome is warm cream glass; the dashboards it makes are dark and neon. `editor-shell.css` holds **50 hex colours, 35 px literals, 8 radii and 0 spacing/radius/type/elevation tokens**. The 16 `--vigilia-*` tokens are declared only under `[data-shell-palette="editorial"]` and are defined nowhere else in the tree, so under the other five palettes every reference resolves to nothing. `index.html` declares `content-scheme="light dark"`; there is no `prefers-color-scheme` rule in the editor at all. Tailwind 4.3.3 and a shadcn config are installed; **zero utility classes are used**. | editor, source |
| **F** | `New theme · New from starter · Open package · Save package · Release package · Open library · Save to library`. Three save verbs, unexplained, unseparated. Success is one line of text in the bottom-left of a 1512px window. | editor, File menu |
| **G** | The Design tab scrolls `SELECTION` (12 fields) → a `Paint:` provenance line → a hint sentence → `THEME SETTINGS`, a different scope, same scroll, no divider. The 280px panel also has a horizontal scrollbar. | editor, inspector |
| **H** | The header is `Vigilia · Editor · File Edit Insert View · Save package`: five menus, one of them duplicating a panel, and a label naming the window. | editor, header |
| I | The settings page is the bar the editor does not reach: *"Only one found — dashboards use NVIDIA GeForce RTX 3080 Ti."* Every control explains itself. | host, settings page |
| A | On a 390×844 phone the 1672×941 artboard renders as a ~390×190 strip: **22% of the screen height, 78% black**, with a full-bleed amber LibreHardwareMonitor diagnostic across the top. | player, 390×844 |
| B | The host binds loopback only; reaching a phone needs `--host 0.0.0.0`. **No pairing UI, no QR, no LAN address, no device preview** — zero matches in `host/public/` or the editor. | host, editor |

**One defect, four symptoms.** Vigilia has no concept of the display it is designing for.
A says the author never sees the consequence of choosing an orientation. B says there is
nowhere to see it. C says the panel shows the document's innards rather than its
composition. F says saving never says where the result went.

## The design

**The author's loop closes in one window: make it, see it where it goes, publish it there.**

The editor is where all three verbs live. The player and the host page are what "where it
goes" resolves to.

## Scope

**In.** The editor shell, in depth. The player chrome, the host settings page and the
publishing path get what the editor's loop needs — a display target the editor can show,
a host path to the phone, and honest save/publish feedback.

**Out.** New product surface nobody asked for — no template gallery, no responsive
artboards, no richer sensor discovery, no theme store, no collaboration. A capability
enters only where an observation above shows its absence. Typography follows the font
trio catalogue plan already in flight; this spec does not restate it.

## Invariants that survive

Not design decisions; this spec does not touch them.

- Fabric stays imperative behind the editor boundary. React never mirrors a Fabric
  object; panels render the bridge's serializable projection.
- One owner per concept. Object actions keep their registry (§172); this changes how many
  surfaces *render* them, not where they are defined.
- `renderer-core` stays Fabric- and DOM-free. The player keeps its import boundary and
  bundle gate (§47).
- Persist authored state only. Viewport, collapse, selection and device choice are
  transient and never enter authored history (§67).
- Never fabricate a reading. A missing or non-`ok` sample stays a gap.
- Editor-shell theming stays separate from authored theme globals (§35).

## Every existing authoring capability is preserved

**Stated by the user as a constraint on this redesign.** Nothing an author can do today
becomes something they cannot do tomorrow. Everything else — layout, navigation,
naming, density, tokens, type treatment, where a control lives, how it looks — is free.

This is a constraint on *capability*, not on *placement*. The design moves capabilities
almost everywhere; it may drop none of them. Where a decision below removes a surface,
the capability moves with it, and the plan's acceptance is a walk of this table.

| Capability today | Lands |
|---|---|
| New theme · New from starter · Open package | File menu, unchanged |
| Save package | **Export** |
| Release package | **Preserved.** Distinct capability until proven to be one of the other two — see Saving |
| Save to library | **Publish to this PC**, which additionally makes the theme live |
| Open library | File menu, unchanged |
| Undo · Redo · Copy · Cut · Duplicate · Delete | Edit menu, unchanged |
| Insert text · shapes · charts | The `+` popover in the left column, rendering `insertGroups()` unchanged |
| **Data source: preview ↔ live** | Canvas-local controls beside the zoom readout |
| **Chart refresh: 30 ↔ 1 fps** | Canvas-local controls beside the zoom readout |
| **Value runs: values ↔ tokens** | Canvas-local controls beside the zoom readout |
| Shell palette | Header swatch opening the palette list |
| Layer select · drag-reorder · inline rename | Layer panel, unchanged |
| Layer lock and visibility toggles | Layer rows, shown on hover / selection / when non-default |
| Group · Ungroup | Contextual toolbar and canvas context menu, from the registry |
| Object action row (layer panel) | The contextual toolbar — one rendering, not two |
| Arrange: align and distribute | The contextual toolbar, registry-gated on multi-selection |
| Stack order: front · forward · backward · back | One **Order** menu beside the toolbar |
| Dock duplicate · copy · cut · delete | The contextual toolbar |
| Dock lock | Toolbar toggle; per-row state stays in the layer panel |
| Canvas context menu | Unchanged, third consumer of the action registry (§172) |
| Zoom fit · 100% · pan | Zoom control, **plus** the device presets |
| Select · move · resize · rotate · snap · smart guides · multi-select · enter group · nudge · select-all | Unchanged — this design does not touch canvas mechanics |
| Selection properties (geometry, rotation, opacity, fill, stroke, border, radius, shadow, frosted glass, blur) | Properties column sections, unchanged fields |
| Chart data bindings | Properties column **Data** section, no longer behind a tab |
| Token references and what they resolve to | Properties column **References** section |
| Artboard and document properties | Left column **Document** tab |
| Palette · type presets | Left column **Document** tab |
| Assets | Left column **Assets** tab |
| Keyboard shortcuts | Unchanged map, now visible in tooltips and a reference |
| Save state · diagnostics · dirty-work confirmation | Status bar, minus developer text |

Three rows were capability losses in the first draft of this design and are now
preserved: the three **View** settings had no named home and would have been dropped with
their menu; **Release package** would have been folded away without being read; and the
player's availability **reasons** would have become reachable only behind an interaction.

---

# The editor

## Structure — two columns, no rail, two menus

The rail is four icons choosing which of four panes fills one 280px column, one of which
holds a single dropdown. That is a navigation level spent on a colour picker. The header
is five menus, two of which duplicate something better placed.

**Drop the rail.** The stage gains 52px. **Drop the Insert and View menus** — both exist
because their affordances live somewhere else, and putting them where the work happens
makes them more findable, not less.

```
┌────────────────────────────────────────────────────────────────────┐
│ Vigilia ▸ System dashboard •    File  Edit    ?        [ Publish ] │
├──────────────┬──────────────────────────────────┬──────────────────┤
│ Layers  +  ⋯ │                                  │  Properties of   │
│ Assets       │            canvas                │  the selection   │
│ Document     │                                  │                  │
│              │  ┌ arrange/order/duplicate ┐     │  Geometry        │
│              │                    [ 51% ▾ ]   │  Typography      │
│              │                                  │  Appearance      │
│              │                                  │  References      │
└──────────────┴──────────────────────────────────┴──────────────────┘
```

- **Left column — the document's contents.** `Layers · Insert · Assets · Document` as a
  segmented header, with `+` opening the insert popover.
- **Right column — the current selection's properties.** Nothing selected and the column
  says so, naming where to choose from. It never shows the document; the left column's
  Document tab owns that.

The crisp rule is **left = what is in this theme, right = what this thing is**. It is the
rule that kills G: two scopes can no longer share a scroll because they are no longer in
the same column.

Collapsing the left column still hands the canvas its width; the existing collapse-and-
refit behaviour carries over, as does per-pane scroll restoration.

The shell palette is not a document property and never was — it moves to the header as a
compact swatch opening the palette list. That is why the rail's `Settings` entry has no
successor.

## The layer panel — composition, not enumeration

Three subtractions, all of which remove rows or icons rather than adding affordances.

1. **Groups start collapsed.** The starter's 52 rows become its top-level groups alone. A
   group *is* the composition; expanding it is opting into the innards. Collapsed-by-
   default is a default, not persisted viewport state (§67).
2. **Kind becomes a treatment, not a glyph.** This is the change that makes the panel
   worth reading:

   | Kind | Leading treatment |
   |---|---|
   | text | the object's own string, in its own face, 11px, truncated |
   | chart | its family mark |
   | shape | a filled swatch of that shape, in its own fill |
   | image | its thumbnail chip |
   | group | disclosure chevron, bold name |

   A text row reads *what it says and that it is text* in one glance. Nothing else fits
   that into 280px.
3. **Lock and visibility hide until they are true.** Today all 52 rows carry two icons
   reading "visible, unlocked" — 104 icons saying nothing. They appear on hover, on
   selection, and whenever they differ from the default. They remain state indicators
   that happen to be clickable (§172); they just stop shouting.

Row anatomy is `[treatment] [name] … [lock] [eye]` at a 24px rhythm, `tabular-nums` on
anything numeric. Drag-to-reorder, inline rename and the refusal of a cross-group drop
are unchanged.

## Selection actions — one contextual toolbar

Eighteen unlabelled icons is not a toolbar, it is an icon wall. The arrange toolbar's
nine buttons were greyed out more often than not, permanently occupying the top of the
canvas to advertise actions no selection could take.

**One toolbar, above the selection, rendering from the action registry.** Arrange actions
need a multi-selection and the dock does not care — that is a registry eligibility
question, not a layout one (§172). The four z-order arrows collapse into one **Order**
menu with four named items; two ups and two downs beside each other is unreadable at any
size. What remains is roughly: duplicate, delete, lock, order, arrange.

Removing the toolbar also removes the hint sentence *"Chart settings are under Data"*,
which exists only because the tab split hid them.

## The properties column — one scope, sectioned

Sections stack in one scrolling column, scoped to what is selected:

| Selection | Sections |
|---|---|
| text | Geometry · Typography · Appearance |
| shape / image | Geometry · Appearance |
| chart | Geometry · Appearance · **Data** |
| group | Geometry (bounds) · Appearance (effective) |
| nothing | *empty, naming where to choose from* |

Sections are collapsible, so a chart's long list stays navigable. **No tab hides a
property and no scope shares a scroll with another.**

**References** is the section the tabs had nowhere to put. The Style panel shows what the
selection's token references resolve to — §75's mechanism, and the thing that makes a
theme-on-globals comprehensible. It is read-only, it is about a different question from
"what can I set", and it gets its own named section at the foot of the column.

The field vocabulary stays: `NumberField` and `LinkedPair` are right, and they are what
panels opt into rather than what CSS forces on them. Every field is one 28px row; labels
right-align to a fixed column so the controls form a single vertical edge.

## Chrome — a token system, and an honest colour scheme

Four token layers are added where there are none: **spacing, radius, type scale,
elevation**. These replace 35 px literals, 8 radii and 5 font sizes.

**Tailwind v4 is the mechanism, and its `@theme` maps onto this codebase's actual
problem rather than onto a generic one.** Spacing is a single declaration —
`--spacing: 0.25rem` — from which the whole scale is generated as
`calc(var(--spacing) * n)`, so the 4px base unit replaces every literal at once rather
than one migration at a time. Radius, `--text-*` (each carrying its own `--line-height`,
`--tracking` and `--font-weight`) and `--shadow-*` cover the other three layers.

The important one is **`@theme inline`**, which makes a Tailwind utility reference the
live variable rather than a copy of it:

```css
@theme inline {
  --color-surface: var(--shell-surface);
  --color-canvas:  var(--vigilia-canvas-bg);
}
```

That is what palette switching needs. `applyShellPalette` sets one data attribute on
`:root` and the CSS cascade does the rest; with `inline`, utilities read that same live
value, so changing `data-shell-palette` recolours the shell without Tailwind knowing a
palette exists. Without it, each palette would need its own generated utility set.

- `--vigilia-*` moves into `:root`; `editorial` keeps only what it overrides. Every
  palette then resolves.
- `--shell-flat` is wired to its evident purpose — collapsing the 6-selector glass lists
  repeated four times — or deleted if it cannot be.
- **The editor follows the system appearance.** `prefers-color-scheme` picks a default;
  the palette picker is an explicit override on top. `index.html` already claims
  `content-scheme="light dark"`, so this makes the claim true instead of removing it.
- `components.json` is deleted: nothing generates or consumes shadcn, and a config
  implying a component library that does not exist is the same defect as a token that
  resolves to nothing.

Density stays what §173 set — more of it, not less. Figma UI3 remains the reference where
Vigilia has no answer of its own.

## Keyboard — an authoring surface is a keyboard surface

There is already a `PRODUCT_SHORTCUTS` map and it is invisible. Observation D is that
eighteen actions are unlabelled; unlabelled is unlearnable.

- Every action on the toolbar, in the canvas context menu and in a menu **shows its
  shortcut in its tooltip**. One owner for the key — the map, not a surface.
- **Nothing is reachable by mouse alone.** The existing map is the floor; the redesign
  does not shrink it.
- A `?` in the header opens a searchable shortcut reference. The same map renders it, so
  it cannot drift from what the keys actually do.

The canvas context menu stays the third consumer of the action registry (§172), and
renders the same keys as the toolbar.

## Saving — two verbs, stated consequence

`Save package`, `Release package` and `Save to library` ask an author to learn what a
package is before they have made one.

- **Publish to this PC** — writes the theme to this machine's library *and* makes it what
  the displays show. The consequence is in the verb.
- **Export** — writes a `.zip` to the PC.

`Release package` is a **preserved capability**, not a candidate for deletion. Its fate
is settled only by reading `#release`: if it is Export-with-a-thumbnail it folds into
Export and says so; if it is something else it keeps its own verb. It does not go on
inference.

Feedback moves to **a toast beside the action**, not the status bar — at 1512px wide a
line of text in the bottom-left corner is not feedback, it is a log. The status bar keeps
ambient state and stops showing developer text: *"Fabric editor ready"* is not a fact
about the author's document. Destructive actions confirm, and confirm with undo.

## The canvas — a display target

Not a second renderer and not a device-preview subsystem: **device presets in the zoom
control**, beside the existing fit and 100%. Selecting *Phone portrait* or *Phone
landscape* frames the artboard in that shape. One canvas, the camera the viewport already
owns (§174), and the consequence of an orientation choice visible in one click. It is
transient per §67 — not an artboard property, because the same theme may be shown on a
wall panel and a phone and the artboard is one document (§51).

With LAN on, the header carries the display's address and a QR code. An author who has
just built a theme is one click from the phone showing it, without leaving the window they
built it in.

---

# The player

**The letterboxing stays.** Orientation is the author's per-theme choice and a mismatched
theme is `contain`-fitted by design (§53). The defect was that choosing was uninformed,
and the editor's device presets fix that. Nothing about rendering changes.

What changes is that **diagnostics stop competing with the theme for the best pixels** —
and nothing else. The availability strip is currently a full-bleed amber banner, roughly
90px of an 844px screen, for a message about a monitoring tool the author chose not to
run. It becomes a small, quiet, corner-anchored marker carrying a count. **The reasons
themselves stay exactly as available as they are today** — the same three, the same
wording, the same redaction — reachable by deliberate expansion, because "why is this
reading missing" is a capability and prominence is the only thing being spent.
`availability-notice.ts` already caps reasons at three and that cap is right. The
connection banner gets the same treatment. Amber/red/cyan keep their semantic meaning.

`load-failure.ts` is the one real page, it is well made, and it is not touched.

**Legibility at arm's length is not claimed as a defect.** ~10px figures on a 390px phone
is suggestive, not measured. The device presets make it checkable, which is the honest fix.

# The host settings page

The copy here already meets the bar the editor should reach (I). It keeps its standard.

**Add a Hosting section.** §145 calls LAN serving "explicit opt-in". Today it is explicit
by absence: you get it by editing a command line. The section carries the toggle, the LAN
address once it is on, and a QR code encoding it — filling a proven gap against an
existing requirement, not adding a capability. §145's "plain LAN HTTP has no
confidentiality; never suggest internet exposure" still governs, and the section must not
read as an invitation to expose anything.

# The loop

Compose → edit → **device preset** → **Publish** → **QR** → phone. Six steps, one window,
no menu archaeology.

---

## Ruled during review

Settled by the user, not argued here:

- **Tailwind v4 is adopted.** §35 names it, it is installed, and its `@theme`/`@theme
  inline` is a better fit than the alternative — `inline` is precisely what a runtime
  `data-shell-palette` swap needs.
- **The right column empties on deselect.** Confirmed as the context-aware behaviour the
  editor wants, not as a loss of information.

## Decisions still open to argument

| Decision | Alternative | Why this one |
|---|---|---|
| The editor carries the design | Four equal specs | It is where the hours go and where 7 of 8 observations landed |
| Drop the rail | Keep it, fix the panes | A navigation level spent on a palette dropdown; 52px of stage for it |
| Insert and View leave the menus | Keep all five | Both duplicate something better placed; the `+` is more findable than a menu |
| One properties column, no tabs | Keep tabs, scope each | Tabs *hid* chart data behind a hint sentence; hiding a property is the bug |
| Arrange merges into the dock | Keep two toolbars | The registry already answers eligibility; two floating bars is a layout duplication |
| Groups collapsed by default | Expanded by default | 52 rows is the innards; the composition is the top level |
| Kind as a treatment, not a glyph | A better icon | Only a treatment survives at 280px, and a text row should read its own text |
| Follow the system appearance | Manual palette only | The meta tag already claims `light dark`; honouring it is cheaper than removing it |
| Device presets in the zoom control | A real device-preview panel | One canvas, the camera that already exists, no second renderer |

## Non-goals

So they are not re-raised: no responsive/multi-orientation themes; no second scene
renderer; no new theme-store or sync; no mobile authoring (the editor stays desktop-only);
no decoration, no scroll-driven or staggered motion (§173); no component library beyond
Base UI; no redesign of `renderer-core`, the persistence path, or acquisition.

## Acceptance

Evidence is rendered observation in a real browser (§33). Each item names what was seen.
The editor carries the first eight.

**Editor**

- **Every row of the capability inventory is walked once, in the browser, at the end.**
  Nothing is unaccounted for; anything that moved says where. This is the acceptance
  item that discharges the preservation constraint, and it is a walk, not a diff.
- The layer panel shows only the starter's top-level groups on open, expanding reaches all
  52 rows, and lock/visibility icons are absent from rows in their default state. A text
  row is identifiable as text without reading its name.
- Exactly one contextual toolbar is on the canvas with a selection, every button in it
  shows a shortcut on hover, and no permanent arrange bar exists.
- The properties column shows only the sections the selection has, never document
  properties; a chart's Data section is visible without switching anything; References
  resolves and is named.
- The left column has no rail and the stage is at least 52px wider at the same window
  size. The header carries exactly two menus.
- Selecting a layer, switching panes, and collapsing restore scroll and refit as they do
  today.
- Every chrome colour resolves under all six shell palettes — no unresolved
  `--vigilia-*` in any palette.
- With the OS in dark mode and no palette override the chrome is dark; under
  `prefers-reduced-motion: reduce` no motion runs.
- The File menu offers Publish and Export, publishing raises a toast naming the live
  theme, and the status bar shows no developer text.

**Loop, player and host**

- A device preset frames the artboard in the chosen shape in one click, from the zoom
  control, without a second canvas.
- With LAN on, address and a scannable QR are visible in the editor header and the
  settings page, and a phone loading the QR shows that theme.
- A 390×844 player shows the starter `contain`-fitted with no full-bleed diagnostic
  banner occupying the top of the screen.
- The settings page's existing copy quality is unchanged.

## For the plan

Decompose at least: **editor structure** (rail removal, header, properties scoping,
toolbar merge), **layer panel**, **keyboard**, **token system and appearance**,
**save/publish**, then **display target** (device presets, hosting + QR), then **player
chrome**. The editor's phases come first because they are the bulk and the rest is
judged by whether it serves them.

One precondition, not a design question: `scripts/reuse-gate.mjs` decides whether the
token-system change needs a note under `docs/decisions/` before its first write. The plan
resolves that before touching CSS.

The capability inventory is the plan's regression surface. Each phase that moves a
capability names its row, so a phase cannot quietly drop one and still pass its own
tests — the walk at the end is what catches a drop nobody thought of.