// @vitest-environment jsdom

/**
 * A card the theme cannot express, through each of the three surfaces that
 * offer one.
 *
 * **Reachable, not theoretical.** On a blank theme (`File > New`) the palette
 * carries ten tokens and the cards name `palette.cpu`, `palette.gpu`,
 * `palette.ram`, `palette.vram`, `palette.down`, `palette.sparkArea` and
 * `palette.storageFill` — so only Clock survives. The author does `Insert >
 * Card > CPU`, and before this was fixed **nothing happened, nothing was
 * said**, and an unhandled rejection went to the console.
 *
 * The cause was a per-surface one, which is why this drives all three rather
 * than one: the Add pane wrapped the promise in `constructing`, which reported
 * it, and the Insert menu and the canvas context menu both dispatched through a
 * façade typed `insertCard(cardId): void`, which **discarded** the rejecting
 * promise. Two of three surfaces swallowed the same refusal.
 *
 * Every surface here is the real one — the real panel, the real menu, the real
 * context menu — against a real `EditorSession` on a blank theme, so this fails
 * if any surface stops reaching the owner or the owner stops reporting.
 */
import { Canvas } from "fabric/es";
import { createRoot, type Root } from "react-dom/client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetManager } from "./asset-manager/index.js";
import { createBlankFabricTheme } from "./new-fabric-theme.js";
import { uiCopy } from "./ui-copy.js";
import { CanvasContextMenu } from "./editor-shell/canvas-context-menu.js";
import type { EditorShellBridge } from "./editor-shell/bridge.js";
import { createShellLayout } from "./editor-shell/shell-layout.jsx";
import { EditorSession } from "./editor-session.js";
import { createErrorManager } from "./error-manager/index.js";
import { createNewObjectPanel } from "./new-object-panel.js";
import { createDeletionManager } from "./deletion-manager/index.js";
import { createClipboardManager } from "./clipboard-manager/index.js";
import { idleCrop } from "./selection-inspector/idle-crop.test-stage.js";
import { artboardSize } from "./artboard-presets.js";

// Base UI's popup needs two browser APIs jsdom has none of: floating-ui observes
// its anchor, and the popup waits for its own open transition before reporting
// itself open. Without them the Insert menu never mounts.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];

// jsdom's selector engine cannot answer `:modal`/`:popover-open`, and
// floating-ui asks for both on every position. Each unanswerable call costs
// ~0.5s of selector parsing, which turns one menu open into ~35s. Real browsers
// answer both.
beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

/**
 * What the author was told. `createErrorManager` fires `editor:warning` on the
 * canvas, and that is the event the shell's diagnostic surface renders — so
 * this reads the real message rather than a stub's return value.
 */
const told: string[] = [];

/** The palette of `File > New`: ten tokens, none of them a device's colour. */
const BLANK = createBlankFabricTheme(
  artboardSize("16:9", "1080p", "landscape"),
);

/** React schedules outside `act`, and floating-ui's measurement never settles
 * inside one, so a popup is flushed with macrotasks instead. */
