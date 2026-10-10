import { Radio } from "@base-ui/react/radio";
import type * as React from "react";
import {
  type ControlProps,
  describedBy,
  useControlIds,
} from "./control-well.js";

/**
 * One member of a closed set where every member has its own colour: a
 * `--radius-md` row at `--panel-2` carrying an adornment and a name, the chosen
 * one lifted to `--stage` behind an accent border (bible §5).
 *
 * It is a **radio**, and the group owns which one is checked: `Radio.Root`
 * derives `aria-checked` from the enclosing `RadioGroup`'s value, so a `checked`
 * prop here would be a second source of truth for one bit that could disagree
 * with the primitive's. The group is also where the keyboard model lives — one
 * Tab stop with arrow keys between the rows is `RadioGroup`'s roving focus, not
 * a `tabIndex` this control would have to keep in step.
 *
 * The adornment is the caller's `ReactNode` rather than a palette, the same way
 * `ControlSwatch` takes its swatch: what a swatch looks like is the vocabulary of
 * the surface that has one, and a control set that knew about palettes would be
 * a control set with a renderer in it.
 */
export function ControlChoiceRow(
  props: ControlProps & {
    readonly value: string;
    readonly swatch: React.ReactNode;
  },
): React.JSX.Element {
  const { label, id, disabled, refused, hint, data, value, swatch } = props;
  const ids = useControlIds(id);

  return (
    <>
      <Radio.Root
        {...data}
        nativeButton
        render={<button type="button" />}
        id={ids.control}
        value={value}
        aria-label={label}
        disabled={disabled}
        // A refusal blocks the choice without leaving the tab order, which §5.3
        // requires: a natively disabled radio is announced by nobody who is not
        // already holding a pointer.
        readOnly={refused !== undefined}
        aria-disabled={refused === undefined ? undefined : true}
        aria-describedby={describedBy(
          hint === undefined ? undefined : ids.hint,
          refused === undefined ? undefined : ids.reason,
        )}
        className="flex min-h-[32px] w-full items-center gap-[var(--space-8)] rounded-md border border-edge bg-panel-2 px-[var(--space-10)] py-[var(--space-6)] text-left text-xs text-muted hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 data-[checked]:border-accent data-[checked]:text-text data-[checked]:[background:var(--stage)]"
      >
        {swatch}
        {label}
      </Radio.Root>
      {/* The ids live in the row rather than in a `ControlRow`: a choice row is
          itself the whole row, so a label-and-control pair beside it would be a
          second thing to read. The description is the same description. */}
      {hint === undefined ? null : (
        <p id={ids.hint} className="sr-only">
          {hint}
        </p>
      )}
      {refused === undefined ? null : (
        <p id={ids.reason} className="text-xs text-muted">
          {refused}
        </p>
      )}
    </>
  );
}
