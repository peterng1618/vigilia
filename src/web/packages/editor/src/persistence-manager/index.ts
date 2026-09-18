import type { FabricThemeEnvelope } from '@vigilia/renderer-core';

/** Product file export; envelope parsing/import arrives with v2 validation. */
export class PersistenceManager {
  #savedDocument: string;

  constructor(initial: FabricThemeEnvelope) {
    this.#savedDocument = documentKey(initial);
  }

  isDirty(theme: FabricThemeEnvelope): boolean {
    return documentKey(theme) !== this.#savedDocument;
  }

  save(theme: FabricThemeEnvelope): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(theme, undefined, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vigilia-theme.json';
    link.click();
    URL.revokeObjectURL(url);
    this.#savedDocument = documentKey(theme);
  }

  destroy(): void {}
}

export async function confirmDocumentReplacement(): Promise<'save' | 'discard' | 'cancel'> {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = '<form method="dialog"><p>Save changes before opening another theme?</p><button value="save">Save</button><button value="discard">Discard</button><button value="cancel">Cancel</button></form>';
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'save' || dialog.returnValue === 'discard' ? dialog.returnValue : 'cancel');
    }, { once: true });
    dialog.showModal();
  });
}

function documentKey(theme: FabricThemeEnvelope): string {
  return JSON.stringify(theme);
}
