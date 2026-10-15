import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindDraftAutosave,
  DRAFT_STORAGE_KEY,
  type Draft,
  type DraftAutosave,
  type DraftSource,
  DraftStore,
  startDraftAutosave,
} from "./draft-store.js";

/**
 * The draft's two halves, neither of which a browser is needed for.
 *
 * **Reading is total.** Every way a stored value can be wrong — unparseable, a
 * shape this build never wrote, a storage that refuses to be read — answers
 * "no draft", because the alternative is an editor that will not boot over a
 * value the author cannot see or edit. **Writing is dirty-only.** A draft over
 * work the author already saved is a recovery prompt on every boot, which is
 * the prompt they learn to dismiss.
 */

/** The document the draft holds. The store never reads inside `content`, so
 *  this only has to be a snapshot-shaped envelope. */
const ENVELOPE: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "ops-board",
  artboard: { width: 1920, height: 1080 },
  metadata: { name: "Ops board", themeLanguage: "en" },
  scene: { version: "7.4.0", objects: [] },
};

const DRAFT: Draft = {
  name: "Ops board",
  savedAt: "2026-10-14T09:31:00.000Z",
  content: ENVELOPE,
};

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial));
  return {
    get length(): number {
      return entries.size;
    },
    key: (index: number): string | null => [...entries.keys()][index] ?? null,
    getItem: (key: string): string | null => entries.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      entries.set(key, value);
    },
    removeItem: (key: string): void => {
      entries.delete(key);
    },
    clear: (): void => {
      entries.clear();
    },
  };
}

/** The private window: the accessor exists and every call on it throws. */
function refusingStorage(): Storage {
  const refuse = (): never => {
    throw new Error("storage is blocked");
  };
  return {
    length: 0,
    key: refuse,
    getItem: refuse,
    setItem: refuse,
    removeItem: refuse,
    clear: refuse,
  };
}

describe("the draft store", () => {
  it("reads nothing from a browser that never kept a draft", () => {
    expect(new DraftStore(memoryStorage()).read()).toBeUndefined();
  });

  it("reads back what it wrote", () => {
    const store = new DraftStore(memoryStorage());
    store.write(DRAFT);

    expect(store.read()).toEqual(DRAFT);
  });

  it("reads an unparseable value as no draft", () => {
    const storage = memoryStorage({ [DRAFT_STORAGE_KEY]: "{not json" });

    expect(new DraftStore(storage).read()).toBeUndefined();
  });

  it("reads a value of the wrong shape as no draft", () => {
    // The shapes a hand-edited or half-written key can hold, and the one a
    // build that stored something else would leave behind.
    const wrong = [
      "null",
      "[]",
      "{}",
      '{"name":"Ops board"}',
      '{"name":"Ops board","savedAt":"2026-10-14T09:31:00.000Z"}',
      '{"name":1,"savedAt":"2026-10-14T09:31:00.000Z","content":{}}',
      '{"name":"Ops board","savedAt":1,"content":{}}',
      '{"name":"Ops board","savedAt":"2026-10-14T09:31:00.000Z","content":null}',
    ];

    for (const value of wrong) {
      const storage = memoryStorage({ [DRAFT_STORAGE_KEY]: value });
      expect(new DraftStore(storage).read(), value).toBeUndefined();
    }
  });

  it("clears the draft it wrote", () => {
    const store = new DraftStore(memoryStorage());
    store.write(DRAFT);
    store.clear();

    expect(store.read()).toBeUndefined();
  });

  it("holds nothing where the browser has no storage at all", () => {
    const store = new DraftStore(undefined);
    store.write(DRAFT);

    expect(store.read()).toBeUndefined();
    expect(() => store.clear()).not.toThrow();
  });

  it("is no draft rather than an error where the browser refuses storage", () => {
    const store = new DraftStore(refusingStorage());

    expect(store.read()).toBeUndefined();
    expect(() => store.write(DRAFT)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});

describe("the draft's autosave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The open document as the autosave asks it. The dirty comparison itself is
   *  the session's; what a case moves here is only its answer. */
  function documentOver(isDirty: () => boolean): DraftSource {
    return { isDirty, draft: () => DRAFT };
  }

  function autosaveOver(
    store: DraftStore,
    document: () => DraftSource | undefined,
  ): DraftAutosave {
    return startDraftAutosave({ store, document });
  }

  it("writes a dirty document on the interval, and nothing while none is open", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    let open = false;
    const autosave = autosaveOver(store, () =>
      open ? documentOver(() => true) : undefined,
    );

    vi.advanceTimersByTime(30_000);
    expect(store.read(), "no document, no draft").toBeUndefined();

    open = true;
    vi.advanceTimersByTime(30_000);
    expect(store.read(), "a dirty document is written").toEqual(DRAFT);

    autosave.stop();
  });

  it("writes nothing for a clean document, and clears what a dirty one left", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    let dirty = true;
    const autosave = autosaveOver(store, () => documentOver(() => dirty));

    vi.advanceTimersByTime(30_000);
    expect(store.read(), "the edit is kept").toEqual(DRAFT);

    // The author undoes back to what was saved. The draft holds an edit they
    // have taken back, and the next boot would offer it as unsaved work.
    dirty = false;
    vi.advanceTimersByTime(30_000);
    expect(store.read(), "a clean document leaves no draft").toBeUndefined();

    autosave.stop();
  });

  it("writes on the way out, and resumes when the page comes back", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    const autosave = autosaveOver(store, () => documentOver(() => true));
    const page = new EventTarget();
    bindDraftAutosave(autosave, page);

    // Leaving: the timer's last tick can be half a minute behind the edit.
    page.dispatchEvent(new Event("pagehide"));
    expect(store.read(), "the page-leave write").toEqual(DRAFT);

    // Away: nothing is written, and a frozen page's interval must not be
    // running behind the editor's back.
    store.clear();
    vi.advanceTimersByTime(120_000);
    expect(store.read(), "stopped while the page was away").toBeUndefined();

    // Back from the back/forward cache: the same session, still live, and it
    // has to be writing drafts again.
    page.dispatchEvent(new Event("pageshow"));
    vi.advanceTimersByTime(30_000);
    expect(store.read(), "writing again after the round trip").toEqual(DRAFT);

    autosave.stop();
  });

  it("stops writing when the editor goes away", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    const autosave = autosaveOver(store, () => documentOver(() => true));

    autosave.stop();
    vi.advanceTimersByTime(120_000);

    expect(store.read()).toBeUndefined();
  });
});
