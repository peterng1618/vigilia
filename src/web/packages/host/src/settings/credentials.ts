import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Provider credentials, written beside the host's other settings.
 *
 * The browser is write-only here: a route may store a value, and the read it
 * gets back carries `set` and a four-character hint, never the value. A source
 * receives the value only inside the host process, through `SourceContext`.
 */
export interface StoredCredential {
  readonly value: string;
  /** An ISO instant. */
  readonly savedAt: string;
}

export interface CredentialStore {
  /** Every entry, keyed by credential id. A bad entry is dropped, not fatal. */
  read(): Promise<Readonly<Record<string, StoredCredential>>>;
  valueOf(id: string): Promise<string | undefined>;
  write(id: string, value: string, savedAt: Date): Promise<void>;
  clear(id: string): Promise<void>;
}

/** The last four characters, and never more: the only part a browser sees. */
export function hintOf(value: string): string {
  return value.slice(-4);
}

const FILE = "credentials.json";
const CREDENTIAL_ID = /^[A-Za-z0-9_-]{1,64}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One entry, or nothing when it is not a non-empty value with a real instant.
 *
 * A hand-edited file must not blank the whole map, so a bad entry is dropped
 * rather than failing the read.
 */
function asCredential(value: unknown): StoredCredential | undefined {
  if (!isObject(value)) return undefined;

  const { value: secret, savedAt } = value;

  if (typeof secret !== "string" || secret === "") return undefined;
  if (typeof savedAt !== "string" || Number.isNaN(Date.parse(savedAt))) {
    return undefined;
  }

  return { value: secret, savedAt };
}

/**
 * The file's contents, with every key held to `CREDENTIAL_ID` and every entry
 * validated. Built through `Object.fromEntries` for the same reason
 * `theme-origins.ts` is: `__proto__` is a legal id, and assignment would reach
 * the map's prototype instead of storing the entry.
 */
function normalizeCredentials(
  input: unknown,
): Record<string, StoredCredential> {
  if (!isObject(input)) return {};

  const pairs: [string, StoredCredential][] = [];

  for (const [id, raw] of Object.entries(input)) {
    if (!CREDENTIAL_ID.test(id)) continue;

    const entry = asCredential(raw);
    if (entry) pairs.push([id, entry]);
  }

  return Object.fromEntries(pairs);
}

async function readCredentials(
  file: string,
): Promise<Record<string, StoredCredential>> {
  try {
    return normalizeCredentials(JSON.parse(await readFile(file, "utf8")));
  } catch {
    // No file, or an unreadable one: no credential is stored.
    return {};
  }
}

export function createCredentialStore(directory: string): CredentialStore {
  const file = path.join(directory, FILE);

  // Written beside the target and renamed over it, so a crash mid-write loses
  // the write rather than every credential. Readers queue with the mutators
  // because on Windows a rename over an open file fails with EPERM.
  const temporary = `${file}.tmp`;

  const save = async (all: Record<string, StoredCredential>): Promise<void> => {
    await mkdir(directory, { recursive: true });
    // Owner-only on the platforms that honour it: the file holds plaintext
    // keys, and a shared Unix host would otherwise leave it world-readable.
    await writeFile(temporary, `${JSON.stringify(all, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, file);
  };

  let writing: Promise<unknown> = Promise.resolve();
  const writeExclusively = <T>(work: () => Promise<T>): Promise<T> => {
    const next = writing.then(work, work);
    writing = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  return {
    async read() {
      return writeExclusively(() => readCredentials(file));
    },

    async valueOf(id) {
      return writeExclusively(async () => {
        if (!CREDENTIAL_ID.test(id)) return undefined;

        return (await readCredentials(file))[id]?.value;
      });
    },

    async write(id, value, savedAt) {
      await writeExclusively(async () => {
        if (!CREDENTIAL_ID.test(id)) {
          throw new Error(`Invalid credential id "${id}".`);
        }

        const all = await readCredentials(file);
        await save(
          normalizeCredentials({
            ...all,
            [id]: { value, savedAt: savedAt.toISOString() },
          }),
        );
      });
    },

    async clear(id) {
      await writeExclusively(async () => {
        if (!CREDENTIAL_ID.test(id)) return;

        const all = await readCredentials(file);
        // Nothing to remove is no write: a file that could not be read reads
        // as `{}`, and saving that would replace the file that is there.
        // `Object.hasOwn` because `__proto__` is a legal id and `in` walks
        // the prototype chain.
        if (!Object.hasOwn(all, id)) return;

        delete all[id];
        await save(all);
      });
    },
  };
}
