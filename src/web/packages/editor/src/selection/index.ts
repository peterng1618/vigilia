import type { ThemeNode } from '@vigilia/renderer-core';
import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
// `collectIds` is a pure query over a ThemeNode tree, so its eventual home is
// renderer-core beside `walkNodes`. It lives in the editor's command module
// today; this imports that owner rather than adding a second walk.
import { collectIds } from '../commands.js';
import type { Bounds } from '../geometry.js';
import { hitTest, hitTestInside, marqueeSelect } from './domain/hit-test.js';
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
} from './domain/selection-state.js';

/**
 * What is selected, and what a click resolves to.
 *
 * ## Why the two belong together
 *
 * `selection-state.ts` decides how a click combines with what is already
 * chosen; `hit-test.ts` decides what was clicked. Both answers depend on
 * `enteredGroups` — which groups the author has opened — and that lived in the
 * selection value while every hit-test call site had to remember to pass it
 * along. Three call sites did; a fourth would eventually not, and the symptom
 * is a click selecting a group the author is standing inside.
 *
 * Holding the state here lets the hit-test wrappers supply it, so the
 * parameter cannot be forgotten. The pure modules underneath are unchanged and
 * still take it explicitly, because that is what makes them testable.
 *
 * ## The modifier policy lives here
 *
 * Shift toggles; **ctrl deliberately does not touch the selection.** Ctrl used
 * to mean "toggle" here while also meaning "disable snapping" during a move,
 * so holding it to avoid a snap silently changed what was being dragged — in
 * the worst case adding an ancestor of the node under the cursor, after which
 * the gesture moved both and sent the child twice as far as the pointer.
 *
 * It was a policy written inline in a pointer handler. It is a rule, so it
 * lives where the rule can be tested without a browser.
 */
export class SelectionManager implements EditorManager {
  public readonly editor: EditorCore;

  #state: SelectionState = emptySelection;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  public get state(): SelectionState {
    return this.#state;
  }

  /** Selected node ids, in the order they were added. */
  public get ids(): readonly string[] {
    return this.#state.ids;
  }

  public get count(): number {
    return this.#state.ids.length;
  }

  /** The node a range or align operation anchors to — the last one clicked. */
  public get anchor(): string | undefined {
    return this.#state.anchor;
  }

  /** Groups the author has opened, outermost first. */
  public get enteredGroups(): readonly string[] {
    return this.#state.enteredGroups;
  }

  public includes(id: string): boolean {
    return this.#state.ids.includes(id);
  }

  /**
   * How a click should combine with the existing selection.
   *
   * Takes the two flags rather than an event, so the rule is testable without
   * a DOM.
   */
  public modeFor(event: { readonly shiftKey: boolean }): SelectionMode {
    return event.shiftKey ? 'toggle' : 'replace';
  }

  public applyClick(id: string | undefined, mode: SelectionMode = 'replace'): void {
    this.#state = applyClick(this.#state, id, mode);
  }

  /** Replaces the selection wholesale — a marquee result, or "select all". */
  public set(ids: readonly string[]): void {
    this.#state = setSelection(this.#state, ids);
  }

  /** Adds to the existing selection (shift-drag). */
  public add(ids: readonly string[]): void {
    this.#state = addToSelection(this.#state, ids);
  }

  public clear(): void {
    this.#state = clearSelection(this.#state);
  }

  public enterGroup(groupId: string): void {
    this.#state = enterGroup(this.#state, groupId);
  }

  /** Leaves the innermost entered group and selects it. */
  public exitGroup(): void {
    this.#state = exitGroup(this.#state);
  }

  /** Drops every entered group and the selection — used when a file is opened. */
  public exitAll(): void {
    this.#state = clearSelection(exitAllGroups(this.#state));
  }

  /**
   * Drops ids that no longer exist.
   *
   * Called after an undo, a delete or a document replacement. A selection
   * pointing at a deleted node is how an editor applies an inspector change to
   * nothing, or crashes on the next gesture.
   */
  public pruneTo(existingIds: ReadonlySet<string>): void {
    this.#state = pruneSelection(this.#state, existingIds);
  }

  /**
   * Prunes against whatever the document currently holds.
   *
   * The form every caller actually wanted: five sites each rebuilt the id set
   * from the document before pruning, which is the sort of repetition that
   * ends with one of them pruning against the wrong document.
   */
  public pruneToDocument(): void {
    this.pruneTo(collectIds(this.editor.document.visible.nodes));
  }

  /** What a click at this point selects, respecting entered groups. */
  public hitTest(nodes: readonly ThemeNode[], point: { x: number; y: number }): string | undefined {
    return hitTest(nodes, point, { enteredGroups: this.#state.enteredGroups });
  }

  /**
   * What is under a point *within* a group, ignoring entered-group depth.
   *
   * Used by the double-click that opens a group: the group has not been
   * entered yet at the moment the question is asked.
   */
  public hitTestInside(
    nodes: readonly ThemeNode[],
    point: { x: number; y: number },
  ): string | undefined {
    return hitTestInside(nodes, point);
  }

  /** What a marquee covers, respecting entered groups. */
  public marquee(nodes: readonly ThemeNode[], bounds: Bounds): readonly string[] {
    return marqueeSelect(nodes, bounds, { enteredGroups: this.#state.enteredGroups });
  }

  public destroy(): void {
    this.#state = emptySelection;
  }
}
