import type { ThemeNode } from '@vigilia/renderer-core';
import type { EditorCore } from '../core/editor.js';
import type { EditorManager } from '../core/manager.js';
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

/** Owns selection state and supplies entered-group context to hit-testing. */
export class SelectionManager implements EditorManager {
  public readonly editor: EditorCore;

  #state: SelectionState = emptySelection;

  constructor({ editor }: { editor: EditorCore }) {
    this.editor = editor;
  }

  public get state(): SelectionState {
    return this.#state;
  }

  public get ids(): readonly string[] {
    return this.#state.ids;
  }

  public get count(): number {
    return this.#state.ids.length;
  }

  public get anchor(): string | undefined {
    return this.#state.anchor;
  }

  public get enteredGroups(): readonly string[] {
    return this.#state.enteredGroups;
  }

  public includes(id: string): boolean {
    return this.#state.ids.includes(id);
  }

  /** Shift toggles; Ctrl is reserved for snap bypass. */
  public modeFor(event: { readonly shiftKey: boolean }): SelectionMode {
    return event.shiftKey ? 'toggle' : 'replace';
  }

  public applyClick(id: string | undefined, mode: SelectionMode = 'replace'): void {
    this.#state = applyClick(this.#state, id, mode);
  }

  public set(ids: readonly string[]): void {
    this.#state = setSelection(this.#state, ids);
  }

  public add(ids: readonly string[]): void {
    this.#state = addToSelection(this.#state, ids);
  }

  public clear(): void {
    this.#state = clearSelection(this.#state);
  }

  public enterGroup(groupId: string): void {
    this.#state = enterGroup(this.#state, groupId);
  }

  public exitGroup(): void {
    this.#state = exitGroup(this.#state);
  }

  public exitAll(): void {
    this.#state = clearSelection(exitAllGroups(this.#state));
  }

  public pruneTo(existingIds: ReadonlySet<string>): void {
    this.#state = pruneSelection(this.#state, existingIds);
  }

  public pruneToDocument(): void {
    this.pruneTo(collectIds(this.editor.document.visible.nodes));
  }

  public hitTest(nodes: readonly ThemeNode[], point: { x: number; y: number }): string | undefined {
    return hitTest(nodes, point, { enteredGroups: this.#state.enteredGroups });
  }

  /** Deep hit used before entering a group. */
  public hitTestInside(
    nodes: readonly ThemeNode[],
    point: { x: number; y: number },
  ): string | undefined {
    return hitTestInside(nodes, point);
  }

  public marquee(nodes: readonly ThemeNode[], bounds: Bounds): readonly string[] {
    return marqueeSelect(nodes, bounds, { enteredGroups: this.#state.enteredGroups });
  }

  public destroy(): void {
    this.#state = emptySelection;
  }
}
