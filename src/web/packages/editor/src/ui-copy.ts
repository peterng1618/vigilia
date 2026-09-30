/** Typed package-local visible editor copy (§35). Authored theme text,
 * telemetry values and developer errors stay outside this module. */

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
  editor: "Editor",
  /** The rail's four panes. An entry's icon is a component beside the rail, not
   *  a mark in this table: a glyph stored as a translatable string is announced
   *  as a word of its own and cannot inherit a shell colour. */
  rail: {
    layers: "Layers",
    add: "Add",
    assets: "Assets",
    settings: "Settings",
    /** What a rail entry does to the panel, for the tooltip. The button's
        accessible name stays the pane it shows, so a screen reader is told the
        pane and a hovering author is told the action. */
    hidePanel: "Hide",
    showPanel: "Show",
  },
  inspector: { design: "Design", data: "Data", style: "Style" },
  /** Selection inspector field labels. */
  inspectorFields: {
    selection: "Selection",
    /** What the selected object is called in the layer list, as against the id. */
    name: "Name",
    /** Shown when a name is rejected rather than truncated to the published bound. */
    invalidName: "That name cannot be applied to the selection.",
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
    insert: "Insert",
    view: "View",
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
  /** The chooser `New` opens before the document exists. Its three control
   *  labels are the artboard panel's own — one preset list, two uses — so only
   *  the words this surface adds are here. */
  newDocument: {
    chooseSize: "Choose an artboard size",
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
  view: {
    dataSource: "Data source",
    chartRefresh: "Chart refresh",
    preview: "Preview",
    live: "Live",
    valueRuns: "Value runs",
    tokens: "tokens",
    values: "values",
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
  dock: { label: "Selected object actions" },
  /** The canvas context menu's accessible name. Its entries reuse the action
   * registry's labels and `chartFamilies`, so no entry copy lives here. */
  canvasMenu: { label: "Canvas actions" },
  /** The stage toolbar's accessible name; the eight buttons carry the labels. */
  arrangeToolbar: { label: "Arrange the selection" },
  /** The stage camera's readout; `label` is also the control's accessible name. */
  zoom: {
    label: "Zoom level",
    toFit: "Zoom to fit",
    toSelection: "Zoom to selection",
    actualSize: "100 %",
  },
  palette: "Shell palette",
  /** Chart family labels, shared by the Add panel and the Insert menu. */
  chartFamilies: {
    gauge: "Gauge",
    line: "Line",
    bar: "Bar",
    pie: "Pie",
  },
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
  /** Panel copy. Panel factories own their DOM contract; this owns the words. */
  panels: {
    layers: "Layers",
    /** Layer-tree row controls. The twisty and the rename field carry the
     * layer's name as well, so those two names are unique; the state icons do
     * not, because "Hide" on every row is the same control repeated and the row
     * it sits in is what tells them apart. */
    hide: "Hide",
    show: "Show",
    rename: "Rename",
    collapse: "Collapse",
    expand: "Expand",
    add: "Add",
    text: "Text",
    panel: "Panel",
    /** A pasted image and a fresh group arrive without an authored name, so
        the layer row would print their uuid; these are what they are called
        instead. */
    image: "Image",
    group: "Group",
    /** The Add pane's two construction lists, each a group. A flat chip list
        would put the word "Line" on two buttons with nothing to tell them
        apart — once for the primitive and once for the chart family. */
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
    language: "Language",
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
    selectChart: "Select a chart to edit its settings.",
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
    weight: "Weight",
    lineHeight: "Line height",
    letterSpacing: "Letter spacing",
    font: "Font",
    trio: "Trio",
  },
} as const;
