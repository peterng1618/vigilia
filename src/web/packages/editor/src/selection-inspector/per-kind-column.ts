import type {
  Binding,
  FabricGlobals,
  SampleSource,
  SettingsSection,
} from "@vigilia/renderer-core";
import { SETTINGS_SECTIONS } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { linkedPair } from "../editor-shell/controls/linked-pair.js";
import { numberField } from "../editor-shell/controls/number-field.js";
import {
  propertySection,
  type PropertySection,
} from "../editor-shell/controls/property-section.js";
import { uiCopy } from "../ui-copy.js";
import {
  type AppearanceContext,
  createNameField,
  createOpacityField,
  createResolutionLine,
  createTypePresetReveal,
  nameOfRef,
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
import { createRunEditor, type RunBindingPort } from "./runs.js";

/**
 * The column the inspector renders, as **data**: one entry per section, in the
 * order the questions are asked. A test enumerates this rather than reading the
 * DOM, and the inspector appends each `root` in turn.
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

export type ColumnSectionId = SettingsSection | "advanced";

export interface ColumnSection {
  readonly section: ColumnSectionId;
  /** The live section element. Reused across renders, so an open section stays
      open rather than being rebuilt at its default. */
  readonly root: HTMLElement;
  readonly defaultOpen: boolean;
  /** How many controls the section holds; the summary prints it. */
  readonly count: number;
}

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
   * The section handles this column keeps, keyed by section. Handed in rather
   * than held here so the state belongs to the inspector's lifetime: a
   * re-render replaces a section's body and leaves the author's open sections
   * exactly as they were.
   */
  readonly sections: Map<ColumnSectionId, PropertySection>;
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

function rotationField(
  context: ColumnContext,
  object: FabricObject,
): HTMLElement {
  return numberField({
    label: GEOMETRY_LABELS.angle,
    value: Math.round(context.geometry.read(object, "angle")),
    data: "vigiliaGeometry",
    dataValue: "angle",
    invalidMessage: uiCopy.inspectorFields.invalidValue,
    onReject: refused(context),
    onCommit: (value) => writeGeometry(context, object, "angle", value),
  }).row;
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
): readonly HTMLElement[] {
  const body: HTMLElement[] = [];
  // The name is a field that writes, so a locked object is not offered one.
  if (!locked) {
    body.push(
      createNameField(appearanceOf(context), target, context.stillTarget),
    );
  }

  const id = target.get("id");
  const port: RunBindingPort | undefined =
    typeof id !== "string" || id.length === 0
      ? undefined
      : {
          bindings: () => context.nodeBindings?.(id) ?? [],
          setBindings: (next) => context.onNodeBindingsChange?.(id, next),
        };
  const runs = createRunEditor(
    context.editor,
    context.globals,
    target as unknown as {
      get(n: string): unknown;
      set(n: string, v: unknown): void;
    },
    context.rerender,
    port,
    context.locale,
    context.sampleSource,
  ).root;
  // A run editor with nothing in it is an empty box, not a control: it is only
  // a question for an object that carries authored text. Counting it would make
  // the section's own count say two over one field.
  if (runs.childElementCount > 0) body.push(runs);

  return body;
}

/** Where it sits and how big: the two pairs, crop, bleed, and this shape's own
    geometry. */
function positionBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): readonly HTMLElement[] {
  if (locked) return [];
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

  return body;
}

/** How it presents: rotation, and opacity. */
function layerBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): readonly HTMLElement[] {
  if (locked) return [];
  return [
    rotationField(context, target),
    createOpacityField(appearanceOf(context), target, context.stillTarget),
  ];
}

/** What ink: the panel's material, and the frosted-glass treatment. */
function paintBody(
  target: FabricObject,
  context: ColumnContext,
  locked: boolean,
): readonly HTMLElement[] {
  if (locked) return [];
  const body: HTMLElement[] = [];

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

  return body;
}

/** What it resolves to. Read-only, so a locked object still gets it: the author
    can see what the object is made of even when they cannot move it. */
function spendsBody(
  target: FabricObject,
  context: ColumnContext,
): readonly HTMLElement[] {
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

  return body;
}

/**
 * The sections this selection gets, in the order the questions are asked.
 *
 * A section with nothing in it is not returned at all: the question does not
 * apply to this kind, so there is no header and no count of zero. Every section
 * that is returned keeps the handle it had, so a re-render replaces a body
 * without collapsing the section the author opened.
 */
export function perKindColumn(
  target: FabricObject,
  context: ColumnContext,
): readonly ColumnSection[] {
  const locked = target.get("locked") === true;

  // Built in question order already; sorted anyway so the order is a statement
  // this module makes rather than one it inherits from the lines above.
  const bodies: readonly (readonly [
    ColumnSectionId,
    readonly HTMLElement[],
  ])[] = [
    ["content", contentBody(target, context, locked)],
    ["position", positionBody(target, context, locked)],
    ["layer", layerBody(target, context, locked)],
    ["paint", paintBody(target, context, locked)],
    ["spends", spendsBody(target, context)],
  ];

  return bodies
    .filter(([, body]) => body.length > 0)
    .sort(([left], [right]) => sectionOrder(left) - sectionOrder(right))
    .map(([id, body]) => {
      const defaultOpen = defaultOpenOf(id);
      const existing = context.sections.get(id);
      if (existing !== undefined) {
        existing.setBody(body);
        return {
          section: id,
          root: existing.root,
          defaultOpen,
          count: body.length,
        };
      }

      const created = propertySection({
        id,
        title: titleOf(id),
        body,
        defaultOpen,
      });
      context.sections.set(id, created);
      return {
        section: id,
        root: created.root,
        defaultOpen,
        count: body.length,
      };
    });
}
