import type * as React from "react";
import { useId } from "react";

/**
 * What every control in the one control set carries.
 *
 * `refused` is a reason, not a flag: bible §5.3 keeps a capability the
 * selection cannot use visible, with its reason readable, and the control not
 * natively disabled — a disabled control leaves the tab order, so the reason
 * would reach nobody not holding a mouse. `data` belongs to the *focus target*,
 * never a wrapper, so a later plan can locate the control a person actually
 * operates.
 */
export type ControlProps = {
  readonly label: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly refused?: string;
  readonly density?: ControlDensity;
  readonly data?: Readonly<Record<`data-${string}`, string>>;
};

/**
 * Bible §3's row rhythm, as a typed choice rather than a number: a panel row is
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
 * `--radius-md` (bible §5). It carries no value and owns no focus — the input
 * inside it owns both — so the focus treatment is `focus-within`, and a
 * keyboard user gets the same accent boundary a mouse user does.
 *
 * The outline is a real `outline`, not only a ring: forced-colours mode
 * overrides author outline colours for you, and a box shadow disappears there.
 *
 * Hover raises the resting `--edge` to `--muted` (bible §5 rule 6). The well
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
 * Bible §5's target size, as a hit area that does not move the paint.
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
    <div className={wellClasses(props.density, props.blocked ?? false)}>
      {props.children}
    </div>
  );
}

/** The three ids one control needs. */
export type ControlIds = {
  readonly control: string;
  readonly label: string;
  readonly reason: string;
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
 * One control's row: its label, its control, and its refusal.
 *
 * The label is a `<label for>` where the control is a labelable element (an
 * input or a button) and a plain span where it is not — a composite whose parts
 * are named by their own text and whose group is named with `aria-labelledby`.
 * The refusal is rendered as words in the row rather than as a tooltip (§5.3),
 * and its `id` is what the control's `aria-describedby` points at.
 *
 * The control slot **takes the row's remaining width** and right-aligns what it
 * holds, rather than shrinking to its content. A content-sized slot is what a
 * `flex-1` child inside it resolves against: the slider's Root is `w-full` and
 * its track is the flexible child, so inside a shrink-to-fit slot the track
 * measured 0px wide and only the 36px well and the 10px thumb were drawn. Every
 * other control is content-sized and right-aligned either way, which is why the
 * row keeps its shape.
 */
export function ControlRow(props: {
  readonly ids: ControlIds;
  readonly label: string;
  readonly labelFor?: string | undefined;
  readonly refused?: string | undefined;
  readonly density?: ControlDensity | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const { ids, label, labelFor, refused, density = "panel", children } = props;
  const labelClasses = "text-xs text-muted";
  return (
    <div
      className={`flex ${ROW_MIN_HEIGHT[density]} flex-wrap items-center gap-x-[var(--space-8)] gap-y-[var(--space-4)]`}
    >
      {labelFor === undefined ? (
        <span id={ids.label} className={labelClasses}>
          {label}
        </span>
      ) : (
        <label id={ids.label} htmlFor={labelFor} className={labelClasses}>
          {label}
        </label>
      )}
      <div className="ml-auto flex flex-1 items-center justify-end gap-[var(--space-6)]">
        {children}
      </div>
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
