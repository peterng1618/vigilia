import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  buildScenePlan,
  createAssetResolver,
  mountScene,
  viewportToDocument,
  type SampleSource,
  type SceneHandle,
  type ThemeDocument,
  type Transform,
} from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { outermostOnly, placeNodes, type PlacedNode } from './geometry.js';
import { hitTest, hitTestInside, marqueeSelect } from './hit-test.js';
import { deferToTarget } from './keyboard.js';
import {
  addToSelection,
  applyClick,
  clearSelection,
  emptySelection,
  enterGroup,
  exitAllGroups,
  exitGroup,
  pruneSelection,
  setSelection,
  type SelectionMode,
  type SelectionState,
} from './selection.js';
import {
  applyGesture,
  type GestureModifiers,
  type GestureNode,
  type GestureStart,
  type Handle,
} from './transform-gesture.js';
import {
  collectSnapTargets,
  snapMove,
  thresholdInDocumentUnits,
  type SnapGuide,
} from './snapping.js';
import { collectIds, deleteNodes, findNode, updateTransforms } from './commands.js';
import {
  canRedo,
  canUndo,
  cancelPreview,
  commit,
  createHistory,
  isDirty,
  markSaved,
  replaceDocument,
  preview,
  redo,
  undo,
  undoLabel,
  visibleDocument,
  type History,
} from './history.js';
import { createOverlay } from './overlay.js';
import { unionBounds } from './geometry.js';
import { describeSelection } from './inspector-model.js';
import { applyFieldChange, labelForField } from './inspector-apply.js';
import { createInspector } from './inspector-panel.js';
import {
  addGlobal,
  collectGlobalUsage,
  deleteGlobal,
  nextGlobalKey,
  rekeyGlobal,
  renameGlobal,
  setGlobalValue,
} from './globals-commands.js';
import { createGlobalsPanel, seedForGroup, type GlobalAction } from './globals-panel.js';
import {
  describeIssues,
  fileNameFor,
  parseThemeFile,
  serializeForFile,
} from './persist.js';
import {
  alignNodes,
  describeRefusal,
  distributeNodes,
  freeGroupId,
  groupNodes,
  ungroupNodes,
  type AlignEdge,
  type ArrangeResult,
} from './arrange.js';

/**
 * The editor shell.
 *
 * Thin on purpose. Every decision — what a click selects, what a drag does to a
 * transform, where a snap lands, what undo restores — lives in the pure modules
 * beside this file and is unit-tested in Node. This translates pointer and
 * keyboard events into those calls and draws the result, which is the same
 * plan/mount discipline the renderer uses.
 *
 * ADR-0005: the scene is rendered by `@vigilia/renderer-core`, exactly as the
 * player renders it, with selection and handles added as an overlay. So there is
 * one renderer and no possibility of editor/display drift.
 *
 * SCAFFOLD STATUS: the document comes from a checked-in fixture and the data
 * from `@vigilia/fake-source`. Opening and saving real files is Gate 4; live
 * sensors are Gate 3, deferred by ADR-0006.
 */

echarts.use([GaugeChart, LineChart, BarChart, PieChart, GridComponent, CanvasRenderer]);

/** Snap threshold in viewport pixels, converted to document units per gesture. */
const SNAP_PIXELS = 7;

/** Arrow-key nudge, in artboard units. Shift multiplies it. */
const NUDGE = 1;
const NUDGE_LARGE = 10;

/**
 * Double-click window and slop, for detecting one ourselves.
 *
 * The browser's `dblclick` cannot be used here. This editor calls
 * `setPointerCapture` on pointerdown so a drag keeps receiving moves when the
 * pointer leaves the stage — and capture retargets `pointerup` to the capturing
 * element, so pointerdown and pointerup no longer share a target and the
 * browser never synthesises `click` at all, let alone `dblclick`. Verified by
 * logging every event during a double-click: only pointerdown and pointerup
 * arrive.
 *
 * Detecting it from consecutive pointerdowns is not a workaround so much as the
 * more honest primitive: it works identically for touch, and it lets a
 * double-tap be tuned independently of an OS mouse setting.
 */
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_SLOP = 5;

