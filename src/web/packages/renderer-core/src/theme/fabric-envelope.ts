import type { Artboard, AssetReference, Binding, Globals, ThemeMetadata } from './document.js';

/** Versioned Vigilia metadata around the opaque Fabric-authored scene. */
export interface FabricThemeEnvelope {
  readonly schemaVersion: 2;
  readonly fabricVersion: string;
  readonly id: string;
  readonly artboard: Artboard;
  readonly scene: Readonly<Record<string, unknown>>;
  readonly metadata?: ThemeMetadata;
  readonly globals?: Globals;
  readonly assets?: readonly AssetReference[];
  /** Semantic bindings remain Vigilia data, keyed by Fabric object id. */
  readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
  readonly editorMetadata?: Readonly<Record<string, unknown>>;
}

export type FabricThemeEnvelopeInput = Omit<FabricThemeEnvelope, 'schemaVersion' | 'fabricVersion' | 'scene'>;
