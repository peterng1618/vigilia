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
  readonly onCommit: (first: number, second: number) => void;
}

export interface LinkedPair {
  readonly row: HTMLElement;
  readonly first: HTMLInputElement;
  readonly second: HTMLInputElement;
  setValues(first: number, second: number): void;
}

/** Two numbers that commit together — a consumer that resizes on either needs
    both, so an accepted edit carries the sibling's last accepted value too.

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

  let firstValue = options.first.value;
  let secondValue = options.second.value;
  const first = numberInput({
    label: options.first.label,
    value: firstValue,
    data: options.first.data,
    ...(options.first.dataValue === undefined
      ? {}
      : { dataValue: options.first.dataValue }),
    host: row,
    ...bounds,
    onCommit: (value) => {
      firstValue = value;
      options.onCommit(firstValue, secondValue);
    },
  });
  const second = numberInput({
    label: options.second.label,
    value: secondValue,
    data: options.second.data,
    ...(options.second.dataValue === undefined
      ? {}
      : { dataValue: options.second.dataValue }),
    host: row,
    ...bounds,
    // A refused edit never reaches a commit, so the sibling still carries the
    // last value it accepted.
    onCommit: (value) => {
      secondValue = value;
      options.onCommit(firstValue, secondValue);
    },
  });
  row.append(rowLabel, first.label, first.input, second.label, second.input);
  return {
    row,
    first: first.input,
    second: second.input,
    setValues(nextFirst, nextSecond) {
      firstValue = nextFirst;
      secondValue = nextSecond;
      first.setValue(nextFirst);
      second.setValue(nextSecond);
    },
  };
}
