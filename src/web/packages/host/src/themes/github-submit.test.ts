import { describe, expect, it } from "vitest";
import type { SubmissionFiles } from "./github-item.js";
import { submitToCatalogue } from "./github-submit.js";

/** A token no request may carry outside the `Authorization` header. */
const TOKEN = "gho_secret_token_value";

const API = "https://api.github.com";
const CATALOGUE = `${API}/repos/peterng1618/vigilia-store`;
const FORK = `${API}/repos/octocat/vigilia-store`;
const FORK_PATH = "/repos/octocat/vigilia-store";
const PR_URL = "https://github.com/peterng1618/vigilia-store/pull/7";

const FILES: SubmissionFiles = {
  itemJson: '{\n  "kind": "dashboard-theme",\n  "name": "Aurora"\n}\n',
  packageBytes: new TextEncoder().encode("zip bytes"),
  thumbnailBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  path: "catalogue/aurora",
};

const INPUT = { login: "octocat", accessToken: TOKEN, files: FILES };

interface Recorded {
  readonly method: string;
  readonly url: string;
  /** The request target with its query, without the fixed API origin. */
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

type Handler = (request: Recorded) => Response | undefined;

/**
 * A `typeof fetch` over a handler that records every request it was asked for.
 * The record is how a test proves where a call went and that the token never
 * left the header, rather than merely that the result looked right.
 */
function recordingFetch(handler: Handler): {
  readonly fetch: typeof fetch;
  readonly seen: Recorded[];
  readonly forkPollDelayMs: number;
} {
  const seen: Recorded[] = [];
  const fetcher: typeof globalThis.fetch = async (input, init) => {
    const href =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const headers: Record<string, string> = {};
    for (const [name, value] of new Headers(init?.headers))
      headers[name] = value;
    const url = new URL(href);
    const request: Recorded = {
      method: init?.method ?? "GET",
      url: href,
      path: `${url.pathname}${url.search}`,
      headers,
      body: typeof init?.body === "string" ? init.body : "",
    };
    seen.push(request);
    return (await handler(request)) ?? new Response("{}", { status: 404 });
  };
  // A fork poll that really waited would add ten seconds to every case.
  return { fetch: fetcher, seen, forkPollDelayMs: 0 };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** The happy path: a fresh fork, a branch, three committed files, one PR. */
const GITHUB: Handler = (request) => {
  if (request.method === "POST" && request.url === `${CATALOGUE}/forks`)
    return new Response("{}", { status: 202 });
  if (request.method === "GET" && request.url === FORK)
    return new Response("{}", { status: 200 });
  if (request.method === "GET" && request.url === `${FORK}/git/ref/heads/main`)
    return json({ object: { sha: "fork-main-head" } });
  if (request.method === "POST" && request.url === `${FORK}/git/refs`)
    return new Response("{}", { status: 201 });
  if (
    request.method === "GET" &&
    request.path.startsWith(`${FORK_PATH}/contents/`)
  )
    return new Response("{}", { status: 404 });
  if (
    request.method === "PUT" &&
    request.path.startsWith(`${FORK_PATH}/contents/`)
  )
    return json({ content: { sha: "committed" } }, 201);
  if (request.method === "POST" && request.url === `${CATALOGUE}/pulls`)
    return json({ html_url: PR_URL }, 201);
  return undefined;
};

/** The happy path, with one route answered differently. */
function withRoute(
  override: (request: Recorded) => Response | undefined,
): Handler {
  return (request) => override(request) ?? GITHUB(request);
}

async function submit(
  handler: Handler,
  input = INPUT,
): Promise<{
  result: Awaited<ReturnType<typeof submitToCatalogue>>;
  seen: Recorded[];
}> {
  const { fetch, seen } = recordingFetch(handler);
  const result = await submitToCatalogue(input, { fetch });
  return { result, seen };
}

function bodyOf(request: Recorded): Record<string, unknown> {
  return JSON.parse(request.body) as Record<string, unknown>;
}

describe("submitToCatalogue", () => {
  it("asks the catalogue repository for the author's fork", async () => {
    const { seen } = await submit(GITHUB);

    const fork = seen.find(
      (request) =>
        request.method === "POST" && request.url === `${CATALOGUE}/forks`,
    );
    expect(fork).toBeDefined();
  });

  it("commits every file to the author's fork on one submission branch", async () => {
    const { result, seen } = await submit(GITHUB);

    expect(result).toEqual({ ok: true, url: PR_URL });
    const puts = seen.filter((request) => request.method === "PUT");
    expect(puts.map((request) => request.url)).toEqual([
      `${FORK}/contents/catalogue/aurora/item.json`,
      `${FORK}/contents/catalogue/aurora/aurora.zip`,
      `${FORK}/contents/catalogue/aurora/thumbnail.png`,
    ]);
    for (const request of puts)
      expect(bodyOf(request)["branch"]).toBe("submit/aurora");
  });

  it("sends each file's bytes base64-encoded, with no file version on a first submission", async () => {
    const { seen } = await submit(GITHUB);

    const puts = seen.filter((request) => request.method === "PUT");
    const bodies = puts.map(bodyOf);
    expect(bodies[0]?.["content"]).toBe(
      Buffer.from(FILES.itemJson, "utf8").toString("base64"),
    );
    expect(bodies[1]?.["content"]).toBe(
      Buffer.from(FILES.packageBytes).toString("base64"),
    );
    expect(bodies[2]?.["content"]).toBe(
      Buffer.from(FILES.thumbnailBytes).toString("base64"),
    );
    for (const body of bodies) expect("sha" in body).toBe(false);
  });

  it("creates the branch from the fork's current main head", async () => {
    const { seen } = await submit(GITHUB);

    const headAt = seen.findIndex(
      (request) => request.url === `${FORK}/git/ref/heads/main`,
    );
    const refAt = seen.findIndex(
      (request) => request.url === `${FORK}/git/refs`,
    );
    expect(headAt).toBeGreaterThanOrEqual(0);
    expect(refAt).toBeGreaterThan(headAt);
    expect(bodyOf(seen[refAt] as Recorded)).toEqual({
      ref: "refs/heads/submit/aurora",
      sha: "fork-main-head",
    });
  });

  it("opens the pull request from the author's branch into the catalogue's main", async () => {
    const { seen } = await submit(GITHUB);

    const pull = seen.find((request) => request.url === `${CATALOGUE}/pulls`);
    expect(pull).toBeDefined();
    const body = bodyOf(pull as Recorded);
    expect(body["head"]).toBe("octocat:submit/aurora");
    expect(body["base"]).toBe("main");
    expect(String(body["title"])).toContain("aurora");
  });

  it("answers an already-open pull request with a sentence, not GitHub's body", async () => {
    const { result } = await submit(
      withRoute((request) =>
        request.url === `${CATALOGUE}/pulls`
          ? json(
              {
                message:
                  "A pull request already exists for peterng1618:submit/aurora.",
              },
              422,
            )
          : undefined,
      ),
    );

    expect(result).toEqual({
      ok: false,
      stage: "pull",
      message: "A pull request for this item is already open.",
    });
  });

  it("waits for GitHub to finish creating the fork", async () => {
    let polls = 0;
    const { result } = await submit(
      withRoute((request) => {
        if (request.method !== "GET" || request.url !== FORK) return undefined;
        polls += 1;
        return new Response("{}", { status: polls === 1 ? 404 : 200 });
      }),
    );

    expect(result).toEqual({ ok: true, url: PR_URL });
    expect(polls).toBe(2);
  });

  it("refuses when the fork never appears", async () => {
    let polls = 0;
    const { result } = await submit(
      withRoute((request) => {
        if (request.method !== "GET" || request.url !== FORK) return undefined;
        polls += 1;
        return new Response("{}", { status: 404 });
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.stage).toBe("fork");
    expect(result.ok ? "" : result.message).toMatch(/fork/i);
    expect(polls).toBe(10);
  });

  it("reuses the file version a branch already holds", async () => {
    const { seen } = await submit(
      withRoute((request) =>
        request.method === "GET" &&
        request.path.startsWith(`${FORK_PATH}/contents/`)
          ? json({ sha: "existing-file-sha" })
          : undefined,
      ),
    );

    const puts = seen.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(3);
    for (const request of puts)
      expect(bodyOf(request)["sha"]).toBe("existing-file-sha");
  });

  it("keeps the token in the Authorization header and nowhere else", async () => {
    const { seen } = await submit(GITHUB);

    expect(seen.length).toBeGreaterThan(0);
    for (const request of seen) {
      expect(request.url).not.toContain(TOKEN);
      expect(request.body).not.toContain(TOKEN);
      expect(request.headers["accept"]).toBe("application/vnd.github+json");
      expect(request.headers["x-github-api-version"]).toBe("2022-11-28");
      for (const [name, value] of Object.entries(request.headers)) {
        if (name === "authorization") expect(value).toBe(`Bearer ${TOKEN}`);
        else expect(value).not.toContain(TOKEN);
      }
      if (request.method === "PUT" || request.method === "POST")
        expect(request.headers["content-type"]).toBe("application/json");
    }
  });

  it("refuses without an identity, before any request", async () => {
    const { result, seen } = await submit(GITHUB, {
      ...INPUT,
      accessToken: "",
    });

    expect(result).toEqual({
      ok: false,
      stage: "identity",
      message: expect.stringMatching(/sign in/i),
    });
    expect(seen).toEqual([]);
  });

  it("refuses a directory that is not one catalogue item", async () => {
    const { result, seen } = await submit(GITHUB, {
      ...INPUT,
      files: { ...FILES, path: "catalogue/../aurora" },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.stage).toBe("commit");
    expect(seen).toEqual([]);
  });
});
