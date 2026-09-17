import { buildScenePlan } from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { ChartManager } from './chart-manager/index.js';
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

  const shell = await mountForkShell({ host, artboard: theme.artboard, plan });
  if (shell.scene === undefined) throw new Error('The fork shell needs a scene adapter for chart editing.');
  const charts = new ChartManager({ editor: shell.editor, scene: shell.scene, source, document: theme, panelHost: host.parentElement! });
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      downloadTheme(shell.snapshot(charts.document));
      status.textContent = 'Fabric theme saved';
    }
  });
  status.textContent = 'Fabric editor ready';
}

void start();

function downloadTheme(theme: object): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(theme, undefined, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vigilia-theme.json';
  link.click();
  URL.revokeObjectURL(url);
}
