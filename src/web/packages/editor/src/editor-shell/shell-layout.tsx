import { Menu } from "@base-ui/react/menu";
import { Tabs } from "@base-ui/react/tabs";
import {
  Images,
  Layers,
  type LucideIcon,
  Plus,
  Settings as SettingsIcon,
  SlidersHorizontal,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";
import { arrangeActions, arrangeEligible } from "../object-actions.js";
import type { ActiveKind, EditorShellBridge, EditorShellSnapshot } from "./bridge.js";
import { CanvasContextMenu } from "./canvas-context-menu.js";
import { CanvasDock } from "./canvas-dock.js";
import { DiagnosticMessage } from "./diagnostic-message.js";
import { LayerPanel } from "./layer-panel.js";
import { ZoomReadout } from "./zoom-readout.js";
import {
  applyShellPalette,
  DEFAULT_SHELL_PALETTE,
  readShellPalette,
  shellPalettes,
  writeShellPalette,
} from "./palette.js";
import {
  DEFAULT_RUN_DISPLAY_MODE,
  type RunDisplayMode,
} from "../run-placeholder.js";
import type { EditorViewControls } from "./session-facade.js";

/** Rail entries own one pane each; the inspector keeps the document panels. */
export type RailPane = "layers" | "add" | "assets" | "settings";
export type InspectorTab = "design" | "data" | "style";

/** One icon per rail entry. An icon is a component, not copy (§35), so it lives
 *  beside the rail rather than in `ui-copy.ts`; the label it stands for is the
 *  button's `aria-label`, which is why the marks it replaces can simply go. */
const RAIL_ICONS: Readonly<Record<RailPane, LucideIcon>> = {
  layers: Layers,
  add: Plus,
  assets: Images,
  settings: SettingsIcon,
};

/** The inspector's own mark, beside the rail for the same reason as the four
 *  above: an icon is a component, and this one says "the selection's fields"
 *  rather than naming a kind of object. */
const INSPECTOR_ICON = SlidersHorizontal;

/** Persistent DOM owners the imperative panels mount into. React positions
 * these; it never renders panel content. The Layers pane has no node here: the
 * tree is React-owned and renders inside `Shell` from the bridge directly. */
export interface ShellHosts {
  readonly canvas: HTMLElement;
  readonly add: HTMLElement;
  readonly assets: HTMLElement;
  readonly document: HTMLElement;
  readonly chart: HTMLElement;
  /** Properties of the selected object, in the Design tab. */
  readonly selection: HTMLElement;
  /** What the selection's references resolve to, in the Style tab. */
  readonly style: HTMLElement;
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

/** The width at which the shell stops having room for two side regions beside a
 *  canvas, and the one the stylesheet's own media query uses. It is named here
 *  because the shell has to *act* on the crossing — a sheet covers a sheet
 *  otherwise — while the layout itself stays CSS's. */
const NARROW_SHELL = "(max-width: 980px)";

/** Whether the shell is below that width, live across a resize. A narrow shell
 *  shows one region at a time, because two 280px sheets over a 336px canvas
 *  leave the author reading whichever one is on top. `matchMedia` is absent
 *  under jsdom, which is a desktop surface for this purpose: the default
 *  matches the stylesheet's own default of four columns. */
function useNarrowShell(): boolean {
  return useSyncExternalStore(
    (onChange: () => void) => {
      const query = window.matchMedia?.(NARROW_SHELL);
      query?.addEventListener("change", onChange);
      return () => query?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(NARROW_SHELL).matches === true,
    () => false,
  );
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
        {item(uiCopy.panels.text, () => session?.addText())}
        {item(uiCopy.chartFamilies.gauge, () => session?.addChart("gauge"))}
        {item(uiCopy.chartFamilies.line, () => session?.addChart("line"))}
        {item(uiCopy.chartFamilies.bar, () => session?.addChart("bar"))}
        {item(uiCopy.chartFamilies.pie, () => session?.addChart("pie"))}
      </MenuGroup>
      <MenuGroup label={uiCopy.menus.arrange}>
        {item(
          uiCopy.actions.align,
          () => session?.arrange("align-left"),
          session?.canArrange("align-left") !== true,
        )}
        {item(
          uiCopy.actions.distribute,
          () => session?.arrange("distribute-x"),
          session?.canArrange("distribute-x") !== true,
        )}
      </MenuGroup>
      <MenuGroup label={uiCopy.menus.view}>
        {item(
          `${uiCopy.view.dataSource}: ${source === "preview" ? uiCopy.view.preview : uiCopy.view.live}`,
          () => {
            const next = source === "preview" ? "live" : "preview";
            getView()?.setSourceMode(next);
            setSource(next);
          },
        )}
        {item(`${uiCopy.view.chartRefresh}: ${rate} FPS`, () => {
          const next: 1 | 30 = rate === 30 ? 1 : 30;
          getView()?.setChartRefreshRate(next);
          setRate(next);
        })}
        {item(
          `${uiCopy.view.valueRuns}: ${runDisplay === "tokens" ? uiCopy.view.tokens : uiCopy.view.values}`,
          () => {
            const next = runDisplay === "tokens" ? "values" : "tokens";
            getView()?.setRunDisplay(next);
            setRunDisplay(next);
          },
        )}
      </MenuGroup>
    </nav>
  );
}

export function createShellLayout(root: HTMLElement): ShellLayout {
  const storage = readStorage();
  const initial =
    storage === undefined ? DEFAULT_SHELL_PALETTE : readShellPalette(storage);
  applyShellPalette(root, initial);

  const hosts: ShellHosts = {
    canvas: element(),
    add: element("vigiliaPanelHostAdd"),
    assets: element("vigiliaPanelHostAssets"),
    document: element("vigiliaPanelHostDocument"),
    chart: element("vigiliaPanelHostChart"),
    selection: element("vigiliaPanelHostSelection"),
    style: element("vigiliaPanelHostStyle"),
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
    const kind = useSelection(store).activeKind;
    const narrow = useNarrowShell();
    // Open on a wide shell, which is where it has always been and where it is
    // the right first paint: an author arrives to edit a selection. Closed on a
    // narrow one, which is the F1.1 argument about the canvas applied to the
    // surface that had no room for it at all. Read once, on mount: this is the
    // default, not a rule — resizing does not override what the author has
    // since chosen, and every width can reach the region from the rail.
    const [inspectorOpen, setInspectorOpen] = useState(!narrow);

    const rail: readonly [RailPane, string][] = [
      ["layers", uiCopy.rail.layers],
      ["add", uiCopy.rail.add],
      ["assets", uiCopy.rail.assets],
      ["settings", uiCopy.rail.settings],
    ];

    /** The entry already showing closes the panel; any other entry — and the
     *  closed entry itself — shows it. The canvas is what an author works in,
     *  so the chrome around it is allowed to get out of the way. */
    const choosePane = (id: RailPane): void => {
      if (!collapsed && pane === id) {
        setCollapsed(true);
        return;
      }
      setPane(id);
      setCollapsed(false);
      // One region at a time when there is only room for one: a sheet over a
      // sheet is not a wider panel, it is the top one hiding the bottom one.
      if (narrow) setInspectorOpen(false);
    };

    /** The inspector collapses the same way the panel does, and for the same
     *  reason: it is chrome around the canvas, so it goes when the author asks.
     *  What differs is where it lands — a column on a wide shell, a sheet over
     *  the stage on a narrow one, where a 280px column would leave the canvas
     *  48px. The decision is CSS's; this only says which way it is. */
    const toggleInspector = (): void => {
      if (inspectorOpen) {
        setInspectorOpen(false);
        return;
      }
      setInspectorOpen(true);
      if (narrow) setCollapsed(true);
    };

    return (
      <div className="editor-shell">
        <header className="editor-shell-header editor-glass">
          <strong>{uiCopy.brand}</strong>
          <span className="editor-shell-tagline">{uiCopy.editor}</span>
          <ShellMenuBar store={store} getView={getView} />
          <button
            className="editor-shell-primary"
            type="button"
            data-vigilia-save-package=""
            onClick={() => void store.bridge?.session.savePackage()}
          >
            {uiCopy.file.savePackage}
          </button>
        </header>
        <div
          className="editor-shell-body"
          data-collapsed={collapsed}
          data-inspector={inspectorOpen}
        >
          <nav
            className="editor-shell-rail editor-glass"
            aria-label="Editor areas"
          >
            {rail.map(([id, label]) => {
              const Icon = RAIL_ICONS[id];
              // Pressed says which pane is chosen and stays true while the panel
              // is closed, so the rail still shows what reopening restores;
              // expanded is how the closed state is announced rather than drawn.
              const closes = !collapsed && pane === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  title={`${closes ? uiCopy.rail.hide : uiCopy.rail.show} ${label}`}
                  aria-pressed={pane === id}
                  aria-expanded={!collapsed}
                  onClick={() => choosePane(id)}
                >
                  <Icon aria-hidden size={16} strokeWidth={1.75} />
                </button>
              );
            })}
            {/* The inspector is a region rather than a pane, so it carries
                `aria-expanded` alone: there is no set of four to be pressed
                against, and a pressed state would claim one. */}
            <button
              type="button"
              className="editor-shell-rail-inspector"
              aria-label={uiCopy.rail.inspect}
              title={`${inspectorOpen ? uiCopy.rail.hide : uiCopy.rail.show} ${uiCopy.rail.inspect}`}
              aria-expanded={inspectorOpen}
              onClick={toggleInspector}
            >
              <INSPECTOR_ICON aria-hidden size={16} strokeWidth={1.75} />
            </button>
          </nav>
          <aside className="editor-shell-panel editor-glass" hidden={collapsed}>
            <div hidden={pane !== "layers"}>
              <LayerPanel bridge={store.bridge} />
            </div>
            <Host node={hosts.add} hidden={pane !== "add"} />
            <Host node={hosts.assets} hidden={pane !== "assets"} />
            <div hidden={pane !== "settings"}>
              <label className="editor-shell-palette">
                {uiCopy.palette}
                <select
                  aria-label={uiCopy.palette}
                  value={palette}
                  onChange={(event) => {
                    const next = event.target.value as typeof initial;
                    writeShellPalette(storage ?? window.localStorage, next);
                    applyShellPalette(root, next);
                    setPalette(next);
                  }}
                >
                  {shellPalettes.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
              <ZoomReadout viewport={store.bridge.editor.viewport} />
            )}
            {/* Renders no DOM of its own: it only binds the canvas's own
                `contextmenu` listener, so it sits with the stage it listens to. */}
            <CanvasContextMenu bridge={store.bridge} />
          </main>
          {/* `hidden` rather than a CSS-only hide, for the reason the panel
              uses it: a collapsed region leaves the accessibility tree instead
              of sitting in it with no box, which a screen reader would still
              read out and a finger still could not press. The tab panels stay
              mounted either way, so reopening restores what the author left. */}
          <aside
            className="editor-shell-inspector editor-glass"
            aria-label={uiCopy.rail.inspect}
            hidden={!inspectorOpen}
          >
            <Tabs.Root defaultValue="design">
              <Tabs.List className="editor-shell-tabs">
                {(["design", "data", "style"] as const).map((tab) => (
                  <Tabs.Tab key={tab} value={tab}>
                    {uiCopy.inspector[tab]}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              {/* Document panels stay mounted in Design: a selection must not
                  make the theme's own settings unreachable. */}
              <Tabs.Panel value="design" keepMounted>
                <Host node={hosts.selection} />
                {kind !== "none" && (
                  <p className="editor-shell-hint">
                    {kind === "chart"
                      ? "Chart settings are under Data."
                      : "Move and lock the selection with the canvas dock."}
                  </p>
                )}
                <Host node={hosts.document} />
              </Tabs.Panel>
              <Tabs.Panel value="data" keepMounted>
                <Host node={hosts.chart} />
              </Tabs.Panel>
              <Tabs.Panel value="style" keepMounted>
                <Host node={hosts.style} />
              </Tabs.Panel>
            </Tabs.Root>
          </aside>
        </div>
        <footer id="status" className="editor-shell-status">
          <Host node={hosts.status} />
          <DiagnosticMessage canvas={store.bridge?.editor.canvas} />
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
