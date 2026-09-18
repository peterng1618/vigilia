import {
  walkBindings,
  type Artboard,
  type AssetReference,
  type Binding,
  type Globals,
  type PalettePaint,
  type ThemeDocument,
  type ThemeMetadata,
} from './document.js';

export interface FabricPaletteEntry {
  readonly name: string;
  readonly value: PalettePaint;
}

export type FabricPalette = Readonly<Record<string, FabricPaletteEntry>>;
/** Development v2 has one global owner for paint and one for typography. */
export type FabricGlobals = Pick<Globals, 'typePresets'> & { readonly palette?: FabricPalette };

/** Versioned Vigilia metadata around the opaque Fabric-authored scene. */
export interface FabricThemeEnvelope {
  readonly schemaVersion: 2;
  readonly fabricVersion: string;
  readonly id: string;
  readonly artboard: Artboard;
  readonly scene: Readonly<Record<string, unknown>>;
  readonly metadata?: ThemeMetadata;
  readonly globals?: FabricGlobals;
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
    ...(document.globals === undefined ? {} : { globals: fabricGlobalsFor(document.globals) }),
    ...(document.assets === undefined ? {} : { assets: document.assets }),
    ...(Object.keys(bindings).length === 0 ? {} : { bindings }),
    ...(document.editorMetadata === undefined ? {} : { editorMetadata: document.editorMetadata }),
  };
}

/** The legacy document writer had untyped palette values; carry CSS solids forward into v2. */
function fabricGlobalsFor(globals: Globals): FabricGlobals {
  const palette = globals.palette;
  return {
    ...(globals.typePresets === undefined ? {} : { typePresets: globals.typePresets }),
    ...(palette === undefined ? {} : {
      palette: Object.fromEntries(Object.entries(palette).map(([id, entry]) => [id, {
        ...entry,
        value: typeof entry.value === 'string' ? { kind: 'solid' as const, color: entry.value } : entry.value,
      }])) as FabricPalette,
    }),
  };
}
