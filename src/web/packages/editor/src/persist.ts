import {
  serializeThemeDocument,
  validateFabricThemeEnvelope,
  type FabricThemeEnvelope,
  validateThemeDocument,
  type ThemeDocument,
  type ValidationIssue,
} from '@vigilia/renderer-core';

/** File import/export boundary. Parsing stays pure; DOM picker/download logic lives in main. */

export type ParseResult =
  | { readonly ok: true; readonly document: ThemeDocument }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export type FabricParseResult =
  | { readonly ok: true; readonly envelope: FabricThemeEnvelope }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Reject unexpectedly large inputs before JSON parsing. */
export const MAX_THEME_BYTES = 8 * 1024 * 1024;

/** Parses JSON and applies the same document validation used by the player. */
export function parseThemeFile(text: string): ParseResult {
  const parsed = parseJson(text);
  return parsed.ok ? validateThemeDocument(parsed.value) : parsed;
}

/** Parses the published v2 envelope; the legacy parser remains fallback-only. */
export function parseFabricThemeFile(text: string): FabricParseResult {
  const parsed = parseJson(text);
  return parsed.ok ? validateFabricThemeEnvelope(parsed.value) : parsed;
}

function parseJson(text: string):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] } {
  if (text.length > MAX_THEME_BYTES) {
    return {
      ok: false,
      issues: [
        {
          code: 'not-an-object',
          path: '',
          message: `That file is larger than ${Math.round(MAX_THEME_BYTES / 1024 / 1024)} MB, so it is not a theme.`,
        },
      ],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          code: 'not-an-object',
          path: '',
          message: `That file is not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      ],
    };
  }

  return { ok: true, value: parsed };
}

/** Canonical file representation, including its trailing newline. */
export function serializeForFile(document_: ThemeDocument): string {
  return serializeThemeDocument(document_);
}

/** Uses the stable id when filename-safe; otherwise falls back to `theme.json`. */
export function fileNameFor(document_: ThemeDocument): string {
  const base = /^[A-Za-z0-9_-]{1,64}$/.test(document_.id) ? document_.id : 'theme';

  return `${base}.json`;
}

/** One-line status-bar summary of validation failure. */
export function describeIssues(issues: readonly ValidationIssue[]): string {
  const first = issues[0];

  if (first === undefined) {
    return 'That file could not be read.';
  }

  const where = first.path === '' ? '' : ` at ${first.path}`;
  const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';

  return `${first.message}${where}${more}`;
}
