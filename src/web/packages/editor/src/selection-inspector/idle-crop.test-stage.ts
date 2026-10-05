import type { CropManager } from "../crop-manager/index.js";

/**
 * A crop session that is not running, for a test about something else.
 *
 * The inspector asks the session which image it is cropping so its fields stay
 * on the image while the session's own frame is the active object, which means
 * every stub standing in for `EditorInteraction` has to answer that. These tests
 * are not about crop, so this answers "no session" and refuses to start one.
 */
export function idleCrop(): CropManager {
  return {
    active: false,
    target: undefined,
    begin: () => false,
    setAspect: () => {},
    apply: () => {},
    cancel: () => {},
  };
}
