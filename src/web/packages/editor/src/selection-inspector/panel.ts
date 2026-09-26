import type { FabricGlobals } from "@vigilia/renderer-core";
import {
  applyObjectPalettePaints,
  type FabricPaintRefs,
  VIGILIA_PAINT_PROPERTY,
} from "@vigilia/scene-fabric";
import { type FabricObject, Rect, Shadow } from "fabric/es";
import { numberField } from "../editor-shell/controls/number-field.js";
import { uiCopy } from "../ui-copy.js";
import { type AppearanceContext, resolveToken } from "./appearance.js";

/**
 * A panel's authored material: which tokens paint its fill, border and shadow,
 * and the native geometry that makes them visible. Everything here is a
 * property Fabric already owns, so an author can edit it, save it, undo it and
 * read it back — no second model beside the scene.
 *
 * Paint resolves through `applyObjectPalettePaints`, the same owner the editor
 * uses when a palette changes, so a field and a palette edit cannot disagree
 * about what a reference means.
 */

/** The paint properties a panel may reference, matching `FabricPaintRefs`. */
type PaintProperty = keyof FabricPaintRefs;

/**
 * A starting blur for a shadow the author has just given a colour. A colour
 * alone draws nothing, so the committed edit must leave something visible —
 * and the blur field appears with it, so this is a value to move, not a rule.
 */
export const DEFAULT_PANEL_SHADOW_BLUR = 8;

/**
 * How far a newly shadowed panel's shadow falls below it. A shadow with no
 * offset is a symmetric halo, not a shadow: the captured editor evidence showed
 * the light panel token drawing a white glow around the panel until this moved.
 */
export const DEFAULT_PANEL_SHADOW_OFFSET = 4;

export interface PanelFieldHooks {
  /** False once the panel describes a different object; the edit is refused. */
  readonly stillTarget: () => boolean;
  /** Repaints and records: one history entry per committed edit. */
  readonly commit: () => void;
  /** Re-reads the object, so the fields show what was just written. */
  readonly onChange: () => void;
}

/**
 * Whether these fields apply at all. A rectangle is the only kind whose corner
 * radius and border mean anything; offering them for a chart, an image or a
 * text object would be controls that accept an edit and apply none.
 *
 * Checked on the live class rather than the persisted `"type"` string: Fabric
 * lowercases `object.type`, and only the scene JSON spells it `Rect`.
 */
export function supportsPanelFields(object: FabricObject): boolean {
  return object instanceof Rect;
}

/** A copy of the object's own references, so a write cannot mutate them. */
function paintRefs(object: FabricObject): FabricPaintRefs {
  const value = object.get(VIGILIA_PAINT_PROPERTY);
  return typeof value === "object" && value !== null
    ? (value as FabricPaintRefs)
    : {};
}

/**
 * Sets one property's reference and leaves the others alone. Palette identity
 * is per property: choosing a fill must not re-point a border or a shadow the
 * author already set, and clearing one must not clear the rest.
 */
function writeRef(
  object: FabricObject,
  property: PaintProperty,
  ref: `palette.${string}` | undefined,
): void {
  const next: { -readonly [K in PaintProperty]?: `palette.${string}` } = {
    ...paintRefs(object),
  };
  if (ref === undefined) delete next[property];
  else next[property] = ref;
  object.set(VIGILIA_PAINT_PROPERTY, next);
}

interface TokenFieldOptions {
  readonly label: string;
  readonly data: string;
  readonly context: AppearanceContext;
  readonly selected: `palette.${string}` | undefined;
  /**
   * Fabric's `Shadow.color` is a string, and the envelope refuses a gradient
   * reference rather than dropping it at paint time, so a gradient is never
   * offered where one cannot be applied.
   */
  readonly solidOnly?: boolean;
  readonly onCommit: (ref: `palette.${string}` | undefined) => void;
}

/** A labelled palette-token picker, named by the token's own name. */
function tokenField(options: TokenFieldOptions): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.htmlFor = `vigilia-token-${options.data}`;
  label.textContent = options.label;
  const select = document.createElement("select");
  select.id = label.htmlFor;
  select.dataset[options.data] = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = uiCopy.panels.notSet;
  select.append(none);
  for (const token of tokenOptions(
    options.context.globals,
    options.solidOnly === true,
  )) {
    const option = document.createElement("option");
    option.value = `palette.${token.id}`;
    option.textContent = token.name;
    select.append(option);
  }
  select.value = options.selected ?? "";
  select.addEventListener("change", () => {
    const value = select.value;
    options.onCommit(value === "" ? undefined : (value as `palette.${string}`));
  });
  row.append(label, select);
  return row;
}

/** The theme's tokens, each under the name its author gave it. */
function tokenOptions(
  globals: FabricGlobals | undefined,
  solidOnly: boolean,
): ReadonlyArray<{ readonly id: string; readonly name: string }> {
  return Object.entries(globals?.palette ?? {})
    .filter(
      ([id, entry]) =>
        id !== "none" && !(solidOnly && entry.value.kind !== "solid"),
    )
    .map(([id, entry]) => ({ id, name: entry.name }));
}

