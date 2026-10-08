import { Select } from "@base-ui/react/select";
import type * as React from "react";
import {
  ControlRow,
  type ControlProps,
  isBlocked,
  useControlIds,
  wellClasses,
} from "./control-well.js";

/** One entry in a well that opens a list. */
export type ControlOption = { readonly id: string; readonly name: string };

/**
 * A value from a closed list, in a well with a chevron.
 *
 * Base UI's Select is the keyboard model and the popup; what this adds is the
 * bible's treatment and its refusal rule. A refused select uses the primitive's
 * `readOnly` rather than `disabled`: §5.3 wants the row present, the reason
 * readable and the tab order unchanged, and browsing a list you cannot choose
 * from is exactly what `readOnly` means here. `aria-disabled` is announced as
 * well, because the reason is a refusal and not an alternative meaning.
 */
export function ControlSelect(
  props: ControlProps & {
    readonly value: string;
    readonly options: readonly ControlOption[];
    readonly onChange: (id: string) => void;
  },
): React.JSX.Element {
  return <SelectControl {...props} />;
}

/**
 * The shared body of the select: one keyboard model, one popup, one refusal
 * rule, and one optional adornment in front of the value. `ControlSwatch` is
 * its only composition.
 */
export function SelectControl(
  props: ControlProps & {
    readonly value: string;
    readonly options: readonly ControlOption[];
    readonly onChange: (id: string) => void;
    readonly adornment?: React.ReactNode;
  },
): React.JSX.Element {
  const {
    label,
    id,
    disabled,
    refused,
    density,
    data,
    value,
    options,
    onChange,
    adornment,
  } = props;
  const ids = useControlIds(id);
  const blocked = isBlocked({ disabled, refused });

  return (
    <ControlRow
      ids={ids}
      label={label}
      labelFor={ids.control}
      refused={refused}
      density={density}
    >
      <Select.Root
        items={options.map((option) => ({
          value: option.id,
          label: option.name,
        }))}
        value={value}
        readOnly={blocked}
        onValueChange={(next) => {
          if (blocked || next === null) return;
          onChange(next);
        }}
      >
        <Select.Trigger
          {...data}
          id={ids.control}
          disabled={disabled}
          aria-disabled={refused === undefined ? undefined : true}
          aria-describedby={refused === undefined ? undefined : ids.reason}
          className={`${wellClasses(density, blocked)} w-full justify-between gap-[var(--space-6)] text-sm text-text`}
        >
          {adornment === undefined ? null : (
            <span aria-hidden className="flex flex-none items-center">
              {adornment}
            </span>
          )}
          <Select.Value className="flex-1 truncate text-left font-mono" />
          <Select.Icon aria-hidden className="flex-none text-2xs text-faint">
            ▼
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} className="z-60">
            <Select.Popup className="min-w-[10rem] rounded-md border border-edge bg-panel p-[var(--space-6)] text-sm text-text shadow-[var(--elev-2)]">
              {options.map((option) => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  className="cursor-default rounded-sm px-[var(--space-8)] py-[var(--space-4)] data-[highlighted]:bg-panel-2"
                >
                  <Select.ItemText>{option.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </ControlRow>
  );
}
