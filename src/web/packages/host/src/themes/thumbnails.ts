import fs from "node:fs/promises";
import path from "node:path";

/**
 * A still of a theme's artboard, stored beside its package so the library can
 * show a picture instead of a name.
 *
 * Not part of the package: `theme-package` admits exactly manifest.json,
 * theme.json and assets/, and a thumbnail is a rendering of one machine's fonts
 * and GPU, so it is not portable and does not belong in the immutable share
 * artifact (§139). Losing one is never an error; the library falls back to text.
 */

const DIRECTORY = "thumbnails";
const EXTENSION = ".png";
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

export function createThumbnailStore(directory: string): ThumbnailStore {
  const folder = path.join(directory, DIRECTORY);
  const filePath = (id: string): string =>
    path.join(folder, `${id}${EXTENSION}`);

  return {
    async read(id) {
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
      if (bytes.byteLength > MAX_BYTES) {
        throw new Error("That thumbnail is too large.");
      }

      if (!isPng(bytes)) {
        throw new Error("A thumbnail must be a PNG.");
      }

      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(filePath(id), bytes);
    },

    async remove(id) {
      await fs.rm(filePath(id), { force: true });
    },
  };
}
