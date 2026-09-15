import { ArrangeManager } from '../arrange/index.js';
import { DocumentManager } from '../document/index.js';
import { GlobalsManager } from '../globals/index.js';
import { InspectorManager } from '../inspector/index.js';
import { LayersManager } from '../layers/index.js';
import { NoticeManager } from '../notice/index.js';
import { SelectionManager } from '../selection/index.js';
import { SnappingManager } from '../snapping/index.js';
import type { EditorCore } from './editor.js';

/**
 * Single source of truth for manager keys, types, and construction order.
 * A manager may use managers registered above it during construction.
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
  {
    key: 'arrange',
    create: (editor: EditorCore) => new ArrangeManager({ editor }),
  },
  {
    key: 'snapping',
    create: (editor: EditorCore) => new SnappingManager({ editor }),
  },
  {
    key: 'layers',
    create: (editor: EditorCore) => new LayersManager({ editor }),
  },
  {
    key: 'inspector',
    create: (editor: EditorCore) => new InspectorManager({ editor }),
  },
] as const;

type Registration = (typeof MANAGER_REGISTRATIONS)[number];

/** Name of a registered manager. */
export type ManagerKey = Registration['key'];

/** Typed manager fields derived from registrations. */
export type ManagerTypes = {
  readonly [R in Registration as R['key']]: ReturnType<R['create']>;
};
