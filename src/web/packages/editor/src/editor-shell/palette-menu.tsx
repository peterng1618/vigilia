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
  storage,
  palette,
  onChange,
}: {
  /** `undefined` where the browser refuses local storage; the palette then
   *  holds for the session rather than refusing to be chosen, so the write is
   *  skipped rather than attempted against a store that throws. */
  readonly storage: Storage | undefined;
  readonly palette: ShellPalette;
  readonly onChange: (next: ShellPalette) => void;
}): React.JSX.Element {
  const choose = (next: ShellPalette): void => {
    if (storage !== undefined) writeShellPalette(storage, next);
    applyShellPalette(next);
    onChange(next);
  };

  return (
    <Menu.Root>
      {/* Named for what it chooses, not for the value printed beside the chip:
          that value is a state, so a trigger left to announce its own content
          says "editorial, button" and nothing about what editorial is. The
          `: value` half is the `ViewSetting` idiom this shell already uses —
          a menu that shows what it is set to has to be able to say it. */}
      <Menu.Trigger
        className="editor-shell-palette"
        data-vigilia-palette=""
        aria-label={`${uiCopy.palette}: ${palette}`}
      >
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