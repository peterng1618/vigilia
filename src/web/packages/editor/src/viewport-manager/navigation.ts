import type { Canvas } from "fabric/es";
import { isTextEntryTarget } from "../shortcut-manager/index.js";
import type { ViewportManager } from "./index.js";

/** One camera-key press; ~10% per press reads as a step without feeling slow. */
const ZOOM_STEP = 1.1;

/** Wheel pixels per e-fold of zoom, so the same gesture feels the same on a
 * notched mouse and a trackpad, whose deltas differ by an order of magnitude. */
const WHEEL_ZOOM_DIVISOR = 1000;

const PAN_CURSOR = "grab";
const PAN_ACTIVE_CURSOR = "grabbing";

/** Bare keys only: ctrl/meta +/=/- belong to the browser's own page zoom. */
const ZOOM_IN_KEYS: ReadonlySet<string> = new Set(["+", "="]);
const ZOOM_OUT_KEYS: ReadonlySet<string> = new Set(["-", "_"]);

/** Line-mode wheels report a handful of lines, pixel-mode a hundred pixels;
 * without normalising, one notch pans ~3px on the former. 16 is the
 * conventional px-per-line. */
const LINE_HEIGHT = 16;

/** Roles without a native element that take Space as their activation. */
const SPACE_ACTIVATED_ROLES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "menuitem",
  "radio",
  "switch",
  "tab",
]);

const wheelDelta = (event: WheelEvent): number =>
  event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * LINE_HEIGHT
    : event.deltaY;

/** Space activates the focused control, so the camera must not claim it there:
 * without this, Space on a focused toolbar button pans instead of pressing it. */
function activatesOnSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLAnchorElement) return target.hasAttribute("href");
  if (
    target instanceof HTMLButtonElement ||
    target instanceof HTMLSelectElement ||
    // No HTMLSummaryElement interface in lib.dom, so the tag is the only check.
    target.tagName === "SUMMARY"
  )
    return true;
  // `isTextEntryTarget` is false for exactly the `<input>` types that consume
  // Space as their own activation, so the negative case reuses that owner.
  if (target instanceof HTMLInputElement) return !isTextEntryTarget(target);
  return SPACE_ACTIVATED_ROLES.has(target.getAttribute("role") ?? "");
}

export interface ViewportNavigationInput {
  readonly canvas: Canvas;
  readonly viewport: ViewportManager;
}

/**
 * Binds the camera's gestures: wheel pans, ctrl/meta-wheel zooms about the
 * pointer, space-drag and middle-drag pan, and `+`/`=`/`-`/`shift+1` zoom.
 * Returns the unbind function.
 *
 * Camera state is not authored content (§57), so nothing here touches history.
 * The camera is the only writer of the viewport transform, so no gesture writes
 * it directly.
 */
