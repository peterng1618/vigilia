import path from 'node:path';

/**
 * Turning a URL path into a file path, safely. Pure — no `fs`.
 *
 * §141 requires traversal to be rejected, and this is the function that does
 * it. It is separated from the `fs` read for the usual reason: the rule worth
 * testing is *which paths are allowed*, and asserting that needs no
 * filesystem, no server and no fixture tree.
 */

/**
 * Content types for what the bundles actually contain.
 *
 * A deliberate allowlist rather than a lookup in a dependency. Anything not
 * listed is served as `application/octet-stream`, which a browser will
 * download rather than execute — the safe direction for an unknown type.
 */
const CONTENT_TYPES = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.ico', 'image/x-icon'],
  ['.map', 'application/json; charset=utf-8'],
]);

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

/**
 * Resolves a URL path inside `root`.
 *
 * @returns An absolute path inside `root`, or `undefined` when the request
 *   escapes it. Refusing is always correct here: there is no legitimate
 *   request from a dashboard for a file outside its own bundle.
 *
 * The containment check is made **after** resolution, not by pattern-matching
 * the URL for `..`. Encoded, doubled and mixed-separator forms of traversal
 * are endless to enumerate; where the path actually lands is not.
 */
export function resolveStaticPath(root: string, urlPath: string): string | undefined {
  let decoded: string;

  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    // A malformed escape is not a file request worth guessing at.
    return undefined;
  }

  // A NUL byte can truncate a path inside a syscall, making a checked
  // extension irrelevant to what actually gets opened.
  if (decoded.includes('\0')) {
    return undefined;
  }

  const withoutQuery = decoded.split('?')[0] ?? '';
  const relative = withoutQuery.replace(/^\/+/, '');
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relative);

  // `startsWith(root)` alone would accept a sibling whose name merely begins
  // with the root's — `/srv/player-secrets` against a root of `/srv/player`.
  // Requiring the separator, or an exact match, closes that.
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + path.sep)) {
    return undefined;
  }

  return candidate;
}
