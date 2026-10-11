import { RadioGroup } from "@base-ui/react/radio-group";
import { Tabs } from "@base-ui/react/tabs";
import { SUPPORTED_SCHEMA_VERSION } from "@vigilia/renderer-core";
import { Info, Keyboard, type LucideIcon, Palette } from "lucide-react";
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
 *  "which tabs there are": the column and the panels both read it, so a fourth
 *  tab cannot appear with a body and no word, or the reverse. */
type SettingsTab = "appearance" | "keyboard" | "about";

const SETTINGS_TABS: readonly SettingsTab[] = [
  "appearance",
  "keyboard",
  "about",
];

/** Each tab's glyph, from the one icon family the shell already draws with
 *  (bible §6: stroke-based, `currentColor`, on a 24px grid). The drawing's
 *  navigation column carries a glyph per row (`current/settings.html:26-37`);
 *  its three are a palette, a keyboard and an info mark, all of which the
 *  installed set has, so no glyph is invented and §6 needs no addition. The
 *  word stays beside the glyph, so the tab's accessible name is the label. */
const SETTINGS_TAB_GLYPHS: Readonly<Record<SettingsTab, LucideIcon>> = {
  appearance: Palette,
  keyboard: Keyboard,
  about: Info,
};

/** The id the palette group is named by, kept out of the shell's other ids. */
const PALETTE_GROUP_ID = "vigilia-settings-palette";

/** One fact the About tab renders, identified by the id it renders it under so
 *  a test reads the row by what it is rather than by its position. */
interface VersionFact {
  readonly id: "schema-version" | "release-version";
  /** The fact's own value: the schema version is a number
   *  (`SUPPORTED_SCHEMA_VERSION`), the release version a string. The tab
   *  stringifies where it renders. */
  readonly value: string | number;
}

/** The version facts this build can honestly read, in the order they render.
 *
 *  **Every value is traceable to an owner**, which is what keeps the tab from
 *  inventing one: the schema version is `SUPPORTED_SCHEMA_VERSION`, the fact a
 *  reader supporting an old package needs, and the release version is the open
 *  document's own `metadata.version` — the same fact the Document pane's
 *  `releaseVersion` row reads. A document that carries no release version (a new
 *  or unsaved theme, or one whose stored version is empty) contributes no row:
 *  Bible §9's missing reading is a gap stated by absence, never a placeholder
 *  that could read as data. */
export function versionFacts(
  releaseVersion: string | undefined,
): readonly VersionFact[] {
  const facts: VersionFact[] = [
    { id: "schema-version", value: SUPPORTED_SCHEMA_VERSION },
  ];
  if (releaseVersion !== undefined && releaseVersion !== "") {
    facts.push({ id: "release-version", value: releaseVersion });
  }
  return facts;
}

/** §7's Appearance tab: the six shell palettes, and follow-the-system.
 *
 *  The six are **cards in one radio group** rather than a `Segmented`, which
 *  bible §5 sizes at 2–4 labels: six lifted segments is a control the bible
 *  does not draw. The drawing gives the group §5 rule 7's grid
 *  (`current/settings.html:44-87`, `repeat(3,1fr)` of `--radius-lg` cards), so
 *  the columns are the drawing's; the group's own keyboard model still walks the
 *  six in reading order, and a narrower dialog changing the columns would not
 *  change the arrow keys.
 *
 *  The preview is the shell's, not the control set's: each bar carries the
 *  `data-shell-palette` of the palette it NAMES, which is what makes a bar paint
 *  its own palette rather than inherit the one in force (`0035`).
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
        className="mt-[var(--space-8)] grid grid-cols-3 gap-[var(--space-8)]"
      >
        {shellPalettes.map((entry) => (
          <ControlChoiceRow
            key={entry}
            shape="card"
            label={entry}
            value={entry}
            data={{ "data-vigilia-palette-choice": entry }}
            swatch={
              // Two bars, each resolving a role **of the palette this card
              // names** rather than of the one in force (`0035`): the ground
              // (§4's `--bg`, "the window behind everything") and the accent.
              // The attribute is on each bar and not on the wrapper — a bar
              // that inherited it would be repainted by the baseline
              // declaration `.editor-shell-palette-swatch` carries, which is
              // the defect `shell-appearance.spec.ts` exists for.
              <span className="flex gap-[var(--space-4)]" aria-hidden>
                <span
                  className="editor-shell-palette-swatch"
                  data-shell-palette={entry}
                />
                <span
                  className="editor-shell-palette-swatch-accent"
                  data-shell-palette={entry}
                />
              </span>
            }
          />
        ))}
      </RadioGroup>
      {/* The modal's own drawing makes this row a box rather than a labelled
          field row: `settings.html:89-93` draws the label at `flex:1` inside a
          `--panel-2` panel at `--radius-lg`, with no label column, so the
          switch's label fills the row and stays on one line. */}
      <div className="mt-[var(--space-14)]">
        <ControlToggle
          shape="boxed"
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

