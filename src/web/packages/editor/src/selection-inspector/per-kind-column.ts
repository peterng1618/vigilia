import type {
  Binding,
  FabricGlobals,
  SampleSource,
  SettingsSection,
} from "@vigilia/renderer-core";
import { SETTINGS_SECTIONS } from "@vigilia/renderer-core";
import { VigiliaChart } from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  FabricImage,
  type FabricObject,
  Group,
} from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import type {
  ChartContentFieldsView,
  ChartPaintFieldsView,
} from "../chart-manager/chart-fields.js";
import { linkedPair } from "../editor-shell/controls/linked-pair.js";
import { uiCopy } from "../ui-copy.js";
import {
  type AppearanceContext,
  createResolutionLine,
  createTypePresetReveal,
  nameField,
  nameOfRef,
  opacityField,
  paintReferencesOf,
  resolveToken,
  resolveTypePreset,
  typePresetOf,
} from "./appearance.js";
import { createBleedField } from "./bleed.js";
import { createCropRow } from "./crop.js";
import { createGlassFields } from "./glass.js";
import {
  createPanelMaterialFields,
  createShapeGeometryFields,
} from "./panel.js";
import { projectRuns } from "./runs.js";
import type { ColumnSectionView, ExtraView, FieldView } from "./view.js";

/**
 * The column the inspector renders, as **data**: one entry per section, in the
 * order the questions are asked. A test enumerates this rather than reading the
 * DOM, and the column renders exactly the sections it returns.
 *
 * The five questions are §4's — Content is what it shows, Position is where it
 * sits and how big, Layer is how it presents, Paint is what ink, Spends is what
 * it resolves to — and they come in `SETTINGS_SECTIONS` order, the one place
 * that order is decided. `advanced` is not a sixth question: it is the
 * collapsed-and-counted treatment, and it goes last when it exists.
 *
 * **Position alone starts closed.** An author adjusts geometry once and chooses
 * the binding constantly, so the one section that is not asked repeatedly is the
 * one that starts out of the way — for every kind, a shape included. Collapsed
 * is not hidden: the summary carries the count.
 */

/**
 * The section vocabulary. `advanced` is **latent and stays**: a caller may mount
 * a collapsed-and-counted treatment under it, but `perKindColumn` never emits
 * one — the chart family's own advanced field is mounted by `chart-manager`, not
 * here. Deleting the member to tidy it would be a behaviour change dressed as
 * tidying.
 */
export type ColumnSectionId = SettingsSection | "advanced";

/**
 * One section as the column renders it: the DOM-free `ColumnSectionView` React
 * reads, plus the live body elements React does not render yet.
 *
 * React owns the section's chrome — its header, its count and its open state —
 * while the field builders still return `HTMLElement`s, so `index.ts` mounts
 * `body` into the container the section renders. The bodies are handed *beside*
 * the view and never inside it: `projectSelection` drops this member, because a
 * `SelectionView` carrying an element fails Review Focus 1's value guard.
 * Tasks 3–6 convert the bodies one section at a time, and this member goes with
 * the last of them.
 */
export interface ColumnSection extends ColumnSectionView {
  readonly body: readonly HTMLElement[];
}

/** What one section holds: the rows React renders, and the body it does not yet. */
interface SectionParts {
  readonly fields?: readonly FieldView[];
  readonly extras?: readonly ExtraView[];
  readonly body?: readonly HTMLElement[];
}

/**
 * Whether the column renders this extra today.
 *
 * `runs`, `chartContent` and `chartPaint` are wired; `crop` is Task 4's. The
 * section's count and the column's rows are the same decision made once, so
 * emitting an extra whose renderer has not landed cannot make a header claim a
 * row that is not there. Wiring one is a change to this predicate and to the
 * column's row together, which is the point.
 */
export function rendersExtra(extra: ExtraView): boolean {
  return (
    extra.kind === "runs" ||
    extra.kind === "chartContent" ||
    extra.kind === "chartPaint"
  );
}