/** The panel's appearance fields, or nothing when it is not a panel. */
export function createPanelFields(
  context: AppearanceContext,
  object: FabricObject,
  hooks: PanelFieldHooks,
): HTMLElement | undefined {
  if (!supportsPanelFields(object)) return undefined;

  const root = document.createElement("div");
  const refs = paintRefs(object);

  /** A refused edit restores the field itself; this only reports it. */
  const refused = (): void =>
    context.editor.errorManager.warn(
      "controls",
      uiCopy.inspectorFields.invalidValue,
    );

  /** One committed edit: refuse a stale one, then repaint and record once. */
  const commit = (write: () => void): void => {
    if (!hooks.stillTarget()) return;
    write();
    hooks.commit();
    hooks.onChange();
  };
  /** A reference change, resolved by the owner the palette editor also uses. */
  const commitRef = (write: () => void): void => {
    commit(() => {
      write();
      applyObjectPalettePaints(context.editor.canvas, context.globals);
    });
  };

  root.append(
    tokenField({
      label: uiCopy.inspectorFields.panelFill,
      data: "vigiliaPanelFill",
      context,
      selected: refs.fill,
      onCommit: (ref) =>
        commitRef(() => {
          writeRef(object, "fill", ref);
          // No reference means no resolver will clear it, so the live paint is
          // cleared here rather than left at the last token's colour.
          if (ref === undefined) object.set("fill", "");
        }),
    }),
    tokenField({
      label: uiCopy.inspectorFields.panelStroke,
      data: "vigiliaPanelStroke",
      context,
      selected: refs.stroke,
      onCommit: (ref) =>
        commitRef(() => {
          writeRef(object, "stroke", ref);
          if (ref === undefined) object.set("stroke", "");
        }),
    }),
    numberField({
      label: uiCopy.inspectorFields.panelBorder,
      value: Math.round(object.get("strokeWidth") as number),
      min: 0,
      data: "vigiliaPanelBorder",
      invalidMessage: uiCopy.inspectorFields.invalidValue,
      onReject: refused,
      onCommit: (value) => commit(() => object.set("strokeWidth", value)),
    }).row,
    numberField({
      label: uiCopy.inspectorFields.panelRadius,
      value: Math.round(object.get("rx") as number),
      min: 0,
      data: "vigiliaPanelRadius",
      invalidMessage: uiCopy.inspectorFields.invalidValue,
      onReject: refused,
      // Both axes, because Fabric derives `ry` from `rx` only while it is unset;
      // persisting one and reading the other back would depend on that default.
      onCommit: (value) => commit(() => object.set({ rx: value, ry: value })),
    }).row,
    tokenField({
      label: uiCopy.inspectorFields.panelShadow,
      data: "vigiliaPanelShadow",
      context,
      selected: refs.shadowColor,
      solidOnly: true,
      onCommit: (ref) =>
        commitRef(() => {
          writeRef(object, "shadowColor", ref);
          if (ref === undefined) {
            object.set("shadow", null);
            return;
          }
          // An existing shadow keeps its blur and offsets; only its colour is
          // re-resolved, from the reference just written.
          if (object.get("shadow") instanceof Shadow) return;
          object.set(
            "shadow",
            new Shadow({
              color: resolveToken(context.globals, ref) ?? "",
              blur: DEFAULT_PANEL_SHADOW_BLUR,
              offsetX: 0,
              offsetY: DEFAULT_PANEL_SHADOW_OFFSET,
            }),
          );
        }),
    }),
  );

  // Only offered when there is a shadow for it to change: a blur box over a
  // panel with no shadow accepts an edit and applies none.
  const shadow = object.get("shadow");
  if (shadow instanceof Shadow) {
    /** Writes one native shadow property, if the shadow is still there. */
    const shadowNumber = (
      label: string,
      data: string,
      read: (live: Shadow) => number,
      write: (live: Shadow, value: number) => void,
    ): HTMLElement =>
      numberField({
        label,
        value: Math.round(read(shadow)),
        min: 0,
        data,
        invalidMessage: uiCopy.inspectorFields.invalidValue,
        onReject: () =>
          context.editor.errorManager.warn(
            "controls",
            uiCopy.inspectorFields.invalidValue,
          ),
        onCommit: (value) =>
          commit(() => {
            const live = object.get("shadow");
            if (live instanceof Shadow) write(live, value);
          }),
      }).row;

    root.append(
      shadowNumber(
        uiCopy.inspectorFields.panelShadowBlur,
        "vigiliaPanelShadowBlur",
        (live) => live.blur,
        (live, value) => {
          live.blur = value;
        },
      ),
      // Downward only: an upward offset would be a second axis of freedom for
      // no reason a panel needs, and this keeps the field to one number.
      shadowNumber(
        uiCopy.inspectorFields.panelShadowOffset,
        "vigiliaPanelShadowOffset",
        (live) => live.offsetY,
        (live, value) => {
          live.offsetY = value;
        },
      ),
    );
  }

  return root;
}
