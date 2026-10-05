/**
 * A pointer DOM event that exposes a screen position.
 */
type CursorIndicatorPointerEvent = MouseEvent | TouchEvent;

/**
 * Pointer coordinates in the browser's viewport.
 */
type CursorIndicatorClientPoint = {
  clientX: number;
  clientY: number;
};

/**
 * Base inline styles for indicators shown next to the pointer.
 */
const CURSOR_INDICATOR_STYLES = {
  position: "absolute",
  display: "none",
  background: "#2B2D33",
  color: "#fff",
  padding: "4px 8px",
  "border-radius": "4px",
  "font-size": "12px",
  "font-weight": "500",
  "font-family": "system-ui, -apple-system, sans-serif",
  "z-index": "1000",
  "pointer-events": "none",
  "white-space": "nowrap",
  "box-shadow": "0 2px 8px rgba(0, 0, 0, 0.2)",
} as const;

/** Horizontal pointer offset in pixels. */
const CURSOR_INDICATOR_OFFSET_X = 16;

/** Vertical pointer offset in pixels. */
const CURSOR_INDICATOR_OFFSET_Y = 16;

export interface CursorIndicator {
  readonly el: HTMLDivElement;
  showAtPointer(input: {
    readonly text: string;
    readonly event: CursorIndicatorPointerEvent;
  }): void;
  hide(): void;
  destroy(): void;
}

/** A DOM tooltip that shows a short value beside the cursor inside the canvas wrapper. */
export function createCursorIndicator({
  className,
  parent,
}: {
  readonly className: string;
  readonly parent: HTMLElement;
}): CursorIndicator {
  const el = createElement({ className });
  parent.append(el);

  function showAtPointer({
    text,
    event,
  }: {
    readonly text: string;
    readonly event: CursorIndicatorPointerEvent;
  }): void {
    const point = resolveClientPoint({ event });

    if (point === null) {
      hide();
      return;
    }

    el.textContent = text;
    el.style.display = "block";

    const position = resolvePosition({ el, parent, point });
    el.style.left = `${position.left}px`;
    el.style.top = `${position.top}px`;
  }

  function hide(): void {
    el.style.display = "none";
    el.textContent = "";
  }

  function destroy(): void {
    hide();
    el.remove();
  }

  return { el, showAtPointer, hide, destroy };
}

/** Creates the indicator element with its base styles. */
function createElement({
  className,
}: {
  readonly className: string;
}): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;

  for (const [key, value] of Object.entries(CURSOR_INDICATOR_STYLES)) {
    element.style.setProperty(key, value);
  }

  return element;
}

/** Positions the indicator in the parent element's coordinates. */
function resolvePosition({
  el,
  parent,
  point,
}: {
  readonly el: HTMLDivElement;
  readonly parent: HTMLElement;
  readonly point: CursorIndicatorClientPoint;
}): CursorIndicatorPosition {
  const parentRect = parent.getBoundingClientRect();
  const indicatorRect = el.getBoundingClientRect();
  const pointerLeft = point.clientX - parentRect.left;
  const pointerTop = point.clientY - parentRect.top;

  let left = pointerLeft + CURSOR_INDICATOR_OFFSET_X;
  let top = pointerTop + CURSOR_INDICATOR_OFFSET_Y;

  if (left + indicatorRect.width > parentRect.width) {
    left = pointerLeft - indicatorRect.width - CURSOR_INDICATOR_OFFSET_X;
  }

  if (top + indicatorRect.height > parentRect.height) {
    top = pointerTop - indicatorRect.height - CURSOR_INDICATOR_OFFSET_Y;
  }

  const maxLeft = Math.max(0, parentRect.width - indicatorRect.width);
  const maxTop = Math.max(0, parentRect.height - indicatorRect.height);

  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

type CursorIndicatorPosition = {
  left: number;
  top: number;
};

/** Returns the screen coordinates of a mouse or first-touch pointer. */
function resolveClientPoint({
  event,
}: {
  readonly event: CursorIndicatorPointerEvent;
}): CursorIndicatorClientPoint | null {
  if (
    "clientX" in event &&
    typeof event.clientX === "number" &&
    "clientY" in event &&
    typeof event.clientY === "number"
  ) {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  const touches = "touches" in event ? event.touches : undefined;
  const changedTouches =
    "changedTouches" in event ? event.changedTouches : undefined;
  const touch = touches?.item(0) ?? changedTouches?.item(0);

  if (!touch) return null;

  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
  };
}
