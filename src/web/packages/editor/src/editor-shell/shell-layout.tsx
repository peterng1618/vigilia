import { Menu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";
import { insertGroups } from "../new-object-panel.js";
import { arrangeActions, arrangeEligible } from "../object-actions.js";
import type { ActiveKind, EditorShellBridge, EditorShellSnapshot } from "./bridge.js";
import { CanvasContextMenu } from "./canvas-context-menu.js";
import { CanvasDock } from "./canvas-dock.js";
import { DiagnosticMessage } from "./diagnostic-message.js";
import { insertItem, InsertPopover } from "./insert-popover.js";
import { LayerPanel } from "./layer-panel.js";
import { PaneBar, type RailPane } from "./pane-bar.js";
import { PaletteMenu } from "./palette-menu.js";
import { PublishControl } from "./publish-control.js";
import { SaveState } from "./save-state.js";
import { DisplaySwitch } from "./display-switch.js";
import { applyShellPalette, DEFAULT_SHELL_PALETTE, readShellPalette } from "./palette.js";
import {
  DEFAULT_RUN_DISPLAY_MODE,
  type RunDisplayMode,
} from "../run-placeholder.js";
import type { EditorViewControls } from "./session-facade.js";
import type { EditorActionFacade } from "./session-facade.js";

export type { RailPane } from "./pane-bar.js";

/** Persistent DOM owners the imperative panels mount into. React positions
 * these; it never renders panel content. The Layers pane has no node here: the
 * tree is React-owned and renders inside `Shell` from the bridge directly. */
export interface ShellHosts {
  readonly canvas: HTMLElement;
  readonly add: HTMLElement;
  readonly assets: HTMLElement;
  readonly document: HTMLElement;
  /** Properties of the selected object. A chart's family settings and bindings
      are part of that column, not a panel of their own. */
  readonly selection: HTMLElement;
  readonly status: HTMLElement;
  readonly dock: HTMLElement;
}

export interface ShellLayout {
  readonly hosts: ShellHosts;
  readonly stage: HTMLElement;
  readonly dock: HTMLElement;
  setBridge(
    bridge: EditorShellBridge | undefined,
    view: EditorViewControls | undefined,
  ): void;
  destroy(): void;
}

function element(datasetKey?: string): HTMLElement {
  const node = document.createElement("div");
  if (datasetKey !== undefined) node.dataset[datasetKey] = "";
  return node;
}

/** Moves a persistent host node into React-owned chrome exactly once. */
function Host({
  node,
  hidden = false,
}: {
  readonly node: HTMLElement;
  readonly hidden?: boolean;
}): React.JSX.Element {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = slot.current;
    if (parent !== null && node.parentElement !== parent) {
      parent.replaceChildren(node);
    }
  }, [node]);
  return <div ref={slot} hidden={hidden} />;
}

/** Selection is external mutable state (Fabric owns it); both the inspector and
 * the menus read one subscription so a late-set bridge still propagates. */
class SelectionStore {
  #bridge: EditorShellBridge | undefined;
  readonly #listeners = new Set<() => void>();
  #snapshot: EditorShellSnapshot = {
    selectedCount: 0,
    locked: false,
    activeKind: "none",
  };
  #unsubscribe: (() => void) | undefined;

  set(bridge: EditorShellBridge | undefined): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#bridge = bridge;
    if (bridge !== undefined) {
      this.#snapshot = bridge.snapshot();
      this.#unsubscribe = bridge.subscribe(() => {
        this.#snapshot = bridge.snapshot();
        for (const listener of this.#listeners) listener();
      });
    } else {
      this.#snapshot = { selectedCount: 0, locked: false, activeKind: "none" };
    }
    for (const listener of this.#listeners) listener();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly get = (): EditorShellSnapshot => this.#snapshot;

  get bridge(): EditorShellBridge | undefined {
    return this.#bridge;
  }
}

function useSelection(store: SelectionStore): EditorShellSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Arrange sits above the canvas because it needs a multi-selection, not one
 * object. It stays visible and greyed rather than being filtered out like the
 * dock's actions, so the controls are discoverable before a selection exists. */
