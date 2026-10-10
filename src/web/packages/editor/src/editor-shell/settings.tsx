import { RadioGroup } from "@base-ui/react/radio-group";
import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef, useState } from "react";
import { ControlChoiceRow } from "../components/ui/control-choice-row.js";
import { ControlToggle } from "../components/ui/control-toggle.js";
import { Dialog } from "../components/ui/dialog.js";
import type { ShortcutOverrides } from "../shortcut-manager/bindings.js";
import type { ProductShortcutId } from "../shortcut-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import {
  applyShellPalette,
  clearShellChoice,
  prefersDarkAppearance,
  type ShellPalette,
  shellPalettes,
  systemShellPalette,
  writeShellChoice,
} from "./palette.js";
import { SETTINGS_TRIGGER_ID } from "./rail.js";
import { SettingsKeyboard } from "./settings-keyboard.js";

/** §7's three tabs, in the order the spec's table names them. One owner of
 *  "which tabs there are": the strip and the panels both read it, so a fourth
 *  tab cannot appear with a body and no word, or the reverse. */
export type SettingsTab = "appearance" | "keyboard" | "about";

const SETTINGS_TABS: readonly SettingsTab[] = [
  "appearance",
  "keyboard",
  "about",
];

/** The id the palette group is named by, kept out of the shell's other ids. */
const PALETTE_GROUP_ID = "vigilia-settings-palette";

/** §7's Appearance tab: the six shell palettes, and follow-the-system.
 *
 *  The six are **choice rows in one radio group** rather than a `Segmented`,
 *  which bible §5 sizes at 2–4 labels: six lifted segments is a control the
 *  bible does not draw. A grid is layout, and the group's own keyboard model
 *  still walks the rows in reading order, so a narrower dialog changes the
 *  columns and not the arrow keys.
 *
 *  The swatch is the shell's, not the control set's: it carries the
 *  `data-shell-palette` of the palette it NAMES, which is what makes a chip
 *  repaint as its own palette rather than inherit the one in force (`0035`).
 *  `ControlChoiceRow` takes it as a node for exactly that reason.
 *
 *  The write is here, in the tab, exactly where the header menu that this
 *  replaces made it: `palette.ts` is the mechanism's owner and the shell owns
 *  the OS subscription, but "this click is a choice" is the surface's, and a
 *  shell that had to hold a second copy of it could drift from this one. */
function AppearanceTab({
  storage,
  palette,
  following,
  onPalette,
  onFollowing,
}: {
  /** `undefined` where the browser refuses local storage; the choice then holds
   *  for the session rather than refusing to be made. */
  readonly storage: Storage | undefined;
  readonly palette: ShellPalette;
  readonly following: boolean;
  readonly onPalette: (next: ShellPalette) => void;
  readonly onFollowing: (next: boolean) => void;
}): React.JSX.Element {
  /** The three steps the choice has always taken, in the order `0035` settled:
   *  storage first (it is what stops the OS having a vote), then the attribute
   *  every palette block and every portalled surface reads, then the shell's
   *  live state. `applyShellPalette` is deliberately not optional — a palette
   *  applied to React state alone leaves a portalled popup painting the old one,
   *  which is the defect `0035` closed. */
  const choose = (next: ShellPalette): void => {
    if (storage !== undefined) writeShellChoice(storage, next);
    applyShellPalette(next);
    onPalette(next);
    onFollowing(false);
  };

  /** Both directions. Turning following on deletes the stored choice — that
   *  key's absence is what "no choice" means to `readShellChoice` — and
   *  resolves the OS at once, so nothing waits for a media query to change.
   *  Turning it off pins what is already resolved: the author keeps the palette
   *  they were looking at rather than the shell jumping to the default. */
  const follow = (next: boolean): void => {
    onFollowing(next);
    if (next) {
      if (storage !== undefined) clearShellChoice(storage);
      const resolved = systemShellPalette(prefersDarkAppearance());
      applyShellPalette(resolved);
      onPalette(resolved);
      return;
    }
    if (storage !== undefined) writeShellChoice(storage, palette);
  };

  return (
    <>
      <h3 id={PALETTE_GROUP_ID}>{uiCopy.settings.palette}</h3>
      {/* `value`/`onValueChange` rather than a `checked` per row: the group is
          the one owner of which palette is in force, so the six rows cannot
          disagree with each other or with the shell's own state. */}
      <RadioGroup
        value={palette}
        onValueChange={choose}
        aria-labelledby={PALETTE_GROUP_ID}
        className="mt-[var(--space-8)] grid grid-cols-2 gap-[var(--space-6)]"
      >
        {shellPalettes.map((entry) => (
          <ControlChoiceRow
            key={entry}
            label={entry}
            value={entry}
            data={{ "data-vigilia-palette-choice": entry }}
            swatch={
              <span
                className="editor-shell-palette-swatch"
                data-shell-palette={entry}
                aria-hidden
              />
            }
          />
        ))}
      </RadioGroup>
      <div className="mt-[var(--space-14)]">
        <ControlToggle
          label={uiCopy.settings.followSystem}
          checked={following}
          hint={
            storage === undefined
              ? uiCopy.settings.followSystemSessionOnly
              : uiCopy.settings.followSystemHint
          }
          data={{ "data-vigilia-follow-system": "" }}
          onChange={follow}
        />
      </div>
    </>
  );
}

