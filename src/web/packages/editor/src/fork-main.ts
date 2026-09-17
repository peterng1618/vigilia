import { buildScenePlan } from '@vigilia/renderer-core';
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import { findNode, updateChartSettings } from './commands.js';
import { createForkChartPanel } from './fork-chart-panel.js';
import { mountForkShell } from './fork-shell.js';

async function start(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage');
  const status = document.querySelector<HTMLElement>('#status');

  if (host === null || status === null) {
    throw new Error('Editor shell is missing #stage or #status.');
  }

  let theme = loadDemoTheme(new URLSearchParams(window.location.search).get('theme') ?? 'demo');

  const nowMs = Date.now();
  const source = createDemoSource(nowMs);
  const plan = buildScenePlan({ document: theme, source, nowMs, animate: false });

  const shell = await mountForkShell({ host, artboard: theme.artboard, plan });
  const panel = createForkChartPanel(host.parentElement!, (id, settings) => {
    theme = updateChartSettings(theme, id, settings);
    shell.scene?.apply(buildScenePlan({ document: theme, source, nowMs: Date.now(), animate: false }));
    drawPanel();
  });

  const drawPanel = (): void => {
    const object = shell.editor.canvas.getActiveObject();
    const id = object?.get('id');
    const node = typeof id === 'string' ? findNode(theme.nodes, id) : undefined;
    panel.render(node?.type === 'chart' ? { id: node.id, content: node.content } : undefined);
  };
  shell.editor.canvas.on('selection:created', drawPanel);
  shell.editor.canvas.on('selection:updated', drawPanel);
  shell.editor.canvas.on('selection:cleared', drawPanel);
  drawPanel();
  status.textContent = 'Fabric editor ready';
}

void start();
