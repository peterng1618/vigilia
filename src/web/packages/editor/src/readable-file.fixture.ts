// jsdom's `File` has no `arrayBuffer`, which every browser's does and which
// the asset manager calls. Installing this makes a built file readable, so a
// test exercises the real import rather than stubbing the manager.
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

export function installReadableFile(): void {
  globalThis.File = ReadableFile as unknown as typeof File;
}
