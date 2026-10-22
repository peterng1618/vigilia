import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * The store session the host holds after signing in through the Worker's
 * social flow, beside the other settings as `store-session.json`.
 *
 * Plaintext at mode `0600`, for the reason `github-token.ts` gives: a local
 * host has nowhere to keep a key a local attacker with this user's access
 * could not also read. The mode is the real control where the platform honours
 * it; on Windows the file inherits the profile directory's ACL. The token is
 * never logged, never sent to the browser, and goes only to the file and the
 * `Authorization` header.
 */

export interface StoreSession {
  /** The Worker's session token. Never log it. */
  readonly token: string;
  /** Better Auth's `user.id`, as `/api/me` reports it. */
  readonly userId: string;
  readonly email: string;
  /** An ISO instant. */
  readonly obtainedAt: string;
}

export interface StoreSessionStore {
  /** The stored session, or nothing when there is none to use. */
  read(): Promise<StoreSession | undefined>;
  write(session: StoreSession): Promise<void>;
  /** Forget the session, on sign-out or a refused token. */
  clear(): Promise<void>;
}

const FILE = "store-session.json";
const MODE = 0o600;

/**
 * Four usable strings, or nothing.
 *
 * A token without the account it acts as cannot be reported honestly, so a bad
 * file reads as no session rather than being coerced into one.
 */
function asSession(value: unknown): StoreSession | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const { token, userId, email, obtainedAt } = value as Record<string, unknown>;

  if (
    typeof token !== "string" ||
    token === "" ||
    typeof userId !== "string" ||
    userId === "" ||
    typeof email !== "string" ||
    email === "" ||
    typeof obtainedAt !== "string" ||
    Number.isNaN(Date.parse(obtainedAt))
  ) {
    return undefined;
  }

  return { token, userId, email, obtainedAt };
}

async function readSession(file: string): Promise<StoreSession | undefined> {
  try {
    return asSession(JSON.parse(await readFile(file, "utf8")));
  } catch {
    // No file, or one that is not JSON: there is no session to use.
    return undefined;
  }
}

export function createStoreSessionStore(directory: string): StoreSessionStore {
  const file = path.join(directory, FILE);

  // Written beside the target and renamed over it, so a crash mid-write loses
  // the write rather than leaving a truncated token. On Windows a rename over a
  // file another handle holds open fails with EPERM instead of waiting, so
  // reads and writes queue rather than overlap — the pattern `github-token.ts`
  // already uses.
  const temporary = `${file}.tmp`;

  const save = async (session: StoreSession): Promise<void> => {
    await mkdir(directory, { recursive: true });
    // A failed rename leaves the plaintext token in the temporary file; it is
    // cleared here and on `clear` rather than waiting for a later write.
    await rm(temporary, { force: true });
    // The mode applies when the temporary file is created, and that file is
    // ours alone; the rename carries it to the target.
    await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, {
      encoding: "utf8",
      mode: MODE,
    });
    await rename(temporary, file);
  };

  let running: Promise<unknown> = Promise.resolve();
  const exclusively = <T>(work: () => Promise<T>): Promise<T> => {
    const next = running.then(work, work);
    running = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  return {
    read: () => exclusively(() => readSession(file)),

    async write(session) {
      await exclusively(async () => {
        const valid = asSession(session);
        if (valid === undefined) {
          throw new Error(
            "Invalid store session: token, userId and email must be non-empty, and obtainedAt an instant.",
          );
        }

        await save(valid);
      });
    },

    async clear() {
      await exclusively(async () => {
        // Both halves: a rename that failed earlier left the token in the
        // temporary file, and signing out has to mean it is gone.
        await rm(temporary, { force: true });
        await rm(file, { force: true });
      });
    },
  };
}
