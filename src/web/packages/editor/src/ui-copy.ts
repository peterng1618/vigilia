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
    /** The inspector is a fifth rail entry, not a sixth pane: it is the
     *  selection's own surface, and a phone-width shell has no room beside
     *  the canvas for it as a column (F1.29). */
    inspect: "Inspect",
    /** What a rail entry does to its region, for the tooltip. One pair, because
     *  every entry — the four panes and the inspector alike — hides and shows
     *  with the same two words. The button's accessible name stays the region
     *  it opens, so a screen reader is told the region and a hovering author is
     *  told the action. */
    hide: "Hide",
    show: "Show",
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
    opacity: "Opacity %",
    paint: "Paint",
    notSet: "not set",
    unresolved: "no longer resolves",
    runs: "Runs",
    runPreset: "Type preset",
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
    arrange: "Arrange",
    view: "View",
  },
  file: {
    newDocument: "New",
    openPackage: "Open package",
    savePackage: "Save package",
    releasePackage: "Release package",
    openLibrary: "Open library",
    saveLibrary: "Save to library",
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
    align: "Align left",
    distribute: "Distribute horizontally",
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
    /** Names the live sample under the language control, which is a status
     * region in its own right and announces itself when the choice changes. */
    languageSample: "Sample in the chosen language",
    previewFit: "Preview fit",
    backgroundMedia: "Background media",
    mediaFit: "Media fit",
    releaseVersion: "Release version",
    notSet: "Not set",
    none: "None",
    /** Shown by a numeric field when an edit is refused, whether it could not be
        read as a number or fell outside the field's range. */
    invalidNumber: "That value cannot be applied. Enter a number in range.",
    palette: "Palette",
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
    weight: "Weight",
    lineHeight: "Line height",
    letterSpacing: "Letter spacing",
    font: "Font",
    trio: "Trio",
  },
} as const;
