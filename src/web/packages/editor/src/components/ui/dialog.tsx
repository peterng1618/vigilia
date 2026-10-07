import * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as React from "react";

/** shadcn's Dialog, on Radix, hand-owned — the same trade `popover.tsx` records.
 *
 * §8 rules Radix the single primitive library; decision `0033` is why this plan
 * adds Dialog and not Tooltip. The overlay and the content are two portals,
 * styled by the shell's own classes, and `applyShellPalette` writes
 * `data-shell-palette` on `documentElement` precisely so a surface portalled to
 * `body` still recolours (`palette.ts:35-49`) — do not add an element parameter
 * there.
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="editor-shell-dialog-overlay" />
        <DialogPrimitive.Content className="editor-shell-dialog" aria-label={label}>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
