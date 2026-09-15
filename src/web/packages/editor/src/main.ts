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
  type ThemeNode,
  type Transform,
} from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { outermostOnly, placeNodes, type PlacedNode } from './geometry.js';
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
  applyGesture,
  type GestureModifiers,
  type GestureNode,
  type GestureStart,
  type Handle,
} from './transform-gesture.js';
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
import { createInspector } from './inspector-panel.js';
import { createLayersPanel, type LayerPanelAction } from './layers-panel.js';
import { createButton } from './button.js';
import { nodeLabel } from './node-label.js';
import { createGlobalsPanel } from './globals-panel.js';
import {
  describeIssues,
  fileNameFor,
  parseThemeFile,
  serializeForFile,
} from './persist.js';
import type { AlignEdge } from './arrange/commands.js';

/** Legacy editor shell: event wiring + DOM only; pure modules own behavior. */

echarts.use([GaugeChart, LineChart, BarChart, PieChart, GridComponent, CanvasRenderer]);

const NUDGE = 1;
const NUDGE_LARGE = 10;

/** Pointer capture prevents native dblclick synthesis, so detect consecutive presses. */
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_SLOP = 5;

interface DragState {
  readonly gesture: GestureStart;
  readonly pointerId: number;
  readonly viewportOrigin: { x: number; y: number };
  readonly kind: 'transform' | 'marquee';
  /** Only completes if the second press is released without becoming a drag. */
  readonly doubleClickCandidate: { readonly id: string; readonly point: { x: number; y: number } } | undefined;
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
  let drag: DragState | undefined;
  let marquee: { x: number; y: number; width: number; height: number } | undefined;
  let lastDown: { time: number; x: number; y: number; id: string | undefined } | undefined;

  const source: SampleSource = createDemoSource(Date.now());
  const resolveAsset = createAssetResolver(theme.assets, { baseUrl: '/' });

  const plan = (document_: ThemeDocument) =>
    buildScenePlan({ document: document_, source, nowMs: Date.now(), resolveAsset });

  let handle: SceneHandle = mountScene({ host, plan: plan(editor.document.visible) });
  const overlay = createOverlay(host);

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

  let inspectorKey = '';
  let layersKey = '';
  let globalsKey = '';

  /** `mountScene.update` cannot accept a changed node-id set; remount when it changes. */
  let lastIds = [...collectIds(editor.document.visible.nodes)].join(',');

  const inspector = createInspector(body, {
    onChange(key, change) {
      if (!editor.inspector.edit(key, change)) {
        // Force refused input back to the committed value.
        inspectorKey = '';
      }

      render();
    },
  });

  const globalsPanel = createGlobalsPanel(leftPanel, {
    onAction(action) {
      if (!editor.globals.apply(action)) {
        globalsKey = '';

        const reason = editor.globals.refusalReason(action);

        if (reason !== undefined) {
          editor.notice.show(reason);
        }
      }

      render();
    },
  });

  const layersPanel = createLayersPanel(panel, {
    onAction(action: LayerPanelAction) {
      if (action.kind === 'select') {
        editor.selection.applyClick(action.id, action.mode);
        render();
        return;
      }

      if (action.kind === 'enter') {
        editor.selection.enterGroup(action.id);
        render();
        return;
      }

      // Layer rows name their target; shared action bodies still live in runAction.
      runAction(action.id, action.targetId);
    },
  });

