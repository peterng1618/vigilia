import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  type Draft,
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

  /** What the timer sees: a document that is dirty, or one that is not. The
   *  dirty comparison itself is `EditorDocument.isDirty`'s. */
  function autosaveOver(
    store: DraftStore,
    isDirty: () => boolean,
  ): ReturnType<typeof startDraftAutosave> {
    return startDraftAutosave({
      store,
      capture: () => (isDirty() ? DRAFT : undefined),
    });
  }

  it("writes a dirty document on the interval and leaves a clean one alone", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    let dirty = true;
    const autosave = autosaveOver(store, () => dirty);

    vi.advanceTimersByTime(30_000);
    expect(store.read(), "a dirty document is written").toEqual(DRAFT);

    store.clear();
    dirty = false;
    vi.advanceTimersByTime(30_000);
    expect(store.read(), "a clean document is not").toBeUndefined();

    autosave.stop();
  });

  it("writes on the way out, where the timer's last tick is behind the edit", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    const autosave = autosaveOver(store, () => true);

    autosave.writeNow();
    expect(store.read()).toEqual(DRAFT);

    autosave.stop();
  });

  it("stops writing when the editor goes away", () => {
    vi.useFakeTimers();
    const store = new DraftStore(memoryStorage());
    const autosave = autosaveOver(store, () => true);

    autosave.stop();
    vi.advanceTimersByTime(120_000);

    expect(store.read()).toBeUndefined();
  });
});
