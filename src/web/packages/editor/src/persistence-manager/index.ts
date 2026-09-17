import type { FabricThemeEnvelope } from '@vigilia/renderer-core';

/** Product file export; envelope parsing/import arrives with v2 validation. */
export class PersistenceManager {
  save(theme: FabricThemeEnvelope): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(theme, undefined, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vigilia-theme.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  destroy(): void {}
}
