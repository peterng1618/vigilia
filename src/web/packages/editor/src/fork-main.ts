import { type FabricThemeEnvelope, type FabricThemeEnvelopeInput } from '@vigilia/renderer-core';
import { assertFabricThemeEnvelopeCompatible, loadFontAssets, startChartRefresh, type ChartRefreshRate } from '@vigilia/scene-fabric';
import { ForkExtensions } from './fork-extensions/index.js';
import { mountForkShell } from './fork-shell.js';
import { createEditorSource } from './live-source.js';
import { createNewFabricTheme } from './new-fabric-theme.js';
import { parseThemePackage } from './persist.js';
import { createThemeLibraryClient } from './theme-library-client.js';

type EditorSource = ReturnType<typeof createEditorSource>;
type ActiveEditor = {
  readonly shell: Awaited<ReturnType<typeof mountForkShell>>;
  readonly extensions: ForkExtensions;
  readonly releaseFonts: () => void;
  source: EditorSource;
};

async function start(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage');
  const panelHost = document.querySelector<HTMLElement>('#properties');
  const status = document.querySelector<HTMLElement>('#status');

  if (host === null || panelHost === null || status === null) {
    throw new Error('Editor shell is missing #stage, #properties or #status.');
  }

  const libraryClient = createThemeLibraryClient();
  let mode: 'preview' | 'live' = 'preview';
  let active: ActiveEditor | undefined;
  let chartRefreshRate: ChartRefreshRate = 30;

  const sourceControl = document.createElement('label');
  sourceControl.textContent = 'Data source';
  const sourceMode = document.createElement('select');
  for (const value of ['preview', 'live'] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value === 'preview' ? 'Preview' : 'Live';
    sourceMode.append(option);
  }
  sourceControl.append(sourceMode);
  panelHost.append(sourceControl);

  const refreshControl = document.createElement('label');
  refreshControl.textContent = 'Chart refresh';
  const refreshRate = document.createElement('select');
  refreshRate.dataset['vigiliaChartRefresh'] = '';
  for (const rate of [30, 1] as const) {
    const option = document.createElement('option');
    option.value = String(rate);
    option.textContent = `${rate} FPS`;
    refreshRate.append(option);
  }
  refreshControl.append(refreshRate);
  panelHost.append(refreshControl);

  const createSource = (envelope: FabricThemeEnvelopeInput): EditorSource => createEditorSource({
    mode,
    keys: semanticKeys(envelope),
    onStatus: (sourceStatus, detail) => {
      status.textContent = `${mode === 'preview' ? 'Preview' : 'Live'}: ${detail ?? sourceStatus}`;
    },
  });

  const replaceSource = (): void => {
    if (active === undefined) return;
    const source = createSource(active.extensions.envelope);
    active.source.close();
    active.extensions.setSource(source.source);
    active.source = source;
  };

  sourceMode.addEventListener('change', () => {
    mode = sourceMode.value === 'live' ? 'live' : 'preview';
    replaceSource();
  });

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.vigilia-theme';
  picker.hidden = true;
  host.parentElement!.append(picker);

  const mount = async (next: { readonly input: FabricThemeEnvelopeInput; readonly envelope: FabricThemeEnvelope; readonly assets?: Readonly<Record<string, Uint8Array>> }) => {
    assertFabricThemeEnvelopeCompatible(next.envelope);
    const releaseFonts = await loadFontAssets({
      assets: next.envelope.assets ?? [], bytes: next.assets ?? {},
      onError: (message) => { status.textContent = message; },
    });
    const source = createSource(next.input);
    let shell: Awaited<ReturnType<typeof mountForkShell>>;
    try {
      shell = await mountForkShell({ host, artboard: next.input.artboard, envelope: next.envelope });
    } catch (error) {
      releaseFonts();
      throw error;
    }
    const extensions = new ForkExtensions({
      shell,
      source: source.source,
      envelope: next.input,
      ...(next.assets === undefined ? {} : { assets: next.assets }),
      panelHost,
      libraryClient,
      onBindingsChange: replaceSource,
      onNew: async () => {
        const fresh = createNewFabricTheme();
        await mount({ input: envelopeInputFor(fresh), envelope: fresh });
        status.textContent = 'New Fabric theme';
      },
      onOpenPackage: () => picker.click(),
      onOpenTheme: async (envelope, assets) => {
        await mount({ input: envelopeInputFor(envelope), envelope, assets });
        status.textContent = `Opened ${envelope.metadata?.name ?? envelope.id}`;
      },
      onSaved: (msg) => { status.textContent = msg ?? 'Fabric theme saved'; },
      onError: (msg) => { status.textContent = msg; },
    });
    await extensions.hydrateAssets(shell);
    active?.extensions.destroy();
    active?.shell.destroy();
    active?.source.close();
    active?.releaseFonts();
    active = { shell, extensions, source, releaseFonts };
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
        await mount({ input: envelopeInputFor(parsed.envelope), envelope: parsed.envelope, assets: parsed.assets });
        status.textContent = `Opened ${file.name}`;
      } catch (error) {
        status.textContent = `Could not open: ${error instanceof Error ? error.message : String(error)}`;
      }
    });
  });

  const chartRefresh = startChartRefresh(() => active?.extensions.charts.refresh(), chartRefreshRate);
  refreshRate.addEventListener('change', () => {
    chartRefreshRate = refreshRate.value === '1' ? 1 : 30;
    chartRefresh.setRate(chartRefreshRate);
  });
  window.addEventListener('pagehide', () => chartRefresh.dispose(), { once: true });

  const theme = createNewFabricTheme();
  await mount({
    input: envelopeInputFor(theme),
    envelope: theme,
  });
  status.textContent = 'Fabric editor ready';
}

void start();

function semanticKeys(envelope: FabricThemeEnvelopeInput): readonly string[] {
  return [...new Set(Object.values(envelope.bindings ?? {}).flatMap((bindings) =>
    bindings.map((binding) => binding.semanticKey)))];
}

function envelopeInputFor(envelope: FabricThemeEnvelope): FabricThemeEnvelopeInput {
  const { schemaVersion: _schemaVersion, fabricVersion: _fabricVersion, scene: _scene, ...input } = envelope;
  return input;
}
