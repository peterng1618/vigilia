import {
  walkBindings,
  type Artboard,
  type AssetReference,
  type Binding,
  type Globals,
  type ThemeDocument,
  type ThemeMetadata,
} from './document.js';

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

/** Keeps v1 semantic data while Fabric becomes the sole geometry owner. */
export function fabricEnvelopeInputFor(document: ThemeDocument): FabricThemeEnvelopeInput {
  const bindings: Record<string, Binding[]> = {};

  for (const { node, binding } of walkBindings(document.nodes)) {
    (bindings[node.id] ??= []).push(binding);
  }

  return {
    id: document.id,
    artboard: document.artboard,
    ...(document.metadata === undefined ? {} : { metadata: document.metadata }),
    ...(document.globals === undefined ? {} : { globals: document.globals }),
    ...(document.assets === undefined ? {} : { assets: document.assets }),
    ...(Object.keys(bindings).length === 0 ? {} : { bindings }),
    ...(document.editorMetadata === undefined ? {} : { editorMetadata: document.editorMetadata }),
  };
}