/** §7's About tab: what this editor is, and the version facts this build can
 *  honestly read.
 *
 *  It renders `versionFacts` and nothing else, so the one rule it could break —
 *  printing a version no owner has — is broken by `versionFacts` or not at all.
 *  The release version arrives as a prop because the fact is the shell's
 *  (`ThemeMetadata.version`), read once there and handed down: the tab reads no
 *  document, no store and no panel. Where a fact is absent the row is absent
 *  too — no `panels.notSet`, no dash that could read as a version (§9). */
function AboutTab({
  releaseVersion,
}: {
  readonly releaseVersion: string | undefined;
}): React.JSX.Element {
  return (
    <div
      className="editor-shell-about flex flex-col gap-[var(--space-8)]"
      data-vigilia-about=""
    >
      <p className="text-sm text-muted">{uiCopy.settings.aboutProvenance}</p>
      <dl>
        {versionFacts(releaseVersion).map((fact) => (
          <div key={fact.id}>
            <dt>
              {fact.id === "schema-version"
                ? uiCopy.settings.aboutSchemaVersion
                : uiCopy.panels.releaseVersion}
            </dt>
            <dd
              className="font-mono text-text"
              data-vigilia-about-fact={fact.id}
            >
              {String(fact.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
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
 *  Appearance, Keyboard and About are each filled here. The
 *  palette is the shell's own state rather than the tab's, because the shell
 *  holds the `watchSystemAppearance` subscription the choice has to reach: the
 *  tab renders the choice and owns none of it. The bindings are the shell's for
 *  the same reason — the dispatcher and the effective table live outside
 *  React — and which row is armed is the tab's state held here only so the
 *  close clears it; Escape closes the modal whatever the row is doing. */
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
  /** The open document's release version, read by the shell from the same
   *  `ThemeMetadata.version` the Document pane's `releaseVersion` row reads, or
   *  `undefined` where the document carries none. The About tab renders it and
   *  invents nothing in its place. */
  readonly releaseVersion: string | undefined;
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
    releaseVersion,
  } = props;
  /** The row whose capture is listening. Held here rather than in the tab so
   *  closing the modal clears it from one place — the `open` effect below — and
   *  no armed row can outlive the surface it belongs to. */
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

  /** Whether a capture is armed is the row's state, and it never stands between
   *  the author and the way out.
   *
   *  An earlier cut declined Base UI's dismissal for every `false` while armed,
   *  so a capture's Escape would cancel the row and leave the modal up. That
   *  bought one nicety — the tab staying where it was — at the price of the
   *  modal being unclosable whenever `armed` outlived its row: the arm's
   *  `focus()` failing is enough, and a pointer dismissal was declined with the
   *  Escape path because the library reports both as the same `false`. The
   *  dismissal is passed straight through now: Escape closes the modal, the
   *  `open` effect below clears `armed` with it, and the row's own Escape
   *  handler disarms in the same press for the case where it still has focus. */
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={uiCopy.settings.title}
      closeLabel={uiCopy.settings.close}
    >
      <h2 className="editor-shell-dialog-lead">{uiCopy.settings.title}</h2>
      {/* A **vertical** tablist: the drawing's navigation is a column beside the
          panel, not a row of words above it. §5 (`design-language.md:143`)
          opens the control vocabulary — "The vocabulary is closed. A control is
          one of these, or it is not a control." — and no *tab* is in it, so the
          bible requires nothing about the axis; spec §13 (`:451-454`) then makes
          the drawing the authority: "The mockup governs wherever the written
          rules are silent. Silence is not permission — it is the drawing's
          jurisdiction." The primitive stays Base UI's (`0038`) and only its
          orientation and treatment change; `orientation` is what points the
          arrow keys up and down the three rows rather than across. */}
      <Tabs.Root
        defaultValue="appearance"
        orientation="vertical"
        className="editor-shell-settings"
      >
        <Tabs.List className="editor-shell-settings-tabs">
          {SETTINGS_TABS.map((tab) => {
            const Glyph = SETTINGS_TAB_GLYPHS[tab];
            return (
              <Tabs.Tab
                key={tab}
                value={tab}
                className="editor-shell-settings-tab"
              >
                <Glyph aria-hidden size={14} strokeWidth={1.7} />
                {uiCopy.settings[tab]}
              </Tabs.Tab>
            );
          })}
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
            {tab === "about" ? (
              <AboutTab releaseVersion={releaseVersion} />
            ) : null}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </Dialog>
  );
}
