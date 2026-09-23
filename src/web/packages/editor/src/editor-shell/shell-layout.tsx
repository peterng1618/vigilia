import { Menu } from "@base-ui/react/menu";
import { Tabs } from "@base-ui/react/tabs";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { uiCopy } from "../ui-copy.js";
import type { ActiveKind, EditorShellBridge } from "./bridge.js";
import { CanvasDock } from "./canvas-dock.js";
import {
  applyShellPalette,
  DEFAULT_SHELL_PALETTE,
  readShellPalette,
  shellPalettes,
  writeShellPalette,
} from "./palette.js";
import type { EditorViewControls } from "./session-facade.js";

/** Rail entries own one pane each; the inspector keeps the document panels. */
export type RailPane = "layers" | "add" | "assets" | "settings";
export type InspectorTab = "design" | "data" | "style";

/** Persistent DOM owners the imperative panels mount into. React positions
 * these; it never renders panel content. */
export interface ShellHosts {
  readonly canvas: HTMLElement;
  readonly layers: HTMLElement;
  readonly add: HTMLElement;
  readonly assets: HTMLElement;
  readonly document: HTMLElement;
  readonly chart: HTMLElement;
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
        <Menu.Positioner>
          <Menu.Popup className="editor-shell-menu-popup" render={<div />}>
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ShellMenuBar({
  getBridge,
  getView,
}: {
  readonly getBridge: () => EditorShellBridge | undefined;
  readonly getView: () => EditorViewControls | undefined;
}): React.JSX.Element {
  const [kind, setKind] = useState<ActiveKind>("none");
  const [source, setSource] = useState<"preview" | "live">("preview");
  const [rate, setRate] = useState<1 | 30>(30);

  useEffect(() => {
    const bridge = getBridge();
    setKind(bridge?.snapshot().activeKind ?? "none");
    setSource(getView()?.sourceMode() ?? "preview");
    setRate(getView()?.chartRefreshRate() ?? 30);
    return bridge?.subscribe(() =>
      setKind(bridge.snapshot().activeKind ?? "none"),
    );
  }, [getBridge, getView]);

  const bridge = getBridge();
  const session = bridge?.session;
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
        {item("Text", () => session?.addText())}
        {item("Gauge", () => session?.addChart("gauge"))}
        {item("Line", () => session?.addChart("line"))}
        {item("Bar", () => session?.addChart("bar"))}
        {item("Pie", () => session?.addChart("pie"))}
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
    layers: element("vigiliaPanelHostLayers"),
    add: element("vigiliaPanelHostAdd"),
    assets: element("vigiliaPanelHostAssets"),
    document: element("vigiliaPanelHostDocument"),
    chart: element("vigiliaPanelHostChart"),
    status: document.createElement("span"),
    dock: document.createElement("nav"),
  };
  hosts.canvas.id = "canvas-host";

  let bridge: EditorShellBridge | undefined;
  let view: EditorViewControls | undefined;
  let reactRoot: Root | undefined;
  const getBridge = (): EditorShellBridge | undefined => bridge;
  const getView = (): EditorViewControls | undefined => view;

  function Shell(): React.JSX.Element {
    const [palette, setPalette] = useState(initial);
    const [pane, setPane] = useState<RailPane>("layers");
    const [kind, setKind] = useState<ActiveKind>("none");

    useEffect(() => {
      const current = getBridge();
      setKind(current?.snapshot().activeKind ?? "none");
      return current?.subscribe(() =>
        setKind(current.snapshot().activeKind ?? "none"),
      );
    }, []);

    const rail: readonly [RailPane, string][] = [
      ["layers", uiCopy.rail.layers],
      ["add", uiCopy.rail.add],
      ["assets", uiCopy.rail.assets],
      ["settings", uiCopy.rail.settings],
    ];

    return (
      <div className="editor-shell">
        <header className="editor-shell-header editor-glass">
          <strong>{uiCopy.brand}</strong>
          <span className="editor-shell-tagline">{uiCopy.editor}</span>
          <ShellMenuBar getBridge={getBridge} getView={getView} />
          <button
            className="editor-shell-primary"
            type="button"
            data-vigilia-save-package=""
            onClick={() => void bridge?.session.savePackage()}
          >
            {uiCopy.file.savePackage}
          </button>
        </header>
        <div className="editor-shell-body">
          <nav
            className="editor-shell-rail editor-glass"
            aria-label="Editor areas"
          >
            {rail.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={pane === id}
                onClick={() => setPane(id)}
              >
                {label.slice(0, 1)}
              </button>
            ))}
          </nav>
          <aside className="editor-shell-panel editor-glass">
            <Host node={hosts.layers} hidden={pane !== "layers"} />
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
          </main>
          <aside className="editor-shell-inspector editor-glass">
            {kind === "none" ? (
              <Host node={hosts.document} />
            ) : (
              <Tabs.Root defaultValue="design">
                <Tabs.List className="editor-shell-tabs">
                  {(["design", "data", "style"] as const).map((tab) => (
                    <Tabs.Tab key={tab} value={tab}>
                      {uiCopy.inspector[tab]}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
                <Tabs.Panel value="design">
                  <p className="editor-shell-hint">
                    {kind === "chart"
                      ? "Chart settings are under Data."
                      : "Move, arrange and lock the selection with the canvas dock."}
                  </p>
                </Tabs.Panel>
                <Tabs.Panel value="data">
                  <Host node={hosts.chart} />
                </Tabs.Panel>
                <Tabs.Panel value="style">
                  <p className="editor-shell-hint">
                    Colours and type resolve through the theme palette and type
                    presets.
                  </p>
                </Tabs.Panel>
              </Tabs.Root>
            )}
          </aside>
        </div>
        <footer id="status" className="editor-shell-status">
          <Host node={hosts.status} />
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
      bridge = nextBridge;
      view = nextView;
      flushSync(() => {
        reactRoot?.render(<Shell />);
        dockRoot.render(
          <CanvasDock bridge={nextBridge} onVisibility={setDockVisible} />,
        );
      });
    },
    destroy() {
      bridge?.destroy();
      bridge = undefined;
      dockRoot.unmount();
      reactRoot?.unmount();
      reactRoot = undefined;
    },
  };
}