async function flush(): Promise<void> {
  for (let round = 0; round < 3; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

interface Wired {
  readonly session: EditorSession;
  readonly facade: ReturnType<EditorSession["actionFacade"]>;
  readonly errors: ReturnType<typeof createErrorManager>;
  readonly canvas: Canvas;
}

/** A real session on a real blank theme, over a real Fabric canvas. */
function wiredSession(): Wired {
  const element = document.createElement("canvas");
  element.width = 1920;
  element.height = 1080;
  document.body.append(element);
  const canvas = new Canvas(element);
  const errors = createErrorManager(canvas);
  // The editor's own diagnostics, read as the shell's diagnostic surface reads
  // them: `createErrorManager` fires `editor:warning` on the canvas.
  canvas.on(
    "editor:warning" as never,
    ((event: { message: string }) => {
      told.push(event.message);
    }) as never,
  );
  const save = vi.fn();

  const session = new EditorSession({
    assetManager: new AssetManager(),
    shell: {
      editor: {
        canvas,
        errorManager: errors,
        clipboardManager: createClipboardManager({
          canvas,
          save,
          errors,
          deletion: createDeletionManager(canvas, save),
          importImage: vi.fn(async () => null),
        }),
        textManager: {
          addText: vi.fn(),
          setAuthoringView: vi.fn(),
          setRepaint: vi.fn(),
        },
        cropManager: idleCrop(),
        viewport: {
          zoom: () => 1,
          display: () => undefined,
          isFitted: () => false,
          onChange: () => () => undefined,
        },
        artboard: () => ({ width: 1920, height: 1080 }),
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input: unknown) => input),
      setBackgroundMedia: vi.fn(),
    } as never,
    source: {} as never,
    envelope: BLANK,
    panelHosts: {
      add: document.body,
      assets: document.body,
      document: document.body,
      selection: document.body,
    },
    onNew: vi.fn(),
    onNewFromStarter: vi.fn(),
    onSaved: vi.fn(),
  });
  return { session, facade: session.actionFacade(), errors, canvas };
}

beforeEach(() => {
  told.length = 0;
  document.body.replaceChildren();
});

/**
 * A theme whose palette is not the starter's.
 *
 * `vg-128`, and the finding that made it a design question rather than a bug.
 * This is the **blank theme** — `File > New`, ten tokens, none of them a
 * device's colour — and it is where the ruling bites hardest: **seven of the
 * eight cards used to be refused here**, because refusing is what kept an
 * unresolved reference out of a document that `snapshot` validates and throws
 * on. The refusal was safe and it was unusable, and the library was dead exactly
 * where an author meets it first.
 *
 * So a blank theme now *inserts*, and says what it mapped. The refusal survives
 * for the theme that genuinely cannot express a card at all, which is a
 * document with no palette to build from — the Add pane's own rule, and pinned
 * below through the same three surfaces an author can reach.
 */
describe("a card a theme with its own vocabulary cannot name", () => {
  it("is inserted and mapped, and the author is told, from the Add pane", async () => {
    const { session, errors, canvas } = wiredSession();
    const panel = createNewObjectPanel(
      document.body,
      editorOf(canvas, errors),
      {
        palette: BLANK.globals?.palette ?? {},
        typePresets: BLANK.globals?.typePresets ?? {},
      },
      {
        addChart: vi.fn(),
        insertCard: (cardId) => session.actionFacade().insertCard(cardId),
      },
    );

    const cpu = [...panel.root.querySelectorAll("button")].find(
      (button) => button.textContent === uiCopy.cardLibrary.cpu,
    );
    cpu?.click();
    await flush();

    // **Both halves.** The card is on the canvas, and nothing in it is
    // unresolved: the blank theme has no `palette.cpu`, so the card's icon and
    // sparkline are painted with the content token it does have. Naming the
    // substituted token is what makes that editable rather than surprising.
    expect(canvas.getObjects()).toHaveLength(1);
    expect(told.join(" ")).toContain(uiCopy.cardLibrary.cpu);
    expect(told.join(" ")).toContain("palette.cpu");
    session.destroy();
  });

  it("is inserted and mapped, and the author is told, from the Insert menu", async () => {
    const { session, canvas } = wiredSession();
    const host = document.createElement("div");
    const layout = createShellLayout(host);
    // Attached first: the menubar renders eagerly, and `setBridge` is a
    // re-render of it rather than its mount.
    layout.setBridge(bridgeOf(session.actionFacade(), canvas), undefined);
    await Promise.resolve();

    // `act` is deliberately not used around the menu: Base UI's popup store
    // keeps re-rendering itself in jsdom and awaiting its effects never
    // settles. The click is the same one an author makes, and the popup is read
    // straight after.
    menubar(host, uiCopy.menus.insert).click();
    await Promise.resolve();
    const entry = menuItem(uiCopy.panels.cards, uiCopy.cardLibrary.cpu);
    expect(entry).toBeDefined();
    entry?.click();
    await flush();

    expect(canvas.getObjects()).toHaveLength(1);
    expect(told.join(" ")).toContain("palette.cpu");
    layout.destroy();
    session.destroy();
  });

  it("is inserted and mapped, and the author is told, from the canvas context menu", async () => {
    const { session, canvas } = wiredSession();
    const host = document.createElement("div");
    document.body.append(host);
    canvas.upperCanvasEl.className = "upper-canvas";
    host.append(canvas.upperCanvasEl);

    const root: Root = createRoot(host);
    root.render(
      <CanvasContextMenu bridge={bridgeOf(session.actionFacade(), canvas)} />,
    );
    await flush();
    canvas.upperCanvasEl.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 90,
      }),
    );
    await flush();

    const entry = menuItem(uiCopy.panels.cards, uiCopy.cardLibrary.cpu);
    expect(entry).toBeDefined();
    entry?.click();
    await flush();

    expect(canvas.getObjects()).toHaveLength(1);
    expect(told.join(" ")).toContain("palette.cpu");
    root.unmount();
    session.destroy();
  });
});

/* ---- the surfaces' own wiring, stated once each ---- */

function editorOf(
  canvas: Canvas,
  errors: Wired["errors"],
): Parameters<typeof createNewObjectPanel>[1] {
  return {
    canvas,
    artboard: () => ({ width: 1920, height: 1080 }),
    historyManager: { saveState: vi.fn() },
    textManager: { addText: vi.fn() },
    errorManager: errors,
  } as never;
}

function bridgeOf(
  facade: ReturnType<EditorSession["actionFacade"]>,
  canvas: Canvas,
): EditorShellBridge {
  return {
    snapshot: () => ({ selectedCount: 0, locked: false, activeKind: "none" }),
    target: () => ({
      kind: "none",
      locked: false,
      memberCount: 0,
      isGroup: false,
    }),
    can: () => false,
    canArrange: () => false,
    layers: () => [],
    groupContext: () => [],
    selectLayer: vi.fn(),
    setLayerVisible: vi.fn(),
    setLayerLocked: vi.fn(),
    setCollapsed: vi.fn(),
    renameLayer: vi.fn(),
    sameLayerParent: () => false,
    reorderLayer: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
    capture: () => undefined,
    session: facade,
    editor: {
      canvas,
      // Read by the display switch for the group of previews that leads.
      artboard: () => ({ width: 1920, height: 1080 }),
      // The zoom readout subscribes to it, so an absent camera is a throw
      // rather than an exercise of the shell.
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: () => () => undefined,
      },
    } as never,
    destroy: vi.fn(),
  } as unknown as EditorShellBridge;
}

function menubar(root: HTMLElement, label: string): HTMLElement {
  const found = [
    ...root.querySelectorAll<HTMLElement>(".editor-shell-menubar button"),
  ].find((button) => button.textContent === label);
  if (found === undefined) throw new Error(`No "${label}" menu.`);
  return found;
}

/**
 * The entry under a named group, which is what tells the two "Line"s apart.
 *
 * Read by whichever the surface carries: the Insert menu names an item by its
 * text, the canvas context menu sets `aria-label` to the same string.
 */
function menuItem(group: string, label: string): HTMLElement | undefined {
  const heading = [
    ...document.body.querySelectorAll<HTMLElement>(".editor-shell-menu-label"),
  ].find((element) => element.textContent === group);
  return [
    ...(heading?.parentElement?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]',
    ) ?? []),
  ].find(
    (item) =>
      item.getAttribute("aria-label") === label || item.textContent === label,
  );
}
