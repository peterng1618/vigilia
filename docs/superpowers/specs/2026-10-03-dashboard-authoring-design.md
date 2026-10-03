# Vigilia — authoring a dashboard, not a canvas

- **Status:** draft
- **Supersedes:** [frontend redesign — one design, four surfaces](2026-10-02-frontend-redesign-design.md)
- **Amends:** §3, §35, §43, §57, §73, §77, §79, §89, §91, §93, §172, §173, §174

## The position

**Vigilia is an editor for a phone display that happens to use Fabric.**

Every decision below follows from that one. Not "a canvas editor with a good default
theme" — the display is what the interface is organised around.

The previous design got this diagnosis right and then spent itself re-arranging the
chrome. That is the failure this one exists to not repeat.

## What this design must never become

Stated first, because the failure mode is real and this spec walks toward it.

> **Here's a blank canvas. Let your imagination run wild. We are the best tool at your
> disposal.**

Every move below removes friction from the common case. **None of them narrows the
uncommon one.** Specifically:

- **A card is a fact about the starter theme, not a rule about themes.** The reference
  happens to be eight frosted panels. Another theme may be one full-bleed photograph and
  a caption, or two hundred loose shapes somebody arranged for the sake of the
  arrangement. The editor is the tool for all of them.
- **The device is a lens, not the document.** The artboard keeps whatever dimensions the
  author chooses (§57: no reflow, whole artboard units). A phone frame shows the artboard
  *as that display would present it*. It never constrains the artboard's shape.
- **Components are an accelerator, never a gate.** Inserting a pre-built card is the fast
  path. Placing a free shape is always available, and a theme made entirely of free shapes
  is a first-class theme, not a degraded one.
- **Nothing here may make a thing *impossible*.** Not a card role, not a device shape, not
  a panel layout.

The test for any change in this spec: *does this remove a step, or does it remove a
freedom?* If the second, it is out.

### The case that proves it

*If I want a 1/4 circle as a decorating element, I should be able to place the 3/4 part
of it outside the canvas to be clipped.*

Driven in the built editor, 2026-10-03. Three findings, and the third is the one:

1. **There is no arc primitive.** `SHAPE_KINDS` is `["rect", "ellipse", "polygon",
   "polyline", "line", "path"]`. A quarter-disc is hand-authored as an SVG path, which is
   what the starter already does for its icons. A bleeding quarter-disc is a basic
   compositional move and the vocabulary cannot express it.

2. **The clipping machinery is sound.** `adapter.ts` clips the player's canvas to the
   artboard rect; `scene-fabric/artboard-crop.ts` counts and names the edges that ran off,
   on both surfaces; `sceneBoxesOf` flattens groups so a group is a box *and* its
   children. This part is already right.

3. **The editor does not clip, so the author composes against a lie.** Measured:
   `canvas.clipPath` is `null` on the editor's Fabric canvas. Place a quarter-disc with
   3/4 hanging off the edge and the editor draws a **full** disc; the phone shows a
   quarter. And `outsideCount` measures the whole bounding rect, so a deliberate bleed is
   reported as "1 object outside" — the artboard panel warns and the player raises a crop
   notice. The intent is invisible to both surfaces.

**A tool that reports deliberate bleed as a fault is a cage that looks helpful.** The
three fixes, none of which constrains anything:

- **The editor clips to the artboard**, so what an author composes against is what ships.
- **A `bleeds` flag** on the object. Marked, it is excluded from the crop count and the
  phone's notice; unmarked, it still warns — so the diagnostic stays honest and stops
  crying wolf over composition, not just over mistakes.
- **Arc and wedge in `SHAPE_KINDS`**, with start and end angle in the inspector.

§57's "no automatic reflow" already permits this and nothing has to change about the
document format. The gap is the editor's preview honesty and the primitive vocabulary.

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

### 1. Groups are the atom, and the starter should use them

The starter is rebuilt with each card as a **group**: its frosted panel, its icon, its
title, its value, its sparkline, its caption, as children in group-local coordinates.

Everything else falls out of that:

- the layer tree is **eight rows** for *this* theme, expandable — not a UI change, a
  document change
- a card moves, scales and transforms as one object; §57's group semantics do the work
- a card can be inserted as a **unit** with parameters, through `instantiateWidget`
- selecting a card can offer *the card's* properties rather than the rectangle's

`provenance` records which unit an inserted card came from, so "these two cards are the
same thing" is a fact in the document rather than a naming coincidence.

**This is a fix to one theme's model, not a product rule.** Groups are the general
capability and they predate this work; what is new is the starter using them, and a unit
library built on `instantiateWidget`. A theme the author built from loose shapes keeps
every one of those shapes selectable, movable and individually styled, and the panel below
is designed for that case as much as for the card case.

**Blast radius, stated up front.** The starter envelope id `vigilia-demo-dashboard` is
referenced by `editor.spec.ts`, the host fixtures and the captured evidence. Rebuilding it
changes geometry, so screenshots and byte-stability fixtures move. That is the cost of
fixing the model, and it is cheaper than carrying a wrong model forever. `AGENTS.md`'s
rule applies: if a task cannot change the starter without breaking evidence that exists to
prove something else, that evidence is re-captured, not preserved.

### 2. The device is a lens on the canvas

Today a 1672×941 artboard is letterboxed into a desktop window at 55%: a preview of
nothing, on the surface where all the work happens.

