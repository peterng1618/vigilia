import type * as React from "react";
import { useEffect, useId, useRef } from "react";
import { tooltip } from "../../editor-shell/controls/tooltip.js";

/**
 * What every control in the one control set carries.
 *
 * `refused` is a reason, not a flag: DESIGN.md §5.3 keeps a capability the
 * selection cannot use visible, with its reason readable, and the control not
 * natively disabled — a disabled control leaves the tab order, so the reason
 * would reach nobody not holding a mouse. `data` belongs to the *focus target*,
 * never a wrapper, so a later plan can locate the control a person actually
 * operates.
 *
 * `hint` is what the setting does, in the author's language. It is **not** a
 * refusal and not visible: the row's tooltip is the pointer's copy and the note
 * the control describes itself by is the screen reader's (§4's icon-only rule
 * makes a tooltip first-class; §5.3's never-in-a-tooltip rule is about a
 * refusal, which is words in the row instead). It renders here rather than at
 * the caller, because the id `aria-describedby` points at is minted inside the
 * control — a caller-side description would be an imperative DOM write, the
 * ADR-0039 violation this set exists to remove.
 */
export type ControlProps = {
  readonly label: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly refused?: string;
  readonly hint?: string;
  /**
   * An element outside this control that describes it — the pane's own standing
   * note, whose id the control cannot mint. `hint` is the description the row
   * already owns and is not visible, so a note the author reads on screen
   * reaches a screen reader only through this: the artboard's size note says
   * what a size change does, and the box that changes it has to be announced
   * with it. Joins `describedBy`'s reading order ahead of the row's own.
   */
  readonly describedById?: string;
  readonly density?: ControlDensity;
  readonly data?: Readonly<Record<`data-${string}`, string>>;
};

/**
 * DESIGN.md §3's row rhythm, as a typed choice rather than a number: a panel row is
 * 26px, a dialog row 30, a settings row 32. A named value rather than a free
 * `28` keeps the rhythm a design decision and the caller unable to go around it.
 * The literal classes are spelled out because Tailwind scans source text — a
 * template-built `h-[${n}px]` would never be compiled.
 */
export type ControlDensity = "panel" | "dialog" | "settings";

const WELL_HEIGHT: Readonly<Record<ControlDensity, string>> = {
  panel: "h-[26px]",
  dialog: "h-[30px]",
  settings: "h-[32px]",
};

const ROW_MIN_HEIGHT: Readonly<Record<ControlDensity, string>> = {
  panel: "min-h-[26px]",
  dialog: "min-h-[30px]",
  settings: "min-h-[32px]",
};

/**
 * A well is a surface, not a control: `--panel-2` fill, a 1px `--edge`, and
 * `--radius-md` (DESIGN.md §5). It carries no value and owns no focus — the input
 * inside it owns both — so the focus treatment is `focus-within`, and a
 * keyboard user gets the same accent boundary a mouse user does.
 *
 * The outline is a real `outline`, not only a ring: forced-colours mode
 * overrides author outline colours for you, and a box shadow disappears there.
 *
 * Hover raises the resting `--edge` to `--muted` (DESIGN.md §5 rule 6). The well
 * cannot know whether the control inside it is blocked, so the caller says so:
 * a refused row must not advertise a change it will not make, and `blocked`
 * drops the hover rather than leaving it to a `:has()` the caller cannot see.
 */
export function wellClasses(
  density: ControlDensity = "panel",
  blocked = false,
): string {
  const hover = blocked ? "" : "hover:border-muted ";
  return `flex ${WELL_HEIGHT[density]} items-center rounded-md border border-edge bg-panel-2 px-[var(--space-6)] ${hover}focus-within:outline focus-within:outline-2 focus-within:outline-accent focus-within:ring-3 focus-within:ring-accent/18`;
}

