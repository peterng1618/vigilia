import path from 'node:path';

/** Pure URL-path resolution and bundle content-type rules. */

/** Allowlist for bundle asset types; unknown extensions stay octet-stream. */
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

/** Relative editor assets require `/editor/`, not `/editor`. */
export function needsTrailingSlash(urlPath: string, mount: string): boolean {
  const withoutQuery = urlPath.split('?')[0] ?? '';

  return withoutQuery === mount;
}

/** Resolves inside `root`; returns undefined for malformed or escaping paths. */
export function resolveStaticPath(root: string, urlPath: string): string | undefined {
  let decoded: string;

  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }

  if (decoded.includes('\0')) {
    return undefined;
  }

  const withoutQuery = decoded.split('?')[0] ?? '';
  const relative = withoutQuery.replace(/^\/+/, '');
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relative);

  // Require a path-separator boundary so similarly prefixed sibling roots are rejected.
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + path.sep)) {
    return undefined;
  }

  return candidate;
}
