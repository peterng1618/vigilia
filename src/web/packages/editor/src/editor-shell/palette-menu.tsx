import { Menu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import { uiCopy } from "../ui-copy.js";
import {
  applyShellPalette,
  type ShellPalette,
  shellPalettes,
  writeShellPalette,
} from "./palette.js";

/** A chip painted from the palette's own tokens rather than from a colour
 *  table here: `data-shell-palette` is the selector every palette block is
 *  written against, so the chip repaints with the palette it names. Reading
 *  `--shell-*` in JS at mount is what would leave it stale after a change.
 *
 *  `aria-hidden` because the name beside it is the accessible name. */
function Swatch({ palette }: { readonly palette: ShellPalette }): React.JSX.Element {
  return (
    <span
      className="editor-shell-palette-swatch"
      data-shell-palette={palette}
      aria-hidden
    />
  );
}

/** The shell palette, in the header.
 *
 *  Same list, same two owners, same browser-local storage as the Settings
 *  pane's `<select>` this replaces — only where it lives has changed. The
 *  trigger names the current value and the popup lists every one, which is
 *  the idiom the View settings already use in this shell.
 */
export function PaletteMenu({
  root,
  storage,
  palette,
  onChange,
}: {
  /** The element carrying `data-shell-palette`, so the change repaints. */
  readonly root: HTMLElement;
  /** `undefined` where the browser refuses local storage; the palette then
   *  holds for the session rather than refusing to be chosen. */
  readonly storage: Storage | undefined;
  readonly palette: ShellPalette;
  readonly onChange: (next: ShellPalette) => void;
}): React.JSX.Element {
  const choose = (next: ShellPalette): void => {
    writeShellPalette(storage ?? window.localStorage, next);
    applyShellPalette(root, next);
    onChange(next);
  };

  return (
    <Menu.Root>
      <Menu.Trigger className="editor-shell-palette" data-vigilia-palette="">
        <Swatch palette={palette} />
        {palette}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="editor-shell-positioner">
          <Menu.Popup className="editor-shell-menu-popup" aria-label={uiCopy.palette}>
            <Menu.RadioGroup value={palette} onValueChange={choose}>
              {shellPalettes.map((entry) => (
                <Menu.RadioItem
                  key={entry}
                  value={entry}
                  aria-label={entry}
                  className="editor-shell-palette-item"
                >
                  <Menu.RadioItemIndicator
                    keepMounted
                    className="editor-shell-menu-check"
                  >
                    <Check aria-hidden size={12} strokeWidth={2.5} />
                  </Menu.RadioItemIndicator>
                  <Swatch palette={entry} />
                  {entry}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}