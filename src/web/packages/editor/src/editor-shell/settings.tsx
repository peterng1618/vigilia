import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef } from "react";
import { Dialog } from "../components/ui/dialog.js";
import { uiCopy } from "../ui-copy.js";
import { SETTINGS_TRIGGER_ID } from "./rail.js";

/** §7's three tabs, in the order the spec's table names them. One owner of
 *  "which tabs there are": the strip and the panels both read it, so a fourth
 *  tab cannot appear with a body and no word, or the reverse. */
export type SettingsTab = "appearance" | "keyboard" | "about";

const SETTINGS_TABS: readonly SettingsTab[] = [
  "appearance",
  "keyboard",
  "about",
];

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
 *  The tab bodies are empty here: plan 5's later tasks fill Appearance,
 *  Keyboard and About. `storage` is the browser-local store those tabs write
 *  through — the same one the palette uses — threaded now so the modal's
 *  signature does not change under its callers when the bodies land. */
export function Settings(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Passed straight through to the tabs, which own nothing of their own. */
  readonly storage: Storage | undefined;
}): React.JSX.Element {
  const { open, onOpenChange } = props;
  // Whether the modal has been open at all, so closing the *initial* closed
  // state does not fire a focus restore on mount.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    document.getElementById(SETTINGS_TRIGGER_ID)?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
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
          />
        ))}
      </Tabs.Root>
    </Dialog>
  );
}
