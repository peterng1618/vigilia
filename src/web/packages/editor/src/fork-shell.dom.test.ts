// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { disposeScene, reviveScene, serialiseScene } from '@vigilia/scene-fabric';

const initEditor = vi.hoisted(() => vi.fn());

vi.mock('@anu3ev/fabric-image-editor', () => ({ default: initEditor }));

import { mountForkShell } from './fork-shell.js';

describe('the adopted editor shell', () => {
  it('installs the disposal-aware history hook at the fork boundary', async () => {
    const editor = { canvas: {}, destroy: vi.fn() };
    initEditor.mockResolvedValue(editor);
    const host = document.createElement('main');
    host.append(document.createElement('p'));

    const shell = await mountForkShell({ host, artboard: { width: 1280, height: 720 } });

    expect(host.children).toHaveLength(1);
    expect(initEditor).toHaveBeenCalledWith('vigilia-fabric-editor', {
      montageAreaWidth: 1280,
      montageAreaHeight: 720,
      editorContainerWidth: '100%',
      editorContainerHeight: '100%',
      beforeHistoryStateLoad: disposeScene,
      serializeHistoryState: serialiseScene,
      reviveHistoryState: reviveScene,
    });
    expect(shell.editor).toBe(editor);
  });

  it('removes its container when initialization fails', async () => {
    initEditor.mockRejectedValue(new Error('fork failed'));
    const host = document.createElement('main');

    await expect(mountForkShell({ host, artboard: { width: 1, height: 1 } })).rejects.toThrow('fork failed');

    expect(host.children).toHaveLength(0);
  });
});
