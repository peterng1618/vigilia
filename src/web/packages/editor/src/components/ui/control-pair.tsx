import type * as React from "react";
import { ControlNumber } from "./control-number.js";
import {
  ControlRow,
  type ControlDensity,
  useControlIds,
} from "./control-well.js";

/**
 * Two numbers sharing one row, each committing its own.
 *
 * The geometry lines are pairs — `X`/`Y` on one line, `W`/`H` on another, a
 * line's two ends — and a pair is a layout, not a control: it is two wells on
 * one line, which is what bible §5 already draws. `ControlPair` owns the row and
 * the row's label; each half is a `ControlNumber` in its `inline` form, so the
 * draft, the validation and the commit rule stay in the one control that owns
 * them rather than being re-derived here.
 *
 * **Each half writes only itself.** A pair that committed both would rewrite the
 * half the author never touched — and an object dragged to a fractional size
 * shows a rounded number in the field it did not edit, so writing the sibling
 * would quantise the dimension behind the author's back.
 *
 * The row carries `data-vigilia-pair` so a suite can read which two fields share
 * a line; the halves' own hooks stay on their inputs.
 */
export function ControlPair(props: {
  readonly label: string;
  readonly halves: readonly {
    readonly label: string;
    readonly value: number;
    readonly data?: Readonly<Record<`data-${string}`, string>>;
    readonly integer?: boolean;
    readonly onCommit: (value: number) => void;
  }[];
  readonly density?: ControlDensity;
}): React.JSX.Element {
  const { label, halves, density } = props;
  const ids = useControlIds(undefined);

  return (
    <div data-vigilia-pair="">
      <ControlRow ids={ids} label={label} density={density}>
        {halves.map((half) => (
          <ControlNumber
            key={half.label}
            inline
            label={half.label}
            value={half.value}
            {...(density === undefined ? {} : { density })}
            {...(half.data === undefined ? {} : { data: half.data })}
            {...(half.integer === undefined ? {} : { integer: half.integer })}
            onCommit={half.onCommit}
          />
        ))}
      </ControlRow>
    </div>
  );
}
