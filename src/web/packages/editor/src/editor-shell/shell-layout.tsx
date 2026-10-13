import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { CompositionPane } from "../panes/composition/composition-pane.js";
import type { PublishSwitch } from "../publish-client.js";
import {
  readShortcutOverrides,
  resolveShortcuts,
  type ShortcutOverrides,
  setActiveShortcuts,
} from "../shortcut-manager/bindings.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import { CanvasContextMenu } from "./canvas-context-menu.js";
import { CanvasDock } from "./canvas-dock.js";
import { DiagnosticMessage } from "./diagnostic-message.js";
import { DisplaySwitch } from "./display-switch.js";
import { DocumentIdentity } from "./document-identity.js";
import { HostingStore } from "./hosting-store.js";
import { RAIL_GLYPHS } from "./icons.js";
import { LayerActions } from "./layer-panel.js";
import {
  applyShellPalette,
  prefersDarkAppearance,
  readShellChoice,
  resolveShellPalette,
  systemShellPalette,
  watchSystemAppearance,
} from "./palette.js";
import { Pane } from "./pane.js";
import { PublishControl } from "./publish-control.js";
import { PublishIndicator } from "./publish-indicator.js";
import { Rail, type RailSlot } from "./rail.js";
import { SaveState } from "./save-state.js";
import type { EditorViewControls } from "./session-facade.js";
import { Settings } from "./settings.js";
import { ShellMenuBar } from "./shell-menu-bar.js";
import {
  PublishSurfaceStore,
  SelectionStore,
  SheetStore,
  useSelection,
  useSheet,
} from "./shell-stores.js";
import { ShortcutReference } from "./shortcut-reference.js";

/** Persistent DOM owners the imperative panels mount into. React positions
 * these; it never renders panel content. The Composition pane has no node
 * here: the tree is React-owned and renders inside `Shell` from the bridge
 * directly. */
