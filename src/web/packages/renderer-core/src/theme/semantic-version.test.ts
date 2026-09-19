import { describe, expect, it } from 'vitest';
import { bumpSemanticVersion, isSemanticVersion } from './document.js';

describe('semantic versions', () => {
  it('initializes and bumps exact release versions', () => {
    expect(isSemanticVersion('1.2.3')).toBe(true);
    expect(isSemanticVersion('v1.2.3')).toBe(false);
    expect(bumpSemanticVersion(undefined, 'patch')).toBe('0.1.0');
    expect(bumpSemanticVersion('1.2.3', 'minor')).toBe('1.3.0');
  });
});
