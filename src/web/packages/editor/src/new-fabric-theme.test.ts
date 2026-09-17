import { describe, expect, it } from 'vitest';
import { validateFabricThemeEnvelope } from '@vigilia/renderer-core';
import { createNewFabricTheme } from './new-fabric-theme.js';

describe('the new Fabric document', () => {
  it('starts with the same validated v2 envelope that the editor opens', () => {
    const document_ = createNewFabricTheme();

    expect(validateFabricThemeEnvelope(document_)).toEqual({ ok: true, envelope: document_ });
    expect(document_.scene.objects).toEqual([]);
  });
});
