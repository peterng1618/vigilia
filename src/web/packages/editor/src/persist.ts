import {
  serializeThemeDocument,
  validateThemeDocument,
  type ThemeDocument,
  type ValidationIssue,
} from '@vigilia/renderer-core';

/**
 * Opening and saving a theme file.
 *
 * ## Why this is a download and an upload, not a "save"
 *
 * There is no host yet (ADR-0006 sequences it after this milestone), so there is
 * nowhere to save *to*. A file picker plus a download is the honest stopgap: it
 * round-trips a real theme through a real file, and it exercises §139 and §141
 * for the first time. When the host exists, themes will live there and this
 * becomes "export a copy".
 *
 * The File System Access API would allow saving in place, and is deliberately
 * not used: it needs a user gesture that cannot be driven from a test, so the
 * whole round trip would become unverifiable in exchange for one fewer click on
 * a surface that is a stopgap anyway.
 *
 * ## Parsing is separated from the DOM on purpose
 *
 * {@link parseThemeFile} takes a string and returns a document or a list of
 * problems, so every rule about *what an acceptable file is* is unit-testable.
 * The picker and the download live in `main.ts` and decide nothing.
 */

export type ParseResult =
  | { readonly ok: true; readonly document: ThemeDocument }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/**
 * The largest file this will attempt to parse.
 *
 * §141 asks for bounded input. 8 MB is far past any plausible theme — the
 * stress fixture is 9 KB — and small enough that a mis-picked video does not
 * freeze the tab while `JSON.parse` walks it.
 */
export const MAX_THEME_BYTES = 8 * 1024 * 1024;

/**
 * Parses and validates a theme file's contents.
 *
 * Validation is the same function the player uses, so a file the editor accepts
 * is a file that renders. Anything else would let an author save something the
 * display then refuses.
 */
export function parseThemeFile(text: string): ParseResult {
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
    // The parser's own message names the offset, which is the only useful thing
    // anyone can say about broken JSON.
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

  return validateThemeDocument(parsed);
}

/**
 * The text to write to a `.json` file.
 *
 * A thin wrapper, kept because the file boundary is where a future concern —
 * a BOM, CRLF on Windows, a packaged container — would land, and because "what
 * goes in the file" deserves a name of its own.
 *
 * `serializeThemeDocument` already appends the trailing newline that editors
 * and diffs expect. Appending another here produced a file ending in a blank
 * line, which the "exactly one newline" test caught.
 */
export function serializeForFile(document_: ThemeDocument): string {
  return serializeThemeDocument(document_);
}

/**
 * A filename for a document.
 *
 * From the theme's own id rather than its display name: the id is already
 * constrained to characters that are safe in a filename, and a display name is
 * not — "CPU / GPU dashboard" would produce a path separator.
 */
export function fileNameFor(document_: ThemeDocument): string {
  const base = /^[A-Za-z0-9_-]{1,64}$/.test(document_.id) ? document_.id : 'theme';

  return `${base}.json`;
}

/** A one-line summary of why a file was rejected, for a status bar. */
export function describeIssues(issues: readonly ValidationIssue[]): string {
  const first = issues[0];

  if (first === undefined) {
    return 'That file could not be read.';
  }

  const where = first.path === '' ? '' : ` at ${first.path}`;
  const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';

  return `${first.message}${where}${more}`;
}
