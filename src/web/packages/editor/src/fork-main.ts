import { buildScenePlan, fabricEnvelopeInputFor, type FabricThemeEnvelope, type FabricThemeEnvelopeInput } from '@vigilia/renderer-core';
import { assertFabricThemeEnvelopeCompatible } from '@vigilia/scene-fabric';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { ForkExtensions } from './fork-extensions/index.js';
import { mountForkShell } from './fork-shell.js';
import { describeIssues, parseFabricThemeFile } from './persist.js';

async function start(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage');
  const status = document.querySelector<HTMLElement>('#status');

  if (host === null || status === null) {
    throw new Error('Editor shell is missing #stage or #status.');
  }

  const nowMs = Date.now();
  const source = createDemoSource(nowMs);
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'application/json,.json';
  picker.hidden = true;
  host.parentElement!.append(picker);

  let active: { readonly shell: Awaited<ReturnType<typeof mountForkShell>>; readonly extensions: ForkExtensions } | undefined;
  const mount = async (next: { readonly input: FabricThemeEnvelopeInput; readonly envelope?: FabricThemeEnvelope; readonly plan?: ReturnType<typeof buildScenePlan> }) => {
    if (next.envelope !== undefined) assertFabricThemeEnvelopeCompatible(next.envelope);
    active?.extensions.destroy();
    active?.shell.destroy();
    const shell = await mountForkShell({
      host,
      artboard: next.input.artboard,
      ...(next.envelope === undefined ? {} : { envelope: next.envelope }),
      ...(next.plan === undefined ? {} : { plan: next.plan }),
    });
    const extensions = new ForkExtensions({
      shell,
      source,
      envelope: next.input,
      panelHost: host.parentElement!,
      onOpen: () => picker.click(),
      onSaved: () => { status.textContent = 'Fabric theme saved'; },
    });
    active = { shell, extensions };
  };

  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (file === undefined) return;
    void file.text().then(async (text) => {
      const parsed = parseFabricThemeFile(text);
      if (!parsed.ok) {
        status.textContent = `Could not open: ${describeIssues(parsed.issues)}`;
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

  const theme = loadDemoTheme(new URLSearchParams(window.location.search).get('theme') ?? 'demo');
  await mount({
    input: fabricEnvelopeInputFor(theme),
    plan: buildScenePlan({ document: theme, source, nowMs, animate: false }),
  });
  status.textContent = 'Fabric editor ready';
}

void start();

function envelopeInputFor(envelope: FabricThemeEnvelope): FabricThemeEnvelopeInput {
  const { schemaVersion: _schemaVersion, fabricVersion: _fabricVersion, scene: _scene, ...input } = envelope;
  return input;
}
