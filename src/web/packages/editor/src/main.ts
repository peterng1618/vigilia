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
import { placeNodes, type PlacedNode } from './geometry.js';
import { hitTest, hitTestInside, marqueeSelect } from './hit-test.js';
import {
  addToSelection,
  applyClick,
  clearSelection,
  emptySelection,
  enterGroup,
  exitGroup,
  pruneSelection,
  setSelection,
  type SelectionMode,
  type SelectionState,
} from './selection.js';
import {
  applyGesture,
  type GestureModifiers,
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
  preview,
  redo,
  undo,
  undoLabel,
  visibleDocument,
  type History,
} from './history.js';
import { createOverlay } from './overlay.js';
import { unionBounds } from './geometry.js';

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

  if (host === null || status === null) {
    throw new Error('Editor shell is missing #stage or #status.');
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

  let lastIds = [...collectIds(visibleDocument(history).nodes)].join(',');

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
  };

  const placed = (): PlacedNode[] => placeNodes(visibleDocument(history).nodes);

  const selectedPlacements = (): PlacedNode[] =>
    placed().filter((node) => selection.ids.includes(node.id));

  const drawOverlay = (): void => {
    const document_ = visibleDocument(history);
    const chosen = selectedPlacements();
    const single = selection.ids.length === 1 ? findNode(document_.nodes, selection.ids[0]!) : undefined;

    overlay.update({
      transform: handle.transform(),
      selected: chosen,
      handlesFor:
        single === undefined || single.locked === true
          ? undefined
          : { id: single.id, transform: single.transform ?? {} },
      guides,
      artboard: document_.artboard,
      marquee,
    });
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

  const selectionModeOf = (event: PointerEvent): SelectionMode =>
    event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';

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
          nodes: gestureNodes(document_, selection.ids),
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
      gesture: { handle: 'move', origin: point, nodes: gestureNodes(document_, selection.ids) },
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
        nodes: gestureNodes(document_, selection.ids),
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

function gestureNodes(document_: ThemeDocument, ids: readonly string[]) {
  return ids
    .map((id) => {
      const node = findNode(document_.nodes, id);
      return node === undefined
        ? undefined
        : {
            id,
            transform: (node.transform ?? {}) as Transform,
            ...(node.locked === true ? { locked: true } : {}),
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
