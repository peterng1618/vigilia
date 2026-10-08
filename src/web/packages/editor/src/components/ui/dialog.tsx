import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type * as React from "react";

/** shadcn's Dialog, hand-owned and reduced to what the one sheet needs.
 *
 * Decision `0038` rules Base UI the editor's one primitive library, and
 * decision `0033` is why this plan has a Dialog and not a Tooltip. The scrim
 * and the popup are portalled to `body` and styled by the shell's own classes,
 * and `applyShellPalette` writes `data-shell-palette` on `documentElement`
 * precisely so a surface portalled there still recolours (`palette.ts:35-49`)
 * — do not add an element parameter there.
 *
 * **No `Dialog.Title`.** The sheet labels itself by `aria-label`, and Base UI
 * leaves `aria-labelledby` off when no title is rendered, so the caller's label
 * stays the announced name; adding a title would silently replace it.
 */
export function Dialog({
  open,
  onOpenChange,
  label,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <DialogPrimitive.Root
      open={open}
      // Base UI passes its own event details as a second argument; the wrapper
      // declares one, so it drops them rather than leaking the library's shape.
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="editor-shell-dialog-overlay" />
        <DialogPrimitive.Popup
          className="editor-shell-dialog"
          aria-label={label}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
