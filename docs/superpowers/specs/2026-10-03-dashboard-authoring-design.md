# Vigilia — authoring a dashboard, not a canvas

- **Status:** draft
- **Supersedes:** [frontend redesign — one design, four surfaces](2026-10-02-frontend-redesign-design.md)
- **Amends:** §3, §35, §43, §57, §73, §77, §79, §89, §91, §93, §172, §173, §174

## The position

**Vigilia is an editor for a phone display that happens to use Fabric.**

Every decision below follows from that one. Not "a canvas editor with a good default
theme" — the display is what the interface is organised around, and an author selects a
**card**, not a rectangle.

The previous design got this diagnosis right and then spent itself re-arranging the
chrome. That is the failure this one exists to not repeat.

## The root cause, found in the code

Driven, then read. The starter theme's cards are **a naming convention, not structure**:

```ts
// src/web/packages/editor/src/new-fabric-theme-cards.ts
export function cpuCard(): ObjectJson[] {
  return [
    frostedCard("cpu-card", 421, 187, 280, 307),
    path("cpu-card-icon", 456, 213, starterIcons.cpu(44), "cpu", 3.6),
    label("cpu-card-title", 528, 212, 140, 27.12, "CPU", 24, "text"),
    text("cpu-card-value", 456, 258, 246, 101.7, percent(90, 60, "cpu-card-load")),
    /* …five more siblings… */
  ];
}
```

`createNewFabricTheme` spreads eight such arrays flat into `scene.objects`. **There is
not one group in the reference composition.** `cpu-card` and `cpu-card-title` are
siblings that happen to share a prefix.

That single fact explains observations I had been treating as UI problems:

| Observation | Real cause |
|---|---|
| 52 rows, every one `aria-level="1"` | There is no hierarchy to show. The author made one by naming things. |
| A card is indistinguishable from its own title | They *are* the same kind of thing in the document. |
| `ram-card`, `ram-card-title`, `ram-gauge`, `ram-value` are four rows | They are four objects the author had to keep in sync by hand, forever. |
| Moving a card means moving six objects | Because a card is not an object. |

Meanwhile three mechanisms for the fix **already exist and are unused**:

- **`instantiateWidget`** (`renderer-core/src/theme/widget.ts`) — copies a subtree with
  fresh ids, remaps bindings *preserving semantic keys*, remaps style refs, and reports
  `unmapped-global` / `id-collision` / `invalid-id`.
- **`WidgetProvenance`** on every `NodeBase` — `{ widgetId, widgetName, widgetVersion,
  insertedAt }`.
- **`ThemeNode` `group`** with ordered children, and §57's rule that groups keep and
  compose transforms.

§77 asks for exactly this. §139 defers *widget packages* until there is an authoring
workflow. There is no widget **library** and no authoring workflow, and those are what
this design adds.

## The design

### 1. A card is the atom

The starter is rebuilt with each card as a **group**: its frosted panel, its icon, its
title, its value, its sparkline, its caption, as children in group-local coordinates.

Everything else falls out of that:

- the layer tree is **eight rows**, expandable — not a UI change, a document change
- a card moves, scales and transforms as one object; §57's group semantics do the work
- a card can be inserted as a **unit** with parameters, through `instantiateWidget`
- selecting a card can offer *the card's* properties rather than the rectangle's

`provenance` records which unit an inserted card came from, so "these two cards are the
same thing" is a fact in the document rather than a naming coincidence.

**Blast radius, stated up front.** The starter envelope id `vigilia-demo-dashboard` is
referenced by `editor.spec.ts`, the host fixtures and the captured evidence. Rebuilding it
changes geometry, so screenshots and byte-stability fixtures move. That is the cost of
fixing the model, and it is cheaper than carrying a wrong model forever. `AGENTS.md`'s
rule applies: if a task cannot change the starter without breaking evidence that exists to
prove something else, that evidence is re-captured, not preserved.

### 2. The canvas is the device

The artboard **is** the display's shape. Today a 1672×941 artboard is letterboxed into a
desktop window at 55%: a preview of nothing, on the surface where all the work happens.

- The stage shows the target device, and the device switch — *Phone portrait · Phone
  landscape · Wall panel · Fit* — **is** the zoom control. There is no second concept of
  "preview", and no dropdown labelled `Orientation: Custom`.
- Device frame, notch and safe areas are visible and accounted for, because the display
  has them.
- **The starter ships portrait.** The primary display type is a phone (§7, and the
  reference is worse than useless on one: 22% of the screen, 78% black). A theme is
  designed for one orientation and the author chooses it once, with the consequence
  visible at all times.

Orientation stays the author's per-theme choice. What changes is that choosing is
*informed* rather than a dropdown nobody can picture.

### 3. The composition panel lists cards

Eight units, not 52 rows. Each row carries:

- a **thumbnail** of what the card is
- its **role** — `gauge · cpu.load`, `ring · mem.used`, `chart · line ×3`, `metric card`
- its **bound key**, so you read what a card is *about* without expanding anything

Lock and visibility appear only when they are true — hover, selection, or non-default.
104 icons reading "visible, unlocked" was noise.

Expansion is available and stays available. This is not a flattening; it is a default.

### 4. The right column describes what the card *shows*

A CPU card is not a rectangle. The first question about one is *which sensor*, not *how
many pixels wide*. So selecting a card opens:

| Section | For a metric card |
|---|---|
| **Content** | Shows · Range · Format · Unit |
| **Appearance** | Type preset · palette tokens spent · glass |
| **Spends** | the tokens and presets it resolves to, read-only |
| **Geometry** | collapsed to one line; one gesture opens it |

Geometry is adjusted once. The binding is chosen constantly. §3 says charts and typography
are first-class; this is the first thing in the UI that acts on it.

`References` — what a selection's tokens resolve to — keeps both of its modes: the
selection's, and the document's, which relocates to the left column's Document pane when
nothing is selected.

**A property an object's kind does not have is not shown.** A card has no border-radius;
a text run has no sensor. That is the whole difference between this and a tab strip.

### 5. Insert a unit, not an object

`+` offers the card library — the units the theme has, plus the shipped ones. Inserting
goes through `instantiateWidget`, so a copy arrives with fresh ids, remapped bindings
preserving semantic keys, and recorded provenance.

`Insert text · shape · chart` stays available. It is the same editor either way, and
removing it would take a capability the preservation constraint protects.

### 6. Publishing is continuous

The editor renders **live data on the device**, always — there is no preview/live switch
to forget to leave on. Publishing answers one question: *put this on the phone*.

With LAN on, the phone shows what you are editing. The header carries the address and a
QR code. §145's "explicit opt-in" becomes a control rather than a CLI flag.

### 7. Keyboard-first

Unlabelled actions are unlearnable, and eighteen of them were on the canvas at once. Every
action shows its shortcut in its tooltip, one contextual toolbar renders from the existing
action registry, and `?` opens a reference rendered from the same `PRODUCT_SHORTCUTS` map.

### 8. A chrome that belongs to its own product

The editor is warm cream glass; the dashboards it makes are dark and neon. Tailwind v4's
`@theme` carries the spacing, radius, type and elevation scales; `@theme inline` carries
the runtime-switched palette so one `data-shell-palette` attribute recolours everything,
including every portalled popup. The editor follows the OS appearance, with the palette
picker as an explicit override. Six palettes, six distinguishable things.

## Sequencing

Ordered by **what becomes visible**, not by what is easy to specify. The previous plan had
the display work fifth behind three furniture tasks; that ordering is the mistake being
corrected.

| # | Plan | The visible change |
|---|---|---|
| **1** | **Cards become structure** | 52 rows → 8. The biggest change in the product. |
| **2** | **The device canvas** | The stage becomes a phone; the starter goes portrait. |
| **3** | **Unit inspector** | Selecting a card answers *which sensor*. |
| **4** | **Composition panel** | Thumbnails, roles, keys; quiet lock and eye. |
| **5** | **Insert a unit** | The `+` inserts cards, through `instantiateWidget`. |
| **6** | **Publish loop** | Live on the device; QR to the phone. |
| **7** | **Keyboard** | Shortcuts in tooltips; `?`. |
| **8** | **Player chrome** | Diagnostics stop eating the phone's best pixels. |
| **9** | **Chrome and appearance** | Tailwind `@theme`, OS appearance, six distinct palettes. |

Plan 1 of the superseded design is **folded into these**. Its landed work — the pane bar
replacing the rail, the palette control, the portal fix, the scale tokens — is
groundwork each of these sits on, and its remaining tasks are re-expressed rather than
re-run.

## Invariants

Untouched by this design.

- Fabric stays imperative behind the editor boundary; React never mirrors an object.
- One owner per concept. The action registry, the card library and `insertGroups` keep
  theirs; surfaces render from them.
- `renderer-core` stays Fabric- and DOM-free; the player keeps its import boundary and
  bundle gate (§47).
- Persist authored state only. Viewport, collapse, selection and device choice are
  transient (§67).
- **Never fabricate a reading.** A missing or non-`ok` sample stays a gap — on the phone
  and in the editor.
- No second scene tree, no second renderer. Fabric JSON is still the document (§134).
- Editor-shell theming stays separate from authored theme globals (§35).

## Non-goals

So they are not re-raised: no responsive or multi-orientation themes; no mobile authoring
(the editor stays desktop-only, §7); no widget *packages* on disk (§139 defers those until
an authoring workflow exists, and this creates the workflow, not the format); no new
product surface nobody asked for; no decoration and no scroll-driven motion (§173).

## Acceptance

Rendered observation in a real browser (§33).

- The layer tree shows eight rows for the starter and expands to the full hierarchy. The
  change is a document change: the groups exist before any panel is touched.
- A card moves as one object and arrives intact.
- The stage shows a device at its true proportions; the device switch is the zoom control.
- Selecting a card opens Content/Appearance/Spends and no property its kind does not have.
- With nothing selected the right column is empty and names where to choose from.
- The `+` inserts a card whose copy carries fresh ids and recorded provenance.
- The phone shows the theme while the editor has it open.
- Six palettes are distinguishable by surface, verified by screenshot rather than by
  computed value — a computed-value assertion passes on three palettes that are
  byte-identical to editorial.

## Ruled during review

- **Tailwind v4 adopted**, with `@theme inline` for the runtime palette.
- **The right column empties on deselect.**
- **Three near-identical palettes get real surfaces** — filed as `vg-120`, then withdrawn
  on the controller's reconsideration rather than left as a decision for the user.
- **All existing authoring capabilities are preserved**; the inventory that discharges it
  is walked in a browser at the end.