/**
 * The kinds of thing the editor can have selected. This is the partition the
 * column's questions fall on, not the roster of Fabric class names.
 *
 * Deliberately not `layer-tree`'s `LayerKind`, which answers a different
 * question — which label and icon a tree row carries — and always describes one
 * object. A selection is not always one object: `activeSelection` is a kind of
 * its own here, and folding it into `group` would make the column describe a
 * multi-selection as though the author had selected a single thing.
 *
 * **Total by construction.** Every kind needs an entry in `KIND_QUESTIONS`, so
 * extending this list without deciding what the new kind asks does not compile —
 * the alternative is a kind that silently renders an empty column, which is the
 * unreachability defect wearing a new cause.
 */
export const SELECTION_KINDS = [
  "shape",
  "text",
  "chart",
  "image",
  "group",
  "activeSelection",
] as const;

export type SelectionKind = (typeof SELECTION_KINDS)[number];

/** Fabric lowercases `type` on the instance, so these are its own spellings. */
function isTextKind(object: FabricObject): boolean {
  const type = (object as { readonly type?: string }).type;
  return type === "textbox" || type === "i-text" || type === "text";
}

/**
 * Which kind a selection is.
 *
 * Ordered so the two containers are named before the class they extend: Fabric's
 * `ActiveSelection` **is** a `Group`, so a group tested first would answer for a
 * selection the author made across several objects.
 */
export function selectionKindOf(target: FabricObject): SelectionKind {
  if (target instanceof ActiveSelection) return "activeSelection";
  if (target instanceof VigiliaChart) return "chart";
  if (target instanceof Group) return "group";
  if (isTextKind(target)) return "text";
  if (target instanceof FabricImage) return "image";
  return "shape";
}

/**
 * What a kind asks that no gate can answer for it.
 *
 * Everything else a kind decides is already owned elsewhere, and is asked rather
 * than restated: `supportsPanelFields` says whether it has material,
 * `createShapeGeometryFields` whether it has geometry of its own, `canCrop`
 * whether it can hold a crop, `supportsGlassControl` whether its backdrop can be
 * sampled, `typePresetOf` whether it carries type. A copy of any of those here
 * would agree with its owner only until someone widened it.
 */
interface KindQuestions {
  /**
   * Whether this selection's appearance is its children's rather than its own.
   *
   * A group and a multi-selection are the two selections with no ink, no type
   * and no material of their own — Fabric gives a group nothing to paint with —
   * so the read-only section that says what the selection resolves to has
   * nothing to read on the selection and reads its children instead. A single
   * object is asked the other way round: its own property *is* the answer, and
   * walking a rectangle's children would be the same "a question this kind does
   * not have" defect in reverse.
   */
  readonly childrenAppearance: boolean;
}

/** Total over `SELECTION_KINDS`: a kind added there and not here is a compile
    error, so a Fabric kind nobody thought about cannot reach an empty column. */
export const KIND_QUESTIONS: Readonly<Record<SelectionKind, KindQuestions>> = {
  shape: { childrenAppearance: false },
  text: { childrenAppearance: false },
  chart: { childrenAppearance: false },
  image: { childrenAppearance: false },
  group: { childrenAppearance: true },
  activeSelection: { childrenAppearance: true },
};

/** The five geometry fields, in whole artboard units. */
export type GeometryKey = "left" | "top" | "width" | "height" | "angle";

/**
 * How the column reads and writes an object's geometry. `index.ts` owns the
 * funnel — the write that scales a shape, writes a text box, or sets an angle —
 * and this is the port it hands over, so the column composes fields without a
 * second copy of the write rules.
 */
export interface GeometryPort {
  read(object: FabricObject, key: GeometryKey): number;
  write(object: FabricObject, key: GeometryKey, value: number): void;
  /** The object's own drawn edge, when it is not the number the Size field
      shows. See `measuredEdgeOf` in `index.ts`. */
  measuredEdge(
    object: FabricObject,
  ): { readonly width: number; readonly height: number } | undefined;
}

