// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { disposeScene, reviveScene, reviveThemeEnvelope, serialiseScene } from '@vigilia/scene-fabric';
import { loadDemoTheme } from '@vigilia/fake-source';

const initEditor = vi.hoisted(() => vi.fn());

vi.mock('@anu3ev/fabric-image-editor', () => ({ default: initEditor }));

import { mountForkShell } from './fork-shell.js';

describe('the adopted editor shell', () => {
  it('installs the disposal-aware history hook at the fork boundary', async () => {
    const editor = { canvas: { toObject: vi.fn(() => ({ version: '7.4.0', objects: [] })) }, destroy: vi.fn() };
    initEditor.mockResolvedValue(editor);
    const host = document.createElement('main');
    Object.defineProperties(host, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    host.append(document.createElement('p'));

    const shell = await mountForkShell({ host, artboard: { width: 1280, height: 720 } });

    expect(host.children).toHaveLength(1);
    expect((host.firstElementChild as HTMLElement).style.cssText).toContain('width: 800px');
    expect((host.firstElementChild as HTMLElement).style.cssText).toContain('height: 450px');
    expect(initEditor).toHaveBeenCalledWith('vigilia-fabric-editor', {
      montageAreaWidth: 1280,
      montageAreaHeight: 720,
      editorContainerWidth: '100%',
      editorContainerHeight: '100%',
      defaultScale: 1,
      beforeHistoryStateLoad: disposeScene,
      serializeHistoryState: serialiseScene,
      reviveHistoryState: reviveScene,
    });
    expect(shell.editor).toBe(editor);
    expect(shell.snapshot({ id: 'theme', artboard: { width: 1280, height: 720 } })).toMatchObject({ schemaVersion: 2, id: 'theme' });
  });

  it('reconciles a supplied shared scene onto the fork canvas', async () => {
    const apply = vi.fn();
    const editor = { canvas: {}, destroy: vi.fn() };
    initEditor.mockResolvedValue(editor);

    const sceneFabric = await import('@vigilia/scene-fabric');
    const adapter = vi.spyOn(sceneFabric, 'createSceneAdapter').mockReturnValue({
      apply,
      dispose: vi.fn(),
      objectFor: vi.fn(),
      setRenderScale: vi.fn(),
    });
    const plan = { artboard: {}, nodes: [], issues: [] } as never;

    await mountForkShell({ host: document.createElement('main'), artboard: { width: 1, height: 1 }, plan });

    expect(adapter).toHaveBeenCalledWith({ canvas: editor.canvas });
    expect(apply).toHaveBeenCalledWith(plan);
    adapter.mockRestore();
  });

  it('validates and revives a supplied Fabric envelope before extensions adopt it', async () => {
    const editor = { canvas: {}, destroy: vi.fn() };
    initEditor.mockResolvedValue(editor);
    const sceneFabric = await import('@vigilia/scene-fabric');
    const revive = vi.spyOn(sceneFabric, 'reviveThemeEnvelope').mockResolvedValue();
    const adapter = vi.spyOn(sceneFabric, 'createSceneAdapter').mockReturnValue({
      apply: vi.fn(), dispose: vi.fn(), objectFor: vi.fn(), setRenderScale: vi.fn(),
    });
    const envelope = { schemaVersion: 2, fabricVersion: '7.4.0', id: 'theme', artboard: { width: 1, height: 1 }, scene: { version: '7.4.0', objects: [] } } as const;

    await mountForkShell({ host: document.createElement('main'), artboard: envelope.artboard, envelope });

    expect(revive).toHaveBeenCalledWith(editor.canvas, envelope);
    expect(adapter).toHaveBeenCalledWith({ canvas: editor.canvas });
    revive.mockRestore();
    adapter.mockRestore();
  });

  it('removes its container when initialization fails', async () => {
    initEditor.mockRejectedValue(new Error('fork failed'));
    const host = document.createElement('main');

    await expect(mountForkShell({ host, artboard: { width: 1, height: 1 } })).rejects.toThrow('fork failed');

    expect(host.children).toHaveLength(0);
  });
});
