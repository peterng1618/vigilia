import { uiCopy } from "../../ui-copy.js";

export interface NumberFieldOptions {
  readonly label: string;
  readonly value: number;
  readonly data: string;
  /** A dataset value, for a keyed selector like `data-vigilia-geometry="left"`.
      Absent means the bare attribute the panels already query. */
  readonly dataValue?: string;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly invalidMessage?: string;
  /** Runs when an edit is refused, for a caller that also reports it elsewhere. */
  readonly onReject?: () => void;
  readonly onCommit: (value: number) => void;
}

export interface NumberField {
  readonly row: HTMLElement;
  readonly input: HTMLInputElement;
  setValue(value: number): void;
  /** Refuses an edit the field itself accepted, for a caller that only finds
      out afterwards — a bound the primitive does not know. `restoreTo` is the
      value the caller knows to be authoritative; without it the last value this
      field accepted is used. Same alert line, same rollback, so one field never
      has two kinds of invalid-input feedback. */
  refuse(restoreTo?: number): void;
}

/** The bare input, its label and its error line. `host` is the row the error
    line is appended to: only the row factory knows how the row is laid out. */
interface NumberInputOptions extends NumberFieldOptions {
  readonly host: HTMLElement;
}

interface NumberInput {
  readonly label: HTMLLabelElement;
  readonly input: HTMLInputElement;
  setValue(value: number): void;
  refuse(): void;
}

let fieldSeq = 0;

export function numberField(options: NumberFieldOptions): NumberField {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const field = numberInput({ ...options, host: row });
  row.append(field.label, field.input);
  return {
    row,
    input: field.input,
    setValue: field.setValue,
    refuse: field.refuse,
  };
}

/** Validated numeric input: it parses, refuses out-of-range values instead of
    clamping them, and owns the rejected-edit rollback by restoring the last
    value it accepted. `numberField` wraps it in a labelled row; `linkedPair`
    uses two of them on one line, so the caller passes the row the error line
    belongs to. */
export function numberInput(options: NumberInputOptions): NumberInput {
  let last = options.value;
  const invalidMessage = options.invalidMessage ?? uiCopy.panels.invalidNumber;
  const label = document.createElement("label");
  label.textContent = options.label;
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(options.step ?? 1);
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  input.className = "vigilia-numeric";
  input.dataset[options.data] = options.dataValue ?? "";
  label.htmlFor = input.id = `vigilia-number-${++fieldSeq}`;
  input.value = String(last);
  const alert = document.createElement("p");
  alert.setAttribute("role", "alert");
  alert.textContent = invalidMessage;

  const accepted = (value: number): boolean =>
    Number.isInteger(value) &&
    (options.min === undefined || value >= options.min) &&
    (options.max === undefined || value <= options.max);

  const setValue = (value: number): void => {
    last = value;
    input.value = String(value);
  };

  // `change`, never per keystroke: a half-typed `1` of `1000` is not an edit.
  const refuse = (restoreTo = last): void => {
    last = restoreTo;
    input.value = String(restoreTo);
    if (alert.parentElement === null) options.host.append(alert);
    options.onReject?.();
  };

  input.addEventListener("change", () => {
    // `Number("")` is 0, so an empty field is refused rather than coerced.
    const raw = input.value.trim();
    const next = raw === "" ? Number.NaN : Number(raw);
    if (!accepted(next)) {
      refuse();
      return;
    }
    last = next;
    alert.remove();
    options.onCommit(next);
  });

  return { label, input, setValue, refuse };
}