/**
 * What a chart's column asks its owner for.
 *
 * Declared here for the reason `GeometryPort` is: the column names the
 * questions and its owner answers them, so nothing in this module knows how a
 * chart's settings, bindings or ratio are written — or how they are rendered.
 * `chart-manager` is that owner; the views below cross as values and the
 * controls that render them live with the owner too.
 *
 * Two bodies, because a chart answers Content (what it shows) and Paint (what
 * ink) with different questions. `undefined` is an owner that has nothing to
 * say for that question — a chart it cannot resolve — and is not an empty body:
 * the extra is what the section's count counts, so an absent answer emits none.
 */
export interface ChartFieldsPort {
  content(chart: VigiliaChart): ChartContentFieldsView | undefined;
  paint(chart: VigiliaChart): ChartPaintFieldsView | undefined;
}

export interface ColumnContext {
  readonly editor: EditorInteraction;
  readonly globals: FabricGlobals | undefined;
  /** The document's language, so a run's format preview is spelled in it. */
  readonly locale: string | undefined;
  readonly geometry: GeometryPort;
  /** False once the column describes a different object; the edit is refused. */
  readonly stillTarget: (object: FabricObject) => boolean;
  /** Repaints and records: one history entry per committed edit. */
  readonly commit: () => void;
  /** Re-reads the object, so the fields show what was just written. */
  readonly rerender: () => void;
  readonly revealTypePresets: (() => void) | undefined;
  readonly refreshGlass: () => void;
  readonly nodeBindings: ((nodeId: string) => readonly Binding[]) | undefined;
  readonly onNodeBindingsChange:
    | ((nodeId: string, bindings: readonly Binding[]) => void)
    | undefined;
  readonly sampleSource: (() => SampleSource) | undefined;
  /**
   * The chart owner's own fields, for a chart selection. Absent when no owner
   * is mounted: a column built without one still answers every other kind, and
   * a chart is not a kind this column invents questions for.
   */
  readonly chartFields?: ChartFieldsPort;
}

/** Position is the one section closed by default; `advanced`, when a caller
    mounts it, is the collapsed-and-counted treatment and starts closed too. */
function defaultOpenOf(id: ColumnSectionId): boolean {
  return id !== "position" && id !== "advanced";
}

function sectionOrder(id: ColumnSectionId): number {
  if (id === "advanced") return SETTINGS_SECTIONS.length;
  const index = SETTINGS_SECTIONS.findIndex((entry) => entry.id === id);
  return index === -1 ? SETTINGS_SECTIONS.length : index;
}

function titleOf(id: ColumnSectionId): string {
  if (id === "advanced") return uiCopy.inspectorFields.advanced;
  return SETTINGS_SECTIONS.find((entry) => entry.id === id)?.label ?? id;
}

/** The appearance context the field builders take. */
function appearanceOf(context: ColumnContext): AppearanceContext {
  return { editor: context.editor, globals: context.globals };
}

/** A refused edit restores the field itself; the column only reports it. */
function refused(context: ColumnContext): () => void {
  return () =>
    context.editor.errorManager.warn(
      "controls",
      uiCopy.inspectorFields.invalidValue,
    );
}

/** The labels the geometry fields carry. The Size pair marks its boxes W and H
    because the full words wrap the second input onto its own line. */
const GEOMETRY_LABELS: Readonly<Record<GeometryKey, string>> = {
  left: uiCopy.inspectorFields.x,
  top: uiCopy.inspectorFields.y,
  width: uiCopy.inspectorFields.width,
  height: uiCopy.inspectorFields.height,
  angle: uiCopy.inspectorFields.rotation,
};

/** The fewest whole units a dimension can be: zero would make the object
    vanish from the canvas and from its own selection box. */
const MIN_DIMENSION = 1;

