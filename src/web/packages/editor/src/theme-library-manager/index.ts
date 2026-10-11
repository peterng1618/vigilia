import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import type { AssetManager } from "../asset-manager/index.js";
import type { ErrorManager } from "../error-manager/index.js";
import {
  promptThemeConflict,
  promptThemeSelection,
} from "../theme-library-dialog.js";
import {
  createThemeLibraryClient,
  ThemeConflictError,
  type ThemeLibraryClient,
} from "../theme-library-client.js";

/**
 * The stored document a session descends from, and what that document declared.
 *
 * A save names the first to say which version it was built from; the second is
 * what lets it leave an asset the stored folder already holds out of the
 * request, because a declared `sha256` that has not moved is proof the bytes
 * have not either. Keeping them in one value is the point — a base without its
 * hashes would upload the whole theme every time, which is what this exists to
 * stop.
 */
interface LibraryBase {
  readonly id: string;
  readonly hashes: ReadonlyMap<string, string>;
}

/** The base of a document, paired with the hashes that document declares. */
function libraryBase(
  id: string | undefined,
  declarations: readonly { readonly path: string; readonly sha256?: string }[],
): LibraryBase | undefined {
  if (id === undefined) {
    return undefined;
  }
  return {
    id,
    hashes: new Map(
      declarations.flatMap((declared) =>
        declared.sha256 === undefined
          ? []
          : [[declared.path, declared.sha256] as const],
      ),
    ),
  };
}

/**
 * What the manager needs of the document it saves, which is the session's.
 *
 * A port rather than the session itself: the manager must not know how a
 * document is composed, only how to hand one to the host's library and take the
 * answer back.
 */
interface ThemeLibraryManagerOptions {
  /** The document as the author last left it. */
  readonly snapshot: () => FabricThemeEnvelope;
  /** The document's own declared bytes, which is what a save sends. */
  readonly assets: AssetManager;
  /** The picture a save ships, or the one this document arrived with: a
   *  capture that fails must cost the preview, not the theme. */
  readonly picture: () => Promise<Uint8Array | undefined>;
  /** What the library now holds, so the unsaved marker can clear. */
  readonly markSaved: (
    theme: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>>,
  ) => void;
  /** Told the document may have moved, which the unsaved marker reads. */
  readonly announceChange: () => void;
  readonly errors: ErrorManager;
  /** Asks before the open document is replaced; `false` stops the open. */
  readonly confirmReplacement: () => Promise<boolean>;
  /** A save that happened, in the editor's own words. */
  readonly onSaved: (message?: string) => void;
  /** Builds a document from the reference composition, as a template. */
  readonly onNewFromStarter: () => Promise<void>;
  /** The stored document this one was opened from, when it was opened from
   *  the library. Every save made from here is checked against it. */
  readonly base?: string;
  /** The host to talk to. Built per call when this session has none, so a
   *  test — or a caller with no host — needs no client. */
  readonly client?: ThemeLibraryClient;
  readonly onError?: (message: string) => void;
  /** Hands an opened document to whoever builds the session that shows it.
   *  Opening a theme builds a new session, so the base has to travel with it
   *  or the session replacing this one would save with no idea what it is
   *  based on. */
  readonly onOpenTheme?: (
    envelope: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>>,
    base?: string,
  ) => Promise<void>;
}

/**
 * Saves a document into the host's library (ADR-0017), reads one back, and
 * holds the base every such save is checked against.
 *
 * The base is the reason this is an owner and not a helper: it is the claim
 * that this document is the one stored, and it is cleared by whoever replaces
 * the document rather than by the save that follows. A base that outlived its
 * document would make the next save look stale when it is not.
 */
export class ThemeLibraryManager {
  #base: LibraryBase | undefined;
  readonly #options: ThemeLibraryManagerOptions;

  constructor(options: ThemeLibraryManagerOptions) {
    this.#options = options;
    this.#base = libraryBase(options.base, options.assets.declarations);
  }

  /** Whether this document descends from one the library holds. A document
   *  with no stored base has no folder, and a published document's assets are
   *  served from the theme's own folder. */
  isStored(): boolean {
    return this.#base !== undefined;
  }

  /** The document is being replaced by one that descends from nothing: a new
   *  document, the starter, or a package the author brought in. */
  forget(): void {
    this.#base = undefined;
  }

  /** Saves into the library, or says in the editor's own words that it did not
   *  happen — the document is untouched either way. */
  async save(): Promise<void> {
    const options = this.#options;
    const current = options.snapshot();
    const client = this.#client();
    try {
      // The library is a folder, so the theme goes as its document and its
      // declared bytes. Building an archive here would compress data the host
      // is about to write uncompressed and inflate again on the next read.
      await this.#write(client, current, false);
      options.onSaved("Saved to library");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // The editor's own words for a save that did not happen, whether it was
      // refused or merely failed — the document is untouched either way, and
      // `markSaved` was not reached, so the author still has it.
      options.onError?.(`Could not save to library: ${msg}`);
      if (error instanceof ThemeConflictError) {
        await this.#resolveConflict(current, client);
      }
    }
  }

