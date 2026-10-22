import {
  CONTROLS_LIGHT_MOCKUP_PATH,
  CONTROLS_MOCKUP_PATH,
  MOCKUP_PATH,
  type ParityRegion,
  SETTINGS_ABOUT_MOCKUP_PATH,
  SETTINGS_KEYBOARD_MOCKUP_PATH,
  SETTINGS_MOCKUP_PATH,
} from "./mockup-values.js";

/** Responsibility: the parity table — every row the drawing reader and the comparators are driven over. */

/**
 * The shell's regions, as the census adjudicates them
 * (`.superpowers/sdd/2026-10-10-shell-parity/adjudication.md`).
 *
 * Every row here is one `design-language-parity.spec.ts` asserts. The measured
 * differences are the four body regions the drawing draws **flush** and
 * **square**, and both dialogs' frames. `height` on the header is the **positive
 * control**: the drawing and the product already agree on 42px, so a run that
 * finds no failures at all is caught as a reader that stopped reading rather
 * than reported as a shell that came right.
 *
 * **Two regions the superseded drawing drew have no row here, because they have
 * no counterpart element** (the census records both as `no-counterpart`): the
 * shell frame there was a `1180px` card bounding the app *inside a page*, and
 * the product's editor **is** the window and fills it, so no product element
 * carried that card's radius or its border. `current/shell.html` draws the shell
 * as the window and has no card, so the frame is gone rather than measured.
 *
 * Two rows the census adjudicates are deliberately *not* here, and say so rather
 * than being implied: the graphite role values are Task 4's assertions (the
 * drawing declares them in its own token table, and the reader gains that target
 * then), and every `fix` row whose owner is another plan or another backlog row
 * is named in plan 8's census instead of asserted here.
 *
 * **The settings modal's regions are the tail of this table** (plan 8 Task 1,
 * `.superpowers/sdd/2026-10-11-settings-parity/adjudication.md`): six rows
 * against `current/settings.html` and the shipped modal, four of them reading a
 * *drawing* selector now that the modal has its own file. They are red on the
 * build this table landed on — that is the instrument's contract, and a row that
 * cannot fail is the defect it exists to end (spec §13). Three rows before them
 * (the boxed switch row, its gap, and the two control drawings' label column)
 * already reach into `settings.html` through `mockupPath`.
 */