export function bindViewportNavigation({
  canvas,
  viewport,
}: ViewportNavigationInput): () => void {
  const element = canvas.upperCanvasEl;
  let spaceHeld = false;
  let panning = false;
  let claimed = false;
  let lastX = 0;
  let lastY = 0;
  let resumeCursor = "";
  let resumeDefaultCursor: string | undefined;
  let resumeSkipTargetFind = false;
  let resumeSelection = false;

  /** Fabric re-applies `defaultCursor` on every hover, so writing the canvas
   * element's cursor directly is overwritten at the next mouse move. Fabric's
   * hover state is the owner: set the value it re-applies. */
  const showCursor = (value: string): void => {
    canvas.defaultCursor = value;
    canvas.setCursor(value);
  };

  /** While the gesture is claimed a press must not select or drag an object, so
   * Fabric is told to find no target: panning must never move authored content. */
  const claim = (): void => {
    if (claimed) return;
    claimed = true;
    resumeCursor = element.style.cursor;
    resumeDefaultCursor = canvas.defaultCursor;
    resumeSkipTargetFind = canvas.skipTargetFind;
    resumeSelection = canvas.selection;
    canvas.skipTargetFind = true;
    canvas.selection = false;
    showCursor(PAN_CURSOR);
  };

  const release = (): void => {
    if (!claimed) return;
    claimed = false;
    canvas.skipTargetFind = resumeSkipTargetFind;
    canvas.selection = resumeSelection;
    if (resumeDefaultCursor !== undefined) {
      canvas.defaultCursor = resumeDefaultCursor;
    }
    // Fabric re-applies the hover cursor on the next mouse move, so the value
    // captured at claim time is the honest one to restore.
    canvas.setCursor(resumeCursor);
  };

  const onWheel = (event: WheelEvent): void => {
    // The editor owns the wheel over the canvas; the page behind it must not
    // scroll under the gesture. ponytail: page-mode deltas are left raw —
    // preventDefault already stops the page scroll and a page-mode wheel over a
    // canvas is vanishingly rare.
    event.preventDefault();
    const delta = wheelDelta(event);
    if (event.ctrlKey || event.metaKey) {
      viewport.zoomToPoint(
        canvas.getViewportPoint(event),
        viewport.zoom() * Math.exp(-delta / WHEEL_ZOOM_DIVISOR),
      );
      return;
    }
    // Shift swaps the wheel's axis, as every other canvas app does.
    if (event.shiftKey) viewport.panBy(-delta, 0);
    else viewport.panBy(0, -delta);
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (!spaceHeld && event.button !== 1) return;
    panning = true;
    claim();
    showCursor(PAN_ACTIVE_CURSOR);
    lastX = event.clientX;
    lastY = event.clientY;
    // Middle-click autoscroll and focus stealing are the browser's defaults.
    event.preventDefault();
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!panning) return;
    // A `mouseup` that lands outside the window never reaches `endPan`, so the
    // gesture would stay claimed: every later move would pan and Fabric would
    // never find a target again. The button bit is the liveness signal.
    if (event.buttons === 0) {
      endPan();
      return;
    }
    viewport.panBy(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const endPan = (): void => {
    if (!panning) return;
    panning = false;
    // The claim survives a release while space is still held, so a second drag
    // in the same hold does not have to re-claim.
    if (spaceHeld) showCursor(PAN_CURSOR);
    else release();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // These are text characters: while a rename field or any input has focus
    // they must reach it, not the camera. A window-level listener sees the
    // focused field as the target, but a synthetic or retargeted event does
    // not, so the focused element is consulted as well.
    if (
      isTextEntryTarget(event.target) ||
      isTextEntryTarget(document.activeElement)
    )
      return;
    // Ctrl+Space is an IME toggle and Alt+Space the window menu; the camera
    // claims bare keys only, so the browser's own chords are never taken.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === " ") {
      // Space also activates the focused control, which owns the key there.
      if (activatesOnSpace(event.target)) return;
      // A focused button would otherwise also re-activate on the space keyup.
      event.preventDefault();
      // Repeated keydowns while space is held must not re-claim and re-capture
      // the cursor, or the restore value becomes the pan cursor itself.
      if (spaceHeld) return;
      spaceHeld = true;
      claim();
      showCursor(PAN_CURSOR);
      return;
    }
    if (ZOOM_IN_KEYS.has(event.key)) {
      viewport.zoomBy(ZOOM_STEP);
      return;
    }
    if (ZOOM_OUT_KEYS.has(event.key)) {
      viewport.zoomBy(1 / ZOOM_STEP);
      return;
    }
    if (event.shiftKey && (event.key === "!" || event.key === "1")) {
      viewport.zoomToFit();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== " ") return;
    spaceHeld = false;
    // A live drag keeps the claim until the pointer is released.
    if (!panning) release();
  };

  /** A lost keyup, e.g. a window switch mid-gesture, would otherwise leave the
   * editor in pan mode with target find disabled for good. */
  const onBlur = (): void => {
    spaceHeld = false;
    panning = false;
    release();
  };

  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", endPan);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return (): void => {
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", endPan);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    release();
  };
}
