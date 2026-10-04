import {
  CHART_FAMILIES,
  type ChartFamily,
  type FabricGlobals,
} from "@vigilia/renderer-core";
import { CARD_LIBRARY } from "./card-library.js";
import type { EditorInteraction } from "./editor-interaction.js";
import {
  createNewShape,
  createNewTextDefaults,
  nextNewObjectPlacement,
  SHAPE_KINDS,
  type ShapeKind,
} from "./new-object-defaults.js";
import { uiCopy } from "./ui-copy.js";

export interface NewObjectPanel {
  readonly root: HTMLElement;
  setGlobals(globals: FabricGlobals | undefined): void;
}

export interface NewObjectActions {
  readonly addChart: (family: ChartFamily) => void;
  /**
   * Inserts one card as a unit. The session owns this because the copy's
   * readings are envelope state, and a panel that made its own would hold a
   * second copy of what the next save writes.
   */
  readonly insertCard: (cardId: string) => void | Promise<void>;
}

/** One object an author can insert, named as the control that inserts it. */
export type InsertableObject =
  | { readonly kind: "text"; readonly label: string }
  | {
      readonly kind: "shape";
      readonly label: string;
      readonly shape: ShapeKind;
    }
  | {
      readonly kind: "chart";
      readonly label: string;
      readonly family: ChartFamily;
    }
  | {
      readonly kind: "card";
      readonly label: string;
      readonly card: string;
    };

/** One heading's worth of them. A heading is what makes "Line" unambiguous. */
export interface InsertGroup {
  /** The heading, or undefined for an object that stands on its own. */
  readonly label: string | undefined;
  readonly objects: readonly InsertableObject[];
}

/**
 * Everything an author can insert, grouped as the Add pane shows it. **The one
 * owner of that list:** the pane's fieldsets and the shell's Insert menu both
 * render this, because two lists that must agree and do not is how a panel —
 * the object this composition is mostly made of — came to be missing from the
 * menu while the pane had it.
 *
 * **Units and primitives are both here, and neither is a fallback for the
 * other.** The card library is the fast path for the common case and the
 * primitives are the tool for the case nobody anticipated, which is the case
 * this product is for (§77, §139). Dropping either is a decision, not a
 * simplification — the test that pins both sections is what makes it one.
 */
export function insertGroups(): readonly InsertGroup[] {
  const objects: readonly InsertableObject[] = [
    ...CARD_LIBRARY.map((unit) => ({
      kind: "card" as const,
      label: unit.label,
      card: unit.id,
    })),
    { kind: "text", label: uiCopy.panels.text },
    ...SHAPE_KINDS.map((shape) => ({
      kind: "shape" as const,
      label: uiCopy.shapeKinds[shape],
      shape,
    })),
    ...CHART_FAMILIES.map((family) => ({
      kind: "chart" as const,
      label: uiCopy.chartFamilies[family],
      family,
    })),
  ];

  const groups: InsertGroup[] = [];
  for (const object of objects) {
    const label = groupOf(object);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.label === label) {
      groups[groups.length - 1] = { label, objects: [...last.objects, object] };
    } else {
      groups.push({ label, objects: [object] });
    }
  }

  return groups;
}

function groupOf(object: InsertableObject): string | undefined {
  switch (object.kind) {
    case "text":
      return undefined;
    case "card":
      return uiCopy.panels.cards;
    case "shape":
      return uiCopy.panels.shapes;
    case "chart":
      return uiCopy.panels.charts;
  }
}

/** A text object, placed and named as a new one always is. */
export function insertNewText(
  editor: EditorInteraction,
  globals: FabricGlobals | undefined,
): void {
  const content = "New text";
  const text = editor.textManager.addText({
    text: content,
    ...createNewTextDefaults(globals, content, nextNewObjectPlacement(editor)),
  });
  // The caret, so typing goes somewhere. Asking for a text box and then having
  // to double-click it before the first character lands is a second, undiscoverable
  // step: the object appears selected, the status says nothing about editing, and
  // a keystroke after Insert went nowhere at all. Every editor this product is
  // measured against puts you in the text as soon as you ask for a text box.
  // Deferred a frame, because the menu this was opened from takes focus back
  // for itself as it closes — entering synchronously put the caret in and then
  // lost it, which is the same defect in a different costume.
  requestAnimationFrame(() => {
    if (editor.canvas.getActiveObject() !== text) return;
    text.enterEditing();
    text.selectAll();
  });
}