- The stage shows the artboard **through a device**, and the device switch — *Phone
  landscape · Phone portrait · Wall panel · Fit* — **is** the zoom control. There is no
  second concept of "preview", and no dropdown labelled `Orientation: Custom`.
- **The default is a landscape phone.** That is the shape the display type usually is, and
  it is the shape the starter is already drawn in, so the reference composition is
  correctly framed the moment the editor opens.
- Device frame, notch and safe areas are visible and accounted for, because the display
  has them.
- **The artboard keeps whatever dimensions the author chooses.** A device frame shows the
  artboard as that display would present it — contained, or cropped, per the existing fit
  rules (§53). It is a lens, not a constraint. A theme that is one photograph at 3:1, a
  theme at 4000×4000, and a theme at 1672×941 are all authored in the same stage, and
  the lens simply shows what each would look like on a given screen.

Orientation stays the author's per-theme choice. What changes is that choosing is
*informed* rather than a dropdown nobody can picture — and that seeing the consequence
costs one click rather than a mental calculation.

### 3. The composition panel shows whatever the theme is made of

Not "eight units". **Whatever the top level actually is**, shown well. For the starter
that is eight rows, because the starter will be eight groups. For a theme an author built
from loose shapes it is however many they made — and the panel has to be *good* at two
hundred rows, not merely correct.

Each row carries whatever identifies it without expansion:

- a **thumbnail** where a thumbnail means something
- its **role** — `gauge · cpu.load`, `ring · mem.used`, `chart · line ×3`, `metric card`,
  or simply `shape` where that is all it is
- its **bound key**, where it has one

Lock and visibility appear only when they are true — hover, selection, or non-default.
104 icons reading "visible, unlocked" was noise, and that noise is worse the more rows
there are, which is exactly the case a card-heavy panel would hide.

Expansion is available and stays available. This is not a flattening; it is a default.

### 4. The right column describes what the thing *is*

A CPU card is not a rectangle. The first question about one is *which sensor*, not *how
many pixels wide*. So selecting a card opens:

| Section | For a metric card |
|---|---|
| **Content** | Shows · Range · Format · Unit |
| **Appearance** | Type preset · palette tokens spent · glass |
| **Spends** | the tokens and presets it resolves to, read-only |
| **Geometry** | collapsed to one line; one gesture opens it |

**Every kind gets a column that fits it.** A free shape gets its geometry and fill, at the
same density and with the same affordances — it is not a lesser selection, it just has
different questions. A text run gets typography. A chart gets data and family settings.
A group gets its bounds and its children's effective appearance. Nothing is unreachable
because it is not a card.

Geometry is adjusted once. The binding is chosen constantly. §3 says charts and typography
are first-class; this is the first thing in the UI that acts on it.

`References` — what a selection's tokens resolve to — keeps both of its modes: the
selection's, and the document's, which relocates to the left column's Document pane when
nothing is selected.

**A property an object's kind does not have is not shown.** A card has no border-radius;
a text run has no sensor. That is the whole difference between this and a tab strip — and
it is a statement about which questions apply, not about which objects may exist.

### 5. Insert a unit *or* a primitive, both first-class

`+` opens a chooser carrying **both**:

- **Units** — the card library, built on `instantiateWidget`, so a copy arrives with fresh
  ids, remapped bindings preserving semantic keys, and recorded provenance.
- **Primitives** — text, shape, chart, image, video, exactly as today.

Neither is the fallback for the other. The unit is the fast path for the common case; the
primitive is the tool for the case nobody anticipated, which is the case this product is
for. `Insert text · shape · chart` is not deprecated by anything in this design.

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
| **1** | **Groups in the starter** | 52 rows → 8. The biggest change in the product. |
| **2** | **The device lens** | The stage frames a landscape phone by default; the artboard stays free. |
| **3** | **The per-kind inspector** | Selecting a card answers *which sensor*; a shape answers its own questions. |
| **4** | **The composition panel** | Good at eight rows and at two hundred. Thumbnails, roles, keys, quiet lock and eye. |
| **5** | **Units alongside primitives** | The `+` offers both, neither as the fallback. |
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

So they are not re-raised: **no constraint on what a theme may be** — not a card count, not
a card shape, not a device aspect; no responsive or multi-orientation themes; no mobile
authoring (the editor stays desktop-only, §7); no widget *packages* on disk (§139 defers
those until an authoring workflow exists, and this creates the workflow, not the format);
no new product surface nobody asked for; no decoration and no scroll-driven motion (§173).

## Acceptance

Rendered observation in a real browser (§33).

- The layer tree shows eight rows for the starter and expands to the full hierarchy. The
  change is a document change: the groups exist before any panel is touched.
- **A theme of two hundred loose shapes opens, selects, moves and styles every one of
  them**, and the panel is usable at that size. This is the acceptance item that fails if
  the card model turned into a rule.
- A card moves as one object and arrives intact.
- The stage frames a **landscape phone** by default and the device switch is the zoom
  control — while an artboard of any dimensions still authors in the same stage.
- Selecting a card opens Content/Appearance/Spends and no property its kind does not have;
  selecting a free shape opens that shape's own column, at the same density.
- With nothing selected the right column is empty and names where to choose from.
- The `+` offers units **and** primitives, neither greyed, neither described as a fallback.
- **A quarter-disc with three quarters of it outside the artboard is authorable, and the
  editor shows exactly the quarter the phone shows.** Marked as bleeding it raises no crop
  notice; unmarked it still does.
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