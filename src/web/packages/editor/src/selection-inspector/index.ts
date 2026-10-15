import type {
  Binding,
  FabricGlobals,
  SampleSource,
} from "@vigilia/renderer-core";
import {
  applyAuthoredText,
  isLocked,
  type PlanTextObject,
  scaleOf,
  writeAuthoredBoxDimension,
} from "@vigilia/scene-fabric";
import type { FabricObject } from "fabric/es";
import { type ArrangeAction, canArrange } from "../arrange.js";
import type { ChartEdits } from "../chart-manager/chart-fields.js";
import type { EditorInteraction } from "../editor-interaction.js";
import {
  arrangeActions,
  type ObjectActionId,
  objectAction,
} from "../object-actions.js";
import { OBJECT_LOCK_CHANGED_EVENT } from "../object-lock-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import { writeMark } from "./bleed.js";
import { createSelectionColumnRoot } from "./column.js";
import { glassRefusal, writeGlassField } from "./glass.js";
import { createInspectorRoot } from "./inspector.js";
import { writePanelField, writeShapeGeometryField } from "./panel.js";
import {
  type ChartFieldsPort,
  type ColumnContext,
  type GeometryKey,
  MIN_DIMENSION,
  perKindColumn,
} from "./per-kind-column.js";
import {
  appendRun,
  dropRun,
  type RunTarget,
  writeBindingFormat,
  writeBindingZone,
  writeRunColour,
  writeRunPreset,
  writeRunSource,
  writeRunText,
  writeTextLayout,
  writeUnitDisplay,
} from "./run-edits.js";
import {
  type ArrangeButtonView,
  createSelectionLeadRoot,
} from "./selection-lead.js";
import {
  type CropEdits,
  editRefusal,
  isTextObject,
  type ProjectionPorts,
  projectSelection,
  type RunEdits,
  readField,
  type SelectionEdits,
} from "./view.js";

/**
 * Properties of the selected object. An author's most common action is "select a
 * thing, change a thing", which had no control surface at all: the inspector
 * offered only document-level settings.
 *
 * The surface itself — which sections a selection gets, and which question each
 * field answers — is `perKindColumn`, which returns it as data. This module owns
 * the object: which one is described (`target`), how a field writes it, and the
 * commit path. Reads the live Fabric object and writes through the canvas,
 * saving history once per committed edit (§67). Whole artboard units (§57).
 *
 * The column renders through React now ([ADR-0039]): `render` projects a
 * serializable `SelectionView` from Fabric and publishes it to the React root.
 * React holds that value and never the object it describes, which is what keeps
 * Fabric out of React and one writer of the scene.
 */

export interface SelectionInspector {
  readonly root: HTMLElement;
  /** Re-reads the active object; call on every selection change. */
  render(): void;
  /** Theme globals changed, so a displayed resolution may have too. */
  setGlobals(next: FabricGlobals | undefined): void;
  /** The document's language changed, so a formatted preview may have too. */
  setLocale(next: string | undefined): void;
}

interface SelectionInspectorOptions {
  readonly editor: EditorInteraction;
  /** Theme globals, so a token's resolution can be shown. */
  readonly globals?: FabricGlobals;
  /**
   * A node's bindings, and the way to write them back. They belong to the theme
   * envelope rather than to the Fabric object, so the session owns them and the
   * inspector asks for them by node id.
   */
  readonly nodeBindings?: (nodeId: string) => readonly Binding[];
  readonly onNodeBindingsChange?: (
    nodeId: string,
    bindings: readonly Binding[],
  ) => void;
  /**
   * The live sample source, so a value run can say whether a reading has
   * arrived for it. A getter rather than a source: the session replaces its
   * source when the author switches between preview and live, and the panel is
   * mounted for the session rather than rebuilt.
   */
  readonly sampleSource?: () => SampleSource;
  /**
   * Re-resolves the glass lifecycle. The handle belongs to the shell that
   * created it and re-resolves on its own only when the canvas gains or loses
   * an object, so an authored treatment written on a panel that is already
   * there reaches it through this. Required rather than optional: without it the
   * enable control would accept an edit and paint nothing.
   */
  readonly refreshGlass: () => void;
  /**
   * The chart owner's own fields, for a chart selection.
   *
   * A getter rather than the port: the chart manager is built after this
   * inspector, in the session that owns both, so the column asks for them at
   * render time — and the owner a later document mount replaces is the one it
   * gets.
   */
  readonly chartFields?: () => ChartFieldsPort | undefined;
  /**
   * The writes those chart fields make, from the same owner.
   *
   * A second getter rather than a member of the port, for the reason
   * `nodeBindings` and `onNodeBindingsChange` are two: the read half projects
   * into a value the column holds, and the write half is never carried into one.
   * A chart's commit resolves the chart by its own id, so `SelectionEdits`'
   * revision guard has nothing to compare and is not the rule here.
   */
  readonly chartEdits?: () => ChartEdits | undefined;
}

