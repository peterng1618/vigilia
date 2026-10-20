/**
 * The package picker's decision, which is `theme-import.ts`'s and not
 * `editor-main.ts`'s: importing writes to the library, where opening a
 * document would need the whole editor shell mounted (R129). The document is
 * therefore not in this file's world at all — the cases below assert what the
 * import reaches (the one write, and the library's own state after it) rather
 * than an object this module cannot see.
 */
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import { parseThemePackage, serializeThemePackage } from "./persist.js";
import { importThemePackage, themeImportId } from "./theme-import.js";
import {
  ThemeConflictError,
  type ThemeLibraryContent,
} from "./theme-library-client.js";

/**
 * The library as `ThemeLibraryClient` documents it: `save` writes the id it is
 * given, and an id already held is a conflict rather than a replacement. The
 * other operations are here to be **not** called — a fake with only `save` on
 * it would make "the import opened nothing" true by construction instead of by
 * observation.
 */
function libraryWithEveryOperation(held: readonly FabricThemeEnvelope[] = []) {
  const stored = new Map(held.map((envelope) => [envelope.id, envelope]));
  const operations: string[] = [];
  const writes: { readonly id: string; readonly overwrite: boolean }[] = [];
  return {
    stored,
    operations,
    writes,
    library: {
      async save(
        id: string,
        content: ThemeLibraryContent,
        options?: { readonly overwrite?: boolean },
      ): Promise<string> {
        operations.push("save");
        writes.push({ id, overwrite: options?.overwrite === true });
        if (stored.has(id) && options?.overwrite !== true) {
          throw new ThemeConflictError(`"${id}" is already in the library.`);
        }
        stored.set(id, content.envelope);
        return "a-base";
      },
      async open(id: string): Promise<ThemeLibraryContent> {
        operations.push("open");
        throw new Error(`no theme "${id}"`);
      },
      async list(): Promise<never[]> {
        operations.push("list");
        return [];
      },
    },
  };
}

/** A valid v2 theme whose name is not its id: a slug of `Living Room` would be
 *  `living-room`, so an import that derived one is visible in the write. */
const PACKAGE_ENVELOPE: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "family-room",
  artboard: { width: 1920, height: 1080 },
  metadata: { name: "Living Room", themeLanguage: "en" },
  scene: { version: "7.4.0", objects: [] },
};

/** The bytes an author hands the picker, written by the format's own writer. */
function packageBytes(
  envelope: FabricThemeEnvelope = PACKAGE_ENVELOPE,
): Uint8Array {
  const written = serializeThemePackage(envelope);
  if (!written.ok) throw new Error(written.message);
  return written.bytes;
}

describe("importThemePackage", () => {
  it("writes an imported package into the library and leaves the document alone", async () => {
    const lib = libraryWithEveryOperation();

    const result = await importThemePackage(packageBytes(), lib.library);

    expect(result).toEqual({ ok: true, id: "family-room" });
    // The id is the package's own, not a slug of its name, and the write never
    // asks to replace what is stored.
    expect(lib.writes).toEqual([{ id: "family-room", overwrite: false }]);
    // The library's own state afterwards: the theme is there, as its document.
    expect(lib.stored.get("family-room")).toEqual(PACKAGE_ENVELOPE);
  });

  it("does not open the imported package as a document", async () => {
    const lib = libraryWithEveryOperation();

    const result = await importThemePackage(packageBytes(), lib.library);

    // Nothing to mount: an id, and no document beside it.
    expect(result).toEqual({ ok: true, id: "family-room" });
    // And the library was touched once — by the write. Not `open`, not `list`.
    expect(lib.operations).toEqual(["save"]);
  });

  it("reports a package the validator refuses, and changes nothing", async () => {
    const lib = libraryWithEveryOperation();
    const bytes = new Uint8Array([1, 2, 3]);
    const refusal = parseThemePackage(bytes);
    if (refusal.ok) throw new Error("the fixture is supposed to be unreadable");

    const result = await importThemePackage(bytes, lib.library);

    // The reader's own reason, carried out rather than replaced by a generic
    // sentence — this is §141's refusal reaching the author.
    expect(result).toEqual({ ok: false, message: refusal.message });
    expect(lib.operations).toEqual([]);
    expect(lib.stored.size).toBe(0);
  });

  it("reports an id the library already holds, and does not replace it", async () => {
    const held: FabricThemeEnvelope = {
      ...PACKAGE_ENVELOPE,
      metadata: { name: "Living Room, edited here", themeLanguage: "en" },
    };
    const lib = libraryWithEveryOperation([held]);

    const result = await importThemePackage(packageBytes(), lib.library);

    // `save`'s own words: the import neither retries nor overwrites.
    expect(result).toEqual({
      ok: false,
      message: '"family-room" is already in the library.',
    });
    expect(lib.stored.get("family-room")).toEqual(held);
    expect(lib.writes).toEqual([{ id: "family-room", overwrite: false }]);
  });
});

describe("themeImportId", () => {
  it("takes the package's own id when the library can hold it", () => {
    expect(themeImportId(PACKAGE_ENVELOPE)).toEqual({
      ok: true,
      id: "family-room",
    });
  });

  it("refuses an id the library cannot hold, naming it", () => {
    const result = themeImportId({ ...PACKAGE_ENVELOPE, id: "Family Room" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Family Room");
  });
});
