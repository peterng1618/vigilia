import type { SubmissionFiles } from "./github-item.js";

/**
 * The write half of a catalogue submission: the author's fork is created, the
 * files are committed to a branch on it, and a pull request is opened against
 * the catalogue. The access token is the caller's and is never put anywhere but
 * the `Authorization` header — not in a URL, a body or a refusal.
 */

export type SubmitResult =
  | { readonly ok: true; readonly url: string }
  | {
      readonly ok: false;
      readonly stage: "identity" | "fork" | "commit" | "pull";
      readonly message: string;
    };

export interface SubmitInput {
  readonly login: string;
  readonly accessToken: string;
  readonly files: SubmissionFiles;
}

export interface SubmitOptions {
  /** Injected so a unit test drives this without a network. */
  readonly fetch?: typeof fetch;
  readonly owner?: string;
  readonly repo?: string;
  /** Overridable so a test never waits; a real fork can take seconds to appear. */
  readonly forkPollDelayMs?: number;
}

/** The REST root is fixed, so a test's fake `fetch` matches a known path. */
const API_BASE = "https://api.github.com";
const DEFAULT_OWNER = "peterng1618";
const DEFAULT_REPO = "vigilia-store";
const MAIN = "main";
const DEFAULT_BRANCH = MAIN;

/** Task 4 builds this path from the store's validated id; anything else is
 *  refused rather than committed, so no caller can choose where a file lands. */
const CATALOGUE_DIRECTORY = /^catalogue\/([A-Za-z0-9_-]{1,64})$/;

/** A fork is created asynchronously. Ten polls a second apart cover ten seconds
 *  of GitHub's own lag; the earlier 200 ms cadence gave it two. */
const FORK_POLL_ATTEMPTS = 10;
const FORK_POLL_DELAY_MS = 1_000;

const ITEM_FILE = "item.json";
const THUMBNAIL_FILE = "thumbnail.png";

type Answer = { readonly response: Response } | { readonly error: string };