/**
 * A shape, added through the canvas as one history entry and left selected.
 * Shared with the Insert menu so the two surfaces cannot insert different
 * objects under the same name.
 */
export function insertNewShape(
  editor: EditorInteraction,
  globals: FabricGlobals | undefined,
  kind: ShapeKind,
): void {
  // The id is the stable key bindings, the schema path and the envelope carry,
  // so it names the kind the button made. F1.8 gave the *display* the right
  // name and an author never sees the id, which is exactly why a circle keyed
  // `panel-…` survived: nobody reading the screen sees it.
  const inserted = createNewShape(
    `${kind}-${crypto.randomUUID()}`,
    globals,
    kind,
    nextNewObjectPlacement(editor),
  );
  editor.canvas.add(inserted);
  editor.canvas.setActiveObject(inserted);
  editor.historyManager.saveState();
  editor.canvas.requestRenderAll();
}

/** Vigilia creates semantic text while the editor retains generic construction and history. */
export function createNewObjectPanel(
  host: HTMLElement,
  editor: EditorInteraction,
  globals: FabricGlobals | undefined,
  actions?: NewObjectActions,
): NewObjectPanel {
  let currentGlobals = globals;
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "add";
  const heading = document.createElement("h2");
  heading.textContent = uiCopy.panels.add;
  /**
   * Runs a construction that refuses when the theme has no reference to give
   * it — a palette without a usable token, type presets without a body, or a
   * card painted with a global this theme has no token for. Reported through
   * the editor's own diagnostics, because a throw out of a click handler leaves
   * the author with a button that silently does nothing.
   *
   * Every construction in this panel goes through it, charts included:
   * `ChartManager.addChart` calls `newChart` into `createNewChartDefaults`
   * with no handler of its own, so an unwrapped chart button would be the only
   * one here that fails silently.
   */
  const constructing = (build: () => void | Promise<void>): void => {
    const report = (error: unknown): void => {
      editor.errorManager.warn(
        "controls",
        error instanceof Error ? error.message : String(error),
      );
    };
    try {
      // A card is enlivened, so its construction is asynchronous; the refusal
      // it may raise arrives in the same diagnostics as every sibling's.
      void Promise.resolve(build()).catch(report);
    } catch (error) {
      report(error);
    }
  };

  /**
   * The units, the primitives and the chart families, each in a labelled group
   * rather than twenty more chips: "Line" is both a chart and a shape, and a
   * flat list would put the same word on two buttons. One construction each —
   * the card library owns what a card is, the defaults module owns what a new
   * shape is, and the canvas and history the editor already exposes own where
   * it lands and how it is recorded.
   */
  const button = (object: InsertableObject): HTMLButtonElement => {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = object.label;
    if (object.kind === "shape") {
      control.dataset["vigiliaPanelAdd"] = object.shape;
    }
    if (object.kind === "card") {
      control.dataset["vigiliaPanelCard"] = object.card;
    }
    control.addEventListener("click", () =>
      constructing(() => {
        switch (object.kind) {
          case "text":
            insertNewText(editor, currentGlobals);
            return;
          case "shape":
            insertNewShape(editor, currentGlobals, object.shape);
            return;
          case "card": {
            const insert = actions?.insertCard;
            // Refused rather than ignored: a library button that quietly does
            // nothing is the one failure an author cannot diagnose.
            if (insert === undefined) {
              throw new Error(
                "The card library needs the editor session that owns the document's bindings.",
              );
            }
            return insert(object.card);
          }
          case "chart":
            actions?.addChart(object.family);
        }
      }),
    );
    return control;
  };

  for (const group of insertGroups()) {
    if (group.label === undefined) {
      root.append(...group.objects.map(button));
      continue;
    }

    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.label;
    fieldset.append(legend, ...group.objects.map(button));
    root.append(fieldset);
  }

  host.append(root);
  return {
    root,
    setGlobals(nextGlobals) {
      currentGlobals = nextGlobals;
    },
  };
}
