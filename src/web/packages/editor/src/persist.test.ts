import { describe, expect, it } from 'vitest';
import { loadDemoTheme } from '@vigilia/fake-source';
import {
  MAX_THEME_BYTES,
  describeIssues,
  fileNameFor,
  parseFabricThemeFile,
  parseThemeFile,
  serializeForFile,
} from './persist.js';

describe('parseThemeFile', () => {
  it('round-trips the demo theme byte for byte', () => {
    const document_ = loadDemoTheme('demo');
    const text = serializeForFile(document_);
    const result = parseThemeFile(text);

    expect(result.ok).toBe(true);

    if (result.ok) {
      // Re-serialising the parsed document must produce the same text, or
      // opening and saving without editing would show a diff.
      expect(serializeForFile(result.document)).toBe(text);
    }
  });

  it('rejects broken JSON with the parser\'s own message', () => {
    const result = parseThemeFile('{ "schemaVersion": 1, ');

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(describeIssues(result.issues)).toContain('not valid JSON');
    }
  });

  it('rejects a valid JSON document that is not a theme', () => {
    const result = parseThemeFile('{"hello":"world"}');

    expect(result.ok).toBe(false);
  });

  it('rejects a file that is too large without parsing it', () => {
    const result = parseThemeFile('x'.repeat(MAX_THEME_BYTES + 1));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(describeIssues(result.issues)).toContain('MB');
    }
  });

  it('reports only the version for a newer schema (§141)', () => {
    const result = parseThemeFile(
      JSON.stringify({ schemaVersion: 99, id: 'x', artboard: { width: 1, height: 1 }, nodes: [] }),
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      // §141: fail on the version alone. Anything else said about a format we
      // do not understand would be speculation.
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.code).toBe('newer-schema-version');
    }
  });

  it('rejects a JSON array, which parses but is not a document', () => {
    expect(parseThemeFile('[]').ok).toBe(false);
  });
});

describe('parseFabricThemeFile', () => {
  const envelope = { schemaVersion: 2, fabricVersion: '7.4.0', id: 'theme', artboard: { width: 1, height: 1 }, scene: { version: '7.4.0', objects: [] } };

  it('accepts a v2 Fabric envelope and rejects v1 without interpreting it', () => {
    expect(parseFabricThemeFile(JSON.stringify(envelope))).toMatchObject({ ok: true, envelope });
    const result = parseFabricThemeFile(JSON.stringify({ ...envelope, schemaVersion: 1, scene: 'wrong' }));
    expect(result).toMatchObject({ ok: false, issues: [{ code: 'unsupported-schema-version' }] });
  });
});

describe('serializeForFile', () => {
  it('ends with exactly one newline', () => {
    const text = serializeForFile(loadDemoTheme('demo'));

    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('}\n\n')).toBe(false);
  });
});

describe('fileNameFor', () => {
  it('uses the theme id', () => {
    expect(fileNameFor(loadDemoTheme('demo'))).toMatch(/^[A-Za-z0-9_-]+\.json$/);
  });

  it('falls back when an id would not be a safe filename', () => {
    const document_ = { ...loadDemoTheme('demo'), id: '../../etc/passwd' };

    // Not reachable from the validator, which enforces the same pattern — but
    // this function is one `JSON.parse` away from arbitrary input, and a
    // filename is exactly where traversal is attempted (§141).
    expect(fileNameFor(document_)).toBe('theme.json');
  });
});

describe('describeIssues', () => {
  it('names the path and counts the rest', () => {
    const text = describeIssues([
      { code: 'out-of-range', path: '/nodes/0/transform/rotation', message: 'Too far.' },
      { code: 'duplicate-id', path: '/nodes/1', message: 'Seen before.' },
    ]);

    expect(text).toBe('Too far. at /nodes/0/transform/rotation (+1 more)');
  });

  it('survives an empty list rather than reading undefined', () => {
    expect(describeIssues([])).toContain('could not be read');
  });
});
