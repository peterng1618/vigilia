import type { ThemeDocument } from '@vigilia/renderer-core';

/**
 * What an editor is started with.
 *
 * Managers read this through `editor.options` rather than taking constructor
 * arguments of their own, so the uniform `new XManager({ editor })` contract
 * holds for all of them and the composition root stays a flat list.
 */
export interface EditorOptions {
  /** The document the editor opens with. */
  readonly document: ThemeDocument;
}
