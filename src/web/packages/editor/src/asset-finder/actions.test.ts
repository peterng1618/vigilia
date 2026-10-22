// @vitest-environment jsdom
import type { AssetPage, AssetResult } from "@yunari/renderer-core";
import { describe, expect, it, vi } from "vitest";
import { AssetManager } from "../asset-manager/index.js";
import type { EditorDocument } from "../editor-document.js";
import { creditOf, importFinderResult } from "./actions.js";

// jsdom's `File` has no `arrayBuffer`, which every browser's does and which
// the asset manager calls. The shim reads the bytes the file was built from.
const JsdomFile = globalThis.File;
class ReadableFile extends JsdomFile {
  readonly #bytes: Uint8Array;

  constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) {
    super(parts, name, options);
    this.#bytes = new Uint8Array(parts[0] as ArrayBuffer);
  }

  override async arrayBuffer(): Promise<ArrayBuffer> {
    return this.#bytes.buffer.slice(
      this.#bytes.byteOffset,
      this.#bytes.byteOffset + this.#bytes.byteLength,
    ) as ArrayBuffer;
  }
}
globalThis.File = ReadableFile as unknown as typeof File;

const svg = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>',
);

const lucide: AssetResult = {
  id: "house",
  name: "house",
  kind: "icon",
  preview: "",
  subtitle: undefined,
  licence: "ISC",
  sourceUrl: "https://lucide.dev/icons/house",
};

const page: AssetPage = {
  source: "lucide",
  results: [lucide],
  next: undefined,
  failure: undefined,
};

function documentStub(): {
  document: EditorDocument;
  addCredit: ReturnType<typeof vi.fn>;
} {
  const addCredit = vi.fn();
  return {
    document: { addCredit } as unknown as EditorDocument,
    addCredit,
  };
}

describe("importFinderResult", () => {
  it("declares the bytes, records the credit and runs the kind's own action", async () => {
    const manager = new AssetManager();
    const { document, addCredit } = documentStub();
    const place = vi.fn();

    const outcome = await importFinderResult({
      page,
      result: lucide,
      bytes: svg,
      filename: "house.svg",
      manager,
      document,
      place,
    });

    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.imported.reference.path).toBe(
      "assets/house.svg",
    );
    expect(addCredit).toHaveBeenCalledWith({
      kind: "icon",
      title: "house",
      license: "ISC",
      changes: "Imported unchanged",
      source: { url: "https://lucide.dev/icons/house" },
    });
    expect(place).toHaveBeenCalledWith(
      outcome.ok ? outcome.imported.reference.id : "",
    );
  });

  it("refuses a file the manager cannot read and adds no entry", async () => {
    const manager = new AssetManager();
    const { document, addCredit } = documentStub();
    const place = vi.fn();

    const outcome = await importFinderResult({
      page,
      result: lucide,
      bytes: svg,
      filename: "house.bin",
      manager,
      document,
      place,
    });

    expect(outcome.ok).toBe(false);
    expect(addCredit).not.toHaveBeenCalled();
    expect(place).not.toHaveBeenCalled();
  });

  it("composes the credit from the result, never from the filename", () => {
    expect(creditOf(lucide)).toEqual({
      kind: "icon",
      title: "house",
      license: "ISC",
      changes: "Imported unchanged",
      source: { url: "https://lucide.dev/icons/house" },
    });
  });
});
