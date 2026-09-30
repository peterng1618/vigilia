import type {
  ThemeLibraryClient,
  ThemeLibraryContent,
} from "./theme-library-client.js";

/**
 * The theme a boot URL asks for, or nothing to open.
 *
 * `?theme=<id>` is the same call the in-editor *Open library* dialog makes,
 * reached by URL instead. A saved theme with no way back to it is a
 * write-only surface: the editor could put one in the library and nothing
 * could ever read it again.
 *
 * An id this host does not have is not an error. A bookmark outlives the theme
 * it points at, and a dead one must open the editor's own default rather than
 * a page that says nothing useful — the same thing a bare `/editor/` gives.
 */
export async function bootTheme(
  search: string,
  client: ThemeLibraryClient,
): Promise<ThemeLibraryContent | undefined> {
  const id = new URLSearchParams(search).get("theme");
  if (id === null || id === "") return undefined;
  try {
    return await client.open(id);
  } catch {
    return undefined;
  }
}
