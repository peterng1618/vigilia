/** Typed package-local visible editor copy (§35). Authored theme text,
 * telemetry values and developer errors stay outside this module. */

import type { ChartFamily } from "@vigilia/renderer-core";
import type { DisplayLensId } from "./display-lens.js";
import type { ShortcutPrefix } from "./shortcut-manager/display.js";

/**
 * The one name per chart family, hoisted so the layer role vocabulary can
 * compose a row's string from the same words the Add pane and the canvas
 * context menu offer. A second spelling of `Gauge` would be a second owner of
 * the same fact.
 */
const chartFamilyLabels = {
  gauge: "Gauge",
  line: "Line",
  bar: "Bar",
  pie: "Pie",
} as const satisfies Record<ChartFamily, string>;

/**
 * The generic word for each kind of layer. `layer-tree.ts`'s row-name fallback
 * reads these, so the five kind words have one owner rather than a private
 * table beside the projection. Keys mirror `LayerKind`: a kind added there
 * without one fails to compile where the projection indexes this.
 */
const layerKindLabels = {
  text: "Text",
  shape: "Shape",
  chart: "Chart",
  group: "Group",
  image: "Image",
} as const;

/**
 * How a row's role reads: one function per arm of `LayerRole`, each turning the
 * facts the projection reports into the words the row shows.
 *
 * A chart whose family this build does not know shows the kind word rather than
 * a neighbour's family the document never claimed, and a chart drawing more
 * than one series says how many (`Line ×3`) — the family alone would hide the
 * difference between one reading and three.
 */
const layerRoles = {
  text: (): string => layerKindLabels.text,
  shape: (): string => layerKindLabels.shape,
  image: (): string => layerKindLabels.image,
  group: (unit: string | undefined): string => unit ?? layerKindLabels.group,
  chart: (family: ChartFamily | undefined, series: number): string => {
    const label =
      family === undefined ? layerKindLabels.chart : chartFamilyLabels[family];
    return series > 1 ? `${label} ×${series}` : label;
  },
} as const;

/**
 * One reason per kind, keyed by the kind `renderer-core` is asked with.
 *
 * Three causes, not one sentence: an open path has no interior to sample
 * through, a path's closedness is author data the product cannot know, and a
 * glyph, a photograph or a plotted series is not a panel at all. `Group` is
 * here because the owner admits it and the renderer still refuses it — Fabric
 * draws a group's children directly, so no boundary is left to sample through
 * (`scene-fabric/src/glass.ts`).
 */
const glassRefusals: Readonly<Record<string, string>> = {
  Polyline:
    "A Polyline is an open path, so there is no interior to sample the backdrop through.",
  Line: "A Line is an open path, so there is no interior to sample the backdrop through.",
  Path: "A Path is author-drawn data and the product cannot know whether it is closed.",
  Group:
    "A Group has no render boundary of its own — put frosted glass on the panel inside it.",
  Textbox:
    "Text is not a panel, and there is no surface behind a glyph to frost.",
  Text: "Text is not a panel, and there is no surface behind a glyph to frost.",
  IText:
    "Text is not a panel, and there is no surface behind a glyph to frost.",
  Image: "An image is not a panel, and there is nothing behind it to frost.",
  VigiliaChart:
    "A chart is not a panel, and there is nothing behind a plotted series to frost.",
  ActiveSelection:
    "Frosted glass applies to one shape at a time — select the shape you want to frost.",
};

/** Typed package-local visible editor copy (§35). Authored theme text,
 * telemetry values and developer errors stay outside this module. */