/** The settings modal the rail's gear opens.
 *
 *  Base UI's `Dialog` is modal by default, so focus is trapped and the page
 *  behind is inert; `Esc` closes it through `onOpenChange`. The one thing the
 *  library does not do for a dialog opened from outside its own tree is return
 *  focus to the gear — there is no `Dialog.Trigger` to register — so the close
 *  restores it from the gear's id. The tabs are `@base-ui/react/tabs` rather
 *  than a hand-rolled `role="tablist"`, because the arrow-key navigation and
 *  the `aria-selected`/`aria-controls` wiring are the primitive's job (0038).
 *
 *  Appearance and Keyboard are filled here; About is plan 5's later task. The
 *  palette is the shell's own state rather than the tab's, because the shell
 *  holds the `watchSystemAppearance` subscription the choice has to reach: the
 *  tab renders the choice and owns none of it. The bindings are the shell's for
 *  the same reason — the dispatcher and the effective table live outside
 *  React — and the one press two surfaces answer to (Escape) is coordinated
 *  here, where the dialog's own dismissal arrives. */
export function Settings(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Passed straight through to the tabs, which own nothing of their own. */
  readonly storage: Storage | undefined;
  readonly palette: ShellPalette;
  readonly following: boolean;
  readonly onPalette: (next: ShellPalette) => void;
  readonly onFollowing: (next: boolean) => void;
  /** The author's bindings, held by the shell because the effective table and
   *  the dispatcher live outside React. The tab reads them and asks for a new
   *  set; it writes storage itself, as the Appearance tab does. */
  readonly overrides: ShortcutOverrides;
  readonly onOverrides: (next: ShortcutOverrides) => void;
}): React.JSX.Element {
  const {
    open,
    onOpenChange,
    storage,
    palette,
    following,
    onPalette,
    onFollowing,
    overrides,
    onOverrides,
  } = props;
  /** The row whose capture is listening. Held here rather than in the tab
   *  because Escape is the one press two surfaces answer to, and this is where
   *  the dialog's own dismissal arrives. */
  const [armed, setArmed] = useState<ProductShortcutId | undefined>(undefined);
  // Whether the modal has been open at all, so closing the *initial* closed
  // state does not fire a focus restore on mount.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    setArmed(undefined);
    if (!wasOpen.current) return;
    wasOpen.current = false;
    document.getElementById(SETTINGS_TRIGGER_ID)?.focus();
  }, [open]);

  /** While a capture is armed, Escape belongs to the capture.
   *
   *  Base UI binds its own dismissal on `document` in the capture phase, which
   *  no row can out-bubble, so this is where the two are reconciled: the
   *  library still asks, and the ask is declined rather than fought with a
   *  second document listener. The row's own handler has cancelled the capture
   *  in the same press, so the next Escape closes the modal. */
  const handleOpenChange = (next: boolean): void => {
    if (!next && armed !== undefined) return;
    onOpenChange(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label={uiCopy.settings.title}
      closeLabel={uiCopy.settings.close}
    >
      <h2 className="editor-shell-dialog-lead">{uiCopy.settings.title}</h2>
      <Tabs.Root defaultValue="appearance" className="editor-shell-settings">
        <Tabs.List className="editor-shell-settings-tabs">
          {SETTINGS_TABS.map((tab) => (
            <Tabs.Tab
              key={tab}
              value={tab}
              className="editor-shell-settings-tab"
            >
              {uiCopy.settings[tab]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {SETTINGS_TABS.map((tab) => (
          <Tabs.Panel
            key={tab}
            value={tab}
            className="editor-shell-settings-panel"
          >
            {tab === "appearance" ? (
              <AppearanceTab
                storage={storage}
                palette={palette}
                following={following}
                onPalette={onPalette}
                onFollowing={onFollowing}
              />
            ) : null}
            {tab === "keyboard" ? (
              <SettingsKeyboard
                storage={storage}
                overrides={overrides}
                armed={armed}
                onArmed={setArmed}
                onOverrides={onOverrides}
              />
            ) : null}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </Dialog>
  );
}
