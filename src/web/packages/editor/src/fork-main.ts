import { buildScenePlan, fabricEnvelopeInputFor } from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { ForkExtensions } from './fork-extensions/index.js';
import { mountForkShell } from './fork-shell.js';

async function start(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage');
  const status = document.querySelector<HTMLElement>('#status');

  if (host === null || status === null) {
    throw new Error('Editor shell is missing #stage or #status.');
  }

  const theme = loadDemoTheme(new URLSearchParams(window.location.search).get('theme') ?? 'demo');

  const nowMs = Date.now();
  const source = createDemoSource(nowMs);
  const plan = buildScenePlan({ document: theme, source, nowMs, animate: false });
  const envelope = fabricEnvelopeInputFor(theme);

  const shell = await mountForkShell({ host, artboard: theme.artboard, plan });
  new ForkExtensions({
    shell,
    source,
    envelope,
    panelHost: host.parentElement!,
    onSaved: () => {
      status.textContent = 'Fabric theme saved';
    },
  });
  status.textContent = 'Fabric editor ready';
}

void start();