export const uiCopy = {
  brand: "Vigilia",
  /** The rail's four slots. A slot's word is both its tooltip and its
   *  accessible name: the slot is icon-only, so it has no text of its own, and
   *  a glyph stored as a translatable string would be announced as a word and
   *  could not inherit a shell colour. One word per slot, from the one owner
   *  of which slots exist (`rail.tsx`). */
  rail: {
    /** The rail's own name, so a screen reader is told what the group of
     *  slots chooses between before it reads each one. */
    label: "Editor panes",
    slots: {
      composition: "Composition",
      add: "Add",
      tokens: "Tokens",
      /** The artboard, background, metadata and reference panels — one pane,
       *  because they are the document's own settings. */
      document: "Document",
    },
  },
  /** Selection inspector field labels. */
  inspectorFields: {
    selection: "Selection",
    /** What the selected object is called in the layer list, as against the id. */
    name: "Name",
    /** Shown when a name is rejected rather than truncated to the published bound. */
    invalidName: "That name cannot be applied to the selection.",
    /** The section the obscure fields collapse into — present and findable, and
        out of the way of the questions an author asks on every edit. */
    advanced: "Advanced",
    x: "X",
    y: "Y",
    /** The Size pair marks its boxes W and H, as the artboard panel's does: the
        full words overflow the row and wrap the second input to its own line. */
    width: "W",
    height: "H",
    rotation: "Rotation",
    /** Row labels for the inspector's paired geometry lines. */
    position: "Position",
    size: "Size",
    /** A text object whose authored box and its own edge are different numbers.
        The Size fields cannot show the edge — they write the box — so this
        names which is which rather than leaving the author to compare a panel
        against a canvas. */
    sizeDisagrees: (box: string, drawn: string) =>
      `Size is the box the text was authored in (${box}). The object measures ${drawn}.`,
    invalidValue: "That value cannot be applied to the selection.",
    nothingSelected: "Select an object to inspect it.",
    /** Shown instead of any field when the selection is locked. */
    locked: "This object is locked. Unlock it to edit it.",
    /** Crop, on a selected image. The session owns the drag and the refusals;
        these name only the controls that start and end it. */
    crop: "Crop",
    cropApply: "Apply",
    cropCancel: "Cancel",
    /** Panel appearance. Every primitive shape owns a fill, a stroke, a border
        width and a shadow; the corner radius is a rectangle's alone. */
    panelFill: "Fill",
    /** An unfilled path is stroked, so its paint is ink and `Fill` would be the
        wrong word — the author who sets it wants the icon recoloured, not the
        region its centrelines enclose flooded. See `paintPropertyFor`. */
    panelInk: "Ink",
    panelStroke: "Stroke",
    panelBorder: "Border width",
    panelRadius: "Corner radius",
    panelShadow: "Shadow",
    panelShadowBlur: "Shadow blur",
    panelShadowOffset: "Shadow offset",
    /** What one shape owns and no other: its corners, its points, its ends or
        its data. The general geometry fields above stay unchanged. */
    shapeSides: "Sides",
    shapePoints: "Points",
    shapeStart: "Start",
    shapeEnd: "End",
    shapePath: "Path data",
    /** The two ends of a swept curve, in degrees. "Angle" is what makes them
        different from the line's own `Start`/`End` endpoints one row up: the
        numbers are positions round a circle rather than points in the box. */
    shapeStartAngle: "Start angle",
    shapeEndAngle: "End angle",
    /** The frosted-glass treatment and its one parameter. */
    glassEnabled: "Frosted glass",
    glassBlur: "Glass blur",
    /**
     * Why one shape cannot be frosted, in that shape's own terms.
     *
     * "Glass applies to panels" teaches an author a rule they still cannot act
     * on; naming the shape they selected tells them what to select instead. The
     * kinds are the ones `renderer-core` is asked with, and membership is
     * decided there — this table only says why an answer of no came back, so a
     * kind it admits never reaches it and a kind added later falls to the
     * sentence below rather than to no explanation at all.
     */
    glassRefused: (kind: string) =>
      glassRefusals[kind] ??
      `${kind} is not a shape frosted glass can be applied to.`,
    /** Named as what the author is describing, not as "ignore the warning". */
    bleeds: "Deliberate bleed",
    opacity: "Opacity %",
    paint: "Paint",
    notSet: "not set",
    unresolved: "no longer resolves",
    runs: "Runs",
    runPreset: "Type preset",
    /** What one run says, for a run that is prose. Distinct from the Add pane's
        "Text" button, which inserts an object rather than naming a field. */
    runText: "Run text",
    addRun: "Add run",
    /** Shown when an in-place edit would have to drop the runs it cannot place. */
    multiRunRefused:
      "This text has more than one run, and typing over the whole object would drop the others. Edit each run's text in the run editor.",
    /** A chart's bindings are its series, which is the word the panel already
        uses for the axis. Named once so the chooser and the refusal agree. */
    runSeries: "Add a series",
    runSeriesFull: (family: string) =>
      `A ${family} chart draws one reading, so it takes one series.`,
    removeSeries: (key: string) => `Remove the series reading ${key}`,
    /** Numbered, so three rows do not offer three identical buttons — the same
        ambiguity F1.17 found in the Add pane, where "Line" was two things. */
    removeRun: (position: number) => `Remove run ${position}`,
    /** Shown when a run after the first asks for tracking the object cannot
        carry: Fabric measures spacing once, from the object. The interpolation
        is the run's own preset reference, as the run list above names it. */
    runTrackingNotSeparate: (preset: string) =>
      `Tracking on "${preset}" is not shown separately — a text object carries one tracking value, from its first run.`,
    editTypePresets: "Edit type presets",
    documentStyle: "This document",
    runColour: "Colour",
    runSource: "Reads",
    staticText: "Static text",
    runFormat: "Format",
    /**
     * The token vocabulary, under the field. The formatter's own rule is that
     * an unrecognised token renders literally "so a typo is visible" — which
     * makes it visible **on a display**, where the author is not looking. The
     * alternative to naming them here is a date reading `EEE, Sep d, yyyy` on a
     * wall, which is exactly what this pass drew.
     */
    runFormatTokens:
      "Tokens: YYYY YY · MMMM MMM MM M · dddd ddd · DD D · HH H hh h · mm ss · A a. Words in [square brackets].",
    runZone: "Zone",
    runZoneFollows: "Follow the display",
    valueRun: "Value",
    emptyRun: "(empty)",
    /** Which binding a run names. The canvas paints the reading, so this is
        where the author sees the name a run reads from. */
    runBinding: (key: string) => `Reads ${key}`,
    /** A run names a binding this object does not declare, so nothing can
        resolve it. The author can only fix this by declaring the binding. */
    runUndeclared: (id: string) =>
      `No binding "${id}" is declared here, so this run resolves to nothing.`,
    /** Declared, but no reading has arrived for it — a missing sensor, not a
        mistake in the theme. Distinct from undeclared because it needs no edit. */
    runUnmapped: (key: string) => `No reading has arrived for ${key} yet.`,
    align: "Align",
    left: "Left",
    centre: "Centre",
    right: "Right",
    /** Text inside its box, which is the thing the two words above do not say.
        The canvas's own `align-top` / `align-center-y` / `align-bottom` move
        selected *objects*, and both surfaces are reachable from one selection,
        so this one names its own subject rather than borrowing the verb. */
    verticalAlign: "Vertical text align",
    verticalTop: "Top",
    verticalMiddle: "Middle",
    verticalBottom: "Bottom",
    wrap: "Wrap",
    on: "On",
    off: "Off",
    overflow: "Overflow",
    clip: "Clip",
    ellipsis: "Ellipsis",
    overflowVisible: "Visible",
  },
  menus: {
    file: "File",
    edit: "Edit",
    view: "View",
  },
  /**
   * How a chord reads. What a key *prints* is deliberately not here: the caps
   * and the marks for unnamed keys are the platform's own and change with
   * neither language nor product, so they live beside the formatter that spells
   * them (`shortcut-manager/display.ts`) rather than in a table of words a
   * translator would change. The rule above is what keeps that honest — `⌘` is
   * a `\p{S}` pictograph, and a copy table that admits one has stopped being
   * one.
   *
   * `alternativeSeparator` is between two chords one action answers to, and is
   * the layer panel's `boundSeparator` idiom one surface over — punctuation,
   * because a word would read as part of a key name.
   *
   * The group names are keyed by the prefix of an action id, which is what
   * makes a new prefix a compile error rather than a heading nobody wrote — and
   * a group word for a prefix no action carries a compile error too, so a
   * heading cannot outlive the actions under it. `help` therefore arrives with
   * the first `help.*` action rather than ahead of it.
   */
  shortcuts: {
    reference: "Keyboard shortcuts",
    close: "Close",
    alternativeSeparator: " · ",
    groups: {
      file: "File",
      edit: "Edit",
      canvas: "Canvas",
      view: "View",
      help: "Help",
    } satisfies Record<ShortcutPrefix, string>,
  },
  file: {
    newDocument: "New theme",
    /** The reference composition, offered as what it is: a template the
     *  product ships. `New` is the author's own blank document; this is the one
     *  they can open a copy of. */
    newFromStarter: "New from starter",
    openPackage: "Open package",
    savePackage: "Save package",
    releasePackage: "Release package",
    openLibrary: "Open library",
    saveLibrary: "Save to library",
  },
  /** The chooser `New` opens before the document exists. The first control is
   *  the display a theme is for, and its entries are the display switch's own
   *  names — one vocabulary, one place it is worded. Behind **Custom** sit the
   *  artboard panel's own three labels, so only the two words this surface adds
   *  are here. */
  newDocument: {
    chooseSize: "Choose an artboard size",
    /** The first question. Named as what it decides — where this theme will be
     *  seen — rather than by the aspect it derives. */
    display: "Display",
    custom: "Custom size",
    create: "Create",
    cancel: "Cancel",
  },
  /** The library chooser. Its two groups say which kind of thing a row is: a
   *  template the product offers, or a theme the author made and can delete. */
  library: {
    choose: "Open a theme",
    /** The control's own name. Distinct from `choose`, which titles the
     *  dialog; a label repeating the title printed over the control. */
    themeField: "Theme",
    templates: "Templates",
    yourThemes: "Your themes",
    open: "Open",
    cancel: "Cancel",
    /** The dialog a refused save raises. Two answers and a way out, because a
     *  refusal must not cost the author their document and must not be a dead
     *  end: reload takes the stored version, overwrite keeps theirs, and
     *  cancelling keeps both. */
    conflict: {
      lead: "This theme was changed somewhere else",
      reload: "Open the saved version",
      overwrite: "Replace it with mine",
      cancel: "Keep editing",
    },
  },
  /** The prompt before a document is replaced, which the author reads on the
   *  way to losing their work. */
  replaceDocument: {
    question: "Save changes before opening another theme?",
    save: "Save",
    discard: "Discard",
    cancel: "Cancel",
  },
  saveState: { unsaved: "Unsaved changes" },
  /** The publish surface. §145: plain LAN HTTP has no confidentiality, so the
   *  words that turn it on have to say what it is. */
  publish: {
    qrName: (url: string): string => `QR code: ${url}`,
    start: "Publish to a phone",
    stop: "Stop publishing",
    starting: "Opening the LAN…",
    /** The popover's own name, so a screen reader reaching the facts knows what
     *  surface it is on before it reads them. */
    surface: "Publishing",
    address: "Phone address",
    warning:
      "Plain HTTP on your own network — trusted networks only, never the internet.",
    copy: "Copy link",
    copied: "Copied",
    /** Which document a display is showing while the author edits it. */
    live: (name: string): string => `Showing ${name}`,
    /** Publishing carries the document and its assets from the theme's own
     *  folder, so a document that has never been saved has nothing to publish
     *  and the author has one step left. */
    unsaved: "Save this theme to the library to publish it",
    expires: (at: string): string => `Pairing expires ${at}`,
  },
  /** The View menu. Each setting names itself and its current value; the values
   *  are listed here rather than composed from a number and a unit, so the menu
   *  cannot say `1` and leave the reader to guess FPS from the neighbour.
   *
   *  The two readings answer different questions (§6): one answers for every
   *  sensor the theme names, the other for what this machine reports. Neither is
   *  the fallback for the other, so neither is called a preview of the other. */
  view: {
    dataSource: "Readings from",
    chartRefresh: "Chart refresh",
    preview: "The theme's sensors",
    live: "This machine",
    previewDetail: "every sensor this theme names",
    valueRuns: "Value runs",
    tokens: "tokens",
    values: "values",
    fps30: "30 FPS",
    fps1: "1 FPS",
  },
  actions: {
    duplicate: "Duplicate",
    lock: "Lock",
    unlock: "Unlock",
    front: "Bring to front",
    bringForward: "Bring forward",
    sendBackward: "Send backward",
    back: "Send to back",
    group: "Group",
    ungroup: "Ungroup",
    delete: "Delete",
    undo: "Undo",
    redo: "Redo",
    copy: "Copy",
    cut: "Cut",
  },
  /** One label per arrange action; keys mirror `ArrangeAction`. */
  arrangeLabels: {
    "align-left": "Align left",
    "align-center-x": "Centre horizontally",
    "align-right": "Align right",
    "align-top": "Align top",
    "align-center-y": "Centre vertically",
    "align-bottom": "Align bottom",
    "distribute-x": "Distribute horizontally",
    "distribute-y": "Distribute vertically",
  },
  /** The status line's report of a refusal or a failure. The severity word
   *  leads the message because the line outlives the moment it was written:
   *  whoever reads it later cannot see which mark it was given. */
  diagnostics: {
    label: "Editor message",
    error: "Error",
    warning: "Warning",
  },
  /** The one contextual toolbar on the canvas: the object actions the
   *  selection can run and the arrange actions it is too small to enable. One
   *  word for one surface; the buttons carry the action labels. */
  canvasToolbar: { label: "Actions for the selection" },
  /** The canvas context menu's accessible name. Its entries reuse the action
   * registry's labels and `chartFamilies`, so no entry copy lives here. */
  canvasMenu: { label: "Canvas actions" },
  /** The stage camera's control: the display the stage looks through, and the
   *  two framings that are not a display. `label` names what the control is;
   *  the trigger appends the readout it shows, because an accessible name that
   *  omits the visible text does not satisfy WCAG 2.5.3. The trigger keeps
   *  reading the camera's zoom, which predates the display and is a capability
   *  this change does not remove — a display is said by the frame drawn around
   *  the stage and by the menu's tick. */
  display: {
    label: "Display and zoom",
    /** The whole stage, with no display in it. */
    fit: "Fit",
    toSelection: "Zoom to selection",
    actualSize: "100 %",
    /** One name per lens, keyed by `DisplayLensId` so a lens cannot be added
     *  to the vocabulary without a label to offer it by. Each name is the
     *  aspect it frames — the same word the id is, so a screen nobody has
     *  heard of is still nameable. */
    displays: {
      "16:9": "16:9",
      "19.5:9": "19.5:9",
      "4:3": "4:3",
      "9:16": "9:16",
      "9:19.5": "9:19.5",
      "3:4": "3:4",
    } satisfies Record<DisplayLensId, string>,
  },
  palette: "Shell palette",
  /** Chart family labels, shared by the Add pane, the canvas context menu and
   *  the layer row's role. */
  chartFamilies: chartFamilyLabels,
  /**
   * One label per primitive shape. The Add pane's shape list, the defaults that
   * build each kind and the inspector's own fields all read this, so a shape is
   * named in exactly one place.
   */
  shapeKinds: {
    rect: "Rectangle",
    circle: "Circle",
    ellipse: "Ellipse",
    triangle: "Triangle",
    polygon: "Polygon",
    polyline: "Polyline",
    line: "Line",
    path: "Path",
    arc: "Arc",
    wedge: "Wedge",
  },
  /**
   * What each card in the library is called, in the Add pane and on the copy an
   * insertion leaves in the layer tree. Named for the reading rather than for
   * where the card sits: two CPU cards are two CPU cards, and the id beside the
   * name is what tells them apart.
   */
  cardLibrary: {
    time: "Clock",
    cpu: "CPU",
    gpu: "GPU",
    ram: "RAM",
    vram: "VRAM",
    trends: "Performance trends",
    storage: "Storage",
    network: "Network",
  },
  /**
   * Artboard preset labels, shared by the inspector's controls and the
   * new-document chooser. A ratio labels itself; an orientation and a
   * resolution are words of their own, and `2K` is not the `2k` it is stored
   * as.
   */
  artboardOrientations: { landscape: "Landscape", portrait: "Portrait" },
  artboardResolutions: { "1080p": "1080p", "2k": "2K", "4k": "4K" },
  /**
   * The two ways a picture can fill a box, spelled once. Background media's fit
   * is the only fit an author sets; the artboard's content fit is a guarantee
   * of the model, so there is one control left to name them.
   */
  fitModes: { contain: "Contain", cover: "Cover" },
  /**
   * The four ways a reading may print its unit, keyed by what is stored.
   *
   * Probed before these were written here and the platform has no word for any
   * of them: `Intl.DisplayNames` has six types — language, region, script,
   * currency, calendar, dateTimeField — and asks for `unitDisplay` with a
   * `RangeError`; `Intl.supportedValuesOf("unit")` is the 45 sanctioned *units
   * of measurement* (acre, byte, celsius), not the ways to display one. So the
   * words name the product's own options: `short` and `long` are the platform's
   * `unitDisplay` values, `none` is ours (ECMA-402 rejects it), and `Default`
   * is the absence of the key. §35 settles the rest — product UI copy is not
   * localised, and a theme declares the language its own text is written in.
   *
   * What the table buys is an owner. The chart panel and the run panel each
   * wrote all four, so a rename fixed one and silently missed the other.
   */
  unitDisplayOptions: {
    "": "Default",
    none: "None",
    short: "Short",
    long: "Long",
  },
  /** Panel copy. Panel factories own their DOM contract; this owns the words. */
  panels: {
    layers: "Layers",
    /** The generic word for each kind of layer, the one owner of the five kind
     *  words — `layer-tree.ts` reads these where it once held a private table. */
    layerKinds: layerKindLabels,
    /** A row's role, in words. One function per arm of `LayerRole`. */
    layerRoles,
    /** Layer-tree row controls. The twisty and the rename field carry the
     * layer's name as well, so those two names are unique; the state icons do
     * not, because "Hide" on every row is the same control repeated and the row
     * it sits in is what tells them apart. */
    hide: "Hide",
    show: "Show",
    /** Between two keys one chart or label reads. The trends card reads three,
     * and a space alone would run them together at 340px. Punctuation rather
     * than a letter, so it cannot be mistaken for part of a key.

     * A row bound to nothing prints nothing here rather than a word saying so.
     * A word repeated down a column carries no information and is paid for out
     * of the layer *name*, which is the one thing a layer list has to keep
     * readable — the density §173 asks for, rather than ink that says "no".
     */
    boundSeparator: " · ",
    rename: "Rename",
    collapse: "Collapse",
    expand: "Expand",
    /** Going into a group and coming back out of it.
     *
     *  Both carry the group's name, unlike the two words above. A twisty can
     *  say "Expand" on every row because the row it sits in is the thing it
     *  acts on; three "Enter" buttons in one tree would be the same word
     *  repeated with nothing telling a reader which group each one opens. The
     *  two verbs differ as well as the names, so the row the author is inside
     *  says something different again. */
    enter: "Enter",
    leave: "Leave",
    /** The drag rule, in the panel's own words rather than in a cursor. A drop
     * across a group boundary is refused by design (Fabric membership is a
     * different operation), and a refusal nothing says reads as a panel being
     * unreliable — the same gesture works one row over, so the author has no
     * other evidence that a rule is what stopped it. */
    reorderRule: "Drag a row to reorder it within its group.",
    add: "Add",
    text: "Text",
    panel: "Panel",
    /** A pasted image and a fresh group arrive without an authored name, so
        the layer row would print their uuid; these are what they are called
        instead. */
    image: "Image",
    group: "Group",
    /** The Add pane's construction lists, each a group. A flat chip list
        would put the word "Line" on two buttons with nothing to tell them
        apart — once for the primitive and once for the chart family.

        `cards` is the unit library, and it sits beside the primitives rather
        than above them: the unit is the fast path for a card, and the primitive
        is the tool for the case nobody anticipated, which is the case this
        product is for. Neither is the fallback for the other, so neither group
        says so. */
    cards: "Card",
    shapes: "Shape",
    charts: "Chart",
    assets: "Assets",
    /** The Assets pane's controls. `import` and `replace` are the two actions
        the pane can take on a local file, so they are named as actions; the
        select is labelled by what it lists rather than by the pane. */
    importAsset: "Import asset",
    replaceAsset: "Replace asset",
    assetList: "Asset",
    /** Shown when a chosen file is not a readable image, video or font the
        package accepts. The author's other work is untouched. */
    assetImportFailed: "That file could not be imported.",
    /** Shown when a removal is refused because something still points at it. */
    assetReferenced: "That asset is in use and cannot be removed.",
    removeAsset: "Remove asset",
    themeSettings: "Theme settings",
    language: "Theme language",
    /** The sample's own row label, one word because it shares the 72px label
     * column every other field on this panel uses. */
    sampleLabel: "Sample",
    /** Names the live sample under the language control, which is a status
     * region in its own right and announces itself when the choice changes. */
    languageSample: "Sample in the chosen language",
    backgroundMedia: "Background media",
    mediaFit: "Media fit",
    releaseVersion: "Release version",
    notSet: "Not set",
    none: "None",
    /** Shown by a numeric field when an edit is refused, whether it could not be
        read as a number or fell outside the field's range. */
    invalidNumber: "That value cannot be applied. Enter a number in range.",
    palette: "Palette",
    /** A palette token's own two paint kinds, as the Paint chooser names them.
     * `linearGradient` is not the `gradient` it is stored as. */
    paintKinds: { solid: "Solid", gradient: "Linear gradient" },
    /** A gradient's angle, and the two fields of each of its stops. The stop
     *  number is one-based, because it is what the author counts. */
    angle: "Angle",
    stopPosition: (stop: number) => `Stop ${stop} position`,
    stopColour: (stop: number) => `Stop ${stop} colour`,
    /** The name a freshly added token or preset carries until it is renamed.
     *  It is authored theme data the author goes on to edit, not a message. */
    newColour: "New colour",
    newType: "New type",
    /** Each pane's own chooser, named by what it lists rather than by the pane
     * it sits in — the section heading already says Palette or Type presets. */
    colourToken: "Colour token",
    typePreset: "Type preset",
    paint: "Paint",
    addColour: "Add colour",
    addStop: "Add stop",
    deleteColour: "Delete colour",
    reassign: "Reassign to",
    typePresets: "Type presets",
    addType: "Add type",
    deleteType: "Delete type",
    previewFont: "Preview font",
    applyFont: "Apply font",
    applyTrio: "Apply trio",
    unitDisplay: "Unit display",
    /** Field labels shared by more than one panel. */
    name: "Name",
    author: "Author",
    description: "Description",
    /** A paired width/height row has no room for the full words beside both
        boxes, so the row keeps its "Size" label and marks them W and H. */
    widthMark: "W",
    heightMark: "H",
    background: "Background",
    barColour: "Bar colour",
    /** A paint's own colour, as against the token it is chosen from. */
    colour: "Colour",
    /** Shown when the browser cannot paint what was typed. Named by the value
     *  itself, because the author has to be able to see which of several they
     *  mistyped. */
    colourPicker: "Pick a colour",
    gradient: "Gradient",
    colourUnpaintable: (value: string) =>
      `Not a colour the browser can paint: "${value}". Hex, rgb(), hsl() or a CSS colour name.`,
    family: "Family",
    size: "Size",
    /** The three controls that choose an artboard size. They choose it
        together; the width and height boxes stay because an author who wants a
        size no preset names still types one. */
    ratio: "Ratio",
    orientation: "Orientation",
    resolution: "Resolution",
    /** Shown by all three when the document holds a size no preset names — an
        author's own, or a hand-edited theme's. A reading, not a choice. */
    customSize: "Custom",
    /** The consequence of every size control on this panel, stated where they
        are. Changing the ratio is one click and it never moves anything, so an
        author narrowing a dashboard by hand is told the rule before the click
        rather than after the content has gone. */
    artboardSizeNote:
      "Objects are not moved or resized. Anything outside the artboard is not shown on a display.",
    /** The rule, with the figure the scene can now be asked for. A proportion of
     *  the composition rather than a bare complaint, and the same wording the
     *  display uses when it loses objects the author cannot see. */
    artboardOutside: (rule: string, outside: number, counted: number): string =>
      `${outside} of ${counted} objects are now outside the artboard and will not be shown on a display. ${rule}`,
    weight: "Weight",
    lineHeight: "Line height",
    letterSpacing: "Letter spacing",
    font: "Font",
    trio: "Trio",
    /** The picker's own search and filter row. */
    fontSearch: "Search fonts",
    /** The three facet kinds by what an author chooses between — `mood`,
     *  `useCase` and `superfamily` are the words a `CatalogQuery` is keyed on,
     *  and none of them is a word an author reads. Keyed by that same field
     *  name, so a fourth kind cannot be added to the query without a word for
     *  it appearing here. */
    fontFacetKinds: {
      mood: "Mood",
      useCase: "Use",
      superfamily: "Superfamily",
    },
    /** One active facet is all a `CatalogQuery` holds, so choosing a second
     *  kind silently drops the first. The author cannot see that from three
     *  selects that each look independent, so the picker says the rule rather
     *  than letting them discover it by clicking. */
    fontFacetRule: "Filters are exclusive: choosing one clears the other two.",
    fontSort: "Sort",
    fontSortName: "Name",
    fontSortFamily: "Family",
    fontFavoritesOnly: "Favourites only",
    fontFavorite: "Add to favourites",
    fontUnfavorite: "Remove from favourites",
    fontTrios: "Trios",
    /** Shown on a face row whose weight is the nearest the family ships, so the
     *  number the row shows is the number the apply will write. */
    fontClamped: "nearest available",
    fontBound: "Bound to a packaged face",
    unbindFont: "Unbind",
    noFontMatches: "No font matches this search.",
    loadingFont: "Loading font…",
  },
} as const;