function ArrangeToolbar({
  store,
}: {
  readonly store: SelectionStore;
}): React.JSX.Element {
  const selection = useSelection(store);
  return (
    <div
      className="editor-shell-arrange editor-glass"
      role="toolbar"
      aria-label={uiCopy.arrangeToolbar.label}
      data-vigilia-arrange-toolbar=""
    >
      {arrangeActions().map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          // Per action: distribute needs three objects where align needs two,
          // and a button that is enabled but refused is a silent no-op.
          disabled={!arrangeEligible(selection.selectedCount, selection.locked, id)}
          onClick={() => store.bridge?.run(id)}
        >
          <Icon aria-hidden size={15} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

function readStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

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
          <Menu.Popup className="editor-shell-menu-popup">{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The tick a checked radio choice carries, reserving its width whether or not
 *  it is showing so the labels either side of it do not shift as the setting
 *  changes. */
const checkSlot = (state: { readonly checked: boolean }): React.CSSProperties => ({
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
                    <Check aria-hidden size={12} strokeWidth={2.5} />
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

function ShellMenuBar({
  store,
  getView,
}: {
  readonly store: SelectionStore;
  readonly getView: () => EditorViewControls | undefined;
}): React.JSX.Element {
  const selection = useSelection(store);
  const kind = selection.activeKind;
  const session = store.bridge?.session;
  const [source, setSource] = useState<"preview" | "live">("preview");
  const [rate, setRate] = useState<1 | 30>(30);
  const [runDisplay, setRunDisplay] = useState<RunDisplayMode>(DEFAULT_RUN_DISPLAY_MODE);

  useEffect(() => {
    setSource(getView()?.sourceMode() ?? "preview");
    setRate(getView()?.chartRefreshRate() ?? 30);
    setRunDisplay(getView()?.runDisplay() ?? DEFAULT_RUN_DISPLAY_MODE);
  }, [getView, selection.selectedCount]);

  const item = (label: string, run: () => void, disabled = false) => (
    <Menu.Item key={label} disabled={disabled} onClick={run}>
      {label}
    </Menu.Item>
  );

  return (
    <nav className="editor-shell-menubar" aria-label="Editor menus">
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
        {item(uiCopy.actions.undo, () => session?.undo(), kind === "none")}
        {item(uiCopy.actions.redo, () => session?.redo(), kind === "none")}
        {item(uiCopy.actions.copy, () => session?.copy(), kind === "none")}
        {item(uiCopy.actions.cut, () => session?.cut(), kind === "none")}
        {item(
          uiCopy.actions.duplicate,
          () => session?.duplicate(),
          kind === "none",
        )}
        {item(
          uiCopy.actions.delete,
          () => session?.deleteActive(),
          kind === "none",
        )}
      </MenuGroup>
      <MenuGroup label={uiCopy.menus.insert}>
        {/* The Add pane's own list, not a second copy of it: this menu had
            drifted to five flat entries with no panel and no shape in it, and
            "Line" meant whichever of the two things the reader happened to see
            first. The groups are the pane's, so the word is as unambiguous
            here as it is there. */}
        {insertGroups().map((group) =>
          group.label === undefined ? (
            group.objects.map((object) => insertItem(object, session))
          ) : (
            <Menu.Group key={group.label}>
              <Menu.GroupLabel className="editor-shell-menu-label">
                {group.label}
              </Menu.GroupLabel>
              {group.objects.map((object) => insertItem(object, session))}
            </Menu.Group>
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

export function createShellLayout(root: HTMLElement): ShellLayout {
  const storage = readStorage();
  const initial =
    storage === undefined ? DEFAULT_SHELL_PALETTE : readShellPalette(storage);
  applyShellPalette(initial);

  const hosts: ShellHosts = {
    canvas: element(),
    add: element("vigiliaPanelHostAdd"),
    assets: element("vigiliaPanelHostAssets"),
    document: element("vigiliaPanelHostDocument"),
    selection: element("vigiliaPanelHostSelection"),
    status: document.createElement("span"),
    dock: document.createElement("nav"),
  };
  hosts.canvas.id = "canvas-host";

  let view: EditorViewControls | undefined;
  let reactRoot: Root | undefined;
  const store = new SelectionStore();
  const getView = (): EditorViewControls | undefined => view;

  function Shell(): React.JSX.Element {
    const [palette, setPalette] = useState(initial);
    const [pane, setPane] = useState<RailPane>("layers");
    const [collapsed, setCollapsed] = useState(false);
    /** The `+` opens the insert chooser, and the shell owns whether it is
     *  showing: the button belongs to the pane bar, so the bar hands the press
     *  up and the popover anchors back to the element that press landed on.
     *
     *  Before a document is open there is no session for a row to dispatch to,
     *  and a menu of twenty-one rows that silently do nothing is the one failure
     *  an author cannot diagnose — so the `+` is refused instead. */
    const [insertOpen, setInsertOpen] = useState(false);
    const addRef = useRef<HTMLButtonElement | null>(null);
    const kind = useSelection(store).activeKind;
    /** Re-frame on the panel toggle, once the viewport has the new width.
     *
     * A resize does not need this any more: the viewport derives whether the
     * camera was fitted and re-fits that one itself. What it deliberately will
     * not do is touch a camera the author has zoomed or panned, and collapsing a
     * panel is not a window nudge — the author handed the canvas 288px on
     * purpose — so this is the one case where their view still follows. Still
     * waiting on the change event rather than a frame: the aside re-renders
     * after the frame, so a fit measured then reads the old box and lands on the
     * collapsed zoom on the way back in.
     */
    const refitOnViewportChange = (): void => {
      const viewport = store.bridge?.editor.viewport;
      if (viewport === undefined) return;
      const off = viewport.onChange(() => {
        off();
        viewport.zoomToFit();
      });
    };

    /** Each pane's scroll offset, kept across the swap.
     *
     * The bar is single-panel, so opening Assets really does tear the layer
     * list down and build it again — the selection, the inspector's geometry
     * and the canvas handles all survive, and only the scroll was lost. With
     * the Starter's 52 rows and more in a theme an author has built, finding
     * your place again after a glance at the assets is the whole cost of it. */
    const scrollOf = useRef(new Map<RailPane, number>());
    const paneBody = useRef<HTMLElement | null>(null);

    /** The segment already showing closes the panel; any other segment — and
     *  the closed one itself — shows it. The canvas is what an author works
     *  in, so the chrome around it is allowed to get out of the way. */
    const choosePane = (id: RailPane): void => {
      // Read the offset off the DOM rather than off an event: the panel is torn
      // down by the swap, so anything held in state is already gone by the time
      // this runs for the next pane. Taken before any branch, because every
      // branch but the collapse hides the panel and a `display: none` box has
      // no scroll offset to read — the getter answers 0, so a save taken after
      // the collapse writes the author's place back as the top of the list.
      if (!collapsed && paneBody.current !== null) {
        scrollOf.current.set(pane, paneBody.current.scrollTop);
      }
      if (!collapsed && pane === id) {
        setCollapsed(true);
        // Collapsing hands the canvas 288px, and the refit runs here too rather
        // than only on a pane swap.
        refitOnViewportChange();
        return;
      }
      setPane(id);
      setCollapsed(false);
      const restore = scrollOf.current.get(id) ?? 0;
      // After the pane's own content is laid out, or the offset lands on
      // whatever height it has at that moment.
      requestAnimationFrame(() => {
        if (paneBody.current !== null) paneBody.current.scrollTop = restore;
        // Only when the panel is coming back. A swap between two open panes
        // changes which pane shows, not how wide the panel is, so nothing
        // resizes and no change event ever arrives — the listener would sit
        // armed until the author's next pan or zoom, and that gesture is the one
        // it ate, snapping the view back to fit.
        if (collapsed) refitOnViewportChange();
      });
    };

    return (
      <div className="editor-shell">
        <header className="editor-shell-header editor-glass">
          <strong>{uiCopy.brand}</strong>
          <span className="editor-shell-tagline">{uiCopy.editor}</span>
          <ShellMenuBar store={store} getView={getView} />
          <PaletteMenu
            storage={storage}
            palette={palette}
            onChange={setPalette}
          />
          <PublishControl />
          <button
            className="editor-shell-primary"
            type="button"
            data-vigilia-save-package=""
            onClick={() => void store.bridge?.session.savePackage()}
          >
            {uiCopy.file.savePackage}
          </button>
        </header>
        <div className="editor-shell-body" data-collapsed={collapsed}>
          {/* The bar heads the left column rather than standing beside it, so
              the canvas gets the rail's 52px back and the segments read as the
              column's own header rather than a second place to navigate. */}
          <PaneBar
            pane={pane}
            collapsed={collapsed}
            onChoose={choosePane}
            onInsert={() => setInsertOpen(true)}
            addRef={addRef}
            addExpanded={insertOpen}
            addDisabled={store.bridge === undefined}
          />
          <InsertPopover
            session={store.bridge?.session}
            open={insertOpen}
            onOpenChange={setInsertOpen}
            anchor={addRef}
          />
          <aside
            className="editor-shell-panel editor-glass"
            hidden={collapsed}
            ref={paneBody}
          >
            <div hidden={pane !== "layers"}>
              <LayerPanel bridge={store.bridge} />
            </div>
            <Host node={hosts.add} hidden={pane !== "insert"} />
            <Host node={hosts.assets} hidden={pane !== "assets"} />
            <Host node={hosts.document} hidden={pane !== "document"} />
          </aside>
          <main id="stage" className="editor-shell-stage" aria-label="Editor canvas">
            <Host node={hosts.canvas} />
            <ArrangeToolbar store={store} />
            <nav
              className="editor-shell-dock editor-glass"
              aria-label={uiCopy.dock.label}
              data-visible={false}
              ref={(node) => {
                if (node !== null && node.firstChild !== hosts.dock) {
                  node.replaceChildren(hosts.dock);
                }
              }}
            />
            {/* The store, not a local: a late-set bridge must reach the readout
                the same way it reaches the inspector and menus. */}
            {store.bridge === undefined ? null : (
              <DisplaySwitch
                viewport={store.bridge.editor.viewport}
                artboard={store.bridge.editor.artboard}
              />
            )}
            {/* Renders no DOM of its own: it only binds the canvas's own
                `contextmenu` listener, so it sits with the stage it listens to. */}
            <CanvasContextMenu bridge={store.bridge} />
          </main>
          <aside className="editor-shell-inspector editor-glass">
            {/* One panel, so no tab strip: a strip with one tab is a control
                that cannot choose. The theme's own settings used to sit under
                this panel behind a `keepMounted` Design tab, which existed so
                a selection could not hide them; they are in the left column's
                Document pane now, which no selection can hide either, so the
                property is discharged by the move rather than by an attribute.
                A chart's own fields are still in this column — its owner is
                asked for them — so a chart keeps every question it has. */}
            <Host node={hosts.selection} />
            {kind !== "none" && (
              <p className="editor-shell-hint">
                Move and lock the selection with the canvas dock.
              </p>
            )}
          </aside>
        </div>
        <footer id="status" className="editor-shell-status">
          <Host node={hosts.status} />
          <DiagnosticMessage canvas={store.bridge?.editor.canvas} />
          <SaveState session={store.bridge?.session} />
        </footer>
      </div>
    );
  }

  flushSync(() => {
    reactRoot = createRoot(root);
    reactRoot.render(<Shell />);
  });

  const stage = root.querySelector<HTMLElement>("#stage");
  const dock = root.querySelector<HTMLElement>(".editor-shell-dock");
  if (stage === null || dock === null) {
    throw new Error("Editor shell did not mount required hosts.");
  }

  // The dock is a separate React root so canvas remounts never disturb it.
  const dockRoot = createRoot(hosts.dock);
  const setDockVisible = (visible: boolean): void => {
    dock.dataset["visible"] = String(visible);
  };
  dockRoot.render(
    <CanvasDock bridge={undefined} onVisibility={setDockVisible} />,
  );

  return {
    hosts,
    stage,
    dock,
    setBridge(nextBridge, nextView) {
      // The store notifies subscribers, so React re-renders the inspector and
      // menus without a manual root re-render — and it keeps working when the
      // bridge is replaced by a later document mount.
      view = nextView;
      store.set(nextBridge);
      flushSync(() => {
        dockRoot.render(
          <CanvasDock bridge={nextBridge} onVisibility={setDockVisible} />,
        );
      });
    },
    destroy() {
      store.bridge?.destroy();
      store.set(undefined);
      dockRoot.unmount();
      reactRoot?.unmount();
      reactRoot = undefined;
    },
  };
}