/**
 * DESIGN.md §5's target size, as a hit area that does not move the paint.
 *
 * A dense control's own box can be smaller than the 24×24 a target needs — the
 * toggle's pill is 26×14 and a segmented label is 22px tall — so the extra area
 * is carried by a centred `::before` rather than by the visible box, which
 * stays exactly what §5 draws. One rule and not a per-control guess, because
 * the requirement is one rule.
 *
 * **Buttons only.** A replaced element has no `::before`: an `<input>` cannot
 * be widened this way at all, so the fields take their target from the well
 * they fill (`h-full` inside a 26px well is 24px of input).
 */
export const hitTargetClasses =
  "relative before:absolute before:top-1/2 before:left-1/2 before:size-[24px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

export function ControlWell(props: {
  readonly density?: ControlDensity | undefined;
  readonly blocked?: boolean | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={`${wellClasses(props.density, props.blocked ?? false)} w-full`}
    >
      {props.children}
    </div>
  );
}

/** The ids one control needs. */
type ControlIds = {
  readonly control: string;
  readonly label: string;
  readonly reason: string;
  readonly hint: string;
};

/** Generated once from `useId` when the caller has not named the control
 *  itself. `useId`'s own separator is not safe to interpolate into a selector,
 *  so it is stripped. */
export function useControlIds(id: string | undefined): ControlIds {
  const generated = useId().replace(/[^\w-]/g, "");
  const control = id ?? `vigilia-control-${generated}`;
  return {
    control,
    label: `${control}-label`,
    reason: `${control}-reason`,
    hint: `${control}-hint`,
  };
}

/** Whether a control must refuse mutation. Both refusals block the same
 *  paths; they differ only in how they are announced. */
export function isBlocked(props: {
  readonly refused?: string | undefined;
  readonly disabled?: boolean | undefined;
}): boolean {
  return props.disabled === true || props.refused !== undefined;
}

/**
 * The shapes a drawing gives a row. The labelled **field row** is the default,
 * and the two the drawings draw differently take their own.
 *
 * - `column` — a fixed label column and one value cell: what
 *   `mockups/current/controls.html` declares for every field row, and what
 *   `mockups/current/shell.html:227` and its eleven siblings declare in the
 *   panes and the inspector (`width:74px;flex:0 0 auto` beside `flex:1`).
 * - `boxed` — the row *is* a panel box with the label filling it:
 *   `mockups/current/settings.html:89-93` draws the follow-the-system switch as
 *   `--panel-2` inside a 1px `--edge` at `--radius-lg`, the label at `flex:1`
 *   and the switch at the right, with no label column at all. A surface whose
 *   drawing draws that owns it — the settings modal — and the inspector's own
 *   switch row (`shell.html:333`) is a `column` row, which is why this is a
 *   choice of the caller rather than a property of the toggle.
 * - `headed` — the label is the region's own heading, drawn above a control that
 *   spans the row: `shell.html:128-132` draws the Add pane's asset picker under
 *   an `Asset` eyebrow, the trigger spanning the pane with the file name at
 *   `flex:1`. Not a labelled row, and the heading is what names the control.
 *
 * What each shape's classes declare is not free: the drawing's `border-radius`
 * *and* its `gap` are compared to the product by the fixture's `PARITY` rows
 * (`tests/e2e/mockup-values.ts`), and read out of the drawing by their own test.
 */
export type ControlShape = "column" | "boxed" | "headed";

