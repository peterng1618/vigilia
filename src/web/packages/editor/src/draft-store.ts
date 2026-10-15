import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

/**
 * The unsaved document, as the browser kept it (`vg-040`).
 *
 * One slot, not one per theme. A draft is a crash-recovery artefact and the
 * author has one editor, so a per-theme map would be a store nobody reads
 * twice. `savedAt` is ISO-8601 UTC, the same convention the library's own
 * `ThemeLibraryEntry.updatedAt` keeps, and `content` is the document's own
 * snapshot — authored theme JSON, never asset bytes.
 */
export interface Draft {
  /** The document's name, read through `documentNameOf`, so the prompt that
   *  offers it names the theme the same way the status line does. */
  readonly name: string;
  readonly savedAt: string;
  readonly content: FabricThemeEnvelope;
}

/** Beside the shell's own two browser-local keys — `vigilia.editor.shell-palette`
 *  and `vigilia.editor.shortcut-overrides` — and browser-local for the same
 *  reason: it is this machine's memory of an unfinished edit, not theme data. */
export const DRAFT_STORAGE_KEY = "vigilia.editor.draft";

/** How often a dirty document is copied, and so the most a crash can cost. */
const DRAFT_INTERVAL_MS = 30_000;

/**
 * The draft, over a `Storage` the caller has already decided about.
 *
 * `readStorage()`'s guard is a decision about this page — a private window
 * throws on the accessor itself — so the store takes that answer rather than
 * asking again, and a store built over `undefined` is the browser with no
 * storage to offer. That is also what makes the module testable without one.
 *
 * Every call is guarded again: a storage that hands out its accessor and then
 * refuses to read or write (quota, private mode) is a browser with no draft,
 * which is not an error the author can act on.
 */
export class DraftStore {
  readonly #storage: Storage | undefined;

  constructor(storage: Storage | undefined) {
    this.#storage = storage;
  }

  /** The draft, or nothing. A value that cannot be parsed, or that is not the
   *  shape this build writes, is a draft that is not there — never a throw at
   *  boot, where the author has no surface to fix it from. */
  read(): Draft | undefined {
    let raw: string | null;
    try {
      raw = this.#storage?.getItem(DRAFT_STORAGE_KEY) ?? null;
    } catch {
      return undefined;
    }
    if (raw === null) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isDraft(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  write(draft: Draft): void {
    try {
      this.#storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // The editor keeps working without a draft. Saying so would report a
      // failure the author has no answer for.
    }
  }

  clear(): void {
    try {
      this.#storage?.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // As `write`: a storage that refuses a removal leaves a draft, not a
      // broken editor.
    }
  }
}

/** What the autosave needs of the document: the draft it holds now, or nothing
 *  while it is clean. The dirty comparison is the document's own. */
export interface DraftAutosave {
  /** Writes now, if the document is dirty. The page-leave path, where the
   *  timer's last tick can be half a minute behind the edit that mattered. */
  writeNow(): void;
  /** Stops the timer, beside `chartRefresh.dispose()` at the same teardown. */
  stop(): void;
}

/**
 * Copies a dirty document into the draft on an interval.
 *
 * **Dirty only.** A draft over work the author already saved makes the
 * recovery prompt fire on every boot over nothing, and a prompt learned to
 * dismiss is the same as no prompt — the failure the unload warning already
 * names in its own words (`editor-main.ts`).
 */
export function startDraftAutosave(input: {
  readonly store: DraftStore;
  readonly capture: () => Draft | undefined;
}): DraftAutosave {
  const writeNow = (): void => {
    const draft = input.capture();
    if (draft !== undefined) input.store.write(draft);
  };
  const timer = setInterval(writeNow, DRAFT_INTERVAL_MS);
  return {
    writeNow,
    stop: () => {
      clearInterval(timer);
    },
  };
}

/** The three fields, and nothing about what is inside them: the envelope's own
 *  compatibility is the renderer's assertion, taken where the document mounts. */
function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const draft = value as Record<string, unknown>;
  return (
    typeof draft["name"] === "string" &&
    typeof draft["savedAt"] === "string" &&
    typeof draft["content"] === "object" &&
    draft["content"] !== null
  );
}
