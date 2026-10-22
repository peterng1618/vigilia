import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * The GitHub token the host keeps after a device-flow authorisation, beside the
 * theme records in the host's settings directory as `github-token.json`.
 *
 * The token is plaintext at mode `0600`, and that is the honest shape for a
 * local host: it has nowhere to keep an encryption key that a local attacker
 * with this user's access could not also read, so encrypting it would add a
 * second file to protect beside the one that matters. The mode is the real
 * control where the platform honours it; on Windows the file inherits the
 * profile directory's ACL, which is already this user's alone. The token is
 * never logged.
 */

export interface GithubIdentity {
  /** The OAuth access token. Never log it. */
  readonly accessToken: string;
  /** The scope GitHub granted, which can be narrower than what was asked. */
  readonly scope: string;
  /** The GitHub account the token acts as. */
  readonly login: string;
  /** An ISO instant. */
  readonly obtainedAt: string;
}

export interface GithubTokenStore {
  /** The stored identity, or nothing when there is none to use. */
  read(): Promise<GithubIdentity | undefined>;
  write(identity: GithubIdentity): Promise<void>;
  /** Forget the identity, on revocation or sign-out. */
  clear(): Promise<void>;
}

const FILE = "github-token.json";
const MODE = 0o600;

/** GitHub's own login shape. A login is interpolated into API paths, so a
 *  hand-edited file cannot be allowed to say `../something`. */
const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;

export function isGithubLogin(login: string): boolean {
  return GITHUB_LOGIN.test(login);
}

/**
 * Four usable strings, or nothing.
 *
 * A token without its scope or account is not half an identity, and an
 * `obtainedAt` that is not an instant cannot be reported honestly, so a bad
 * file reads as no identity rather than being coerced into one.
 */
function asIdentity(value: unknown): GithubIdentity | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const { accessToken, scope, login, obtainedAt } = value as Record<
    string,
    unknown
  >;

  if (
    typeof accessToken !== "string" ||
    accessToken === "" ||
    typeof scope !== "string" ||
    scope === "" ||
    typeof login !== "string" ||
    !isGithubLogin(login) ||
    typeof obtainedAt !== "string" ||
    Number.isNaN(Date.parse(obtainedAt))
  ) {
    return undefined;
  }

  return { accessToken, scope, login, obtainedAt };
}

async function readIdentity(file: string): Promise<GithubIdentity | undefined> {
  try {
    return asIdentity(JSON.parse(await readFile(file, "utf8")));
  } catch {
    // No file, or one that is not JSON: there is no identity to use, and a
    // hand-edited file is not worth failing a submission over.
    return undefined;
  }
}

export function createGithubTokenStore(directory: string): GithubTokenStore {
  const file = path.join(directory, FILE);

  // Written beside the target and renamed over it, so a crash mid-write loses
  // the write rather than leaving a truncated token. Readers go through the
  // queue below: on Windows a rename over a file another handle holds open
  // fails with EPERM instead of waiting, so the two must never overlap.
  const temporary = `${file}.tmp`;

  const save = async (identity: GithubIdentity): Promise<void> => {
    await mkdir(directory, { recursive: true });
    // A failed rename leaves the plaintext token in the temporary file; it is
    // cleared here and on `clear` rather than waiting for a later write.
    await rm(temporary, { force: true });
    // The mode applies when the temporary file is created, and that file is
    // ours alone; the rename carries it to the target.
    await writeFile(temporary, `${JSON.stringify(identity, null, 2)}\n`, {
      encoding: "utf8",
      mode: MODE,
    });
    await rename(temporary, file);
  };

  // A read and a write can overlap — a submission reading while a
  // re-authorisation writes — and both touch one file. A read landing inside
  // the save would parse a prefix of the JSON as no identity and lose the
  // sign-in, so they queue; a rejection is swallowed for the queue's sake and
  // still reaches its own caller.
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
    read: () => exclusively(() => readIdentity(file)),

    async write(identity) {
      await exclusively(async () => {
        const valid = asIdentity(identity);
        if (valid === undefined) {
          throw new Error(
            "Invalid GitHub identity: accessToken and scope must be non-empty, login must be 1-39 letters, digits or hyphens, and obtainedAt an instant.",
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
