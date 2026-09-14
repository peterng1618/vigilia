import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  buildScenePlan,
  createAssetResolver,
  mountScene,
  viewportToDocument,
  type GlobalRef,
  type SampleSource,
  type SceneHandle,
  type ThemeDocument,
  type Transform,
} from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { outermostOnly, placeNodes, type PlacedNode } from './geometry.js';
import { hitTest, hitTestInside, marqueeSelect } from './hit-test.js';
import { deferToTarget } from './keyboard.js';
import { withScaledDescendants } from './resize-children.js';
import {
  type ActionContext,
  type ActionId,
  actionById,
  actionForShortcut,
  actionsInGroup,
  disabledReason,
  shortcutLabel,
} from './actions.js';
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
import {
  collectIds,
  deleteNodes,
  findNode,
  reorderNode,
  setNodeFlags,
  updateTransforms,
} from './commands.js';
import { EditorCore } from './core/editor.js';
import { createOverlay } from './overlay.js';
import { unionBounds } from './geometry.js';
import { describeSelection } from './inspector-model.js';
import { applyFieldChange, labelForField } from './inspector-apply.js';
import { createInspector } from './inspector-panel.js';
import { createLayersPanel, type LayerPanelAction } from './layers-panel.js';
import { buildLayerTree } from './layers-model.js';
import { createButton } from './button.js';
import { nodeLabel } from './node-label.js';
import {
  addGlobal,
  collectGlobalUsage,
  deleteGlobal,
  referencesTo,
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

  const editor = new EditorCore({ document: theme });
  let selection: SelectionState = emptySelection;
  let drag: DragState | undefined;
  let guides: readonly SnapGuide[] = [];
  let marquee: { x: number; y: number; width: number; height: number } | undefined;
  let lastDown: { time: number; x: number; y: number; id: string | undefined } | undefined;

  const source: SampleSource = createDemoSource(Date.now());
  const resolveAsset = createAssetResolver(theme.assets, { baseUrl: '/' });

  const plan = (document_: ThemeDocument) =>
    buildScenePlan({ document: document_, source, nowMs: Date.now(), resolveAsset });

  let handle: SceneHandle = mountScene({ host, plan: plan(editor.document.visible) });
  const overlay = createOverlay(host);

  // Left sidebar: theme-level globals (palette, fonts, etc.), always visible.
  const leftPanel = document.createElement('div');
  leftPanel.dataset['vigiliaPanel'] = 'theme';
  leftPanel.style.cssText = [
    'width:220px',
    'flex:none',
    'display:flex',
    'flex-direction:column',
    'min-height:0',
    'min-width:0',
    'overflow:hidden',
    'background:var(--vigilia-panel-bg)',
    'border-right:1px solid var(--vigilia-panel-border)',
    'padding:0',
  ].join(';');
  work.insertBefore(leftPanel, host);

  // Right sidebar: element inspector on top, document layer tree below.
  const panel = document.createElement('div');
  panel.dataset['vigiliaPanel'] = 'root';
  panel.style.cssText = [
    'width:300px',
    'flex:none',
    'display:flex',
    'flex-direction:column',
    'min-height:0',
    'min-width:0',
    'overflow:hidden',
    'background:var(--vigilia-panel-bg)',
    'border-left:1px solid var(--vigilia-panel-border)',
  ].join(';');
  work.append(panel);

  const body = document.createElement('div');
  body.style.cssText = [
    'flex:1',
    'min-height:0',
    'min-width:0',
    'display:flex',
    'flex-direction:column',
    'padding:0',
    'overflow:hidden',
  ].join(';');
  panel.append(body);

  /**
   * What each panel last rendered, so a redraw can be skipped.
   */
  let inspectorKey = '';
  let layersKey = '';
  let globalsKey = '';

  /**
   * The node ids the scene was last mounted with.
   *
   * `mountScene.update` refuses a plan whose ids differ — it is for new data,
   * not a new document — so a change to the set means a remount. Opening a file
   * clears this, because every id changed at once.
   */
  let lastIds = [...collectIds(editor.document.visible.nodes)].join(',');

  const inspector = createInspector(body, {
    onChange(key, change) {
      const document_ = editor.document.current;
      const next = applyFieldChange(document_, selection.ids, key, change);

      // Identity: `applyFieldChange` returns the same document when a change
      // did not apply — a refused value, an unknown key — and committing then
      // would put an undo entry in history that does nothing.
      if (next !== document_) {
        editor.document.commit(labelForField(key), next);
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

  const globalsPanel = createGlobalsPanel(leftPanel, {
    onAction(action) {
      const document_ = editor.document.current;
      const next = applyGlobalAction(document_, action);

      if (next !== document_) {
        editor.document.commit(labelForGlobalAction(action), next);
      } else {
        // See the inspector's `onChange`: a refused edit must snap back, and
        // the guard would otherwise skip the redraw that does it. An invalid
        // token key is the reachable case — `not a key` stayed in the field.
        globalsKey = '';

        // A refused deletion needs a reason. Spec 0011 D3 means a referenced
        // token cannot be inlined away, so the author has to reassign first —
        // and "nothing happened" is the least useful way to say that.
        if (action.kind === 'delete') {
          const uses = referencesTo(document_, `${action.group}.${action.key}` as GlobalRef).length;

          if (uses > 0) {
            editor.notice.show(`${action.key} is used ${uses} time${uses === 1 ? '' : 's'} — reassign those first`);
          }
        }
      }

      render();
    },
  });

  const layersPanel = createLayersPanel(panel, {
    onAction(action: LayerPanelAction) {
      if (action.kind === 'select') {
        selection = applyClick(selection, action.id, action.mode);
        render();
        return;
      }

      if (action.kind === 'enter') {
        selection = enterGroup(selection, action.id);
        render();
        return;
      }

      const document_ = editor.document.current;
      const target = findNode(document_.nodes, action.targetId);

      if (target === undefined) {
        return;
      }

      if (action.id === 'layer.toggle-visibility') {
        const next = target.visible === false;
        editor.document.commit(
          `${next ? 'Show' : 'Hide'} ${nodeLabel(target)}`,
          setNodeFlags(document_, target.id, { visible: next }),
        );
        render();
        return;
      }

      const nextLocked = target.locked !== true;
      editor.document.commit(
        `${nextLocked ? 'Lock' : 'Unlock'} ${nodeLabel(target)}`,
        setNodeFlags(document_, target.id, { locked: nextLocked }),
      );
      render();
    },
  });

  const runArrange = (result: ArrangeResult, label: string): void => {
    if (result.refused !== undefined) {
      editor.notice.show(describeRefusal(result.refused));
      return;
    }

    editor.notice.clear();

    if (result.document !== editor.document.current) {
      editor.document.commit(label, result.document);
    }

    if (result.select !== undefined) {
      selection = setSelection(selection, result.select);
    }

    selection = pruneSelection(selection, collectIds(editor.document.visible.nodes));
    render();
  };

  /** §61: a locked node is not deleted, and a wholly locked selection is a no-op. */
  const deleteSelection = (): void => {
    const document_ = editor.document.current;
    const removable = selection.ids.filter((id) => findNode(document_.nodes, id)?.locked !== true);

    if (removable.length === 0) {
      return;
    }

    editor.document.commit(
      `Delete ${removable.length} element${removable.length === 1 ? '' : 's'}`,
      deleteNodes(document_, new Set(removable)),
    );
    selection = pruneSelection(selection, collectIds(editor.document.visible.nodes));
    render();
  };

  /** Moves the selection by one step, or {@link NUDGE_LARGE} with shift held. */
  const nudge = (id: ActionId): void => {
    const direction = NUDGE_DIRECTIONS[id];

    if (direction === undefined) {
      return;
    }

    const step = id.endsWith('-large') ? NUDGE_LARGE : NUDGE;
    const document_ = editor.document.current;
    const gesture: GestureStart = {
      handle: 'move',
      origin: { x: 0, y: 0 },
      nodes: gestureNodes(document_, placed(), selection.ids),
    };

    const transforms = applyGesture(gesture, {
      x: direction.x * step,
      y: direction.y * step,
    });

    if (transforms.size > 0) {
      // A nudge is a completed gesture in itself, so it commits immediately.
      // Coalescing a held arrow key into one entry would be nicer and needs a
      // timer; one entry per press is at least predictable.
      editor.document.commit('Nudge', updateTransforms(document_, transforms));
      render();
    }
  };

  /**
   * The enablement snapshot every surface asks about.
   *
   * Built here because it reads the mutable editor state; the *rules* live in
   * `actions.ts`, so a toolbar, a menu and the keyboard cannot disagree about
   * whether something is available.
   */
  const actionContext = (): ActionContext => {
    const document_ = editor.document.visible;
    const selected = selection.ids.map((id) => findNode(document_.nodes, id));

    return {
      selectionCount: selection.ids.length,
      canUndo: editor.document.canUndo,
      canRedo: editor.document.canRedo,
      hasGroupSelected: selected.some((node) => node?.type === 'group'),
      allSelectedLocked:
        selection.ids.length > 0 && selected.every((node) => node?.locked === true),
    };
  };

  /**
   * The one place an action is performed.
   *
   * Every surface — keyboard, toolbars, menu bar, layer panel — routes here by
   * id, so there is exactly one body per action. Adding a surface adds no
   * behaviour, which is the whole point of `actions.ts`.
   */
  const runAction = (id: ActionId): void => {
    const action = actionById(id);

    // A disabled action is not an error: a surface may show it, and a keystroke
    // may reach it. Saying why beats doing nothing silently.
    const context = actionContext();

    if (action !== undefined && !action.enabled(context)) {
      // Non-null: `disabledReason` returns undefined only for an action that
      // is enabled, and this branch is the one where it is not.
      editor.notice.show(disabledReason(action, context)!);

      return;
    }

    switch (id) {
      case 'file.open':
        filePicker.click();
        return;

      case 'file.save':
        saveTheme();
        return;

      case 'edit.undo':
      case 'edit.redo':
        if (id === 'edit.undo') {
          editor.document.undo();
        } else {
          editor.document.redo();
        }
        selection = pruneSelection(selection, collectIds(editor.document.visible.nodes));
        render();
        return;

      case 'edit.delete':
        deleteSelection();
        return;

      case 'object.group':
        runArrange(
          groupNodes(editor.document.current, selection.ids, freeGroupId(editor.document.current)),
          'Group',
        );
        return;

      case 'object.ungroup':
        runArrange(ungroupNodes(editor.document.current, selection.ids), 'Ungroup');
        return;

      case 'arrange.align-left':
      case 'arrange.align-centre':
      case 'arrange.align-right':
      case 'arrange.align-top':
      case 'arrange.align-middle':
      case 'arrange.align-bottom': {
        const edge = id.slice('arrange.align-'.length) as AlignEdge;

        runArrange(alignNodes(editor.document.current, selection.ids, edge), action?.label ?? 'Align');
        return;
      }

      case 'arrange.distribute-x':
      case 'arrange.distribute-y': {
        const axis = id.endsWith('-x') ? 'x' : 'y';

        runArrange(
          distributeNodes(editor.document.current, selection.ids, axis),
          action?.label ?? 'Distribute',
        );
        return;
      }

      case 'layer.reorder-front':
      case 'layer.reorder-back':
      case 'layer.reorder-forward':
      case 'layer.reorder-backward': {
        const targetId = selection.ids[0];
        if (targetId === undefined) {
          return;
        }

        const target = id.slice('layer.reorder-'.length) as 'front' | 'back' | 'forward' | 'backward';
        const document_ = editor.document.current;
        const next = reorderNode(document_, targetId, target);

        if (next !== document_) {
          editor.document.commit(action?.label ?? 'Reorder layer', next);
          render();
        }
        return;
      }

      case 'layer.toggle-visibility': {
        const targetId = selection.ids[0];
        const document_ = editor.document.current;
        const node = targetId === undefined ? undefined : findNode(document_.nodes, targetId);

        if (node === undefined) {
          return;
        }

        const next = node.visible === false;
        editor.document.commit(
          `${next ? 'Show' : 'Hide'} ${nodeLabel(node)}`,
          setNodeFlags(document_, node.id, { visible: next }),
        );
        render();
        return;
      }

      case 'layer.toggle-lock': {
        const targetId = selection.ids[0];
        const document_ = editor.document.current;
        const node = targetId === undefined ? undefined : findNode(document_.nodes, targetId);

        if (node === undefined) {
          return;
        }

        const nextLocked = node.locked !== true;
        editor.document.commit(
          `${nextLocked ? 'Lock' : 'Unlock'} ${nodeLabel(node)}`,
          setNodeFlags(document_, node.id, { locked: nextLocked }),
        );
        render();
        return;
      }

      case 'navigate.escape':
        // Cancelling a gesture keeps the selection. Discarding it as well was
        // extra punishment for an author who changed their mind mid-drag, and
        // spec 0005 asks only that the gesture "vanishes with no trace in the
        // history". Outside a gesture, Escape steps out of an entered group.
        if (drag === undefined) {
          selection = exitGroup(selection);
        }

        editor.document.cancelPreview();
        drag = undefined;
        marquee = undefined;
        guides = [];
        render();
        return;

      default:
        nudge(id);
    }
  };

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
        editor.notice.show(`Could not open: ${describeIssues(result.issues)}`);
        return;
      }

      // A new file is a new history. An undo that crossed a file boundary would
      // restore half of another theme.
      editor.document.replace(result.document);
      selection = clearSelection(exitAllGroups(selection));
      editor.notice.show(`Opened ${file.name}`);
      lastIds = '';
      inspectorKey = '';
      layersKey = '';
      globalsKey = '';
      render();
    });
  });

  const saveTheme = (): void => {
    const document_ = editor.document.current;
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
    editor.document.markSaved();
    editor.notice.show(`Saved ${anchor.download}`);
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
    'gap:6px',
    'padding:10px 14px',
    'border-bottom:1px solid var(--vigilia-panel-border)',
  ].join(';');
  panel.insertBefore(toolbar, body);

  const fileBar = document.createElement('div');
  fileBar.dataset['vigiliaToolbar'] = 'file';
  fileBar.style.cssText = 'display:flex;flex:none;gap:8px;padding:10px 14px 0';
  panel.insertBefore(fileBar, toolbar);

  for (const action of actionsInGroup('file')) {
    const button = createButton({
      text: action.label.replace('…', ''),
      title: `${action.label} (${shortcutLabel(action.shortcut)})`,
      dataset: {
        vigiliaFile: action.id.slice('file.'.length),
        vigiliaAction: action.id,
      },
      onClick: () => runAction(action.id),
    });
    fileBar.append(button);
  }

  for (const action of actionsInGroup('arrange')) {
    const button = createButton({
      text: action.glyph ?? '?',
      title: action.label,
      dataset: {
        vigiliaArrange: action.id.slice('arrange.'.length),
        vigiliaAction: action.id,
      },
      flex: '1 1 22px',
      fontSize: '12px',
      padding: '0',
      onClick: () => runAction(action.id),
    });
    toolbar.append(button);
  }

  /**
   * Enablement, asked of the registry rather than inferred from the view.
   *
   * The previous version read the rule off each button's own id — "starts with
   * distribute means it needs three" — and scoped it with a DOM selector. One
   * word too broad disabled Open and Save until two nodes were selected, which
   * timed out two browser tests. Now every button carries its action id and the
   * rule has one home.
   */
  const drawToolbar = (): void => {
    const context = actionContext();

    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-vigilia-action]')) {
      const id = button.dataset['vigiliaAction'] as ActionId | undefined;
      const action = id === undefined ? undefined : actionById(id);

      if (action === undefined) {
        continue;
      }

      const enabled = action.enabled(context);

      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.4';
      button.style.cursor = enabled ? 'pointer' : 'default';
      button.title = enabled
        ? action.label
        : `${action.label} — ${disabledReason(action, context) ?? ''}`;
    }
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
    handle = mountScene({ host, plan: plan(editor.document.visible) });
    host.append(overlay.root);
  };

  const render = (): void => {
    const document_ = editor.document.visible;
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
    drawInspector();
    drawLayers();
    drawGlobals();
  };

  const placed = (): PlacedNode[] => placeNodes(editor.document.visible.nodes);

  const selectedPlacements = (): PlacedNode[] =>
    placed().filter((node) => selection.ids.includes(node.id));

  const drawOverlay = (): void => {
    const document_ = editor.document.visible;
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
    const document_ = editor.document.current;
    const sections = describeSelection(document_, selection.ids);
    const key = JSON.stringify(sections);

    if (key === inspectorKey) {
      return;
    }

    inspectorKey = key;
    inspector.render(sections, document_.globals ?? {});
  };

  const drawLayers = (): void => {
    const document_ = editor.document.visible;
    const rows = buildLayerTree(document_.nodes, selection);
    const key = JSON.stringify(rows);

    if (key === layersKey) {
      return;
    }

    layersKey = key;
    layersPanel.render(rows);
  };

  const drawGlobals = (): void => {
    const usage = collectGlobalUsage(editor.document.current);
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
      editor.document.canUndo ? `undo: ${editor.document.undoLabel}` : undefined,
      editor.document.canRedo ? 'redo available' : undefined,
      editor.document.isDirty ? 'unsaved' : 'saved',
      editor.notice.message,
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
    editor.notice.clear();

    const grabbed = (event.target as HTMLElement | null)
      ?.closest('[data-vigilia-handle]')
      ?.getAttribute('data-vigilia-handle') as Handle | undefined;

    const document_ = editor.document.visible;
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

    const committed = editor.document.current;
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
      // A group's children are a consequence of resizing it, not part of the
      // gesture: without this the outline grows around unchanged contents.
      const withChildren = withScaledDescendants(committed, transforms, drag.gesture.handle);

      // A preview, not a commit: §67 wants one undo entry per gesture.
      editor.document.preview(updateTransforms(committed, withChildren));
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
        const document_ = editor.document.visible;
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
      editor.document.cancelPreview();
      enterGroupAt(finished.doubleClickCandidate.id, finished.doubleClickCandidate.point);
      return;
    }

    editor.document.commitPreview(labelFor(finished.gesture.handle, selection.ids.length));

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
    const document_ = editor.document.visible;
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

    // Backspace is a second binding for Delete, kept here rather than in the
    // registry so the menu shows one canonical key.
    const key = event.key === 'Backspace' ? 'Delete' : event.key;
    const action = actionForShortcut({ key, meta, shift: event.shiftKey });

    if (action === undefined) {
      return;
    }

    // Claimed before running, and before the enablement check: Ctrl+S must not
    // fall through to the browser's "save page" just because the action is
    // currently unavailable.
    event.preventDefault();

    // Nothing but Escape may run while a gesture is live.
    //
    // A live drag holds a snapshot of the nodes as they were when it started
    // (`GestureStart.nodes`) and re-applies it against `editor.document.current` on
    // every pointer move. An action that commits meanwhile moves that ground
    // out from under it, and the next move re-applies the stale snapshot on top
    // of the new document. Observed three ways: Ctrl+Z mid-drag put the node
    // 180 px out instead of 100 and **destroyed the earlier history entry**;
    // Ctrl+G mid-drag moved a panel 165 px for 120 px of travel, because
    // grouping rebased the children while the gesture still held their old
    // absolute positions; Delete mid-drag left a phantom "Move 0 elements"
    // entry that made the following undo look dead.
    //
    // Refusing is the honest option — the alternative, silently cancelling the
    // author's gesture to service a keystroke, throws away work they can see on
    // screen. Escape is exempt because cancelling is precisely what it means.
    if (drag !== undefined && action.id !== 'navigate.escape') {
      editor.notice.show('Finish or cancel the drag first (Esc cancels)');
      return;
    }

    runAction(action.id);
  });

  window.addEventListener('resize', () => {
    handle.resize();
    drawOverlay();
  });

  // The status bar repaints because the message changed, not because each of
  // the six sites that set one remembered to ask. Two of them did not: the
  // pointerdown that clears a stale refusal returns early for a resize handle,
  // so the old explanation used to sit there for the whole of the next drag.
  editor.events.on('notice:changed', () => {
    drawStatus();
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

/**
 * Which way each nudge action moves.
 *
 * Keyed by action id rather than by key name, because `actions.ts` now owns
 * which key is bound — this table would otherwise be a second place where
 * ArrowUp could be wired to the wrong axis.
 */
const NUDGE_DIRECTIONS: Partial<Record<ActionId, { readonly x: number; readonly y: number }>> = {
  'navigate.nudge-left': { x: -1, y: 0 },
  'navigate.nudge-left-large': { x: -1, y: 0 },
  'navigate.nudge-right': { x: 1, y: 0 },
  'navigate.nudge-right-large': { x: 1, y: 0 },
  'navigate.nudge-up': { x: 0, y: -1 },
  'navigate.nudge-up-large': { x: 0, y: -1 },
  'navigate.nudge-down': { x: 0, y: 1 },
  'navigate.nudge-down-large': { x: 0, y: 1 },
};

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
