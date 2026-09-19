import { type FabricThemeEnvelope, type FabricThemeEnvelopeInput } from '@vigilia/renderer-core';
import { assertFabricThemeEnvelopeCompatible } from '@vigilia/scene-fabric';
import { createDemoSource } from '@vigilia/fake-source';
import { ForkExtensions } from './fork-extensions/index.js';
import { mountForkShell } from './fork-shell.js';
import { createNewFabricTheme } from './new-fabric-theme.js';
import { parseThemePackage } from './persist.js';
import { createThemeLibraryClient } from './theme-library-client.js';

async function start(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage');
  const panelHost = document.querySelector<HTMLElement>('#properties');
  const status = document.querySelector<HTMLElement>('#status');

  if (host === null || panelHost === null || status === null) {
    throw new Error('Editor shell is missing #stage, #properties or #status.');
  }

  const nowMs = Date.now();
  const source = createDemoSource(nowMs);
  const libraryClient = createThemeLibraryClient();

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.vigilia-theme';
  picker.hidden = true;
  host.parentElement!.append(picker);

  let active: { readonly shell: Awaited<ReturnType<typeof mountForkShell>>; readonly extensions: ForkExtensions } | undefined;
  const mount = async (next: { readonly input: FabricThemeEnvelopeInput; readonly envelope: FabricThemeEnvelope }) => {
    assertFabricThemeEnvelopeCompatible(next.envelope);
    const shell = await mountForkShell({
      host,
      artboard: next.input.artboard,
      envelope: next.envelope,
    });
    const extensions = new ForkExtensions({
      shell,
      source,
      envelope: next.input,
      panelHost,
      libraryClient,
      onNew: async () => {
        const fresh = createNewFabricTheme();
        await mount({ input: envelopeInputFor(fresh), envelope: fresh });
        status.textContent = 'New Fabric theme';
      },
      onOpenPackage: () => picker.click(),
      onOpenTheme: async (envelope) => {
        await mount({ input: envelopeInputFor(envelope), envelope });
        status.textContent = `Opened ${envelope.metadata?.name ?? envelope.id}`;
      },
      onSaved: (msg) => { status.textContent = msg ?? 'Fabric theme saved'; },
      onError: (msg) => { status.textContent = msg; },
    });
    active?.extensions.destroy();
    active?.shell.destroy();
    active = { shell, extensions };
  };

  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (file === undefined) return;
    void file.arrayBuffer().then(async (buffer) => {
      const bytes = new Uint8Array(buffer);
      const parsed = parseThemePackage(bytes);
      if (!parsed.ok) {
        status.textContent = `Could not open: ${parsed.message}`;
        return;
      }
      try {
        await mount({ input: envelopeInputFor(parsed.envelope), envelope: parsed.envelope });
        status.textContent = `Opened ${file.name}`;
      } catch (error) {
        status.textContent = `Could not open: ${error instanceof Error ? error.message : String(error)}`;
      }
    });
  });

  const theme = createNewFabricTheme();
  await mount({
    input: envelopeInputFor(theme),
    envelope: theme,
  });
  status.textContent = 'Fabric editor ready';
}

void start();

function envelopeInputFor(envelope: FabricThemeEnvelope): FabricThemeEnvelopeInput {
  const { schemaVersion: _schemaVersion, fabricVersion: _fabricVersion, scene: _scene, ...input } = envelope;
  return input;
}