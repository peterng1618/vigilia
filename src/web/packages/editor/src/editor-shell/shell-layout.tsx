import { Menu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";
import {
  type HostingAnswer,
  mintSession,
  readHosting,
  setLan,
} from "../hosting-client.js";
import {
  shortcutLabel,
  shortcutSpokenLabel,
} from "../shortcut-manager/display.js";
import type { ProductShortcutId } from "../shortcut-manager/index.js";
import type { EditorShellBridge, EditorShellSnapshot } from "./bridge.js";
import { CanvasContextMenu } from "./canvas-context-menu.js";
import { CanvasDock } from "./canvas-dock.js";
import { DiagnosticMessage } from "./diagnostic-message.js";
import { LayerActions, LayerPanel } from "./layer-panel.js";
import { Pane } from "./pane.js";
import { Rail, RAIL_GLYPHS, type RailSlot } from "./rail.js";
import { PaletteMenu } from "./palette-menu.js";
import { PublishControl } from "./publish-control.js";
import type { PublishSwitch } from "../publish-client.js";
import { SaveState } from "./save-state.js";
import { DisplaySwitch } from "./display-switch.js";
import { ShortcutReference } from "./shortcut-reference.js";
import {
  applyShellPalette,
  prefersDarkAppearance,
  readShellChoice,
  resolveShellPalette,
  systemShellPalette,
  watchSystemAppearance,
} from "./palette.js";
import {
  DEFAULT_RUN_DISPLAY_MODE,
  type RunDisplayMode,
} from "../run-placeholder.js";
import type { EditorViewControls } from "./session-facade.js";

/** Persistent DOM owners the imperative panels mount into. React positions
 * these; it never renders panel content. The Composition pane has no node
 * here: the tree is React-owned and renders inside `Shell` from the bridge
 * directly. */
export interface ShellHosts {
  readonly canvas: HTMLElement;
  /** The Add pane's body: the insert list and, beside it, the asset library
      (`§5.2` absorbs the Assets pane into Add). */
  readonly add: HTMLElement;
  readonly assets: HTMLElement;
  /** The Tokens pane: the theme's paints and type presets. */
  readonly tokens: HTMLElement;
  /** The Document pane: the artboard and the references it resolves. */
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
    /** What the publish surface's switch drives. Owned by `editor-main`, so the
     *  surface decides whether publishing is on and never holds a document. */
    publish?: PublishSwitch,
  ): void;
  /** Opens §7's reference sheet. The session owns the `?` dispatcher and never
   *  sees React, so `editor-main` routes the gesture here. */
  showShortcuts(): void;
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

/** Whether the `?` sheet is open, as external state.
 *
 * The dispatcher lives in `EditorSession`, which never sees React, so the
 * gesture has to reach the chrome through a subscription rather than a prop —
 * the same shape `SelectionStore` has, for the same reason.
 */
class SheetStore {
  #open = false;
  readonly #listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  readonly get = (): boolean => this.#open;
  set(open: boolean): void {
    if (this.#open === open) return;
    this.#open = open;
    for (const listener of this.#listeners) listener();
  }
}

function useSheet(store: SheetStore): boolean {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** What the shell knows about the host behind it, and the one place that answers
 *  "is this editor publishing".
 *
 *  `unknown` is the initial state and a real one: until the host has answered,
 *  the editor has nothing to say about publishing, and a reader that treated it
 *  as "not live" would be inventing a fact. `absent` is a build with no host at
 *  all — the same silence, for a different reason. */
export type HostingSnapshot =
  | { readonly kind: "unknown" }
  | { readonly kind: "absent" }
  | {
      readonly kind: "known";
      readonly answer: HostingAnswer;
      /** The credential a phone pairs with, which is not the editor session. */
      readonly pairing: HostingAnswer["session"] | undefined;
      /** A refusal, in the host's own words. */
      readonly reason: string | undefined;
      /** The state a toggle is asking for, while the host is deciding. */
      readonly pending: boolean | undefined;
    };

/** The host's answer, owned outside React: the header's control and Task 4's
 *  status bar read one subscription rather than each asking the host. Unknown
 *  until the host answers, and it renders no claim until then. */
export class HostingStore {
  #snapshot: HostingSnapshot = { kind: "unknown" };
  readonly #listeners = new Set<() => void>();

  /** The host is asked once, here, so every reader — the header's control and
   *  Task 4's status bar — shares one answer rather than each asking. */
  constructor() {
    void this.read();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly get = (): HostingSnapshot => this.#snapshot;

  #emit(next: HostingSnapshot): void {
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  }

  /** The host's first answer. An unread host is `absent`, not "not live". A
   *  build with no `fetch` at all reaches the same place, which is why this
   *  catches rather than letting the constructor's promise reject unhandled. */
  async read(): Promise<void> {
    try {
      const answer = await readHosting();
      if (answer === undefined) {
        this.#emit({ kind: "absent" });
        return;
      }
      this.#emit({
        kind: "known",
        answer,
        pairing: answer.lan ? await mintSession() : undefined,
        reason: undefined,
        pending: undefined,
      });
    } catch {
      this.#emit({ kind: "absent" });
    }
  }

  /** Turns the LAN on or off, and reads where the host landed.
   *
   *  A `200` means the host accepted the request, not that it moved: it answers
   *  first and rebinds afterwards, so the state it asked for — and a refusal, if
   *  it made one — is on the read that follows rather than in the PUT's body. */
  async toggle(): Promise<void> {
    const current = this.#snapshot;
    if (current.kind !== "known") return;
    const wanted = !current.answer.lan;
    this.#emit({ ...current, pending: wanted, reason: undefined });

    const outcome = await setLan(wanted);
    if (!outcome.ok) {
      // The host is the only thing that knows where its binding ended up: a
      // refusal restores the old one, which is not necessarily where the button
      // was pointing.
      const now = await readHosting();
      const answer = now ?? current.answer;
      this.#emit({
        kind: "known",
        answer,
        pairing: answer.lan ? current.pairing : undefined,
        reason: outcome.reason,
        pending: undefined,
      });
      return;
    }

    const { answer } = outcome;
    this.#emit({
      kind: "known",
      answer,
      pairing: answer.lan ? await mintSession() : undefined,
      reason: answer.refusal ?? undefined,
      pending: undefined,
    });
  }
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
        {/* A row names an id only when that binding reaches the same manager the
            row calls through the session — `edit.undo` and this row both end at
            `historyManager.undo()`, and so on for the six. The File rows carry
            none because that is what the plan enumerated, not because they fail
            the rule: `file.new`, `file.open` and `file.save` each reach the same
            call their row does. That disagreement is open as `vg-185`. */}
        {item(
          uiCopy.actions.undo,
          () => session?.undo(),
          kind === "none",
          "edit.undo",
        )}
        {item(
          uiCopy.actions.redo,
          () => session?.redo(),
          kind === "none",
          "edit.redo",
        )}
        {item(
          uiCopy.actions.copy,
          () => session?.copy(),
          kind === "none",
          "edit.copy",
        )}
        {item(
          uiCopy.actions.cut,
          () => session?.cut(),
          kind === "none",
          "edit.cut",
        )}
        {item(
          uiCopy.actions.duplicate,
          () => session?.duplicate(),
          kind === "none",
          "edit.duplicate",
        )}
        {item(
          uiCopy.actions.delete,
          () => session?.deleteActive(),
          kind === "none",
          "edit.delete",
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
  const initial = resolveShellPalette(
    storage === undefined ? undefined : readShellChoice(storage),
    prefersDarkAppearance(),
  );
  applyShellPalette(initial);

  const hosts: ShellHosts = {
    canvas: element(),
    add: element("vigiliaPanelHostAdd"),
    assets: element("vigiliaPanelHostAssets"),
    tokens: element("vigiliaPanelHostTokens"),
    document: element("vigiliaPanelHostDocument"),
    selection: element("vigiliaPanelHostSelection"),
    status: document.createElement("span"),
    dock: document.createElement("div"),
  };
  hosts.canvas.id = "canvas-host";

  let view: EditorViewControls | undefined;
  let publish: PublishSwitch | undefined;
  let reactRoot: Root | undefined;
  const store = new SelectionStore();
  const sheet = new SheetStore();
  const hosting = new HostingStore();
  const getView = (): EditorViewControls | undefined => view;

  function Shell(): React.JSX.Element {
    const [palette, setPalette] = useState(initial);
    const [slot, setSlot] = useState<RailSlot>("composition");
    const [collapsed, setCollapsed] = useState(false);
    const kind = useSelection(store).activeKind;
    const sheetOpen = useSheet(sheet);
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
     * The rail is single-pane, so opening Add really does tear the composition
     * list down and build it again — the selection, the inspector's geometry
     * and the canvas handles all survive, and only the scroll was lost. With
     * the Starter's 52 rows and more in a theme an author has built, finding
     * your place again after a glance at the assets is the whole cost of it. */
    const scrollOf = useRef(new Map<RailSlot, number>());
    const paneBody = useRef<HTMLElement | null>(null);

    /** The OS gets a vote only while the author has not cast one.
     *
     *  The predicate is re-read here rather than the listener being detached on
     *  choose: the two are the same condition, and an effect that depended on
     *  the choice would either re-subscribe on every palette or close over a
     *  stale one. `readShellChoice` asks storage, which is where "has the author
     *  chosen" actually lives — the picker writes there before it calls back. */
    useEffect(
      () =>
        watchSystemAppearance((prefersDark) => {
          if (storage !== undefined && readShellChoice(storage) !== undefined) {
            return;
          }
          const next = systemShellPalette(prefersDark);
          applyShellPalette(next);
          setPalette(next);
        }),
      [],
    );

    /** The slot already showing closes the pane; any other slot — and the
     *  closed one itself — shows it. The canvas is what an author works in, so
     *  the chrome around it is allowed to get out of the way. */
    const choosePane = (id: RailSlot): void => {
      // Read the offset off the DOM rather than off an event: the panel is torn
      // down by the swap, so anything held in state is already gone by the time
      // this runs for the next slot. Taken before any branch, because every
      // branch but the collapse hides the panel and a `display: none` box has
      // no scroll offset to read — the getter answers 0, so a save taken after
      // the collapse writes the author's place back as the top of the list.
      if (!collapsed && paneBody.current !== null) {
        scrollOf.current.set(slot, paneBody.current.scrollTop);
      }
      if (!collapsed && slot === id) {
        setCollapsed(true);
        // Collapsing hands the canvas 288px, and the refit runs here too rather
        // than only on a pane swap.
        refitOnViewportChange();
        return;
      }
      setSlot(id);
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
        {/* A full-width strip, not a floating card: the header is the window's
            top edge, and §7.1 gives it document- and editor-level actions only.
            The brand, the three menus and the palette sit left; the publish
            control is the editor's one filled accent button, on the right. No
            tagline and no document readout — a per-document fact belongs on the
            canvas (§7.5), and the readout only grew with the LAN. */}
        <header className="editor-shell-header">
          <strong>{uiCopy.brand}</strong>
          <ShellMenuBar store={store} getView={getView} />
          <PaletteMenu
            storage={storage}
            palette={palette}
            onChange={setPalette}
          />
          <PublishControl
            session={store.bridge?.session}
            publish={publish}
            hosting={hosting}
          />
        </header>
        <div className="editor-shell-body" data-collapsed={collapsed}>
          {/* The rail is the left edge's own column, ahead of the pane's, so
              the canvas gets the pane's width back and the slots read as one
              vertical choice rather than a second navigation bar. */}
          <Rail slot={slot} collapsed={collapsed} onChoose={choosePane} />
          <aside
            className="editor-shell-panel editor-glass"
            hidden={collapsed}
            ref={paneBody}
          >
            {/* Every pane wears the same chrome — a title bar, a body and a
                footer toolbar — and each is `hidden` rather than unmounted,
                because the persistent hosts below live inside them and React
                re-parents those nodes; a pane taken off the tree would take its
                host's content with it. The pane is the one owner of the
                `data-vigilia-panel` name, so the Composition pane's is
                `layers` — the name the specs and the panel CSS already browse
                by — and the other three are named for their rail slot. */}
            <Pane
              id="layers"
              title={uiCopy.panels.layers}
              icon={RAIL_GLYPHS.composition}
              hidden={slot !== "composition"}
              footer={<LayerActions bridge={store.bridge} />}
            >
              <LayerPanel bridge={store.bridge} />
            </Pane>
            {/* The assets host renders inside the Add pane's body, with the
                insert host: `§5.2` puts the asset path in Add, and a fourth
                slot for it would be a slot the bible does not name. */}
            <Pane
              id="add"
              title={uiCopy.rail.slots.add}
              icon={RAIL_GLYPHS.add}
              hidden={slot !== "add"}
            >
              <Host node={hosts.add} hidden={slot !== "add"} />
              <Host node={hosts.assets} hidden={slot !== "add"} />
            </Pane>
            <Pane
              id="tokens"
              title={uiCopy.rail.slots.tokens}
              icon={RAIL_GLYPHS.tokens}
              hidden={slot !== "tokens"}
            >
              <Host node={hosts.tokens} hidden={slot !== "tokens"} />
            </Pane>
            <Pane
              id="document"
              title={uiCopy.rail.slots.document}
              icon={RAIL_GLYPHS.document}
              hidden={slot !== "document"}
            >
              <Host node={hosts.document} hidden={slot !== "document"} />
            </Pane>
          </aside>
          <main
            id="stage"
            className="editor-shell-stage"
            aria-label="Editor canvas"
          >
            <Host node={hosts.canvas} />
            {/* The dock owns its own element and derives its own visibility;
                this is only the slot that puts its mount point in the stage. */}
            <Host node={hosts.dock} />
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
            {/* §7's reference, driven by the session's `?` dispatcher through
                this external store. Rendering it in the shell rather than a
                local `useEffect` listener keeps the manager the sole
                window-level dispatcher. */}
            <ShortcutReference
              open={sheetOpen}
              onOpenChange={(next) => sheet.set(next)}
            />
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
  if (stage === null) {
    throw new Error("Editor shell did not mount required hosts.");
  }

  // The dock is a separate React root so canvas remounts never disturb it. It
  // owns its own element now and derives `data-visible` from the bridge it is
  // given, so nothing outside it writes that attribute; the render is flushed
  // so the element exists before the caller reads `dock`.
  const dockRoot = createRoot(hosts.dock);
  flushSync(() => {
    dockRoot.render(<CanvasDock bridge={undefined} />);
  });
  const dock = root.querySelector<HTMLElement>(".editor-shell-dock");
  if (dock === null) {
    throw new Error("Editor shell did not mount the canvas toolbar.");
  }

  return {
    hosts,
    stage,
    dock,
    setBridge(nextBridge, nextView, nextPublish) {
      // The store notifies subscribers, so React re-renders the inspector and
      // menus without a manual root re-render — and it keeps working when the
      // bridge is replaced by a later document mount.
      view = nextView;
      publish = nextPublish;
      store.set(nextBridge);
      flushSync(() => {
        dockRoot.render(<CanvasDock bridge={nextBridge} />);
      });
    },
    showShortcuts() {
      // The gesture arrives from outside React, so the store writes and the
      // subscription re-renders; `flushSync` settles it before this returns.
      flushSync(() => sheet.set(true));
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