/** The geometry keys the funnel writes directly; every other id is a shape's
    own geometry and is parsed by its owner in `panel.ts`. */
const GEOMETRY_KEYS: ReadonlySet<string> = new Set([
  "left",
  "top",
  "width",
  "height",
  "angle",
]);

export function createSelectionInspector(
  host: HTMLElement,
  options: SelectionInspectorOptions,
): SelectionInspector {
  const editor = options.editor;
  let globals = options.globals;
  /** The document's language; a format preview is spelled in it. */
  let locale: string | undefined;
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "selection";
  host.append(root);

  // Three React roots share the column, in document order: the subject and the
  // empty state; the lead — the arrange actions and the one refusal the
  // subject's kind carries, which are the selection's own rather than a
  // property of it; then the sections, header, count, open state and every row
  // under them. Splitting them rather than growing one root is what keeps each
  // value beside the code that projects it, and the order here is the order the
  // imperative column had.
  const reactHost = document.createElement("div");
  const leadHost = document.createElement("div");
  const sectionsHost = document.createElement("div");
  root.append(reactHost, leadHost, sectionsHost);
  const column = createInspectorRoot(reactHost);
  const lead = createSelectionLeadRoot(leadHost);
  const sectionColumn = createSelectionColumnRoot(sectionsHost);

  const selected = (): FabricObject | undefined =>
    editor.canvas.getActiveObject() ?? undefined;

  /**
   * The last object the fields described, kept only so a history restore can
   * re-bind. Restoring rebuilds the scene and drops Fabric's selection, so an
   * author who undoes an edit would otherwise lose the panel they were working
   * in; the object's Vigilia id survives the restore, so the fields find it
   * again.
   *
   * **Deliberately not cleared when the selection goes away.** A restore fires
   * Fabric's own `selection:cleared` too, and clearing here would empty this
   * before `restoring` was ever consulted — the memory has to outlive the
   * deselect it must not be used for.
   */
  let bound: FabricObject | undefined;

  /** True only for the render a history load triggers. */
  let restoring = false;

  /**
   * The identity token for the object a published view describes. Bumped
   * whenever the described target is replaced, cleared, removed, rehydrated by
   * history or changed by crop context — a document id cannot identify an
   * `ActiveSelection`, so the object's own identity is the token.
   */
  let targetRevision = 0;
  let described: FabricObject | undefined;

  const objectById = (id: unknown): FabricObject | undefined => {
    if (typeof id !== "string") {
      return undefined;
    }

    const find = (
      objects: readonly FabricObject[],
    ): FabricObject | undefined => {
      for (const object of objects) {
        if (object.get("id") === id) {
          return object;
        }

        const children = (
          object as { getObjects?: () => FabricObject[] }
        ).getObjects?.();
        if (children !== undefined) {
          const nested = find(children);
          if (nested !== undefined) {
            return nested;
          }
        }
      }

      return undefined;
    };

    return find(editor.canvas.getObjects());
  };

  /**
   * The object to describe: the live selection, or the re-bound one across a
   * history restore. **A deselect is neither**, and the column empties for it —
   * `2026-10-03-dashboard-authoring-design.md:558`, "with nothing selected the
   * right column is empty and names where to choose from", and its `:574` ruling
   * that the column empties on deselect.
   *
   * A crop session is the exception: it makes its own frame the active object,
   * so following the selection would describe that frame rather than the image
   * the author is cropping. The session names its image, and the fields stay
   * bound to it until the session ends.
   */
  const target = (): FabricObject | undefined => {
    const cropping = editor.cropManager.target;
    if (cropping !== undefined) {
      bound = cropping;
      return cropping;
    }

    const active = selected();

    if (active !== undefined) {
      bound = active;
      return active;
    }

    if (restoring && bound !== undefined) {
      const again = objectById(bound.get("id"));
      bound = again;
      return again;
    }

    return undefined;
  };

  /** Writes one field to the object without rendering or saving history, so a
      caller can batch several writes into one entry. */
  const write = (
    object: FabricObject,
    key: GeometryKey,
    value: number,
  ): void => {
    // A dimension below one unit would make the object vanish from the canvas
    // and from its own selection box. The pre-plan Size pair carried this floor
    // as a field bound that landed the value on it rather than refusing; it is
    // the funnel's now, once, for both dimensions.
    const dimension = Math.max(value, MIN_DIMENSION);
    switch (key) {
      case "left":
        object.set({ left: value });
        break;
      case "top":
        object.set({ top: value });
        break;
      case "width": {
        // A text object's width is the box its text wraps inside, not a scale
        // on the type. Writing `scaleX` instead stretched every glyph: a 24px
        // caption asked for a 220-unit box came back at 3.4× the size, and the
        // H field squashed the same type to 0.44 of its height. The authored box
        // is the owner, and the renderer re-asserts it.
        //
        // The unit the box is written in is the object's own, unscaled one:
        // `dimension` is what the field *shows*, which is the drawn edge —
        // `readField` reads `width * scaleX` — and a scaled text object draws
        // `box × scale`. So the write divides by the same scale the read
        // multiplies by, or the control cannot round-trip: a 140 × 27 box at
        // scale 2 read 280, typing 280 back stored 280, and the object drew
        // 560 (vg-109). A dragged handle writes the same unscaled unit
        // (`text-manager`'s `adoptResizedBox`, `controls-manager`'s height
        // control), and `scaleOf` is the rule for a zero scale, so neither side
        // re-spells it. A drawn number below the object's own scale divides
        // below the box's floor of 1 and the writer refuses it, which is this
        // control's floor read in the other unit — the box does not vanish for
        // it, and the field keeps the number it had.
        if (isTextObject(object)) {
          writeAuthoredBoxDimension(
            object as PlanTextObject,
            "width",
            dimension / scaleOf(object.scaleX),
          );
          applyAuthoredText(editor.canvas, globals);
          break;
        }
        // Scale rather than resize: a chart's own width is its raster size.
        const next = dimension / (object.width <= 0 ? 1 : object.width);
        object.set({ scaleX: next });
        break;
      }
      case "height": {
        if (isTextObject(object)) {
          // Same unit as the width above, and as `writeAuthoredBoxDimension`'s
          // own seeding of the other dimension from the object's edges — those
          // are unscaled too, so the first Size edit still produces a whole box
          // in one unit (vg-057).
          writeAuthoredBoxDimension(
            object as PlanTextObject,
            "height",
            dimension / scaleOf(object.scaleY),
          );
          applyAuthoredText(editor.canvas, globals);
          break;
        }
        const next = dimension / (object.height <= 0 ? 1 : object.height);
        object.set({ scaleY: next });
        break;
      }
      case "angle": {
        // The property alone rotates about the authored left/top origin while
        // the gesture holds the centre (`centeredRotation`), so the centre is
        // read before the write and restored after it (vg-475; canvas-nudge).
        const centre = object.getRelativeCenterPoint();
        object.set({ angle: value });
        object.setPositionByOrigin(centre, "center", "center");
        break;
      }
    }

    object.setCoords();
  };

  /** One entry per committed edit, matching the dock's own actions. */
  const commit = (): void => {
    editor.canvas.requestRenderAll();
    editor.historyManager.saveState();
  };

  /**
   * The target may have changed while a field held focus; re-render rather
   * than write to an object the panel no longer describes. Every committing
   * field asks this first, so a stale event cannot mutate the selection that
   * has since been replaced.
   */
  const stillTarget = (object: FabricObject): boolean => {
    if (target() === object) return true;
    render();
    return false;
  };

  /**
   * Writes the object's display name. Removing the key, not storing blank: the
   * id is what the projection falls back to, so an emptied field leaves the
   * object exactly as an unnamed one is.
   *
   * The canvas fires the same signal a drag reports, because the layer row
   * prints this name and its panel caches the projection: a rename that only
   * wrote the object would leave the two surfaces disagreeing until something
   * else republished.
   */
  const writeName = (
    object: FabricObject,
    value: string | number | boolean,
  ): void => {
    const trimmed = (typeof value === "string" ? value : String(value)).trim();
    object.set("name", trimmed === "" ? undefined : trimmed);
    object.setCoords();
    editor.canvas.requestRenderAll();
    editor.canvas.fire("object:modified" as never, { target: object } as never);
  };

  /** Writes the deliberate-bleed mark, and tells the surfaces that count it.
      The figure the artboard panel prints is derived from the scene, so it has
      to be told the scene moved or it keeps showing the number from before. */
  const writeBleed = (object: FabricObject, next: boolean): boolean => {
    if (!writeMark(object, next)) return false;
    editor.canvas.fire("object:modified" as never, { target: object } as never);
    return true;
  };

  /**
   * Writes opacity from a percentage, refusing a value outside Fabric's 0–1.
   */
  const writeOpacity = (
    object: FabricObject,
    value: string | number | boolean,
  ): boolean => {
    const percent = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      editor.errorManager.warn("controls", uiCopy.inspectorFields.invalidValue);
      return false;
    }

    object.set({ opacity: percent / 100 });
    object.setCoords();
    return true;
  };

  /**
   * The column's one way to write, from the React surface.
   *
   * The revision, lock and field rules are `view.ts`'s `editRefusal`, read here
   * against the live target **at call time**: a control whose draft outlived its
   * selection is refused before the write funnel is reached, because the funnel
   * would otherwise resolve the *current* target and write an old draft into a
   * newly selected object. A refusal publishes the current view and writes
   * nothing; an invalid value is reported in the row's own words.
   */
  const edits: SelectionEdits = {
    commit(expectedRevision, fieldId, value) {
      const object = described;
      if (object === undefined) {
        render();
        return false;
      }

      const refusal = editRefusal(
        { expectedRevision, fieldId, value },
        { targetRevision, locked: isLocked(object) },
      );
      if (refusal !== undefined) {
        if (refusal === "invalid") {
          editor.errorManager.warn(
            "controls",
            fieldId === "name"
              ? uiCopy.inspectorFields.invalidName
              : uiCopy.inspectorFields.invalidValue,
          );
        }
        render();
        return false;
      }

      let applied = true;
      if (fieldId === "name") {
        writeName(object, value);
      } else if (fieldId === "opacity") {
        applied = writeOpacity(object, value);
      } else if (fieldId === "bleeds") {
        applied = writeBleed(object, value === true);
      } else if (GEOMETRY_KEYS.has(fieldId)) {
        write(object, fieldId as GeometryKey, value as number);
      } else if (fieldId.startsWith("panel-")) {
        // The panel's material writes — resolve a reference, create a default
        // shadow, move a live one — are `panel.ts`'s; this funnel only asks. The
        // whole-canvas paint pass and its reporter ride with the write.
        applied = writePanelField(
          object,
          { editor, globals },
          fieldId,
          value as string | number,
        );
        if (!applied) {
          editor.errorManager.warn(
            "controls",
            uiCopy.inspectorFields.invalidValue,
          );
        }
      } else if (fieldId.startsWith("glass-")) {
        // The treatment writes are `glass.ts`'s. The lifecycle is re-resolved
        // here because nothing else does it: a property written on a panel that
        // is already there is neither a gain nor a loss of an object, so the
        // control that changed it is what has to ask.
        applied = writeGlassField(object, { editor, globals }, fieldId, value);
        if (!applied) {
          editor.errorManager.warn(
            "controls",
            uiCopy.inspectorFields.invalidValue,
          );
        } else {
          options.refreshGlass();
        }
      } else {
        // A shape's own geometry: the parse, the bound and the scale it adopts
        // are its owner's, and this is the funnel that asks for the write.
        applied = writeShapeGeometryField(
          object,
          fieldId,
          value as string | number,
        );
        if (!applied) {
          editor.errorManager.warn(
            "controls",
            uiCopy.inspectorFields.invalidValue,
          );
        } else {
          // Every field here moves a corner, a handle or an endpoint, and a
          // stale control box outlives the render.
          object.setCoords();
        }
      }

      if (!applied) {
        render();
        return false;
      }

      commit();
      render();
      return true;
    },
  };

  /**
   * Applies one run edit to the described object and records one history entry.
   *
   * Not lock-gated: a locked object still takes its bindings and its authored
   * text, which is what the run editor writes — hiding it would refuse work the
   * editor performs.
   */
  const applyRunEdit = (change: (object: FabricObject) => boolean): boolean => {
    const object = described;
    if (object === undefined) {
      render();
      return false;
    }
    if (!stillTarget(object)) return false;
    if (!change(object)) {
      render();
      return false;
    }
    applyAuthoredText(editor.canvas, globals);
    commit();
    render();
    return true;
  };

  /** The node id a run editor hangs its bindings on, when the object has one. */
  const nodeIdOf = (object: FabricObject): string => {
    const id = object.get("id");
    return typeof id === "string" && id.length > 0 ? id : "";
  };

  /** The live bindings a node declares; the session owns the list. */
  const bindingsOf = (nodeId: string): readonly Binding[] =>
    nodeId === "" ? [] : (options.nodeBindings?.(nodeId) ?? []);

  const setBindings = (nodeId: string, next: readonly Binding[]): void => {
    if (nodeId !== "") options.onNodeBindingsChange?.(nodeId, next);
  };

  /**
   * Runs one write against the described object's run target. The write rules
   * themselves live beside the run editor, so a test drives the same functions
   * this port does; this only resolves the target and records the entry.
   */
  const runEdit = (change: (target: RunTarget) => boolean): boolean =>
    applyRunEdit((object) => {
      const nodeId = nodeIdOf(object);
      return change({
        object,
        nodeId,
        bindings: () => bindingsOf(nodeId),
        setBindings: (next) => setBindings(nodeId, next),
      });
    });

  const runEdits: RunEdits = {
    setRunText: (index, text) => runEdit((t) => writeRunText(t, index, text)),
    setRunPreset: (index, ref) => runEdit((t) => writeRunPreset(t, index, ref)),
    setRunColour: (index, ref) => runEdit((t) => writeRunColour(t, index, ref)),
    setUnitDisplay: (index, value) =>
      runEdit((t) => writeUnitDisplay(t, index, value)),
    setSource: (index, key) => runEdit((t) => writeRunSource(t, index, key)),
    setFormat: (index, format) =>
      runEdit((t) => writeBindingFormat(t, index, format)),
    setZone: (index, zone) => runEdit((t) => writeBindingZone(t, index, zone)),
    writeLayout: (patch) => runEdit((t) => writeTextLayout(t, patch)),
    addRun: () => runEdit(appendRun),
    removeRun: (index) => runEdit((t) => dropRun(t, index)),
  };

  /**
   * The crop row's four commands, on the session the editor owns.
   *
   * `begin` resolves the target and refuses a stale one first, for the reason
   * every other field does — a button that held focus across a selection change
   * would otherwise start cropping whatever is selected now. The other three act
   * on the open session, which names its own image.
   */
  const cropEdits: CropEdits = {
    begin: () => {
      const object = described;
      if (object === undefined) {
        render();
        return false;
      }
      if (!stillTarget(object)) return false;
      return editor.cropManager.begin(object);
    },
    setAspect: (ratio) => editor.cropManager.setAspect(ratio),
    apply: () => editor.cropManager.apply(),
    cancel: () => editor.cropManager.cancel(),
  };

  const columnContext = (): ColumnContext => {
    const chartFields = options.chartFields?.();
    return {
      editor,
      globals,
      locale,
      geometry: {
        read: readField,
        write,
      },
      stillTarget,
      commit,
      rerender: render,
      refreshGlass: options.refreshGlass,
      nodeBindings: options.nodeBindings,
      onNodeBindingsChange: options.onNodeBindingsChange,
      sampleSource: options.sampleSource,
      ...(chartFields === undefined ? {} : { chartFields }),
    };
  };

  /**
   * The chart owner's writes, or a port that does nothing.
   *
   * A no-op rather than `undefined`: the column's charts are rendered only when
   * `chartFields` answered, so a chart control can only exist when an owner is
   * mounted — and a `SelectionColumn` that had to guard every row's callbacks
   * would be a second copy of that same condition.
   */
  const chartEdits = (): ChartEdits =>
    options.chartEdits?.() ?? {
      onSettings: () => {},
      onBinding: () => {},
      onAspect: () => {},
      onAddBinding: () => {},
      onRemoveBinding: () => {},
    };

  /**
   * The arrange actions, in the registry's order, each with its own answer — and
   * none at all when this selection can run none of them.
   *
   * Two or more selected objects — or groups — is what the eight are for, and
   * the threshold is `arrange.ts`'s: `canArrange` is asked per action, so a
   * control cannot advertise one `applyArrange` would refuse. Asking it per
   * action is also what draws `Distribute` disabled beside two selected objects
   * instead of absent, and what makes a single object's column show no arrange
   * row rather than eight greyed buttons about a question it does not have.
   */
  const arrangeRow = (): readonly ArrangeButtonView[] => {
    const buttons = arrangeActions().map(({ id, label }) => ({
      id,
      label,
      // The action's verb is the tail of the registry's own id; the run below
      // never parses it, because the registry's `run` carries it.
      enabled: canArrange(editor, id.slice("arrange:".length) as ArrangeAction),
    }));
    return buttons.some((button) => button.enabled) ? buttons : [];
  };

  /** The arrange row's one way to run: the registry's, so this module neither
   *  restates a verb nor reaches `applyArrange` behind the registry's back. */
  const runArrange = (id: ObjectActionId): void => {
    objectAction(id).run(editor);
  };

  /**
   * Projects the described object and publishes it to React. Every row, the
   * reveal a section may carry and the lead's two questions are the roots' to
   * render — there is nothing left for this module to mount into a rendered
   * container.
   */
  const render = (): void => {
    const object = target();
    if (object !== described) {
      described = object;
      targetRevision += 1;
    }

    const ports: ProjectionPorts = {
      globals,
      locale,
      nodeBindings: options.nodeBindings,
      sampleSource: options.sampleSource,
      geometry: { read: readField },
    };
    const sections =
      object === undefined ? [] : perKindColumn(object, columnContext());

    const view = projectSelection(object, targetRevision, ports, sections);
    // All three roots read the same selection: the subject root renders the
    // subject and the empty state, the lead renders what the selection itself
    // has to say, and the section root renders the sections and every row in
    // them.
    column.publish(view, edits);
    lead.publish(
      {
        // A refusal is about the object the panel describes, so it follows
        // `target()` — including the crop session's own subject — rather than
        // the live selection the arrange row reads.
        glassRefusal: object === undefined ? undefined : glassRefusal(object),
        arrange: object === undefined ? [] : arrangeRow(),
      },
      runArrange,
    );
    sectionColumn.publish(view, edits, runEdits, chartEdits(), cropEdits);
  };

  // Fabric reports a finished drag/resize/rotate as `object:modified`; the fields
  // must follow it or they would show stale numbers.
  editor.canvas.on("object:modified", render);
  editor.canvas.on("selection:created", render);
  editor.canvas.on("selection:updated", render);
  editor.canvas.on("selection:cleared", render);
  // A deletion fires no selection event — the active object is discarded first,
  // so the panel went on showing the deleted object's name and geometry while
  // the layer list and canvas had both moved on. The three surfaces disagreed
  // about what the document contained.
  editor.canvas.on("object:removed", render);
  editor.canvas.on("object:added", render);
  // A lock change writes the object and fires no other event (vg-148), so the
  // lock manager notifies and the column follows it rather than offering the
  // writing fields it will refuse.
  editor.canvas.on(OBJECT_LOCK_CHANGED_EVENT as never, render);
  // Restoring history rebuilds the scene and drops the selection; the fields
  // must re-bind to the same object rather than vanishing. Scoped to this one
  // render, because every *other* loss of selection is the author deselecting
  // and the column must empty for that — `try`/`finally` so a throw inside
  // `render` cannot leave the flag armed for the next deselect.
  editor.canvas.on("editor:history-state-loaded" as never, () => {
    restoring = true;
    try {
      render();
    } finally {
      restoring = false;
    }
  });

  render();

  return {
    root,
    render,
    setGlobals(next) {
      globals = next;
      render();
    },
    setLocale(next) {
      locale = next;
      render();
    },
  };
}