/**
 * One control's row: its label, its control, its refusal, and its hint.
 *
 * The label is a `<label for>` where the control is a labelable element (an
 * input or a button) and a plain span where it is not — a composite whose parts
 * are named by their own text and whose group is named with `aria-labelledby`.
 * The refusal is rendered as words in the row rather than as a tooltip (§5.3),
 * and its `id` is what the control's `aria-describedby` points at.
 *
 * The hint reaches the author two ways, neither of them a line of text under
 * every field: a note the control describes itself by, hidden from the eye, and
 * the row's tooltip — the pointer's copy of the same words (§4). The tooltip is
 * `tooltip()`'s, the one owner of what a tooltip is, armed and torn down with
 * the row exactly as `ControlIconButton` arms its own. It carries the refusal
 * when there is one, so a row that both refuses and explains says why first.
 *
 * With `shape` at its default, the control slot is the row's **one value
 * track**. It is a fixed-width label column and a flexible cell, which is what
 * the drawing declares (`mockups/current/controls.html`): the label is
 * `width:74px;flex:0 0 auto`, the value is `flex:1`. The cell is the geometry
 * and each control fills it — `ControlWell` is `w-full`, the select's trigger
 * and the slider's root already were, and a segmented group fills it too.
 * Fixing the slot rather than giving each kind its own width is the difference
 * between one track and four: with a content-sized slot a number well was as
 * wide as its `<input>` while a select filled the slot, so the boxes in one
 * section started at four different left edges (`vg-297`).
 *
 * The cell still right-aligns what does not fill it — a 26×14 toggle is a fixed
 * pill by §5 and sits at the right edge, as the drawing draws it.
 *
 * The column is the **default shape, not the only one**. A drawing that shapes a
 * row differently is drawn differently here (`ControlShape`), because applying
 * one surface's column to another surface's row is what wrapped the settings
 * modal's switch label and ellipsised the Add pane's file name (`vg-302`).
 */
export function ControlRow(props: {
  readonly ids: ControlIds;
  readonly label: string;
  readonly labelFor?: string | undefined;
  readonly refused?: string | undefined;
  readonly hint?: string | undefined;
  readonly density?: ControlDensity | undefined;
  readonly shape?: ControlShape | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const {
    ids,
    label,
    labelFor,
    refused,
    hint,
    density = "panel",
    shape = "column",
    children,
  } = props;
  // Every column breaks rather than widening: §7.7 lets a long name ellipsize or
  // wrap, never widen a pane or cover its own control. The `boxed` label already
  // fills its row, so its width is the row's rather than a declared 74px.
  const labelClasses = {
    column: "w-[74px] flex-none break-words text-xs text-muted",
    boxed: "min-w-0 flex-1 break-words text-xs text-muted",
    headed:
      "mb-[var(--space-8)] block w-full text-2xs font-semibold tracking-[0.11em] text-muted uppercase",
  }[shape];
  const rowClasses = {
    column: `flex ${ROW_MIN_HEIGHT[density]} flex-wrap items-center gap-x-[var(--space-8)] gap-y-[var(--space-4)]`,
    // The box the drawing draws, and the row is it rather than a wrapper around
    // it: `--panel-2` inside a 1px `--edge` at `--radius-lg`.
    boxed:
      "flex items-center gap-[var(--space-10)] rounded-lg border border-edge bg-panel-2 px-[var(--space-10)] py-[var(--space-8)]",
    headed: "flex flex-col",
  }[shape];
  const cellClasses = {
    column: "flex min-w-0 flex-1 items-center justify-end gap-[var(--space-6)]",
    boxed: "flex flex-none items-center gap-[var(--space-6)]",
    headed: "flex min-w-0 items-center gap-[var(--space-6)]",
  }[shape];
  const row = useRef<HTMLDivElement>(null);
  const tip = hint === undefined ? undefined : (refused ?? hint);

  useEffect(() => {
    const element = row.current;
    if (element === null || tip === undefined) return;
    return tooltip({ trigger: element, text: tip }).destroy;
  }, [tip]);

  return (
    <div ref={row} className={rowClasses}>
      {labelFor === undefined ? (
        <span id={ids.label} className={labelClasses}>
          {label}
        </span>
      ) : (
        <label id={ids.label} htmlFor={labelFor} className={labelClasses}>
          {label}
        </label>
      )}
      <div className={cellClasses}>{children}</div>
      {hint === undefined ? null : (
        <p id={ids.hint} className="sr-only">
          {hint}
        </p>
      )}
      {refused === undefined ? null : (
        <p id={ids.reason} className="w-full text-xs text-muted">
          {refused}
        </p>
      )}
    </div>
  );
}

/** The ids a control's `aria-describedby` points at, in reading order. */
export function describedBy(
  ...ids: readonly (string | undefined)[]
): string | undefined {
  const present = ids.filter((id): id is string => id !== undefined);
  return present.length === 0 ? undefined : present.join(" ");
}
