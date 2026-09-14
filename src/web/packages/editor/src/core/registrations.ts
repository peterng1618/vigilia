import { DocumentManager } from '../document/index.js';
import { GlobalsManager } from '../globals/index.js';
import { NoticeManager } from '../notice/index.js';
import { SelectionManager } from '../selection/index.js';
import type { EditorCore } from './editor.js';

/**
 * Every manager the editor has, in the order it is built.
 *
 * ## One declaration, three derivations
 *
 * This array is the only place a manager is named. Its key union
 * ({@link ManagerKey}), the typed fields on {@link EditorCore}
 * ({@link ManagerTypes}) and the construction order are all *derived* from it,
 * so adding a manager is one entry here and nothing else — and there is no
 * second list to drift from this one.
 *
 * That is the difference between a mechanism and a reminder. The obvious
 * alternative — a list of fields on the root, a separate ordered array, and a
 * test asserting they match — has three declarations and a test whose job is
 * to notice when someone updates two of them.
 *
 * ## Order is not cosmetic
 *
 * `init()` walks this forward and `destroy()` walks it in reverse, so a
 * manager may use any manager **above** it during construction. Where that is
 * genuinely circular, take a lazy thunk (`resolveX: () => this.editor.x`)
 * rather than reordering by trial and error — the thunk states the cycle,
 * a reordering hides it.
 *
 * Current order and why:
 *
 * 1. `notice` — depends on nothing, and everything below may need to refuse
 *    out loud while starting up.
 * 2. `document` — reads `options.document`, and every later manager reads the
 *    document.
 * 3. `selection` — prunes itself against the document, so it needs one.
 * 4. `globals` — reads and edits the document through its manager.
 */
export const MANAGER_REGISTRATIONS = [
  {
    key: 'notice',
    create: (editor: EditorCore) => new NoticeManager({ editor }),
  },
  {
    key: 'document',
    create: (editor: EditorCore) => new DocumentManager({ editor }),
  },
  {
    key: 'selection',
    create: (editor: EditorCore) => new SelectionManager({ editor }),
  },
  {
    key: 'globals',
    create: (editor: EditorCore) => new GlobalsManager({ editor }),
  },
] as const;

type Registration = (typeof MANAGER_REGISTRATIONS)[number];

/** The name of a manager, as `editor.<key>` and in the registration table. */
export type ManagerKey = Registration['key'];

/**
 * The typed shape of the managers on the root.
 *
 * Derived from each registration's return type, which is why a manager cannot
 * be registered without being typed or typed without being registered.
 * `EditorCore` merges this in, so `editor.document` is a `DocumentManager` to
 * the compiler without anyone writing that fact down twice.
 */
export type ManagerTypes = {
  readonly [R in Registration as R['key']]: ReturnType<R['create']>;
};
