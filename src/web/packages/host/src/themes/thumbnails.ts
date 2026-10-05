import fs from "node:fs/promises";
import path from "node:path";
import { isValidThemeId } from "./store.js";

/**
 * A still of a theme's artboard, stored inside that theme's own folder so the
 * library can show a picture instead of a name.
 *
 * It also travels in the exported package, in a slot `theme-package` names in
 * the manifest and rewrites on every export. The ruling that put it there
 * overturned the earlier argument against it — that a picture is a rendering of
 * one machine's fonts and GPU, and so not portable. The half that still holds:
 * a thumbnail is not a *runtime* asset, which is why it is a slot of its own
 * rather than something in `assets/` for the renderer to load. Losing one is
 * never an error; the library falls back to text.
 */

const FILE = "thumbnail.png";
/** A screenshot of a dashboard; anything larger is not one. */
const MAX_BYTES = 2 * 1024 * 1024;

/** PNG magic: the only format the library renders. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface ThumbnailStore {
  read(id: string): Promise<Uint8Array | undefined>;
  write(id: string, bytes: Uint8Array): Promise<void>;
  remove(id: string): Promise<void>;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength > PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
  );
}

/** A name a theme folder's own listing cannot mistake for anything, matching
 *  the theme store's staging names. */
function scratchName(): string {
  return `.thumbnail-${Date.now()}.${Math.random().toString(36).slice(2)}`;
}

/**
 * @param library The theme library's root: a picture belongs to the theme it
 *   renders, so it is addressed through the same directory the theme is.
 */
export function createThumbnailStore(library: string): ThumbnailStore {
  const filePath = (id: string): string => path.join(library, id, FILE);

  return {
    async read(id) {
      if (!isValidThemeId(id)) {
        return undefined;
      }

      try {
        const bytes = await fs.readFile(filePath(id));

        // A file someone else wrote must not be served as an image.
        return isPng(bytes) ? new Uint8Array(bytes) : undefined;
      } catch {
        // Absent is ordinary: an older package, or a capture that failed.
        return undefined;
      }
    },

    async write(id, bytes) {
      if (!isValidThemeId(id)) {
        throw new Error("Invalid theme id.");
      }

      if (bytes.byteLength > MAX_BYTES) {
        throw new Error("That thumbnail is too large.");
      }

      if (!isPng(bytes)) {
        throw new Error("A thumbnail must be a PNG.");
      }

      // Staged beside its target and renamed, the way the theme store writes a
      // folder: a picture now lives inside the folder that store protects, and a
      // torn one would be served as a corrupt image. `rename` onto an existing
      // *file* succeeds on Windows, unlike onto a directory.
      const folder = path.dirname(filePath(id));
      const staging = path.join(folder, scratchName());
      await fs.mkdir(folder, { recursive: true });

      try {
        await fs.writeFile(staging, bytes);
        await fs.rename(staging, filePath(id));
      } catch (error) {
        await fs.rm(staging, { force: true });
        throw error;
      }
    },

    async remove(id) {
      if (!isValidThemeId(id)) {
        return;
      }

      // The picture, never the theme: a theme is removed by removing its folder,
      // and the picture goes with it because it is one file in there. This
      // exists to drop a picture on its own, and the folder is the theme store's.
      await fs.rm(filePath(id), { force: true });
    },
  };
}