  /** Opens a stored theme, or the reference composition as a template. */
  async open(): Promise<void> {
    const options = this.#options;
    if (!(await options.confirmReplacement())) return;
    const client = this.#client();
    try {
      // The client goes in so a delete raised from this dialog reaches the host
      // this session is already talking to, rather than one the dialog builds.
      const choice = await promptThemeSelection(
        await client.list(),
        undefined,
        {
          client,
        },
      );
      if (choice === undefined) return;
      // A template is not a stored theme: it is not in the host's library, so
      // there is nothing to fetch and nothing the author could have deleted.
      // The editor already holds it, which is why it is offered at all.
      if (choice.kind === "template") {
        this.#base = undefined;
        await options.onNewFromStarter();
        return;
      }
      const opened = await client.open(choice.id);
      if (options.onOpenTheme !== undefined) {
        this.#base = libraryBase(opened.base, opened.envelope.assets ?? []);
        await options.onOpenTheme(opened.envelope, opened.assets, opened.base);
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * The save itself, so a deliberate overwrite after a refusal takes the same
   * road the refused save did — the same declared bytes, the same picture, and
   * the same move of the base onto what was just written.
   */
  async #write(
    client: ThemeLibraryClient,
    current: FabricThemeEnvelope,
    overwrite: boolean,
  ): Promise<void> {
    const options = this.#options;
    const base = this.#base;
    this.#base = libraryBase(
      await client.save(
        current.id,
        {
          envelope: current,
          assets: this.#payload(base, overwrite),
          ...(base === undefined ? {} : { base: base.id }),
        },
        { overwrite },
      ),
      options.assets.declarations,
    );

    const png = await options.picture();
    if (png !== undefined && client.saveThumbnail !== undefined) {
      try {
        await client.saveThumbnail(current.id, png);
      } catch (error) {
        options.errors.warn(
          "controls",
          `Saved, but the library picture failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    options.markSaved(current, options.assets.assets);
    // The document did not move, but whether it is saved just changed, and the
    // marker reads that question rather than watching the scene.
    options.announceChange();
  }

  /**
   * The bytes this save has to carry, which is only the ones the stored folder
   * does not already hold.
   *
   * An asset the author has not touched since they opened the theme is left
   * out, and the host takes it from the folder it is replacing — a 438 KB
   * backdrop that has not moved does not go over the wire again. It may do that
   * only because this save went out with the base the editor opened with, and
   * the host's guard has already said the stored document is that one.
   *
   * A save with no base is a first save, and a deliberate overwrite stands the
   * guard down, so both carry the whole theme: there is nothing to reconstruct
   * from, and on the second road what is on disk is not the document this save
   * came from.
   */
  #payload(
    base: LibraryBase | undefined,
    overwrite: boolean,
  ): Readonly<Record<string, Uint8Array>> {
    const all = this.#options.assets.assets;
    if (base === undefined || overwrite) {
      return all;
    }
    const payload: Record<string, Uint8Array> = {};
    for (const declared of this.#options.assets.declarations) {
      const sha256 = declared.sha256;
      if (sha256 !== undefined && base.hashes.get(declared.path) === sha256) {
        continue;
      }
      // A declaration with no bytes is a document that is already broken; the
      // host refuses a theme that names an asset nobody can produce, which is
      // the honest answer, and sending an empty file would not be.
      const bytes = all[declared.path];
      if (bytes !== undefined) {
        payload[declared.path] = bytes;
      }
    }
    return payload;
  }

  /**
   * What an author wants done about a save the host refused. Nothing is thrown
   * away on either road, and the third answer keeps both: reloading takes the
   * stored document, overwriting sends the author's own with the guard stood
   * down for this one save, and dismissing it leaves the document exactly as it
   * was so they can copy anything out of it first.
   */
  async #resolveConflict(
    current: FabricThemeEnvelope,
    client: ThemeLibraryClient,
  ): Promise<void> {
    const options = this.#options;
    const choice = await promptThemeConflict();
    if (choice === "reload") {
      const opened = await client.open(current.id);
      this.#base = libraryBase(opened.base, opened.envelope.assets ?? []);
      await options.onOpenTheme?.(opened.envelope, opened.assets, opened.base);
      return;
    }
    if (choice !== "overwrite") {
      return;
    }
    try {
      await this.#write(client, current, true);
      options.onSaved("Saved to library");
    } catch (error) {
      options.onError?.(
        `Could not save to library: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  #client(): ThemeLibraryClient {
    return this.#options.client ?? createThemeLibraryClient();
  }
}
