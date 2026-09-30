import type { FabricObject } from "fabric/es";
import { canCrop } from "../crop-manager/index.js";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";

/**
 * The control over a selected image's crop.
 *
 * It lives in the selection inspector rather than beside the Assets pane
 * because it acts on the *selection*, not on the asset library: an author crops
 * the image they have already placed, and #23 asks that assets stop having a
 * panel of their own. The inspector is where a control over a selected object
 * already lives.
 *
 * The session is `crop-manager`'s. This starts one, locks a ratio, and applies
 * or abandons it; it owns none of the drag, because the drag is Fabric's own
 * handles on the frame the session installs.
 */

/** The ratios an author is offered, as width over height. */
const ASPECTS: readonly (readonly [label: string, ratio: number])[] = [
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["16:9", 16 / 9],
];

/**
 * The crop row for one selection, or undefined when there is nothing to crop.
 *
 * While a session is open the row shows the session's own controls and ignores
 * the selection: the session has made its frame the active object, so the
 * selection is the frame rather than the image the author is cropping.
 *
 * `stillTarget` is asked before the session starts, for the reason every other
 * field asks it — a button that held focus across a selection change would
 * otherwise crop whatever is selected now.
 */
export function createCropRow(
  editor: EditorInteraction,
  object: FabricObject | undefined,
  stillTarget: (object: FabricObject) => boolean,
): HTMLElement | undefined {
  const session = editor.cropManager;
  const row = document.createElement("div");
  row.className = "vigilia-field-row";

  if (session.active) {
    for (const [label, ratio] of ASPECTS) {
      const aspect = button(label, "vigiliaCropAspect", label);
      aspect.addEventListener("click", () => {
        session.setAspect(ratio);
      });
      row.append(aspect);
    }
    const apply = button(uiCopy.inspectorFields.cropApply, "vigiliaCropApply");
    apply.addEventListener("click", () => {
      session.apply();
    });
    const cancel = button(
      uiCopy.inspectorFields.cropCancel,
      "vigiliaCropCancel",
    );
    cancel.addEventListener("click", () => {
      session.cancel();
    });
    row.append(apply, cancel);
    return row;
  }

  if (object === undefined || !canCrop(object)) return undefined;
  const target = object;
  const start = button(uiCopy.inspectorFields.crop, "vigiliaCrop");
  start.addEventListener("click", () => {
    if (!stillTarget(target)) return;
    session.begin(target);
  });
  row.append(start);
  return row;
}

/** A test handle and a class the shell's panel button styling already covers.
    A dataset value lets one test name the button among several of a kind. */
function button(
  text: string,
  dataset: string,
  value?: string,
): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  element.dataset[dataset] = value ?? "";
  return element;
}