interface DragState {
  readonly gesture: GestureStart;
  readonly pointerId: number;
  /** Viewport position where the drag began, for the marquee. */
  readonly viewportOrigin: { x: number; y: number };
  readonly kind: 'transform' | 'marquee';
  /**
   * This press *could* complete a double-click, if the pointer is released
   * without travelling.
   *
   * Deciding on release rather than on the press is what makes both gestures
   * work. Acting on the second press swallows a click-then-drag at the same
   * spot — which a browser test caught immediately, because "select, then drag
   * it somewhere" is the most common thing anyone does in an editor.
   */
  readonly doubleClickCandidate: { readonly id: string; readonly point: { x: number; y: number } } | undefined;
  /** Set once the pointer travels far enough that this is definitely a drag. */
  moved: boolean;
}

function start(): void {
  const host = document.querySelector<HTMLElement>('#stage');
  const status = document.querySelector<HTMLElement>('#status');
  const work = document.querySelector<HTMLElement>('#work');

  if (host === null || status === null || work === null) {
    throw new Error('Editor shell is missing #stage, #work or #status.');
  }

  const parameters = new URLSearchParams(window.location.search);
  const theme = loadDemoTheme(parameters.get('theme') ?? 'demo');

  let history: History = createHistory(theme);
  let selection: SelectionState = emptySelection;
  let drag: DragState | undefined;
  let guides: readonly SnapGuide[] = [];
  let marquee: { x: number; y: number; width: number; height: number } | undefined;
  let lastDown: { time: number; x: number; y: number; id: string | undefined } | undefined;

  const source: SampleSource = createDemoSource(Date.now());
  const resolveAsset = createAssetResolver(theme.assets, { baseUrl: '/' });

  const plan = (document_: ThemeDocument) =>
    buildScenePlan({ document: document_, source, nowMs: Date.now(), resolveAsset });

  let handle: SceneHandle = mountScene({ host, plan: plan(visibleDocument(history)) });
  const overlay = createOverlay(host);

  // One right-hand column with two tabs: the selection, and the theme's
  // globals. Globals are document-level, so they cannot live inside the
  // inspector — which says "nothing selected" exactly when an author most
  // wants to look at the palette.
  const panel = document.createElement('div');
  panel.dataset['vigiliaPanel'] = 'root';
  panel.style.cssText = [
    'width:300px',
    'flex:none',
    'display:flex',
    'flex-direction:column',
    'min-height:0',
    'background:#151922',
    'border-left:1px solid #232a36',
  ].join(';');
  work.append(panel);

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;flex:none;border-bottom:1px solid #232a36';
  panel.append(tabs);

  const body = document.createElement('div');
  body.style.cssText = 'flex:1;min-height:0;display:flex;padding:0 10px';
  panel.append(body);

  let tab: 'element' | 'theme' = 'element';

  /**
   * What each panel last rendered, so a redraw can be skipped.
   *
   * Declared here because the panels' own callbacks reset them — an edit that
   * is refused changes no document and would otherwise skip the redraw that
   * snaps the field back. See `drawInspector` and `drawGlobals` for why the
   * guards exist at all.
   */
  let inspectorKey = '';
  let globalsKey = '';

  /**
   * The node ids the scene was last mounted with.
   *
   * `mountScene.update` refuses a plan whose ids differ — it is for new data,
   * not a new document — so a change to the set means a remount. Opening a file
   * clears this, because every id changed at once.
   */
  let lastIds = [...collectIds(visibleDocument(history).nodes)].join(',');

  const inspector = createInspector(body, {
    onChange(key, change) {
      const document_ = history.current;
      const next = applyFieldChange(document_, selection.ids, key, change);

      // Identity: `applyFieldChange` returns the same document when a change
      // did not apply — a refused value, an unknown key — and committing then
      // would put an undo entry in history that does nothing.
      if (next !== document_) {
        history = commit(history, labelForField(key), next);
      } else {
        // Refused. The redraw guard compares against the last content
        // rendered, and a refused edit changes nothing — so without this the
        // panel skips the redraw and the author's rejected input stays on
        // screen looking accepted. Clearing the key forces the field back to
        // the real value.
        inspectorKey = '';
      }

      render();
    },
  });

  const globalsPanel = createGlobalsPanel(body, {
    onAction(action) {
      const document_ = history.current;
      const next = applyGlobalAction(document_, action);

      if (next !== document_) {
        history = commit(history, labelForGlobalAction(action), next);
      } else {
        // See the inspector's `onChange`: a refused edit must snap back, and
        // the guard would otherwise skip the redraw that does it. An invalid
        // token key is the reachable case — `not a key` stayed in the field.
        globalsKey = '';
      }

      render();
    },
  });

  /**
   * A one-off message in the status bar.
   *
   * Arrange operations refuse for reasons an author cannot see from the
   * selection — "these two are in different groups", "ungrouping this would
   * shear a child". A refusal that silently does nothing reads as a broken
   * shortcut, so the reason is said out loud. Cleared by the next gesture.
   */
  let notice: string | undefined;

  const runArrange = (result: ArrangeResult, label: string): void => {
    if (result.refused !== undefined) {
      notice = describeRefusal(result.refused);
      drawStatus();
      return;
    }

    notice = undefined;

    if (result.document !== history.current) {
      history = commit(history, label, result.document);
    }

    if (result.select !== undefined) {
      selection = setSelection(selection, result.select);
    }

    selection = pruneSelection(selection, collectIds(visibleDocument(history).nodes));
    render();
  };

  const arrangeButtons: readonly (readonly [string, string, () => void])[] = [
    ['align-left', '⇤', () => runArrange(alignNodes(history.current, selection.ids, 'left'), 'Align left')],
    ['align-centre', '⇔', () => runArrange(alignNodes(history.current, selection.ids, 'centre'), 'Align centre')],
    ['align-right', '⇥', () => runArrange(alignNodes(history.current, selection.ids, 'right'), 'Align right')],
    ['align-top', '⇡', () => runArrange(alignNodes(history.current, selection.ids, 'top'), 'Align top')],
    ['align-middle', '⇕', () => runArrange(alignNodes(history.current, selection.ids, 'middle'), 'Align middle')],
    ['align-bottom', '⇣', () => runArrange(alignNodes(history.current, selection.ids, 'bottom'), 'Align bottom')],
    ['distribute-x', '⋯', () => runArrange(distributeNodes(history.current, selection.ids, 'x'), 'Distribute horizontally')],
    ['distribute-y', '⋮', () => runArrange(distributeNodes(history.current, selection.ids, 'y'), 'Distribute vertically')],
  ];

  /**
   * Opening and saving.
   *
   * A hidden `<input type=file>` and a generated download rather than the File
   * System Access API: there is no host to save *to* yet (ADR-0006), so this is
   * a stopgap either way, and a picker-plus-download round trip is one a test
   * can actually drive.
   */
  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = 'application/json,.json';
  filePicker.dataset['vigiliaOpen'] = 'input';
  filePicker.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
  panel.append(filePicker);

  filePicker.addEventListener('change', () => {
    const file = filePicker.files?.[0];

    if (file === undefined) {
      return;
    }

    void file.text().then((text) => {
      const result = parseThemeFile(text);

      // The picker is reset either way, or choosing the same file twice in a
      // row fires no change event and looks like a dead button.
      filePicker.value = '';

      if (!result.ok) {
        // Loudly, and without touching the open document: a theme that fails
        // validation is exactly the case §141 exists for, and silently keeping
        // half of it would be worse than refusing.
        notice = `Could not open: ${describeIssues(result.issues)}`;
        drawStatus();
        return;
      }

      // A new file is a new history. An undo that crossed a file boundary would
      // restore half of another theme.
      history = replaceDocument(history, result.document);
      selection = clearSelection(exitAllGroups(selection));
      notice = `Opened ${file.name}`;
      lastIds = '';
      inspectorKey = '';
      globalsKey = '';
      render();
    });
  });

  const saveTheme = (): void => {
    const document_ = history.current;
    const blob = new Blob([serializeForFile(document_)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileNameFor(document_);
    anchor.click();

    URL.revokeObjectURL(url);

    // §139: saving marks the history clean WITHOUT clearing it, so undo still
    // reaches edits from before the save. This is the first caller — the rule
    // has been unit-tested since the history module existed and until now had
    // never run in the product.
    history = markSaved(history);
    notice = `Saved ${anchor.download}`;
    render();
  };

  const toolbar = document.createElement('div');
  toolbar.dataset['vigiliaToolbar'] = 'arrange';
  // Two rows, not one wrapped row. Ten controls do not fit one 300 px row: the
  // first version clipped the last align button off the panel's edge, and
  // wrapping then left it orphaned on a line of its own. Both were visible in
  // the committed screenshot, which is what committing them is for.
  toolbar.style.cssText = [
    'display:flex',
    'flex:none',
    'gap:2px',
    'padding:4px 8px',
    'border-bottom:1px solid #232a36',
  ].join(';');
  panel.insertBefore(toolbar, body);

  const fileBar = document.createElement('div');
  fileBar.dataset['vigiliaToolbar'] = 'file';
  fileBar.style.cssText = 'display:flex;flex:none;gap:4px;padding:4px 8px 0';
  panel.insertBefore(fileBar, toolbar);

  const fileButtons: readonly (readonly [string, string, string, () => void])[] = [
    ['open', 'Open', 'Open a theme file (Ctrl+O)', () => filePicker.click()],
    ['save', 'Save', 'Download this theme (Ctrl+S)', saveTheme],
  ];

  for (const [id, label, title, run] of fileButtons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.dataset['vigiliaFile'] = id;
    button.style.cssText = [
      'flex:none',
      'height:22px',
      'padding:0 8px',
      'background:#1d2530',
      'color:#8a97ab',
      'border:1px solid #2a3242',
      'border-radius:3px',
      'cursor:pointer',
      'font:11px/1 system-ui,sans-serif',
    ].join(';');
    button.addEventListener('click', run);
    fileBar.append(button);
  }

  for (const [id, glyph, run] of arrangeButtons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = glyph;
    button.title = id.replace('-', ' ');
    button.dataset['vigiliaArrange'] = id;
    button.style.cssText = [
      'flex:1 1 22px',
      'min-width:0',
      'height:22px',
      'background:#1d2530',
      'color:#8a97ab',
      'border:1px solid #2a3242',
      'border-radius:3px',
      'cursor:pointer',
      'font:12px/1 system-ui,sans-serif',
    ].join(';');
    button.addEventListener('click', run);
    toolbar.append(button);
  }

  const drawToolbar = (): void => {
    // Enabled by selection count, so the buttons say when they are usable
    // rather than refusing after the fact. Distribute needs three; align needs
    // two.
    // Scoped to the arrange buttons. Selecting every button in the toolbar also
    // caught Open and Save, which then sat disabled until two nodes were
    // selected — two browser tests timed out clicking Save before this line
    // was narrowed.
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-vigilia-arrange]')) {
      const needs = button.dataset['vigiliaArrange']?.startsWith('distribute') === true ? 3 : 2;
      const enabled = selection.ids.length >= needs;

      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.4';
      button.style.cursor = enabled ? 'pointer' : 'default';
    }
  };

  const drawTabs = (): void => {
    tabs.textContent = '';

    for (const [id, label] of [
      ['element', 'Element'],
      ['theme', 'Theme'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset['vigiliaTab'] = id;
      button.style.cssText = [
        'flex:1',
        'padding:6px 4px',
        'background:none',
        'border:none',
        `border-bottom:2px solid ${tab === id ? '#4c9aff' : 'transparent'}`,
        `color:${tab === id ? '#e8ecf3' : '#8a97ab'}`,
        'font:11px/1.4 system-ui,sans-serif',
        'text-transform:uppercase',
        'letter-spacing:0.06em',
        'cursor:pointer',
      ].join(';');
      button.addEventListener('click', () => {
        if (tab === id) {
          return;
        }

        tab = id;
        // Forces both panels to redraw: their guards compare against the last
        // content they rendered, and a hidden panel's content did not change.
        inspectorKey = '';
        globalsKey = '';
        render();
      });
      tabs.append(button);
    }

    inspector.root.style.display = tab === 'element' ? 'block' : 'none';
    globalsPanel.root.style.display = tab === 'theme' ? 'block' : 'none';
    inspector.root.style.flex = '1';
    globalsPanel.root.style.flex = '1';
  };

  /**
   * Re-mounts the scene.
   *
   * Needed because `mountScene.update` deliberately refuses a plan whose node
   * ids differ — it is for new data, not a new document. Adding or deleting a
   * node is a new document, so the scene is rebuilt. Moving one is not, and
   * takes the cheap path.
   */
  const remount = (): void => {
    handle.dispose();
    overlay.root.remove();
    handle = mountScene({ host, plan: plan(visibleDocument(history)) });
    host.append(overlay.root);
  };

  const render = (): void => {
    const document_ = visibleDocument(history);
    const ids = [...collectIds(document_.nodes)].join(',');

    if (ids === lastIds) {
      handle.update(plan(document_));
    } else {
      lastIds = ids;
      remount();
    }

    drawOverlay();
    drawStatus();
    drawToolbar();
    drawTabs();
    drawInspector();
    drawGlobals();
  };

  const placed = (): PlacedNode[] => placeNodes(visibleDocument(history).nodes);

  const selectedPlacements = (): PlacedNode[] =>
    placed().filter((node) => selection.ids.includes(node.id));

  const drawOverlay = (): void => {
    const document_ = visibleDocument(history);
    const chosen = selectedPlacements();
    // From the same placements as the outline: handles derived from the raw
    // transform land in the wrong place for anything inside a group.
    const single = selection.ids.length === 1 ? chosen[0] : undefined;

    overlay.update({
      transform: handle.transform(),
      selected: chosen,
      handlesFor: single === undefined || single.locked ? undefined : single,
      guides,
      artboard: document_.artboard,
      marquee,
    });
  };

  /**
   * Redraws the inspector, but only when its content would differ.
   *
   * The panel is rebuilt wholesale, which loses focus — and `render()` also
   * runs on every 1 Hz data tick, so redrawing unconditionally would steal
   * focus from a field mid-typing once a second. The selection and the
   * committed document are what the panel depends on; live sample values are
   * not.
   */
  const drawInspector = (): void => {
    if (tab !== 'element') {
      return;
    }

    const document_ = history.current;
    const sections = describeSelection(document_, selection.ids);
    const key = JSON.stringify(sections);

    if (key === inspectorKey) {
      return;
    }

    inspectorKey = key;
    inspector.render(sections, document_.globals ?? {});
  };

  const drawGlobals = (): void => {
    if (tab !== 'theme') {
      return;
    }

    const usage = collectGlobalUsage(history.current);
    const key = JSON.stringify(usage);

    if (key === globalsKey) {
      return;
    }

    globalsKey = key;
    globalsPanel.render(usage);
  };

  const drawStatus = (): void => {
    const count = selection.ids.length;
    const inside = selection.enteredGroups.at(-1);

    status.textContent = [
      count === 0 ? 'Nothing selected' : count === 1 ? selection.ids[0] : `${count} selected`,
      inside === undefined ? undefined : `inside ${inside}`,
      canUndo(history) ? `undo: ${undoLabel(history)}` : undefined,
      canRedo(history) ? 'redo available' : undefined,
      isDirty(history) ? 'unsaved' : 'saved',
      notice,
    ]
      .filter((part) => part !== undefined)
      .join('  ·  ');
  };

  const toDocument = (event: PointerEvent | MouseEvent) => {
    const rect = host.getBoundingClientRect();

    return viewportToDocument(handle.transform(), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const modifiersOf = (event: PointerEvent | KeyboardEvent): GestureModifiers => ({
    constrain: event.shiftKey,
    fromCentre: event.altKey,
  });

  /**
   * Shift toggles; ctrl does NOT touch the selection.
   *
   * Ctrl used to mean "toggle" here while also meaning "disable snapping"
   * during a move — so holding ctrl to avoid a snap silently changed what was
   * being dragged. In the worst case it added an ancestor of the node under the
   * cursor, and the gesture then moved both, sending the child twice as far as
   * the pointer.
   *
   * Shift-click toggling matches what authors expect from other design tools,
   * and it leaves ctrl free to mean one thing.
   */
  const selectionModeOf = (event: PointerEvent): SelectionMode =>
    event.shiftKey ? 'toggle' : 'replace';

  host.addEventListener('pointerdown', (event: PointerEvent) => {
    // Only the primary button starts a gesture; a right-click is for a context
    // menu that does not exist yet, and treating it as a drag would move things
    // by accident.
    if (event.button !== 0) {
      return;
    }

    // `closest`, not `event.target.dataset`. A handle is a hit area containing a
    // smaller visible dot, so the press lands on the dot — which carries no
    // dataset, so reading the target directly found nothing and every resize
    // silently became a move. The status bar said "Move element" while the
    // author dragged a resize handle.
    // A new gesture supersedes whatever the last refusal was about.
    notice = undefined;

    const grabbed = (event.target as HTMLElement | null)
      ?.closest('[data-vigilia-handle]')
      ?.getAttribute('data-vigilia-handle') as Handle | undefined;

    const document_ = visibleDocument(history);
    const point = toDocument(event);
    const hitNow = hitTest(document_.nodes, point, { enteredGroups: selection.enteredGroups });

    const isDoubleClick =
      grabbed === undefined &&
      lastDown !== undefined &&
      event.timeStamp - lastDown.time < DOUBLE_CLICK_MS &&
      Math.abs(event.clientX - lastDown.x) <= DOUBLE_CLICK_SLOP &&
      Math.abs(event.clientY - lastDown.y) <= DOUBLE_CLICK_SLOP &&
      lastDown.id === hitNow;

    lastDown = { time: event.timeStamp, x: event.clientX, y: event.clientY, id: hitNow };

    const candidate =
      isDoubleClick && hitNow !== undefined ? { id: hitNow, point } : undefined;

    host.setPointerCapture(event.pointerId);

    if (grabbed !== undefined && selection.ids.length > 0) {
      drag = {
        kind: 'transform',
        pointerId: event.pointerId,
        viewportOrigin: { x: event.clientX, y: event.clientY },
        gesture: {
          handle: grabbed,
          origin: point,
          nodes: gestureNodes(document_, placed(), selection.ids),
        },
        doubleClickCandidate: undefined,
        moved: false,
      };
      return;
    }

    const hit = hitNow;

    if (hit === undefined) {
      // Empty canvas: start a marquee, and deselect unless a modifier says to
      // keep what is already chosen.
      selection = applyClick(selection, undefined, selectionModeOf(event));
      drag = {
        kind: 'marquee',
        pointerId: event.pointerId,
        viewportOrigin: { x: event.clientX, y: event.clientY },
        gesture: { handle: 'move', origin: point, nodes: [] },
        doubleClickCandidate: undefined,
        moved: false,
      };
      render();
      return;
    }

    // Clicking an already-selected node keeps the whole selection, so dragging
    // a multi-selection does not collapse it to one node.
    if (!selection.ids.includes(hit) || selectionModeOf(event) !== 'replace') {
      selection = applyClick(selection, hit, selectionModeOf(event));
    }

    drag = {
      kind: 'transform',
      pointerId: event.pointerId,
      viewportOrigin: { x: event.clientX, y: event.clientY },
      gesture: {
        handle: 'move',
        origin: point,
        nodes: gestureNodes(document_, placed(), selection.ids),
      },
      doubleClickCandidate: candidate,
      moved: false,
    };

    render();
  });

  host.addEventListener('pointermove', (event: PointerEvent) => {
    if (drag === undefined || event.pointerId !== drag.pointerId) {
      return;
    }

    if (
      Math.abs(event.clientX - drag.viewportOrigin.x) > DOUBLE_CLICK_SLOP ||
      Math.abs(event.clientY - drag.viewportOrigin.y) > DOUBLE_CLICK_SLOP
    ) {
      drag.moved = true;
    }

    if (drag.kind === 'marquee') {
      const rect = host.getBoundingClientRect();
      const x = Math.min(drag.viewportOrigin.x, event.clientX) - rect.left;
      const y = Math.min(drag.viewportOrigin.y, event.clientY) - rect.top;

      marquee = {
        x,
        y,
        width: Math.abs(event.clientX - drag.viewportOrigin.x),
        height: Math.abs(event.clientY - drag.viewportOrigin.y),
      };

      drawOverlay();
      return;
    }

    const committed = history.current;
    const pointer = toDocument(event);
    const modifiers = modifiersOf(event);

    let transforms = applyGesture(drag.gesture, pointer, modifiers);

    // Snapping applies to a move only. A snapped resize needs the moving EDGE
    // compared against targets rather than the whole box, which is a different
    // calculation and is not implemented — so it is left off rather than
    // approximated with the wrong one.
    if (drag.gesture.handle === 'move' && !event.ctrlKey && !event.metaKey) {
      const bounds = unionBounds(
        placeNodes(committed.nodes).filter((node) => selection.ids.includes(node.id)),
      );

      if (bounds !== undefined) {
        const snapped = snapMove(
          bounds,
          { x: pointer.x - drag.gesture.origin.x, y: pointer.y - drag.gesture.origin.y },
          collectSnapTargets(
            placeNodes(committed.nodes),
            committed.artboard,
            new Set(selection.ids),
          ),
          { threshold: thresholdInDocumentUnits(SNAP_PIXELS, handle.transform().scale) },
        );

        guides = snapped.guides;
        transforms = applyGesture(
          drag.gesture,
          { x: drag.gesture.origin.x + snapped.delta.x, y: drag.gesture.origin.y + snapped.delta.y },
          modifiers,
        );
      }
    }

    if (transforms.size > 0) {
      // A preview, not a commit: §67 wants one undo entry per gesture.
      history = preview(history, updateTransforms(committed, transforms));
      render();
    }
  });

  const endDrag = (event: PointerEvent): void => {
    if (drag === undefined || event.pointerId !== drag.pointerId) {
      return;
    }

    const finished = drag;
    drag = undefined;
    guides = [];

    if (finished.kind === 'marquee') {
      if (marquee !== undefined && (marquee.width > 2 || marquee.height > 2)) {
        const document_ = visibleDocument(history);
        const rect = host.getBoundingClientRect();
        const from = viewportToDocument(handle.transform(), {
          x: finished.viewportOrigin.x - rect.left,
          y: finished.viewportOrigin.y - rect.top,
        });
        const to = toDocument(event);

        const hits = marqueeSelect(
          document_.nodes,
          { left: from.x, top: from.y, right: to.x, bottom: to.y },
          { enteredGroups: selection.enteredGroups },
        );

        selection = event.shiftKey
          ? addToSelection(selection, hits)
          : setSelection(selection, hits);
      }

      marquee = undefined;
      render();
      return;
    }

    // A press that never travelled and completed a double-click opens the group
    // instead of committing a transform. The preview is discarded: whatever
    // sub-pixel movement happened between the two clicks is not an edit.
    if (!finished.moved && finished.doubleClickCandidate !== undefined) {
      lastDown = undefined;
      history = cancelPreview(history);
      enterGroupAt(finished.doubleClickCandidate.id, finished.doubleClickCandidate.point);
      return;
    }

    const previewed = history.preview;

    history =
      previewed === undefined
        ? cancelPreview(history)
        : commit(history, labelFor(finished.gesture.handle, selection.ids.length), previewed);

    render();
  };

  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);

  /**
   * Enters the group under a point and selects what is actually there.
   *
   * Called from the synthesised double-click. If the target is not a group
   * there is nothing to enter, and the first click's selection already stands.
   */
  function enterGroupAt(outerId: string, point: { x: number; y: number }): void {
    const document_ = visibleDocument(history);
    const node = findNode(document_.nodes, outerId);

    if (node?.type !== 'group') {
      return;
    }

    selection = enterGroup(selection, outerId);
    const inner = hitTestInside(document_.nodes, point);

    if (inner !== undefined && inner !== outerId) {
      selection = applyClick(selection, inner);
    }

    render();
  }

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    const meta = event.ctrlKey || event.metaKey;

    // These are bound on `window`, so they also see everything typed into an
    // inspector field. `keyboard.ts` decides what a focused control keeps.
    const target = event.target;

    if (
      target instanceof HTMLElement &&
      deferToTarget(
        {
          tagName: target.tagName,
          type: target.getAttribute('type') ?? undefined,
          isContentEditable: target.isContentEditable,
        },
        event.key,
        meta,
      )
    ) {
      return;
    }

    if (meta && event.key.toLowerCase() === 'z') {
      history = event.shiftKey ? redo(history) : undo(history);
      selection = pruneSelection(selection, collectIds(visibleDocument(history).nodes));
      event.preventDefault();
      render();
      return;
    }

    if (meta && event.key.toLowerCase() === 'y') {
      history = redo(history);
      selection = pruneSelection(selection, collectIds(visibleDocument(history).nodes));
      event.preventDefault();
      render();
      return;
    }

    if (meta && event.key.toLowerCase() === 's') {
      // Ctrl+S is the browser's "save page", which is never what an author
      // means with an editor focused.
      event.preventDefault();
      saveTheme();
      return;
    }

    if (meta && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      filePicker.click();
      return;
    }

    // Ctrl+G / Ctrl+Shift+G, as every design tool binds them.
    if (meta && event.key.toLowerCase() === 'g') {
      event.preventDefault();

      if (event.shiftKey) {
        runArrange(ungroupNodes(history.current, selection.ids), 'Ungroup');
      } else {
        runArrange(
          groupNodes(history.current, selection.ids, freeGroupId(history.current)),
          'Group',
        );
      }

      return;
    }

    if (event.key === 'Escape') {
      selection = drag === undefined ? exitGroup(selection) : clearSelection(selection);
      history = cancelPreview(history);
      drag = undefined;
      marquee = undefined;
      guides = [];
      render();
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && selection.ids.length > 0) {
      const document_ = history.current;
      const removable = selection.ids.filter(
        (id) => findNode(document_.nodes, id)?.locked !== true,
      );

      if (removable.length > 0) {
        history = commit(
          history,
          `Delete ${removable.length} element${removable.length === 1 ? '' : 's'}`,
          deleteNodes(document_, new Set(removable)),
        );
        selection = pruneSelection(selection, collectIds(visibleDocument(history).nodes));
        event.preventDefault();
        render();
      }
      return;
    }

    const nudge = arrowNudge(event.key);

    if (nudge !== undefined && selection.ids.length > 0) {
      const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
      const document_ = history.current;
      const gesture: GestureStart = {
        handle: 'move',
        origin: { x: 0, y: 0 },
        nodes: gestureNodes(document_, placed(), selection.ids),
      };

      const transforms = applyGesture(gesture, { x: nudge.x * step, y: nudge.y * step });

      if (transforms.size > 0) {
        // A nudge is a completed gesture in itself, so it commits immediately.
        // Coalescing a held arrow key into one entry would be nicer and needs a
        // timer; one entry per press is at least predictable.
        history = commit(history, 'Nudge', updateTransforms(document_, transforms));
        event.preventDefault();
        render();
      }
    }
  });

  window.addEventListener('resize', () => {
    handle.resize();
    drawOverlay();
  });

  render();
}

/**
 * Snapshots the selected nodes for a gesture.
 *
 * Takes the placements as well as the document, because a gesture needs each
 * node's ancestor matrix to convert a document-space pointer delta into the
 * parent space its `x`/`y` are written in (§57).
 */
function gestureNodes(
  document_: ThemeDocument,
  placements: readonly PlacedNode[],
  ids: readonly string[],
): GestureNode[] {
  // §57: moving a group moves its children, so a selection holding both must
  // transform the group alone.
  return outermostOnly(placements, ids)
    .map((id) => {
      const node = findNode(document_.nodes, id);

      if (node === undefined) {
        return undefined;
      }

      const placement = placements.find((candidate) => candidate.id === id);

      return {
        id,
        transform: (node.transform ?? {}) as Transform,
        ...(node.locked === true ? { locked: true } : {}),
        ...(placement === undefined ? {} : { parentMatrix: placement.parentMatrix }),
      };
    })
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
}

function labelFor(handle: Handle, count: number): string {
  const subject = count === 1 ? 'element' : `${count} elements`;

  if (handle === 'move') {
    return `Move ${subject}`;
  }
  if (handle === 'rotate') {
    return `Rotate ${subject}`;
  }

  return `Resize ${subject}`;
}

function arrowNudge(key: string): { x: number; y: number } | undefined {
  switch (key) {
    case 'ArrowLeft':
      return { x: -1, y: 0 };
    case 'ArrowRight':
      return { x: 1, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -1 };
    case 'ArrowDown':
      return { x: 0, y: 1 };
    default:
      return undefined;
  }
}

start();

/**
 * Turns a globals-panel action into a document edit.
 *
 * Every case returns the document unchanged when the edit does not apply — an
 * invalid key, a duplicate, an unknown token — so the caller skips the commit
 * by identity and no undo entry appears that does nothing.
 */
function applyGlobalAction(document_: ThemeDocument, action: GlobalAction): ThemeDocument {
  switch (action.kind) {
    case 'add': {
      const seed = seedForGroup(action.group);

      return addGlobal(
        document_,
        action.group,
        nextGlobalKey(document_, action.group, action.group === 'palette' ? 'colour' : 'token'),
        seed,
      );
    }
    case 'value':
      return setGlobalValue(document_, action.group, action.key, action.value);
    case 'name':
      return renameGlobal(document_, action.group, action.key, action.name);
    case 'key':
      return rekeyGlobal(document_, action.group, action.key, action.nextKey);
    case 'delete':
      return deleteGlobal(document_, action.group, action.key);
  }
}

function labelForGlobalAction(action: GlobalAction): string {
  switch (action.kind) {
    case 'add':
      return 'Add token';
    case 'value':
      return `Set ${action.key}`;
    case 'name':
      return 'Rename token';
    case 'key':
      // Named differently from a display rename on purpose: this one rewrote
      // every reference in the document, and the undo label should say so.
      return 'Change token key';
    case 'delete':
      return 'Delete token';
  }
}