function pair(
  context: ColumnContext,
  object: FabricObject,
  rowLabel: string,
  first: GeometryKey,
  second: GeometryKey,
): HTMLElement {
  const side = (key: GeometryKey) => ({
    label: GEOMETRY_LABELS[key],
    value: Math.round(context.geometry.read(object, key)),
    data: "vigiliaGeometry",
    dataValue: key,
  });
  const min =
    first === "width" || first === "height" ? MIN_DIMENSION : undefined;

  return linkedPair({
    rowLabel,
    first: side(first),
    second: side(second),
    ...(min === undefined ? {} : { min }),
    invalidMessage: uiCopy.inspectorFields.invalidValue,
    onReject: refused(context),
    // Each half writes only its own key: X/Y and W/H are independent, and
    // writing the sibling would quantise a fractional dimension the author
    // never touched.
    onCommitFirst: (value) => writeGeometry(context, object, first, value),
    onCommitSecond: (value) => writeGeometry(context, object, second, value),
  }).row;
}

function writeGeometry(
  context: ColumnContext,
  object: FabricObject,
  key: GeometryKey,
  value: number,
): void {
  if (!context.stillTarget(object)) return;
  context.geometry.write(object, key, value);
  context.commit();
}

/** Rotation, the one angle a Layer column asks for. It is whole units, and it
    writes through the same geometry port the Position pair does. */
function rotationField(
  context: ColumnContext,
  object: FabricObject,
): FieldView {
  return {
    id: "angle",
    control: "number",
    label: GEOMETRY_LABELS.angle,
    value: Math.round(context.geometry.read(object, "angle")),
    // The control refuses a fraction inline; `editRefusal` refuses it again at
    // the write boundary, which is the copy that must hold.
    integer: true,
    data: { "data-vigilia-geometry": "angle" },
  };
}

/**
 * The Size pair reads the authored box, which is what it writes. Where the
 * object's own edge is a different number, the author is told which is which
 * rather than left to compare a panel against a canvas.
 */
function sizeDisagreement(
  context: ColumnContext,
  object: FabricObject,
  edge: { readonly width: number; readonly height: number },
): HTMLElement {
  const line = document.createElement("p");
  line.className = "vigilia-resolution";
  line.dataset["vigiliaResolution"] = uiCopy.inspectorFields.size;
  line.textContent = uiCopy.inspectorFields.sizeDisagrees(
    `${Math.round(context.geometry.read(object, "width"))} × ${Math.round(
      context.geometry.read(object, "height"),
    )}`,
    `${edge.width} × ${edge.height}`,
  );
  return line;
}

/** What it shows: the name, and a text object's runs and layout. */
function contentBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): SectionParts {
  const fields: FieldView[] = [];
  const extras: ExtraView[] = [];
  const body: HTMLElement[] = [];

  // The name is a field that writes, so a locked object is not offered one.
  if (!locked) fields.push(nameField(target));

  // The run editor is the one sub-surface the row union cannot express, so it
  // crosses as an extra carrying its projected value. `projectRuns` returns
  // undefined for an object with no authored text: an empty box is not a
  // control, and counting one would make the section's own count lie.
  const id = target.get("id");
  const nodeId = typeof id === "string" && id.length > 0 ? id : "";
  const runs = projectRuns(
    target as unknown as {
      get(name: string): unknown;
      set(name: string, value: unknown): void;
    },
    nodeId,
    {
      globals: context.globals,
      locale: context.locale,
      nodeBindings: context.nodeBindings,
      sampleSource: context.sampleSource,
      swatchValue: (ref) => resolveToken(context.globals, ref),
    },
  );
  if (runs !== undefined) extras.push({ kind: "runs", nodeId, runs });

  // A chart's own questions: the readings it draws and how its family is set.
  // The owner answers them through the port; asking here is what puts them in
  // the column they answer rather than behind a second tab. Withheld on a
  // locked chart like every other writing field.
  if (
    !locked &&
    target instanceof VigiliaChart &&
    context.chartFields !== undefined
  ) {
    const chart = context.chartFields.content(target);
    if (chart !== undefined)
      extras.push({ kind: "chartContent", content: chart });
  }

  return { fields, extras, body };
}

/** Where it sits and how big: the two pairs, crop, bleed, and this shape's own
    geometry. Still imperative until Task 4. */
function positionBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): SectionParts {
  if (locked) return { body: [] };
  const body: HTMLElement[] = [];

  body.push(
    pair(context, target, uiCopy.inspectorFields.position, "left", "top"),
    pair(context, target, uiCopy.inspectorFields.size, "width", "height"),
  );

  const edge = context.geometry.measuredEdge(target);
  if (edge !== undefined) body.push(sizeDisagreement(context, target, edge));

  // Crop sits with the geometry it changes, and only for a selection that can
  // hold one — an image, which is the only kind `canCrop` admits.
  const crop = createCropRow(context.editor, target, context.stillTarget);
  if (crop !== undefined) body.push(crop);

  // The mark that says this object's overhang is deliberate. It is beside crop
  // rather than under appearance because what it changes is the crop notice
  // both surfaces print, not how the object paints.
  body.push(
    createBleedField(appearanceOf(context), target, {
      stillTarget: () => context.stillTarget(target),
      commit: context.commit,
      onChange: context.rerender,
    }),
    ...createShapeGeometryFields(appearanceOf(context), target, {
      stillTarget: () => context.stillTarget(target),
      commit: context.commit,
      onChange: context.rerender,
    }),
  );

  return { body };
}

/** How it presents: rotation, and opacity. */
function layerBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): SectionParts {
  if (locked) return { fields: [] };
  return {
    fields: [rotationField(context, target), opacityField(target)],
  };
}

/** What ink: the panel's material, and the frosted-glass treatment. Still
    imperative until Task 5. */
function paintBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): SectionParts {
  if (locked) return { body: [] };
  const body: HTMLElement[] = [];
  const extras: ExtraView[] = [];

  const material = createPanelMaterialFields(appearanceOf(context), target, {
    stillTarget: () => context.stillTarget(target),
    commit: context.commit,
    onChange: context.rerender,
  });
  if (material !== undefined) body.push(material);

  // Offered for a selection whose backdrop can actually be sampled; a kind that
  // cannot is told why rather than shown nothing.
  body.push(
    createGlassFields(appearanceOf(context), target, {
      stillTarget: () => context.stillTarget(target),
      commit: context.commit,
      onChange: context.rerender,
      refreshGlass: context.refreshGlass,
    }),
  );

  // What a chart paints its data with, from the owner that writes it. A chart's
  // paint is its own question, asked of the same owner that answered Content.
  if (target instanceof VigiliaChart && context.chartFields !== undefined) {
    const chart = context.chartFields.paint(target);
    if (chart !== undefined) extras.push({ kind: "chartPaint", paint: chart });
  }

  return { body, extras };
}

/** Every object under this one, at any depth, in document order. A kind with no
    children answers with an empty list rather than an error: asking is not the
    same as having something to find. */
function descendantsOf(target: FabricObject): readonly FabricObject[] {
  const children =
    (target as { getObjects?: () => FabricObject[] }).getObjects?.() ?? [];
  return children.flatMap((child) => [child, ...descendantsOf(child)]);
}

/**
 * What a container resolves to, read from its children.
 *
 * Deduplicated by reference: a card whose five labels share one token resolves
 * to that one token, and repeating it five times would make the section a copy
 * of the canvas rather than an answer to "what is this made of". Each line keeps
 * the label its own reader gave it, so a chart child's paint is named by its
 * family's field descriptor and a shape's by the Paint field.
 */
function childrenResolution(
  target: FabricObject,
  context: ColumnContext,
): {
  readonly paints: readonly HTMLElement[];
  readonly presets: readonly HTMLElement[];
} {
  const paints = new Map<string, string>();
  const presets = new Set<string>();

  for (const child of descendantsOf(target)) {
    for (const { label, ref } of paintReferencesOf(child)) {
      if (!paints.has(ref)) paints.set(ref, label);
    }
    const preset = typePresetOf(child);
    if (preset !== undefined) presets.add(preset);
  }

  return {
    paints: [...paints].map(([ref, label]) =>
      createResolutionLine(
        label,
        nameOfRef(context.globals, ref),
        resolveToken(context.globals, ref),
      ),
    ),
    presets: [...presets].map((preset) =>
      createResolutionLine(
        uiCopy.inspectorFields.runPreset,
        nameOfRef(context.globals, preset),
        resolveTypePreset(context.globals, preset),
      ),
    ),
  };
}

