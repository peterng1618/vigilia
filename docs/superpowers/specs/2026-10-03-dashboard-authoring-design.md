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

## What KWGT got right, and what it cost

KWGT is the closest thing to this product that exists — an editor whose output is a small
fixed-size display, built by someone who is looking at it while they author. It is a far
better reference here than Figma UI3, which has no equivalent domain at all. Four things
it taught me, and one place it is worse than us.

**1. The target size is the first decision, not a property.** KWGT's own FAQ says: *"Before
creating a new preset, you have to resize first. It will remember the dimension."* You pick
the widget's size on the launcher, then build the preset to fit it. Even the preset format
carries it — `$si(swidth)$` reads the screen width.

Vigilia has the opposite: the artboard panel offers `Ratio: Custom`, `Orientation: Custom`,
`Resolution: Custom`. Three "Custom"s as the starting state. The design becomes coherent if
the **first** thing an author picks is what this is for — *Phone landscape · Phone portrait
· Wall panel* — and the artboard arrives sized. Custom stays available and stays one click
away; it is just not where you start.

**2. A group needs a size of its own.** KWGT's Overlap group derives its dimensions from
its largest child, and the documented workaround is *"add a transparent shape as background
and give that shape the dimensions you want the group to have."*

That workaround is telling: a container that has no size of its own cannot be laid out
deliberately. Vigilia's cards already have the right answer sitting in them — **the
frosted panel *is* the card's box.** Grouping the starter should therefore make the panel
the group's explicit size, not the largest child. A confirmation from outside, arrived at
independently.

**3. Configuring a thing and editing its parts are different acts.** KWGT's Komponent — an
exportable, reusable group — works because *"the globals of the Komponent will become the
settings of it, so when using the module you will not see the objects inside (unless you
unlock it) but just the basic settings."*

Two intents, two verbs. **Select** gives you the card's settings. **Enter** gives you its
parts. The composition panel conflates them today — a disclosure triangle that both reveals
the children *and* selects the row. They should be separate, because "what can I configure
here" and "what is inside this" are different questions.

**4. Layer and Position are different questions.** KWGT's per-object property tabs separate
`Layer` (scale, rotation, anchoring, alignment, time zone — how it presents) from `Position`
(alignment, margins, anchors, coordinates — where it sits). My earlier sections were
Content / Appearance / Spends / Geometry, which mixes them. The corrected set:

| Section | The question |
|---|---|
| **Content** | What does it show? |
| **Position** | Where does it sit, and what size? |
| **Layer** | How does it present — scale, rotation, anchoring, alignment? |
| **Paint** | What ink, from which tokens? |
| **Spends** | Read-only: the tokens and presets it resolves to |

**And where we are better.** KWGT's own bug list says *"Move items into the Overlap group,
Stack group and Komponent will lose the position properties. Because it will work as
padding instead of X/Y offsets"* — a lossy grouping operation its users document as a
known issue, alongside a *"4 years long"* inverted-clip-mask bug in the same groups.

§57 already requires group/ungroup to **preserve world appearance**. That is a guarantee
KWGT cannot make, and it is why this plan authors the starter *as* groups rather than
grouping it after the fact. Keep that requirement; it is the difference.

