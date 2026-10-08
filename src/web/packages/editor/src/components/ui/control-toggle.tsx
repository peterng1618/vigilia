import { Switch } from "@base-ui/react/switch";
import type * as React from "react";
import {
  ControlRow,
  type ControlProps,
  isBlocked,
  useControlIds,
} from "./control-well.js";

/**
 * A boolean that applies immediately, as a 26×14 pill (bible §5).
 *
 * The primitive's `readOnly` is what a refusal uses: the switch stays in the
 * tab order, its reason stays readable, and the flip is refused at the source
 * rather than hidden behind a disabled attribute. `nativeButton` keeps the id
 * on the focus target, which is what the row's `<label for>` names.
 */
export function ControlToggle(
  props: ControlProps & {
    readonly checked: boolean;
    readonly onChange: (value: boolean) => void;
  },
): React.JSX.Element {
  const { label, id, disabled, refused, data, checked, onChange } = props;
  const ids = useControlIds(id);
  const blocked = isBlocked({ disabled, refused });

  return (
    <ControlRow
      ids={ids}
      label={label}
      labelFor={ids.control}
      refused={refused}
    >
      <Switch.Root
        {...data}
        nativeButton
        render={<button type="button" />}
        id={ids.control}
        checked={checked}
        readOnly={blocked}
        disabled={disabled}
        aria-disabled={refused === undefined ? undefined : true}
        aria-describedby={refused === undefined ? undefined : ids.reason}
        onCheckedChange={(next) => {
          if (blocked) return;
          onChange(next);
        }}
        className="flex h-[14px] w-[26px] flex-none items-center rounded-full border border-edge bg-panel-2 p-0 data-[checked]:border-accent data-[checked]:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        <Switch.Thumb className="block size-[10px] translate-x-[4px] rounded-full bg-muted transition-transform data-[checked]:translate-x-[10px] data-[checked]:bg-panel" />
      </Switch.Root>
    </ControlRow>
  );
}
