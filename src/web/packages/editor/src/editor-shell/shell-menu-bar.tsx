import { Menu } from "@base-ui/react/menu";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_RUN_DISPLAY_MODE,
  type RunDisplayMode,
} from "../run-placeholder.js";
import {
  activeShortcuts,
  subscribeShortcuts,
} from "../shortcut-manager/bindings.js";
import {
  shortcutLabel,
  shortcutSpokenLabel,
} from "../shortcut-manager/display.js";
import type { ProductShortcutId } from "../shortcut-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import { CHECK_GLYPH, Glyph } from "./icons.js";
import type {
  EditorActionFacade,
  EditorViewControls,
} from "./session-facade.js";
import { type SelectionStore, useSelection } from "./shell-stores.js";

function MenuGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <Menu.Root>
      <Menu.Trigger>{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="editor-shell-positioner">
          <Menu.Popup className="editor-shell-menu-popup">
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The tick a checked radio choice carries, reserving its width whether or not
 *  it is showing so the labels either side of it do not shift as the setting
 *  changes. */
const checkSlot = (state: {
  readonly checked: boolean;
}): React.CSSProperties => ({
  display: "inline-block",
  width: 13,
  visibility: state.checked ? "visible" : "hidden",
});

/** One View setting as a submenu of its own values.
 *
 *  These were three items that flipped a boolean on click, which read as
 *  settings and behaved as switches: nothing on screen said the other value
 *  existed, `Chart refresh` moved 30 FPS to 1 FPS on one mis-click with nothing
 *  to explain the preview that then looked hung, and no `aria-checked` meant a
 *  screen reader heard a plain menu item and never which state was current.
 *  The zoom badge beside them is the idiom already in this shell — a trigger
 *  naming the current value, a popup listing every one — and the trigger's
 *  `aria-haspopup` is what now distinguishes the two.
 *
 *  The choices stay open after one is picked, so the tick can be seen moving and
 *  the other value is still one gesture away rather than a reopen.
 */
function ViewSetting<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly (readonly [T, string])[];
  readonly onChange: (next: T) => void;
}): React.JSX.Element {
  const current = options.find(([id]) => id === value)?.[1] ?? "";
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger>{`${label}: ${current}`}</Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner className="editor-shell-positioner">
          <Menu.Popup className="editor-shell-menu-popup">
            <Menu.RadioGroup value={value} onValueChange={onChange}>
              {options.map(([id, text]) => (
                <Menu.RadioItem key={id} value={id}>
                  <Menu.RadioItemIndicator keepMounted style={checkSlot}>
                    <Glyph icon={CHECK_GLYPH} size={12} />
                  </Menu.RadioItemIndicator>
                  {text}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}

/** The Edit menu's rows, in order — the one owner of what that menu draws.
 *  `uiCopy.actions` carries fourteen keys and only these six are Edit rows, so
 *  unlike File and View the list cannot be an `Object.values` of the table.
 *  `ShellMenuBar` maps over this to render them and `ui-copy.test.ts`'s
 *  sentence-case case reads the same const, so a row added to the menu enters
 *  §9's net instead of escaping it silently. */
export const EDIT_MENU_ROWS: readonly {
  readonly label: string;
  readonly shortcut: ProductShortcutId;
  readonly run: (session: EditorActionFacade | undefined) => void;
}[] = [
  { label: uiCopy.actions.undo, shortcut: "edit.undo", run: (s) => s?.undo() },
  { label: uiCopy.actions.redo, shortcut: "edit.redo", run: (s) => s?.redo() },
  { label: uiCopy.actions.copy, shortcut: "edit.copy", run: (s) => s?.copy() },
  { label: uiCopy.actions.cut, shortcut: "edit.cut", run: (s) => s?.cut() },
  {
    label: uiCopy.actions.duplicate,
    shortcut: "edit.duplicate",
    run: (s) => s?.duplicate(),
  },
  {
    label: uiCopy.actions.delete,
    shortcut: "edit.delete",
    run: (s) => s?.deleteActive(),
  },
];

export function ShellMenuBar({
  store,
  getView,
}: {
  readonly store: SelectionStore;
  readonly getView: () => EditorViewControls | undefined;
}): React.JSX.Element {
  const selection = useSelection(store);
  // Subscribed, so a rebind redraws every chord these rows print rather than
  // leaving a mark that runs a different action.
  useSyncExternalStore(subscribeShortcuts, activeShortcuts, activeShortcuts);
  const kind = selection.activeKind;
  const session = store.bridge?.session;
  const [source, setSource] = useState<"preview" | "live">("preview");
  const [rate, setRate] = useState<1 | 30>(30);
  const [runDisplay, setRunDisplay] = useState<RunDisplayMode>(
    DEFAULT_RUN_DISPLAY_MODE,
  );

  useEffect(() => {
    setSource(getView()?.sourceMode() ?? "preview");
    setRate(getView()?.chartRefreshRate() ?? 30);
    setRunDisplay(getView()?.runDisplay() ?? DEFAULT_RUN_DISPLAY_MODE);
  }, [getView, selection.selectedCount]);

  const item = (
    label: string,
    run: () => void,
    disabled = false,
    shortcut?: ProductShortcutId,
  ) => (
    <Menu.Item key={label} disabled={disabled} onClick={run}>
      {label}
      {/* Inline and right-aligned rather than a tooltip: that is the reading a
          menu row has had in every application the author has used, and a popup
          over the row it describes would cover the menu. */}
      {shortcut === undefined ? null : (
        <kbd
          className="editor-shell-menu-key"
          aria-label={shortcutSpokenLabel(shortcut)}
        >
          {shortcutLabel(shortcut)}
        </kbd>
      )}
    </Menu.Item>
  );

  return (
    <nav className="editor-shell-menubar" aria-label={uiCopy.menus.label}>
      <MenuGroup label={uiCopy.menus.file}>
        {item(uiCopy.file.newDocument, () => void session?.newDocument())}
        {item(uiCopy.file.newFromStarter, () => void session?.newFromStarter())}
        {item(uiCopy.file.openPackage, () => session?.openPackage())}
        {item(uiCopy.file.savePackage, () => void session?.savePackage())}
        {item(uiCopy.file.releasePackage, () => void session?.releasePackage())}
        {item(uiCopy.file.openLibrary, () => void session?.openLibrary())}
        {item(uiCopy.file.saveLibrary, () => void session?.saveLibrary())}
      </MenuGroup>
      <MenuGroup label={uiCopy.menus.edit}>
        {/* A row names an id only when that binding reaches the same manager the
            row calls through the session — `edit.undo` and this row both end at
            `historyManager.undo()`, and so on for the six. The File rows carry
            none because that is what the plan enumerated, not because they fail
            the rule: `file.new`, `file.open` and `file.save` each reach the same
            call their row does. That disagreement is open as `vg-185`. */}
        {EDIT_MENU_ROWS.map((row) =>
          item(
            row.label,
            () => row.run(session),
            kind === "none",
            row.shortcut,
          ),
        )}
      </MenuGroup>
      <MenuGroup label={uiCopy.menus.view}>
        <ViewSetting
          label={uiCopy.view.dataSource}
          value={source}
          options={[
            ["preview", uiCopy.view.preview],
            ["live", uiCopy.view.live],
          ]}
          onChange={(next) => {
            getView()?.setSourceMode(next);
            setSource(next);
          }}
        />
        <ViewSetting
          label={uiCopy.view.chartRefresh}
          value={rate}
          options={[
            [30, uiCopy.view.fps30],
            [1, uiCopy.view.fps1],
          ]}
          onChange={(next) => {
            getView()?.setChartRefreshRate(next);
            setRate(next);
          }}
        />
        <ViewSetting
          label={uiCopy.view.valueRuns}
          value={runDisplay}
          options={[
            ["values", uiCopy.view.values],
            ["tokens", uiCopy.view.tokens],
          ]}
          onChange={(next) => {
            getView()?.setRunDisplay(next);
            setRunDisplay(next);
          }}
        />
      </MenuGroup>
    </nav>
  );
}
