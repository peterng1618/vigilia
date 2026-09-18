import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCHEMA_PATH = fileURLToPath(
  new URL('../../../../../../schema/theme-document.schema.json', import.meta.url),
);

interface SchemaShape {
  readonly $id: string;
  readonly required: readonly string[];
  readonly properties: Record<string, Record<string, unknown>>;
  readonly $defs: Record<string, Record<string, unknown>>;
}

function schema(): SchemaShape {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as SchemaShape;
}

describe('published Fabric theme schema', () => {
  it('publishes the v2 envelope rather than the obsolete node tree', () => {
    const document = schema();

    expect(document.$id).toContain('/2.json');
    expect(document.required).toEqual(['schemaVersion', 'fabricVersion', 'id', 'artboard', 'scene']);
    expect(document.properties['nodes']).toBeUndefined();
    expect(document.properties['scene']).toBeDefined();
  });

  it('keeps envelope bindings and assets explicit while dropping GIF assets', () => {
    const document = schema();
    const asset = document.$defs['assetReference']!['properties'] as Record<string, Record<string, unknown>>;
    const binding = document.$defs['binding']!;

    expect(asset['kind']!['enum']).toEqual(['image', 'svg', 'video', 'font']);
    expect(binding['required']).toContain('id');
    expect(document.properties['bindings']).toBeDefined();
  });

  it('publishes structured palette paints while allowing CSS-compatible colours', () => {
    const document = schema();
    const palette = document.$defs['paletteGroup']!;
    const paint = document.$defs['palettePaint']!;

    expect(palette['required']).toEqual(['none']);
    expect(palette['additionalProperties']).toMatchObject({
      properties: { value: { $ref: '#/$defs/palettePaint' } },
    });
    expect(paint['oneOf']).toHaveLength(2);
  });

  it('publishes typed typography presets separately from style references', () => {
    const document = schema();
    const globals = document.$defs['globals']!['properties'] as Record<string, Record<string, unknown>>;
    const preset = document.$defs['typePreset']!;

    expect(globals['typePresets']).toEqual({ $ref: '#/$defs/typePresetGroup' });
    expect(preset['required']).toEqual(['family', 'size']);
  });
});