Sources: [Groups explained](https://docs.kustom.rocks/docs/general_information/groups_explained/),
[KWGT FAQ](https://docs.kustom.rocks/docs/faq/faq_kwgt/), [Kustom forum on grouping](https://forum.kustom.rocks/t/group-elements-in-kwgt-custom-widget/7787).

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

### Convenience is not a smaller surface

> *We made it convenient for authors to design. Not limit what they could design
> because we thought that's limited set is what they should care about. A chart might
> have 50 customizable properties. We thought that would confuse the user, so we show
> them 10 and lock the other 40 into defaults, hidden. That's wrong.*

The correction is general, and it is aimed at this spec as much as at the code: **order
and grouping are how you serve convenience. Removal is not.** A long property list is a
navigability problem, and the answer to a navigability problem is navigation.

So, for every property surface in this design:

- **Every authorable setting is present.** None locked to a default, none hidden.
- **Ordered by likelihood of use**, so the common path is the first thing read.
- **Grouped by what the setting is about** — shape, paint, data, time — not by which
  struct happens to declare it.
- **Every field carries a hint** saying what it does, in the author's language. Most
  descriptors ship without one today; the field exists on `SettingsFieldDescriptor` and
  is underused.
- **Good defaults**, so an author who touches nothing still gets something worth showing.
- **The obscure ones at the end, in a collapsed section** — present, findable, and out of
  the way. Collapsed is not hidden: the count is visible and the section opens.

**Measured, and the codebase already agrees.** `renderer-core/src/charts/settings-fields.ts`
is headed *"Every scalar setting, per family"* and mostly is. Against the settings types:
line 11 descriptors of 15 keys, bar 9 of 12, pie 7 of 11, plus paint fields per family.
So the architecture the principle wants already exists — what is missing is the
organisation layer, and **two actual holes**:

- **`PieSettings.total` is unreachable** (`vg-121`). Whether a pie sums its parts or
  divides by a *fixed total with a measurable remainder* is the RAM/storage-ring case,
  and the renderer computes `remainder`, `overflow` and `complete` against it. An author
  cannot choose it. That is the principle's exact failure: a real decision removed
  because the surface looked long without it.
- **`animation` is unreachable on every family** (`vg-122`).

The file's own header also records a known duplication: `validate.ts`'s
`validateSettingsRange` is *not* a switch, so a fifth family would be range-checked as a
pie, and driving it from this table "closes both problems at once."

**The plan's obligation.** The new per-kind inspector renders from these descriptors
rather than re-curating them, every descriptor gains a group and a hint, and the
completeness check is a test: a key in a settings type with no descriptor fails. That
test is the one that would have caught both holes the day they were cut.

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

**The artboard is chosen from a device, not typed.** Today a new theme opens with
`Ratio: Custom`, `Orientation: Custom`, `Resolution: Custom` — three "Custom"s as the
starting state, which asks an author to know a ratio before knowing what the thing is for.
KWGT's own rule is *"before creating a new preset, you have to resize first; it will
remember the dimension."*

So the **first** question is what this is for, and the artboard arrives sized:
*Phone landscape · Phone portrait · Wall panel*. Custom is still there and still one click
away — this reorders the decision, it does not remove an option.

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

**Select and enter are different acts.** A disclosure triangle that both reveals the
children *and* selects the row conflates two questions: *what can I configure here* and
*what is inside this*. KWGT's Komponent separates them — the component's globals become
its settings, and you unlock it to see the objects inside. So:

- **select** a row → that thing's settings
- **enter** a group → its parts, in the panel and on the canvas

Lock and visibility appear only when they are true — hover, selection, or non-default.
104 icons reading "visible, unlocked" was noise, and that noise is worse the more rows
there are, which is exactly the case a card-heavy panel would hide.

Expansion is available and stays available. This is not a flattening; it is a default.

### 4. The right column describes what the thing *is*

A CPU card is not a rectangle. The first question about one is *which sensor*, not *how
many pixels wide*. The sections are the questions, kept separate — **Content** is what it
shows, **Position** is where it sits, **Layer** is how it presents, **Paint** is what ink.
Conflating position with presentation is why the current panel reads as a form.

| Section | The question |
|---|---|
| **Content** | What does it show? Shows · Range · Format · Unit |
| **Position** | Where does it sit, and how big? |
| **Layer** | How does it present — scale, rotation, anchoring, alignment? |
| **Paint** | What ink, from which tokens? |
| **Spends** | Read-only: the tokens and presets it resolves to |

Position and Layer are separate because they are separate questions, and because scaling a
card and moving it are different mistakes. Geometry as a whole is collapsed by default: an
author adjusts it once and chooses the binding constantly.

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

The two sources are **not** a quality setting. They answer different questions:

- **Preview answers for every sensor the theme names**, whether or not this PC has one.
- **Live answers for what this machine actually reports.**

That distinction is the point, and it is why both stay. An author is usually not building a
theme for their own machine — they are building one to hand to somebody else — so the theme
routinely names a sensor the author does not have. A tool that could only show this PC's
hardware would make that theme unauthorable on the machine it was authored on.

`createPreviewSource` already does this: it takes the theme's keys and answers for each
from a waveform, so a theme may feature a GPU temperature on a laptop with no discrete
GPU. **Keep it, keep the switch, and stop describing it as "fake data".** The framing that
survives is *"what this machine reports"* against *"what the theme asks for."*

The switch stays because it is a real choice with real consequences, and it stays in canvas
controls where the canvas is (plan 1, task 4) rather than in a menu.

Publishing answers one question: *put this on the phone*. With LAN on, the phone shows what
you are editing. The header carries the address and a QR code, and §145's "explicit
opt-in" becomes a control rather than a CLI flag.

### 7. Keyboard-first

Unlabelled actions are unlearnable, and eighteen of them were on the canvas at once. Every
action shows its shortcut in its tooltip, one contextual toolbar renders from the existing
action registry, and `?` opens a reference rendered from the same `PRODUCT_SHORTCUTS` map.

### 8. A chrome that belongs to its own product, on one primitive library

**The problem is not that Base UI is limited. It is that there are two of everything.**

Measured across the editor and player: Base UI is used in **five imports** — `menu` three
times, `tabs` once, `context-menu` once. Meanwhile `@radix-ui/react-popover` is **already a
direct dependency**, and `components/ui/popover.tsx` is *shadcn's Popover on Radix*, hand-
owned, whose own comment records that the colour picker's ecosystem already put a second
headless library in the tree. So the app has two primitive libraries and **two popover
implementations** — Base UI's `Menu` for the palette, Radix's `Popover` for the colour
picker.

**Neither Base UI nor Radix ships a colour picker.** shadcn/ui does, and shadcn is
copy-paste components you own rather than a library you depend on — which is exactly what
this repo already does by hand: `colour-picker.tsx`, `colour-maths.ts` and
`gradient-editor.tsx` exist and work. **So the motivating example does not hold: the colour
picker is not missing, and switching libraries would not have produced it.**

What the redesign actually needs, and where it is today:

| Need | Have |
|---|---|
| menu | Base UI ✓ |
| tabs | Base UI ✓ |
| context menu | Base UI ✓ |
| popover | **both** — the incoherence |
| colour picker | ours, on Radix popover |
| dialog (the `?` reference) | **neither** |
| collapsible (inspector sections) | **neither** |

**Ruling: standardise on Radix as the single primitive library, and migrate the five Base
UI imports.** It is already a direct dependency, it carries `Dialog`, `Collapsible`,
`Tooltip` and `Select` — the three the redesign needs and Base UI is not currently used for
— and the repo already owns components in shadcn's idiom, so this matches how it works
rather than imposing something new.

**This is a mechanism-boundary change and the reuse gate says so.** A primitive library is
exactly "an owner where a wrong decision is expensive and invisible" — nothing fails, it
just renders or behaves wrongly. So it gets a `docs/decisions/` note and the seven rungs
before its first write, **and it is sequenced as its own plan phase rather than folded into
layout work**, because migrating the menus touches the same tests that assert their
behaviour — including the `ResizeObserver` and `getAnimations` stubs those files carry
specifically because Base UI's popups need them.

Cost if wrong: five files and their tests revert. Cost of *not* deciding it: the redesign
adds a Dialog and a Collapsible from a third source, and the incoherence compounds.

### 9. Appearance

The editor is warm cream glass; the dashboards it makes are dark and neon. Tailwind v4's
`@theme` carries the spacing, radius, type and elevation scales; `@theme inline` carries the
runtime-switched palette so one `data-shell-palette` attribute recolours everything,
including every portalled popup. The editor follows the OS appearance, with the palette
picker as an explicit override. Six palettes, six distinguishable things.

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
- **Every authorable setting of a selected object has a control.** A key in a settings type
  with no descriptor fails a test, so a property cannot be quietly dropped from the surface
  without a red gate — the two holes filed today would not have survived it.
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