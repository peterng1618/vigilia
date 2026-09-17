import type { FabricThemeEnvelope } from '@vigilia/renderer-core';

/** The editor's initial document is the same v2 envelope that Open revives. */
export function createNewFabricTheme(): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: '7.4.0',
    id: 'untitled',
    artboard: { width: 1280, height: 720 },
    scene: { version: '7.4.0', objects: [] },
  };
}