  const deleteSelection = (): void => {
    const document_ = editor.document.current;
    const removable = editor.selection.ids.filter((id) => findNode(document_.nodes, id)?.locked !== true);

    if (removable.length === 0) {
      return;
    }

    editor.document.commit(
      `Delete ${removable.length} element${removable.length === 1 ? '' : 's'}`,
      deleteNodes(document_, new Set(removable)),
    );
    editor.selection.pruneToDocument();
    render();
  };

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
      nodes: gestureNodes(document_, placed(), editor.selection.ids),
    };

    const transforms = applyGesture(gesture, {
      x: direction.x * step,
      y: direction.y * step,
    });

    if (transforms.size > 0) {
      editor.document.commit('Nudge', updateTransforms(document_, transforms));
      render();
    }
  };

  /** Snapshot only the mutable state used by pure action enablement rules. */
  const actionContext = (): ActionContext => {
    const document_ = editor.document.visible;
    const selected = editor.selection.ids.map((id) => findNode(document_.nodes, id));

    return {
      selectionCount: editor.selection.ids.length,
      canUndo: editor.document.canUndo,
      canRedo: editor.document.canRedo,
      hasGroupSelected: selected.some((node) => node?.type === 'group'),
      allSelectedLocked:
        editor.selection.ids.length > 0 && selected.every((node) => node?.locked === true),
    };
  };

  const targetNode = (targetId: string | undefined): ThemeNode | undefined => {
    const chosen = targetId ?? editor.selection.ids[0];

    return chosen === undefined ? undefined : findNode(editor.document.current.nodes, chosen);
  };

  /** Single imperative body for toolbar, keyboard and layer actions. */
  const runAction = (id: ActionId, targetId?: string): void => {
    const action = actionById(id);
    const context = actionContext();

    // Selection-based enablement does not apply when a layer row supplies its own target.
    if (targetId === undefined && action !== undefined && !action.enabled(context)) {
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
        editor.selection.pruneToDocument();
        render();
        return;

      case 'edit.delete':
        deleteSelection();
        return;

      case 'object.group':
        if (editor.arrange.group('Group')) {
          render();
        }
        return;

      case 'object.ungroup':
        if (editor.arrange.ungroup('Ungroup')) {
          render();
        }
        return;

      case 'arrange.align-left':
      case 'arrange.align-centre':
      case 'arrange.align-right':
      case 'arrange.align-top':
      case 'arrange.align-middle':
      case 'arrange.align-bottom': {
        const edge = id.slice('arrange.align-'.length) as AlignEdge;

        if (editor.arrange.align(edge, action?.label ?? 'Align')) {
          render();
        }
        return;
      }

      case 'arrange.distribute-x':
      case 'arrange.distribute-y': {
        const axis = id.endsWith('-x') ? 'x' : 'y';

        if (editor.arrange.distribute(axis, action?.label ?? 'Distribute')) {
          render();
        }
        return;
      }

      case 'layer.reorder-front':
      case 'layer.reorder-back':
      case 'layer.reorder-forward':
      case 'layer.reorder-backward': {
        const chosen = targetId ?? editor.selection.ids[0];

        if (chosen === undefined) {
          return;
        }

        const target = id.slice('layer.reorder-'.length) as 'front' | 'back' | 'forward' | 'backward';
        const document_ = editor.document.current;
        const next = reorderNode(document_, chosen, target);

        if (next !== document_) {
          editor.document.commit(action?.label ?? 'Reorder layer', next);
          render();
        }
        return;
      }

      case 'layer.toggle-visibility': {
        const node = targetNode(targetId);

        if (node === undefined) {
          return;
        }

        const visible = node.visible === false;

        editor.document.commit(
          `${visible ? 'Show' : 'Hide'} ${nodeLabel(node)}`,
          setNodeFlags(editor.document.current, node.id, { visible }),
        );
        render();
        return;
      }

      case 'layer.toggle-lock': {
        const node = targetNode(targetId);

        if (node === undefined) {
          return;
        }

        const locked = node.locked !== true;

        editor.document.commit(
          `${locked ? 'Lock' : 'Unlock'} ${nodeLabel(node)}`,
          setNodeFlags(editor.document.current, node.id, { locked }),
        );
        render();
        return;
      }

      case 'navigate.escape':
        if (drag === undefined) {
          editor.selection.exitGroup();
        }

        editor.document.cancelPreview();
        drag = undefined;
        marquee = undefined;
        editor.snapping.clear();
        render();
        return;

      default:
        nudge(id);
    }
  };

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

      // Reset so choosing the same file again still emits change.
      filePicker.value = '';

      if (!result.ok) {
        editor.notice.show(`Could not open: ${describeIssues(result.issues)}`);
        return;
      }

      editor.document.replace(result.document);
      editor.selection.exitAll();
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

    editor.document.markSaved();
    editor.notice.show(`Saved ${anchor.download}`);
    render();
  };

  const toolbar = document.createElement('div');
  toolbar.dataset['vigiliaToolbar'] = 'arrange';
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

  /** Buttons keyed by action id so enablement never reads behavior back from DOM. */
  const actionButtons = new Map<ActionId, HTMLButtonElement>();

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
    actionButtons.set(action.id, button);
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
    actionButtons.set(action.id, button);
  }

  const drawToolbar = (): void => {
    const context = actionContext();

    for (const [id, button] of actionButtons) {
      const action = actionById(id);

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
    placed().filter((node) => editor.selection.ids.includes(node.id));

  const drawOverlay = (): void => {
    const document_ = editor.document.visible;
    const chosen = selectedPlacements();
    const single = editor.selection.ids.length === 1 ? chosen[0] : undefined;

    overlay.update({
      transform: handle.transform(),
      selected: chosen,
      handlesFor: single === undefined || single.locked ? undefined : single,
      guides: editor.snapping.guides,
      artboard: document_.artboard,
      marquee,
    });
  };

  /** Skip wholesale inspector rebuilds when descriptors are unchanged; rebuild loses focus. */
  const drawInspector = (): void => {
    const sections = editor.inspector.sections();
    const key = JSON.stringify(sections);

    if (key === inspectorKey) {
      return;
    }

    inspectorKey = key;
    inspector.render(sections, editor.document.current.globals ?? {});
  };

  const drawLayers = (): void => {
    const rows = editor.layers.rows();
    const key = JSON.stringify(rows);

    if (key === layersKey) {
      return;
    }

    layersKey = key;
    layersPanel.render(rows);
  };

  const drawGlobals = (): void => {
    const usage = editor.globals.usage();
    const key = JSON.stringify(usage);

    if (key === globalsKey) {
      return;
    }

    globalsKey = key;
    globalsPanel.render(usage);
  };

  const drawStatus = (): void => {
    const count = editor.selection.ids.length;
    const inside = editor.selection.enteredGroups.at(-1);

    status.textContent = [
      count === 0 ? 'Nothing selected' : count === 1 ? editor.selection.ids[0] : `${count} selected`,
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

  host.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    editor.notice.clear();

    // Handle hit areas contain child dots; resolve from the nearest annotated ancestor.
    const grabbed = (event.target as HTMLElement | null)
      ?.closest('[data-vigilia-handle]')
      ?.getAttribute('data-vigilia-handle') as Handle | undefined;

    const document_ = editor.document.visible;
    const point = toDocument(event);
    const hitNow = editor.selection.hitTest(document_.nodes, point);

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

    if (grabbed !== undefined && editor.selection.ids.length > 0) {
      drag = {
        kind: 'transform',
        pointerId: event.pointerId,
        viewportOrigin: { x: event.clientX, y: event.clientY },
        gesture: {
          handle: grabbed,
          origin: point,
          nodes: gestureNodes(document_, placed(), editor.selection.ids),
        },
        doubleClickCandidate: undefined,
        moved: false,
      };
      return;
    }

    const hit = hitNow;

    if (hit === undefined) {
      editor.selection.applyClick(undefined, editor.selection.modeFor(event));
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

    // Preserve an existing multi-selection when beginning a drag on one member.
    if (!editor.selection.ids.includes(hit) || editor.selection.modeFor(event) !== 'replace') {
      editor.selection.applyClick(hit, editor.selection.modeFor(event));
    }

    drag = {
      kind: 'transform',
      pointerId: event.pointerId,
      viewportOrigin: { x: event.clientX, y: event.clientY },
      gesture: {
        handle: 'move',
        origin: point,
        nodes: gestureNodes(document_, placed(), editor.selection.ids),
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

    // Move snapping uses the actual gesture nodes; resize snapping is not implemented.
    if (drag.gesture.handle === 'move' && !event.ctrlKey && !event.metaKey) {
      const delta = editor.snapping.resolveMove({
        movingIds: drag.gesture.nodes.map((node) => node.id),
        delta: { x: pointer.x - drag.gesture.origin.x, y: pointer.y - drag.gesture.origin.y },
        scale: handle.transform().scale,
      });

      transforms = applyGesture(
        drag.gesture,
        { x: drag.gesture.origin.x + delta.x, y: drag.gesture.origin.y + delta.y },
        modifiers,
      );
    }

    if (transforms.size > 0) {
      const withChildren = withScaledDescendants(committed, transforms, drag.gesture.handle);

      // One live gesture remains one undo transaction (§67).
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
    editor.snapping.clear();

    if (finished.kind === 'marquee') {
      if (marquee !== undefined && (marquee.width > 2 || marquee.height > 2)) {
        const document_ = editor.document.visible;
        const rect = host.getBoundingClientRect();
        const from = viewportToDocument(handle.transform(), {
          x: finished.viewportOrigin.x - rect.left,
          y: finished.viewportOrigin.y - rect.top,
        });
        const to = toDocument(event);

        const hits = editor.selection.marquee(document_.nodes, {
          left: from.x,
          top: from.y,
          right: to.x,
          bottom: to.y,
        });

        if (event.shiftKey) {
          editor.selection.add(hits);
        } else {
          editor.selection.set(hits);
        }
      }

      marquee = undefined;
      render();
      return;
    }

    // A stationary second press enters the group instead of committing sub-pixel movement.
    if (!finished.moved && finished.doubleClickCandidate !== undefined) {
      lastDown = undefined;
      editor.document.cancelPreview();
      enterGroupAt(finished.doubleClickCandidate.id, finished.doubleClickCandidate.point);
      return;
    }

    editor.document.commitPreview(labelFor(finished.gesture.handle, editor.selection.ids.length));

    render();
  };

  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);

  function enterGroupAt(outerId: string, point: { x: number; y: number }): void {
    const document_ = editor.document.visible;
    const node = findNode(document_.nodes, outerId);

    if (node?.type !== 'group') {
      return;
    }

    editor.selection.enterGroup(outerId);
    const inner = editor.selection.hitTestInside(document_.nodes, point);

    if (inner !== undefined && inner !== outerId) {
      editor.selection.applyClick(inner);
    }

    render();
  }

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    const meta = event.ctrlKey || event.metaKey;
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

    // Backspace is an alternate Delete binding; registry keeps one canonical label.
    const key = event.key === 'Backspace' ? 'Delete' : event.key;
    const action = actionForShortcut({ key, meta, shift: event.shiftKey });

    if (action === undefined) {
      return;
    }

    event.preventDefault();

    // Gesture snapshots become stale if another edit commits mid-drag; refuse all but Escape.
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

  editor.events.on('notice:changed', () => {
    drawStatus();
  });

  render();
}

/** Snapshot selected nodes plus ancestor matrices needed for parent-space gesture math. */
function gestureNodes(
  document_: ThemeDocument,
  placements: readonly PlacedNode[],
  ids: readonly string[],
): GestureNode[] {
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

/** Direction only; `actions.ts` owns which keys invoke these ids. */
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