export async function submitToCatalogue(
  input: SubmitInput,
  options?: SubmitOptions,
): Promise<SubmitResult> {
  const { login, accessToken, files } = input;
  if (login.trim() === "")
    return refuse("identity", "Sign in to GitHub before submitting a theme.");
  if (accessToken.trim() === "")
    return refuse(
      "identity",
      "GitHub's sign-in returned no token; sign in again.",
    );

  const themeId = CATALOGUE_DIRECTORY.exec(files.path)?.[1];
  if (themeId === undefined)
    return refuse(
      "commit",
      `"${files.path}" is not a catalogue directory a submission can commit to.`,
    );

  const owner = options?.owner ?? DEFAULT_OWNER;
  const repo = options?.repo ?? DEFAULT_REPO;
  const fetcher = options?.fetch ?? fetch;
  const pollDelay = options?.forkPollDelayMs ?? FORK_POLL_DELAY_MS;
  const token = accessToken;
  const forkPath = `/repos/${login}/${repo}`;
  const branch = `submit/${themeId}`;

  // 1. Ask the catalogue for the author's fork, then wait for it to exist.
  const forked = await call(
    fetcher,
    "POST",
    `/repos/${owner}/${repo}/forks`,
    token,
    {},
  );
  if ("error" in forked) return refuse("fork", forked.error);
  await drain(forked.response);
  if (!forked.response.ok)
    return refuse(
      "fork",
      `GitHub refused to create your fork (HTTP ${forked.response.status}). Check that your token can create repositories.`,
    );

  let forkReady = false;
  for (let attempt = 0; attempt < FORK_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(pollDelay);
    const polled = await call(fetcher, "GET", forkPath, token);
    if ("error" in polled) return refuse("fork", polled.error);
    await drain(polled.response);
    if (polled.response.ok) {
      forkReady = true;
      break;
    }
  }
  if (!forkReady)
    return refuse(
      "fork",
      "GitHub did not finish creating your fork in time; try again in a minute.",
    );

  // 2. Branch from the fork's current main head, never a cached ref.
  const head = await call(
    fetcher,
    "GET",
    `${forkPath}/git/ref/heads/${MAIN}`,
    token,
  );
  if ("error" in head) return refuse("commit", head.error);
  if (!head.response.ok) {
    await drain(head.response);
    return refuse(
      "commit",
      `GitHub refused to read your fork's main branch (HTTP ${head.response.status}).`,
    );
  }
  const headBody = await readObject(head.response);
  const headObject = headBody?.["object"];
  const headSha =
    typeof headObject === "object" && headObject !== null
      ? (headObject as Record<string, unknown>)["sha"]
      : undefined;
  if (typeof headSha !== "string" || headSha === "")
    return refuse(
      "commit",
      "GitHub's answer for your fork's main branch had no head version.",
    );

  const ref = await call(fetcher, "POST", `${forkPath}/git/refs`, token, {
    ref: `refs/heads/${branch}`,
    sha: headSha,
  });
  if ("error" in ref) return refuse("commit", ref.error);
  await drain(ref.response);
  // A 422 is the branch already existing: this item's earlier submission, whose
  // files are replaced below. Any other refusal stops here.
  if (!ref.response.ok && ref.response.status !== 422)
    return refuse(
      "commit",
      `GitHub refused to create the submission branch (HTTP ${ref.response.status}).`,
    );

  // 3. Commit every file to that one branch.
  const commits = [
    {
      path: `${files.path}/${ITEM_FILE}`,
      bytes: new TextEncoder().encode(files.itemJson),
    },
    { path: `${files.path}/${themeId}.zip`, bytes: files.packageBytes },
    { path: `${files.path}/${THUMBNAIL_FILE}`, bytes: files.thumbnailBytes },
  ];
  for (const file of commits) {
    const existing = await existingSha(
      fetcher,
      `${forkPath}/contents/${file.path}`,
      branch,
      token,
    );
    if ("error" in existing) return refuse("commit", existing.error);
    const written = await call(
      fetcher,
      "PUT",
      `${forkPath}/contents/${file.path}`,
      token,
      {
        message: `Add ${file.path}`,
        content: Buffer.from(file.bytes).toString("base64"),
        branch,
        ...(existing.sha === undefined ? {} : { sha: existing.sha }),
      },
    );
    if ("error" in written) return refuse("commit", written.error);
    await drain(written.response);
    if (!written.response.ok)
      return refuse(
        "commit",
        `GitHub refused to commit ${file.path} (HTTP ${written.response.status}).`,
      );
  }

  // 4. Open the pull request against the catalogue's main.
  const pull = await call(
    fetcher,
    "POST",
    `/repos/${owner}/${repo}/pulls`,
    token,
    {
      title: `Add ${themeId} to the catalogue`,
      head: `${login}:${branch}`,
      base: DEFAULT_BRANCH,
      body: `Submitted from Vigilia.\n\nThe theme's files are in \`${files.path}\`.`,
    },
  );
  if ("error" in pull) return refuse("pull", pull.error);
  if (pull.response.status === 422) {
    await drain(pull.response);
    return refuse("pull", "A pull request for this item is already open.");
  }
  if (!pull.response.ok) {
    await drain(pull.response);
    return refuse(
      "pull",
      `GitHub refused to open the pull request (HTTP ${pull.response.status}).`,
    );
  }
  const opened = await readObject(pull.response);
  const url = opened?.["html_url"];
  if (typeof url !== "string" || url === "")
    return refuse(
      "pull",
      "GitHub opened the pull request but returned no address for it.",
    );
  return { ok: true, url };
}

/** The file's version on the submission branch, or nothing on a first submit. */
async function existingSha(
  fetcher: typeof fetch,
  contentsPath: string,
  branch: string,
  token: string,
): Promise<{ readonly sha?: string } | { readonly error: string }> {
  const answer = await call(
    fetcher,
    "GET",
    `${contentsPath}?ref=${encodeURIComponent(branch)}`,
    token,
  );
  if ("error" in answer) return { error: answer.error };
  if (answer.response.status === 404) {
    await drain(answer.response);
    return {};
  }
  if (!answer.response.ok) {
    await drain(answer.response);
    return {
      error: `GitHub refused to read ${contentsPath} (HTTP ${answer.response.status}).`,
    };
  }
  const body = await readObject(answer.response);
  const sha = body?.["sha"];
  if (typeof sha !== "string" || sha === "")
    return {
      error: `GitHub's answer for ${contentsPath} had no file version to replace.`,
    };
  return { sha };
}

async function call(
  fetcher: typeof fetch,
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<Answer> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    return {
      response: await fetcher(`${API_BASE}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    };
  } catch {
    return { error: "GitHub could not be reached." };
  }
}

async function readObject(
  response: Response,
): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Releasing a body this module does not read is what frees the connection. */
async function drain(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function refuse(
  stage: "identity" | "fork" | "commit" | "pull",
  message: string,
): SubmitResult {
  return { ok: false, stage, message };
}
