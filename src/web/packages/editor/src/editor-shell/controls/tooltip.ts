/**
 * The editor's one tooltip, as a DOM function.
 *
 * `canvas-dock.tsx` is React and the selection inspector builds elements with
 * `document.createElement` and never sees React, so a shared *component* would
 * be a component one of the two callers cannot use. What both need is the
 * behaviour — a popup portalled to `body` above the trigger, opened by hover
 * or focus, dismissed by leaving, blurring or Escape — and the class the shell
 * and `tests/e2e/editor.spec.ts` already locate by name.
 */

/** Above the trigger, as the dock's `Positioner(side="top", sideOffset={8})`
    had it. */
const SIDE_OFFSET = 8;
/** Kept off the viewport edge, so a long reason in a side panel stays readable. */
const EDGE_MARGIN = 8;
/** Wide enough for a sentence about a shape, narrow enough not to cross the
    inspector. A popup with no bound measures to the width of the page. */
const MAX_WIDTH = 280;
/** The popup's width is its own, and never a consequence of where it is put.

    An out-of-flow popup whose `left` is still `auto` is sized against the space
    from its static position to the edge of the viewport, and only once `left`
    and `top` are assigned does it shrink-wrap its text — so a reason that wraps
    to three lines in its placed position measured as one line, and the height
    `place` computed was short by two. The popup then landed on top of its own
    trigger, which fires `pointerleave` on the trigger, dismisses the popup, and
    leaves the pointer re-entering a trigger whose hover timer has just restarted:
    hover never settled, and a reason that only answered to focus. A one-word
    dock label measured the same either way, which is why that caller never
    showed it and this one did. */
const WIDTH = "max-content";
/** Hover waits, focus does not: a delay is what stops a pointer crossing the
    dock from flashing every label, and a keyboard user has already committed to
    a control by focusing it. */
const HOVER_DELAY_MS = 600;

let seq = 0;
/** The open tooltip, if any. Two at once would put two `.editor-shell-tooltip`
    elements in the document, which is a strict-mode violation for every
    locator that names the class. */
let open: Tooltip | undefined;

export interface TooltipOptions {
  readonly trigger: HTMLElement;
  readonly text: string;
  /** The chord this control's action answers to, when it has one. Omitted —
   *  not `undefined` — by every caller with no chord, because
   *  `exactOptionalPropertyTypes` is on. */
  readonly shortcut?: string;
}

export interface Tooltip {
  /** Removes the popup and every listener this call added. */
  destroy(): void;
}

export function tooltip({ trigger, text, shortcut }: TooltipOptions): Tooltip {
  let popup: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (popup === undefined) return;
    popup.remove();
    popup = undefined;
    trigger.removeAttribute("aria-describedby");
    if (open === handle) open = undefined;
  };

  const show = (): void => {
    if (popup !== undefined) return;
    open?.destroy();
    const element = document.createElement("div");
    element.className = "editor-shell-tooltip";
    element.setAttribute("role", "tooltip");
    const label = document.createElement("span");
    label.textContent = text;
    element.append(label);
    // One owner for what a popup contains: the words, and the key that runs the
    // same thing. The chip is a `kbd` so a stylesheet can mark it without a
    // class of its own, and so its text is what a reader selecting the popup
    // copies — a chord is typed, not read.
    if (shortcut !== undefined) {
      const chip = document.createElement("kbd");
      chip.className = "editor-shell-tooltip-key";
      chip.textContent = shortcut;
      element.append(chip);
    }
    element.id = `vigilia-tooltip-${++seq}`;
    element.style.width = WIDTH;
    element.style.maxWidth = `${MAX_WIDTH}px`;
    document.body.append(element);
    popup = element;
    place(element, trigger);
    // The description is what reaches a screen reader on focus; the popup
    // alone is a visual affordance and the disclosure this control exists for
    // would be the mouse's alone without it.
    trigger.setAttribute("aria-describedby", element.id);
    open = handle;
  };

  const showOnHover = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(show, HOVER_DELAY_MS);
  };

  const onPointerDown = (event: Event): void => {
    if (event.target !== trigger) hide();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") hide();
  };

  trigger.addEventListener("pointerenter", showOnHover);
  trigger.addEventListener("pointerleave", hide);
  trigger.addEventListener("focus", show);
  trigger.addEventListener("blur", hide);
  trigger.addEventListener("keydown", onKeyDown);
  // Pressing anywhere else dismisses it. The inspector re-renders its whole
  // subtree on every selection change, and removing a focused element fires no
  // blur — without this a popup would be left stranded over the editor.
  document.addEventListener("pointerdown", onPointerDown);

  const handle: Tooltip = {
    destroy: (): void => {
      hide();
      trigger.removeEventListener("pointerenter", showOnHover);
      trigger.removeEventListener("pointerleave", hide);
      trigger.removeEventListener("focus", show);
      trigger.removeEventListener("blur", hide);
      trigger.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      if (open === handle) open = undefined;
    },
  };
  return handle;
}

/**
 * Above the trigger and horizontally centred on it, then pulled inside the
 * viewport. Measured after the popup is in the document, because its own width
 * is what the horizontal clamp needs and it has none until it is laid out —
 * which is why `show` sizes it independently of where it is put.
 */
function place(popup: HTMLElement, trigger: HTMLElement): void {
  const anchor = trigger.getBoundingClientRect();
  popup.style.position = "fixed";
  const box = popup.getBoundingClientRect();
  const half = box.width / 2 + EDGE_MARGIN;
  const centre = anchor.left + anchor.width / 2;
  const left = Math.min(
    Math.max(centre, half),
    Math.max(half, window.innerWidth - half),
  );
  const above = anchor.top - box.height - SIDE_OFFSET;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(above < EDGE_MARGIN ? anchor.bottom + SIDE_OFFSET : above)}px`;
}
