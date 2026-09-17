import { buildScenePlan } from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { ChartManager } from './chart-manager/index.js';
import { mountForkShell } from './fork-shell.js';
import { PersistenceManager } from './persistence-manager/index.js';
import { ShortcutManager } from './shortcut-manager/index.js';

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
  const persistence = new PersistenceManager();
  const shortcuts = new ShortcutManager();
  shortcuts.register('file.save', () => {
      persistence.save(shell.snapshot(charts.document));
      status.textContent = 'Fabric theme saved';
  });
  status.textContent = 'Fabric editor ready';
}

void start();
