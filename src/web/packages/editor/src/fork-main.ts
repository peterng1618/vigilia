import { buildScenePlan } from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { mountForkShell } from './fork-shell.js';

async function start(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage');
  const status = document.querySelector<HTMLElement>('#status');

  if (host === null || status === null) {
    throw new Error('Editor shell is missing #stage or #status.');
  }

  const theme = loadDemoTheme(new URLSearchParams(window.location.search).get('theme') ?? 'demo');

  const nowMs = Date.now();
  const plan = buildScenePlan({ document: theme, source: createDemoSource(nowMs), nowMs, animate: false });

  await mountForkShell({ host, artboard: theme.artboard, plan });
  status.textContent = 'Fabric editor ready';
}

void start();