/** What it resolves to. Read-only, so a locked object still gets it: the author
    can see what the object is made of even when they cannot move it. */
function spendsBody(
  target: FabricObject,
  context: ColumnContext,
  questions: KindQuestions,
): SectionParts {
  if (questions.childrenAppearance) {
    const { paints, presets } = childrenResolution(target, context);
    // A container whose children resolve to nothing still answers the paint
    // question — with "none" — exactly as a single unpainted object does, so the
    // section keeps the line it had before it learned to read the children.
    return {
      body: [
        ...(paints.length === 0
          ? [
              createResolutionLine(
                uiCopy.inspectorFields.paint,
                undefined,
                undefined,
              ),
            ]
          : paints),
        ...presets,
      ],
    };
  }

  const body: HTMLElement[] = [];
  const references = paintReferencesOf(target);

  if (references.length === 0) {
    body.push(
      createResolutionLine(uiCopy.inspectorFields.paint, undefined, undefined),
    );
  } else {
    for (const { label, ref } of references) {
      body.push(
        createResolutionLine(
          label,
          nameOfRef(context.globals, ref),
          resolveToken(context.globals, ref),
        ),
      );
    }
  }

  // Type belongs to a text object; a shape has none, so it gets no line.
  const preset = typePresetOf(target);
  if (preset !== undefined) {
    // `nameOfRef`, because this line printed `typePresets.24-400` while the
    // panel beside it and both dropdowns printed `Card title`. That is what
    // made vg-089 read as a mis-bound dropdown: the screenshot had caught
    // this line, not the control it was blamed on.
    body.push(
      createResolutionLine(
        uiCopy.inspectorFields.runPreset,
        nameOfRef(context.globals, preset),
        resolveTypePreset(context.globals, preset),
      ),
    );
    if (context.revealTypePresets !== undefined) {
      body.push(createTypePresetReveal(context.revealTypePresets));
    }
  }

  return { body };
}

/**
 * The sections this selection gets, in the order the questions are asked.
 *
 * A section with nothing in it is not returned at all: the question does not
 * apply to this kind, so there is no header and no count of zero. React renders
 * exactly the sections it is handed, in the order it is handed them, so the
 * empty-section rule and the order both stay here rather than becoming a second
 * owner in the column.
 */
export function perKindColumn(
  target: FabricObject,
  context: ColumnContext,
): readonly ColumnSection[] {
  const locked = target.get("locked") === true;
  // The selection's kind is asked once, and its answers are read by name — so a
  // kind that reaches here without a rule cannot have been added to
  // `SELECTION_KINDS` without a compile error. See `KIND_QUESTIONS`.
  const questions = KIND_QUESTIONS[selectionKindOf(target)];

  // Built in question order already; sorted anyway so the order is a statement
  // this module makes rather than one it inherits from the lines above.
  const bodies: readonly (readonly [ColumnSectionId, SectionParts])[] = [
    ["content", contentBody(target, context, locked)],
    ["position", positionBody(target, context, locked)],
    ["layer", layerBody(target, context, locked)],
    ["paint", paintBody(target, context, locked)],
    ["spends", spendsBody(target, context, questions)],
  ];

  const sizeOf = (parts: SectionParts): number =>
    (parts.fields?.length ?? 0) +
    (parts.extras?.filter(rendersExtra).length ?? 0) +
    (parts.body?.length ?? 0);

  return bodies
    .filter(([, parts]) => sizeOf(parts) > 0)
    .sort(([left], [right]) => sectionOrder(left) - sectionOrder(right))
    .map(([id, parts]) => ({
      id,
      title: titleOf(id),
      // Spends is the read-only section in a later task; today no section
      // declares itself uneditable, so no header says it is.
      readOnly: false,
      defaultOpen: defaultOpenOf(id),
      // One number over one section: the rows React renders and the body it does
      // not yet, counted from the same parts the section is built from.
      count: sizeOf(parts),
      fields: parts.fields ?? [],
      extras: parts.extras ?? [],
      body: parts.body ?? [],
    }));
}