interface ShellHosts {
  readonly canvas: HTMLElement;
  /** The Add pane's body: the insert list and, at its foot, the declared-asset
      library (`§5.2` absorbs the Assets pane into Add). */
  readonly add: HTMLElement;
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
  /** The shell's own projection of the selection, for the panes that read it —
   *  the Tokens pane's preset chooser opens on the preset the selection is set
   *  in rather than on the first declared one (`vg-094`). */
  readonly selection: SelectionStore;
  /** Brings a slot's pane into view and scrolls it to `target`, a CSS selector
   *  inside the pane body. One owner opens a slot and scrolls a pane, because
   *  a pane that is not showing has no scroll target to reach: the reveal is
   *  two steps and this is the only place that knows both. */
  reveal(slot: RailSlot, target?: string): void;
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
  /** Opens the publish surface — the act the header's own control performs on a
   *  press. The session's `publish.surface` chord routes through here rather
   *  than through a second publish path, and it moves no host state: the switch
   *  inside the surface is the only control that does. */
  showPublishing(): void;
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

export function createShellLayout(root: HTMLElement): ShellLayout {
  const storage = readStorage();
  const initial = resolveShellPalette(
    storage === undefined ? undefined : readShellChoice(storage),
    prefersDarkAppearance(),
  );
  applyShellPalette(initial);
  // The effective binding table is written once, here, before anything can
  // press a key: the dispatcher, the menubar, the dock's tooltips and the
  // header's publish chord all read this one table.
  const initialOverrides: ShortcutOverrides =
    storage === undefined ? {} : readShortcutOverrides(storage);
  setActiveShortcuts(resolveShortcuts(initialOverrides));

  const hosts: ShellHosts = {
    canvas: element(),
    add: element("vigiliaPanelHostAdd"),
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
  const publishSurface = new PublishSurfaceStore();
  const hosting = new HostingStore();
  /** `Shell`'s door for a caller outside React, filled by the component below
   *  because the slot, the scroll memory and the one `paneBody` element are all
   *  the component's. A plain cell rather than a ref, because
   *  `createShellLayout` is not a component and `useRef` has no dispatcher
   *  there. Opening a pane for a reveal and opening it from the rail stay the
   *  same code path. */
  let revealPane: ((slot: RailSlot, target?: string) => void) | undefined;
  const getView = (): EditorViewControls | undefined => view;

  function Shell(): React.JSX.Element {
    const [palette, setPalette] = useState(initial);
    /** Whether the OS is still choosing. Initialized from storage — the same
     *  question `createShellLayout` asked for `initial` — and moved from there
     *  by the Appearance tab, which owns the choice and writes both this and
     *  storage in one step. */
    const [following, setFollowing] = useState(
      storage === undefined || readShellChoice(storage) === undefined,
    );
    const [slot, setSlot] = useState<RailSlot>("composition");
    const [collapsed, setCollapsed] = useState(false);
    /** §7's settings modal, opened by the rail's gear. Local state, like the
     *  palette above: it is a shell surface, not document state, and it is
     *  never serialized. */
    const [settingsOpen, setSettingsOpen] = useState(false);
    /** The author's bindings, held here because the effective table lives
     *  outside React. Initialized from storage — the same read
     *  `createShellLayout` made for the live table — and moved from there by
     *  the Keyboard tab, which asks for a new set and writes storage itself. */
    const [overrides, setOverrides] = useState(initialOverrides);
    const applyOverrides = (next: ShortcutOverrides): void => {
      setOverrides(next);
      setActiveShortcuts(resolveShortcuts(next));
    };
    /** The document's name and the release version both come through the
     *  shell's one reading of `ThemeMetadata` — the bridge snapshot — so the
     *  About tab's version is the same fact the Document pane's
     *  `releaseVersion` row reads, never a second source. */
    const { activeKind: kind, releaseVersion } = useSelection(store);
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
     *  `following` is the same condition `readShellChoice` answers, held as the
     *  state the Appearance tab's toggle is: it is written where the choice is,
     *  so the two cannot disagree, and it holds when the browser refused its
     *  storage — where a storage read would call every session choice "no
     *  choice" and let the OS overrule it. The subscription is armed only while
     *  following, so a palette change re-renders nothing here. */
    useEffect(() => {
      if (!following) return;
      return watchSystemAppearance((prefersDark) => {
        const next = systemShellPalette(prefersDark);
        applyShellPalette(next);
        setPalette(next);
      });
    }, [following]);

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

    // Reassigned every render, so the callback never closes over a stale slot
    // or a stale collapse. A layout effect rather than the render body, because
    // writing a ref while rendering is the one thing React forbids.
    useLayoutEffect(() => {
      revealPane = (id, target) => {
        // The offset of the pane being left, read before the swap hides it —
        // the same save `choosePane` makes, for the same reason.
        if (!collapsed && paneBody.current !== null) {
          scrollOf.current.set(slot, paneBody.current.scrollTop);
        }
        setSlot(id);
        setCollapsed(false);
        requestAnimationFrame(() => {
          const body = paneBody.current;
          if (body === null) return;
          const row = target === undefined ? null : body.querySelector(target);
          // A target the pane no longer holds falls back to the place the pane
          // was left, which is still the honest answer.
          if (row === null) body.scrollTop = scrollOf.current.get(id) ?? 0;
          else row.scrollIntoView({ block: "start" });
        });
      };
    });

    return (
      <div className="editor-shell">
        {/* A full-width strip, not a floating card: the header is the window's
            top edge, and §7.1 gives it document- and editor-level actions only.
            The brand and the three menus sit left; the publish control is the
            editor's one filled accent button, on the right. No tagline and no
            document readout — a per-document fact belongs on the canvas (§7.5),
            and the readout only grew with the LAN. The shell palette is not
            here either: §7 makes it a set-once choice and it lives in
            Settings, at the accepted cost of no at-a-glance readout. */}
        <header className="editor-shell-header">
          <strong>{uiCopy.brand}</strong>
          <ShellMenuBar store={store} getView={getView} />
          <PublishControl
            session={store.bridge?.session}
            publish={publish}
            hosting={hosting}
            surface={publishSurface}
          />
        </header>
        <div className="editor-shell-body" data-collapsed={collapsed}>
          {/* The rail is the left edge's own column, ahead of the pane's, so
              the canvas gets the pane's width back and the slots read as one
              vertical choice rather than a second navigation bar. */}
          <Rail
            slot={slot}
            collapsed={collapsed}
            onChoose={choosePane}
            onOpenSettings={() => setSettingsOpen(true)}
          />
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
                by — and the other three are named for their rail slot. The
                visible title is the slot's own word, as the other three are;
                the `layers` name is only the DOM handle. */}
            <Pane
              id="layers"
              title={uiCopy.rail.slots.composition}
              icon={RAIL_GLYPHS.composition}
              hidden={slot !== "composition"}
              footer={<LayerActions bridge={store.bridge} />}
            >
              <CompositionPane bridge={store.bridge} />
            </Pane>
            {/* The Add pane's body — the insert list and, at its foot, the
                declared-asset library — is one host and one React tree. `§5.2`
                puts the file path in Add, and a fourth slot for it would be a
                slot DESIGN.md does not name. */}
            <Pane
              id="add"
              title={uiCopy.rail.slots.add}
              icon={RAIL_GLYPHS.add}
              hidden={slot !== "add"}
            >
              <Host node={hosts.add} hidden={slot !== "add"} />
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
            aria-label={uiCopy.stage.label}
          >
            <Host node={hosts.canvas} />
            {/* §7.5's two top corners in one row, which is what keeps §7.7's
                "clusters cannot collide" true without either knowing the
                other's width. The row is `pointer-events: none`; the two
                clusters take it back, so the band between them is still the
                canvas's. */}
            <div className="editor-shell-stage-top">
              {/* What the author is editing, in the corner §7.5 gives identity.
                  It reads the store rather than a prop, so a bridge set after
                  the shell mounted — and a rename after that — reaches it too. */}
              <DocumentIdentity store={store} />
              {/* The store, not a local: a late-set bridge must reach the
                  readout the same way it reaches the inspector and menus. */}
              {store.bridge === undefined ? null : (
                <DisplaySwitch
                  viewport={store.bridge.editor.viewport}
                  artboard={store.bridge.editor.artboard}
                />
              )}
            </div>
            {/* The dock owns its own element and derives its own visibility;
                this is only the slot that puts its mount point in the stage. */}
            <Host node={hosts.dock} />
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
            {/* §7's settings modal. The gear's route is the rail's
                `onOpenSettings`; the modal returns focus to the gear itself.
                `storage` is the browser-local store the palette already uses. */}
            <Settings
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              storage={storage}
              palette={palette}
              following={following}
              onPalette={setPalette}
              onFollowing={setFollowing}
              overrides={overrides}
              onOverrides={applyOverrides}
              releaseVersion={releaseVersion}
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
              <p className="editor-shell-hint">{uiCopy.selectionHint}</p>
            )}
          </aside>
        </div>
        <footer id="status" className="editor-shell-status">
          <Host node={hosts.status} />
          <DiagnosticMessage canvas={store.bridge?.editor.canvas} />
          <SaveState session={store.bridge?.session} />
          {/* The host's own fact, beside the save state: an unknown host renders
              no mark rather than "not live". */}
          <PublishIndicator store={hosting} />
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
    selection: store,
    reveal(slot, target) {
      revealPane?.(slot, target);
    },
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
    showPublishing() {
      // The gesture arrives from outside React and lands on the popover's own
      // open flag, exactly as a press on the header control does: the chord
      // reveals the surface and touches nothing the host is doing.
      flushSync(() => publishSurface.set(true));
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