export const PARITY: readonly ParityRegion[] = [
  {
    region: "header — height",
    mockupSelector: '[style*="height:42px"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-header",
    designLanguageSection: "§7.1, §7's diagram",
  },
  {
    region: "body — inset",
    mockupSelector: '[style*="flex:1;min-height:0"]',
    mockupProperty: "padding-top",
    productSelector: ".editor-shell-body",
    designLanguageSection: "§7's diagram, §3 elevation 0",
    mockupSilence: true,
  },
  {
    region: "body — gap",
    mockupSelector: '[style*="flex:1;min-height:0"]',
    mockupProperty: "column-gap",
    productSelector: ".editor-shell-body",
    designLanguageSection: "§7's diagram, §3 elevation 0",
    mockupSilence: true,
  },
  {
    region: "rail — radius",
    mockupSelector: '[style*="width:46px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-rail",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  {
    region: "left pane — radius",
    mockupSelector: '[style*="width:246px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-panel",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  {
    region: "stage — radius",
    mockupSelector: '[style*="repeating-linear-gradient(45deg"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-stage",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  {
    region: "inspector — radius",
    mockupSelector: '[style*="width:276px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-inspector",
    designLanguageSection: "§3 radius table, §7's diagram",
    mockupSilence: true,
  },
  /* **A dialog's radius is not the drawing's to give.** The only 10px frame the
     superseded drawing had was the window's own — `.mockup` and the shell card it
     wrapped — and both belong to a drawn window, which the product does not have;
     `current/settings.html` draws no window and so has no frame for a row to
     name. DESIGN.md §3's radius table is closed (4/6/8/10) and gives 10 to
     "Floating clusters (dock, view controls, identity chip)" only; a modal is not
     a cluster, so both dialogs are panels and take `--radius-lg`. So this row's
     comparator is the **scale**, read from the product's own `:root` declaration
     (`scaleToken`) rather than written here, and it stays red until Task 3.
     Two rows, because both dialogs render the one `.editor-shell-dialog` rule
     (`shortcut-reference.tsx` and `settings.tsx`) and a change made for one is
     exactly what a single row would miss. */
  {
    region: "settings modal — frame radius",
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-dialog",
    designLanguageSection: "§3 radius table",
    scaleToken: "--radius-lg",
    surface: "settings",
  },
  {
    region: "`?` sheet — frame radius",
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-dialog",
    designLanguageSection: "§3 radius table",
    scaleToken: "--radius-lg",
    surface: "sheet",
  },
  {
    /* The one composition difference a predating rule addresses: §7.5 admits
       both treatments, so the drawing's texture is not the product's obligation.
       Recorded rather than asserted — see the census's `licensed` tally. */
    region: "stage ground — texture",
    mockupSelector: '[style*="repeating-linear-gradient(45deg"]',
    mockupProperty: "background",
    productSelector: ".editor-shell-stage",
    designLanguageSection: "§7.5",
    licensed:
      '§7.5: "Subtle palette-derived stage texture is permitted when it stays behind the artwork and does not obscure controls; neither texture nor a flat ground is mandatory."',
  },
  /* ── The view cluster's camera step (`vg-456`) ──────────────────────────────
     The three zoom/fit squares at `current/shell.html:160,163,166` were read by
     nothing: the drawings README states their 26px as prose, `PARITY` carried no
     region for the cluster, and `mockup-values.test.ts` reads drawing values only
     through `PARITY` rows — so the squares could return to 22px with every check
     still green.

     **The address has to carry one of the two dimensions, and this is the one it
     can carry.** The three squares' `style` attributes are identical, so an
     address is a substring of them; the substring naming neither dimension
     (`border-radius:6px;display:flex;align-items:center;justify-content:center`)
     also matches the bottom cluster's 30px squares, and one naming `width` alone
     also matches the switch at `:338` (`width:26px;height:14px`), so `addressed`
     refuses either. Carrying `height` settles the three squares alone, which is
     why both rows read through it: the **width** row then compares a value, and
     a height regression is the address going stale. */
  {
    region: "view cluster — the camera step's width",
    mockupSelector:
      '[style*="height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center"]',
    mockupProperty: "width",
    productSelector: ".editor-shell-view-step",
    designLanguageSection:
      "§5 — 'Icon button — A 26–30px square at `--radius-md`, glyph only'",
  },
  {
    region: "view cluster — the camera step's height",
    mockupSelector:
      '[style*="height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-view-step",
    designLanguageSection:
      "§5 — 'Icon button — A 26–30px square at `--radius-md`, glyph only'",
  },
  /* **The control set's own drawing, read on the fixture.** Both files are the
     inspector column and both declare the same row: a label column of
     `width:74px;flex:0 0 auto` and a value cell of `flex:1`. The product
     declared neither, so a number well was as wide as its `<input>`, a select
     filled the slot and a segmented group hugged its right edge — four widths
     in one section where the drawing draws one (`vg-297`).

     **The selector names the long-copy label, and that is not an accident.**
     Eleven of the twelve labels carry `width:74px;flex:0 0 auto` with nothing
     after it, and the twelfth — the one over the multi-line well — carries the
     same declaration plus `padding-top:4px`. A `[style*="…"]` selector is a
     substring match, so every prefix of the eleven also matches the twelfth and
     the reader refuses to pick one; the twelfth is the *only* address that
     settles which element is meant, and it declares the same column. Two rows
     rather than one because the drawings are two files, and one of them having
     drifted is exactly what a single row could not say. */
  {
    region: "field row — label column (controls drawing)",
    mockupPath: CONTROLS_MOCKUP_PATH,
    mockupSelector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11px;padding-top:4px"]',
    mockupProperty: "width",
    productSelector: '[data-fixture="text"] label',
    designLanguageSection:
      "§5 (the shared grid); DESIGN.md is silent on the column's width, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — label column (controls-editorial drawing)",
    mockupPath: CONTROLS_LIGHT_MOCKUP_PATH,
    mockupSelector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11px;padding-top:4px"]',
    mockupProperty: "width",
    productSelector: '[data-fixture="text"] label',
    designLanguageSection:
      "§5 (the shared grid); DESIGN.md is silent on the column's width, so the drawing governs",
    surface: "fixture",
  },
  /* **The two shapes a row takes when a drawing shapes it differently.** The
     field row above is the default; these two are the rows the drawings draw as
     something else, and each is read from the drawing that draws it rather than
     from a value chosen here (`vg-302`).

     **Two properties each, because the drawing declares two.** The box's
     `border-radius` alone was the instrument claiming more coverage than it had:
     the product's `gap` matched the drawing's by construction, and nothing
     compared it. Reading one of a drawing's two declared values is `vg-292`'s
     family, which is the family this task exists to leave.

     The settings modal's switch row: `settings.html:89-93` draws it as a
     `--panel-2` box at `--radius-lg`, the label at `flex:1` and the 26×14
     switch at the right — no label column. That box is why the row is a shape
     and not a width: applying the inspector's 74px column to it wrapped
     "Follow the system" onto a second line. The drawn box's inset is §3's `8px`
     (the off-scale `9px` was drawing-stale, `vg-303`); the drawing writes it as
     a `padding` shorthand, which `lookup` refuses to read a longhand from, so no
     row holds it and the rows read the radius and gap the drawing declares.

     The drawing's `gap: 10px` is the row's own: label to switch. The pane
     picker's `gap: 6px` is inside its trigger, name to chevron, which is the
     element the row names. */
  {
    region: "field row — the settings switch row's box (settings drawing)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-fixture="boxed"] > div',
    designLanguageSection:
      "§5 (the well); DESIGN.md does not shape the modal's switch row, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — the settings switch row's box, label to switch",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    mockupProperty: "gap",
    productSelector: '[data-fixture="boxed"] > div',
    designLanguageSection:
      "§5 (the well); DESIGN.md does not shape the modal's switch row, so the drawing governs",
    surface: "fixture",
  },
  /* The shell's select-trigger box — the well-with-chevron form the drawing
     writes on the Add pane's picker and twice on the inspector's own triggers.

     **The row reads the inspector's instance, and the title names it rather than
     claiming the picker.** `shell.html:129` (the picker) declares the trigger as
     `display:flex;align-items:center;gap:6px;…;border-radius:6px;padding:4px
     8px`; `:275` and `:312` (the inspector's triggers) declare exactly that plus
     a leading `flex:1;`, so the picker's attribute is a **suffix** of theirs and
     every substring that matches it matches them too. A `[style*="…"]` selector
     therefore cannot settle the picker alone — a shorter one addresses three
     elements and `lookup` refuses — and the declaration the row can read is the
     inspector's. Its `border-radius` and `gap` are the picker's too, and the
     product side of both rows is the picker (`control-fixture.tsx`'s `headed`
     element, the fixture's copy of `shell.html:128-132` because the Add pane is
     closed while Document is open). What the column's *absence* buys the picker
     is geometry, and the fixture asserts that: the control starts where the row
     starts. */
  {
    region: "field row — the inspector select trigger box (shell drawing)",
    mockupPath: MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:4px 8px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-fixture="headed"] [data-fixture-select]',
    designLanguageSection:
      "§5 (the well the trigger is drawn as); DESIGN.md does not shape the pane's picker, so the drawing governs",
    surface: "fixture",
  },
  {
    region: "field row — the inspector select trigger box, name to chevron",
    mockupPath: MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:4px 8px"]',
    mockupProperty: "gap",
    productSelector: '[data-fixture="headed"] [data-fixture-select]',
    designLanguageSection:
      "§5 (the well the trigger is drawn as); DESIGN.md does not shape the pane's picker, so the drawing governs",
    surface: "fixture",
  },
  /* ── The settings modal, against `current/settings.html` (plan 8 Task 1) ────
     The drawing is now the modal's comparator for the regions it draws, read on
     the `settings` surface: the modal is opened by the gear, its Appearance panel
     is the default tab, and every element below exists only while it is open
     (plan 7's `surface` control set — no new machinery).

     **These rows are red on the build they land on, on purpose.** Tasks 2, 3 and
     5 pull the product to the drawing, and each row names its task in the census.
     A row loosened, skipped or `test.fixme`d to reach green would be the defect
     this table exists to end, so none is. Task 2 has since answered two of them —
     row 1 and row 2 below read green — and the note each carries says how.

     **Row 1 — the navigation's axis.** The drawing is a `150px` column with an
     icon per row; the product *was* a horizontal word strip with no width of its
     own, and is now the column the drawing draws (Task 2). The *width* is the
     one property the axis has, and it is what this row reads: a strip's width is
     its container's, a column's is its own — and the column's is on the element
     this row names, with no padding or border on it, because a border-box width
     would shorten the content box a `width` reading returns. The axis's
     *direction* — and the keyboard model it implies — is not a property and is a
     named gap in the census, Task 2's browser walk being its evidence.

     The rule that makes the drawing govern is **§5** — "The vocabulary
     is closed. A control is one of these, or it is not a control", with no *tab*
     in it, so DESIGN.md requires nothing about the axis — and **spec §13**
     (`:451-454`), which names this very strip: "The mockup governs wherever the
     written rules are silent. Silence is not permission — it is the drawing's
     jurisdiction."

     **Row 2 — the lead's role.** §2 gives a dialog exactly two type roles, and
     the product's `<h2>` was neither: `--text-md` (13px) on `--shell-text` where
     the drawing puts the surface's name on the nav as a `--text-2xs` eyebrow.
     The `<h2>` is the modal's own title and the `?` sheet renders the same rule,
     so its role is §2's dialog title, `--text-lg` — read from the product's own
     `:root`, so this row cannot drift from the token. **Task 2 removed the
     eyebrow marks with the size**: §2 reserves uppercase for a section
     eyebrow ("Nothing else is uppercase"), and the rule covers the dialog's
     visible name at seven sites, five of them `<p>`s that render the same string
     the dialog passes as its `label`. The theme library's `role="status"` node
     no longer wears the rule — a status is not a name — and takes
     `.editor-shell-dialog-status` instead.

     **Row 3 — the scrim, and the first colour row.** `#0009` is 60% black where
     §3's modal scrim is `#00000073`, 45%, and a hex literal where §10 forbids one
     in a surface; both are vg-294. The expected value is the token Task 3
     declares — `--elev-scrim` — read from `:root` at run time, so the row follows
     the token rather than a copy of DESIGN.md's number. Until that token exists
     the row reads "the product declares no `--elev-scrim`", which is the failure
     it is for. A *colour* cannot ride `lengthInPx` (it returns `null` for a
     colour) and the drawing draws no scrim at all, so this is the one row whose
     comparator is a resolved colour.

     **Rows 4–6 — the palette group.** The drawing is a `repeat(3,1fr)` grid of
     `--radius-lg` cards, each carrying two 16px bars — the palette's ground and
     its accent. The product is a `grid-cols-2` of `--radius-md` choice rows,
     each carrying one 14px chip. The count is read by `trackCount` (a
     track list is neither side a single px), the card's radius by the px reading,
     and the bar's height by the px reading against the one bar the reader can
     settle: the other eleven carry the same prefix, so a shorter selector would
     address twelve elements and `lookup` refuses rather than pick one. `§5`'s
     choice row is the licence spec `:469-477` withdraws — plan 5 wrote it and
     then cited it — so the drawing governs.

     **The shape is the part of it no row can read.** One chip versus two bars is
     a difference in how many elements the card carries and what each carries, not
     a property of one element; the census names that gap rather than pretending
     the bar's height is the whole finding. */
  {
    region: "settings nav — column width (the axis)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector: '[style*="width:150px"]',
    mockupProperty: "width",
    productSelector: ".editor-shell-settings-tabs",
    designLanguageSection:
      "§5 closes the vocabulary — no *tab* control is in it, so DESIGN.md requires nothing about the axis — and spec §13 (`:451-454`) makes the drawing its jurisdiction where the rules are silent, naming this strip at `:458-459`",
    surface: "settings",
  },
  {
    region: "settings modal — lead type",
    mockupProperty: "font-size",
    productSelector: ".editor-shell-dialog-lead",
    designLanguageSection: "§2 — a dialog title is `--text-lg` 15px (`vg-295`)",
    scaleToken: "--text-lg",
    surface: "settings",
  },
  {
    region: "settings modal — scrim",
    mockupProperty: "background-color",
    productSelector: ".editor-shell-dialog-overlay",
    designLanguageSection:
      "§3 elevation 3 — the modal's scrim is `#00000073`; §10 forbids a hex literal in a surface (`vg-294`)",
    scaleToken: "--elev-scrim",
    comparator: "colour",
    surface: "settings",
  },
  {
    region: "palette grid — column count",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector: '[style*="display:grid"]',
    mockupProperty: "grid-template-columns",
    comparator: "count",
    productSelector: '[aria-labelledby="yunari-settings-palette"]',
    designLanguageSection:
      "§5 rule 7 leaves the grid to the drawing, which draws three columns; no section names a column count",
    surface: "settings",
  },
  {
    region: "palette card — radius",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="border:1px solid var(--edge);border-radius:8px;padding:8px;background:var(--panel2)"]',
    mockupProperty: "border-radius",
    productSelector: "[data-yunari-palette-choice]",
    designLanguageSection:
      "§3 radius table — a card in a grid is `--radius-lg`; §5's choice row is the licence spec `:469-477` withdraws",
    surface: "settings",
  },
  {
    region: "palette swatch — bar height",
    mockupPath: SETTINGS_MOCKUP_PATH,
    // **Re-anchored on the value the drawing now paints.** The selector was
    // `background:#fffdf7` — editorial's *surface* — and the user's ruling that
    // the bar depicts the palette's **ground** (`vg-321`, 2026-10-11) repainted
    // the drawing's bar to `#f5f1e8`, so the old substring matched nothing. The
    // bar's own colour is the honest anchor: it is the value, it says what was
    // drawn, and a bar repainted again moves the address rather than passing.
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#f5f1e8"]',
    mockupProperty: "height",
    productSelector: ".editor-shell-palette-swatch",
    designLanguageSection:
      "§7.8 — 'Palette choices retain visual swatches'; the swatch's form is the drawing's, and §5 names a swatch, never one",
    surface: "settings",
  },
  /* ── The ground bar's COLOUR, one row per solid-ground palette (`vg-321`) ───
     The 2026-10-11 ruling makes the bar depict the palette's **ground** — §4's
     `--bg`, `--shell-backdrop` — and names the drawing's six bars the stale
     side. The height row above reads **only the first rendered bar**
     (editorial's, `readRows`), so a bar's *colour* was compared against
     nothing and every palette passed; each row below is therefore keyed to its
     own palette with a compound `productSelector`, because the grid renders all
     six bars at once and one `.editor-shell-palette-swatch` can only address the
     first of them.

     **Light is deliberately absent, and its bar's colour is therefore
     unverified.** Its ground is a *gradient* (`editor-shell.css:281`, and the
     drawing draws the same `linear-gradient(145deg,#d8ebe4,#afd4d1)`), so the
     product's `background-color` resolves to `rgba(0, 0, 0, 0)` and a gradient
     is exactly what `colourValue` answers `null` for — a colour row would fail
     on a surface that is correct. No `scaleToken` can cover the six either:
     scale tokens are read once from `:root`, which carries only editorial's
     baseline. Five solid grounds are what this instrument can read honestly;
     the light bar needs a gradient-aware comparator that does not exist. */
  {
    region: "palette swatch — editorial ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#f5f1e8"]',
    mockupProperty: "background-color",
    productSelector:
      '.editor-shell-palette-swatch[data-shell-palette="editorial"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — graphite ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#0b0e12"]',
    mockupProperty: "background-color",
    productSelector:
      '.editor-shell-palette-swatch[data-shell-palette="graphite"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — ember ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#e9cdb4"]',
    mockupProperty: "background-color",
    productSelector: '.editor-shell-palette-swatch[data-shell-palette="ember"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — moss ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#cfe0bb"]',
    mockupProperty: "background-color",
    productSelector: '.editor-shell-palette-swatch[data-shell-palette="moss"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    region: "palette swatch — plum ground",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#dccdef"]',
    mockupProperty: "background-color",
    productSelector: '.editor-shell-palette-swatch[data-shell-palette="plum"]',
    designLanguageSection:
      "§4 — `--bg` is 'the window behind everything'; §7.8 names no role, so the drawing's bar is the palette's ground (`vg-321`)",
    surface: "settings",
    comparator: "colour",
  },
  {
    /* **The frame's inset — the one settings region a predating rule keeps, and
       the licence is §3's own spacing table.** The census records `#4` and `#7`
       as one composition difference: the drawing's frame carries no padding of
       its own and insets *from its children* (`current/settings.html:41`
       `padding:14px 16px`, `:22` `padding:10px 6px`), while `.editor-shell-dialog`
       carries `padding: 20px 24px` on the frame and none on the panel. The two
       differ in **where** the inset sits, not in whether there is one — and §3
       positively requires `20–24` for "dialog padding", which is the
       product's value, so this is a difference kept by a rule that predates it,
       not a defect.

       **Task 2 Step 2 may move this value.** It rebuilds `.editor-shell-dialog`'s
       padding as part of the nav (its `Produces`: "a `.editor-shell-dialog` whose
       padding is the nav's geometry rather than a padded column around a strip"),
       so this licence is re-examined when that lands rather than silently
       inherited — the row names the value, so a change to it brings the reader
       back here.

       The selector reads the drawing's *own* inset declaration (`:41`), because
       that is the half of the pair the drawing states as a value: the frame's
       silence about padding is the other half, and it is silence this reader
       would report as the drawing drawing nothing. */
    region: "settings modal — the frame's inset (the dialog's padding)",
    mockupPath: SETTINGS_MOCKUP_PATH,
    mockupSelector: '[style*="flex:1;min-width:0;padding:14px 16px"]',
    mockupProperty: "padding",
    productSelector: ".editor-shell-dialog",
    designLanguageSection: "§3 spacing",
    surface: "settings",
    licensed:
      '§3: "| 20–24 | Between regions; dialog padding |" — the product renders `padding: 20px 24px` on `.editor-shell-dialog`, the value §3 requires for a dialog; the drawing draws no frame padding and insets its children (`current/settings.html:41` `padding:14px 16px`) instead.',
  },
  /* ── The modal's two other panels (plan 8 Task 4) ───────────────────────────
     The census recorded six regions as `no-counterpart` because the current set
     drew the Appearance panel alone (`adjudication.md:96-101`, rows `#13`–`#18`).
     The Keyboard and About panels are now drawn, each on its own file, and these
     are the values those drawings declare for the regions the product renders.

     **The drawing is the target and the rows are red on purpose.** They are
     pulled green by Task 7, which owns the Keyboard panel; the About row passes,
     because that panel is drawn as the product renders it (the census's
     `drawing-stale` repair of a capability the drawing lacked) rather than
     redrawn, and the release row it would carry is absent on both sides
     (`vg-288`, still open).

     **What is not a row, and why.** `#13`'s *placement* — the return-to-default
     action moving into a panel header — and `#16`/`#17`'s armed row and its
     refusal are not values of one element: the first is a shape the drawing now
     draws and the second two are states, of which a drawing shows one
     (`mockups/README.md`). They are Task 7's driven captures (§13.1), not
     comparators, and the census's gap list is where a shape belongs.

     **The chord mark's two declared values are read together**, the shape the
     settings switch row's box already uses: the chip is a bordered mono mark in
     the drawing and a bare `<kbd>` in the product, so its radius and its inset
     are the two halves of one difference. Both rows address the same element —
     twenty unchanged chips in the drawing, which is **one** element form to the
     reader (`addressed` counts identical attributes once), so the selector
     settles which is meant.

     **The row container's radius is a row the census does not carry**, added at
     review: `#13`–`#17` are the header, the chip, the per-row control, the armed
     row and the refusal, and none of them is the container those sit in. §3's
     table puts it out of reach of the value the product declared — a binding row
     is a row, so `--radius-md` and not `--radius-sm` — and the drawing draws 6px.
     Its selector is the container's whole declaration, which twenty rows carry
     identically: one element form, the same reading the chip's row uses. The
     container's `padding:4px 6px` is a shorthand this row does not read, so
     `lookup`'s guard is not tripped. */
  {
    region: "keyboard — the shortcut row's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:center;gap:16px;padding:4px 6px;border-radius:6px"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-keyboard [data-yunari-shortcut-row]",
    designLanguageSection:
      "§3 radius table — `--radius-md` 6px is 'Controls, menu rows, small tiles' and a binding row is a row; `--radius-sm` 4px is 'Swatches, inline chips, the slider thumb's container'",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the chord mark's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="border:1px solid var(--edge);border-radius:4px;padding:4px;font:400 11px/1.3 ui-monospace,Menlo,monospace;color:var(--muted)"]',
    mockupProperty: "border-radius",
    productSelector: ".editor-shell-keyboard kbd",
    designLanguageSection:
      "§2 — a chord mark is mono, so it is a value; §3 radius table — `--radius-sm` 4px is 'Swatches, inline chips'",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the chord mark's inset",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="border:1px solid var(--edge);border-radius:4px;padding:4px;font:400 11px/1.3 ui-monospace,Menlo,monospace;color:var(--muted)"]',
    mockupProperty: "padding",
    productSelector: ".editor-shell-keyboard kbd",
    designLanguageSection:
      "§3 spacing — 4px is 'Inside a control (well padding, icon button)'",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the per-row return-to-default action's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="flex:0 0 auto;border:1px solid var(--edge);border-radius:6px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-yunari-shortcut-reset="file.new"]',
    designLanguageSection:
      "§3 radius table — `--radius-md` 6px is 'Controls, menu rows, small tiles', and a button is a control; the dialog's own Close already takes it",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the return-to-default action's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="margin-left:auto;border:1px solid var(--edge);border-radius:6px"]',
    mockupProperty: "border-radius",
    productSelector: "[data-yunari-shortcut-reset-all]",
    designLanguageSection:
      "§3 radius table — `--radius-md` 6px is 'Controls'; the same value the per-row action takes, one act being one control",
    surface: "settings-keyboard",
  },
  {
    region: "keyboard — the rebind control's radius",
    mockupPath: SETTINGS_KEYBOARD_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px"]',
    mockupProperty: "border-radius",
    productSelector: '[data-yunari-shortcut-arm="file.new"]',
    designLanguageSection:
      "§5 — 'Icon button — A 26–30px square at `--radius-md`, glyph only'",
    surface: "settings-keyboard",
  },
  {
    region: "about — the read-only row's label-to-value gap",
    mockupPath: SETTINGS_ABOUT_MOCKUP_PATH,
    mockupSelector:
      '[style*="display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:4px 0"]',
    mockupProperty: "gap",
    productSelector: "[data-yunari-about] dl > div",
    designLanguageSection:
      "§5 rule 2 — 'Read-only rows are label + mono value, baseline-aligned, right-aligned'",
    surface: "settings-about",
  },
];
