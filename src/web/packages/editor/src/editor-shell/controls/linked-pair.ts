import { numberInput } from "./number-field.js";

export interface LinkedPairField {
  readonly label: string;
  readonly value: number;
  readonly data: string;
  /** A dataset value, for a keyed selector like `data-vigilia-geometry="left"`.
      Absent means the bare attribute the panels already query. */
  readonly dataValue?: string;
}

export interface LinkedPairOptions {
  readonly rowLabel: string;
  readonly first: LinkedPairField;
  readonly second: LinkedPairField;
  /** Applied to both fields; a pair whose halves differ is not a pair. */
  readonly min?: number;
  readonly max?: number;
  readonly invalidMessage?: string;
  /** Runs when either half refuses an edit, for a caller that also reports it. */
  readonly onReject?: () => void;
  readonly onCommitFirst: (value: number) => void;
  readonly onCommitSecond: (value: number) => void;
}

export interface LinkedPair {
  readonly row: HTMLElement;
  readonly first: HTMLInputElement;
  readonly second: HTMLInputElement;
  setValues(first: number, second: number): void;
}

/** Two numeric fields sharing one row and one set of bounds, each committing
    its own value. A consumer that needs the sibling reads it from its own
    state — a pair that committed both would rewrite the half not edited.

    A flex line rather than a `.vigilia-field` grid: two labelled numeric boxes
    do not fit beside a 72px label column in a 280px panel. */
export function linkedPair(options: LinkedPairOptions): LinkedPair {
  const row = document.createElement("div");
  row.className = "vigilia-field-row";
  const rowLabel = document.createElement("span");
  rowLabel.className = "vigilia-pair-label";
  rowLabel.textContent = options.rowLabel;

  const bounds = {
    ...(options.min === undefined ? {} : { min: options.min }),
    ...(options.max === undefined ? {} : { max: options.max }),
    ...(options.invalidMessage === undefined
      ? {}
      : { invalidMessage: options.invalidMessage }),
    ...(options.onReject === undefined ? {} : { onReject: options.onReject }),
  };

  const first = numberInput({
    label: options.first.label,
    value: options.first.value,
    data: options.first.data,
    ...(options.first.dataValue === undefined
      ? {}
      : { dataValue: options.first.dataValue }),
    host: row,
    ...bounds,
    onCommit: options.onCommitFirst,
  });
  const second = numberInput({
    label: options.second.label,
    value: options.second.value,
    data: options.second.data,
    ...(options.second.dataValue === undefined
      ? {}
      : { dataValue: options.second.dataValue }),
    host: row,
    ...bounds,
    onCommit: options.onCommitSecond,
  });
  row.append(rowLabel, first.label, first.input, second.label, second.input);
  return {
    row,
    first: first.input,
    second: second.input,
    setValues(nextFirst, nextSecond) {
      first.setValue(nextFirst);
      second.setValue(nextSecond);
    },
  };
}
