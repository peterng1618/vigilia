import { describe, expect, it } from 'vitest';
import { validateFabricThemeEnvelope } from '@vigilia/renderer-core';
import { createNewFabricTheme } from './new-fabric-theme.js';

describe('the new Fabric document', () => {
  it('starts with a validated v2 dashboard that the editor opens', () => {
    const document_ = createNewFabricTheme();

    expect(validateFabricThemeEnvelope(document_)).toEqual({ ok: true, envelope: document_ });
    expect(document_.scene.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'background' }),
      expect.objectContaining({ id: 'cpu-card' }),
      expect.objectContaining({ id: 'memory-card' }),
    ]));
  });
});
