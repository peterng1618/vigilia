import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGithubTokenStore, type GithubIdentity } from "./github-token.js";

/** The file as a hand-edited one would be, for the reader to read. */
const tokenFile = (dir: string) => path.join(dir, "github-token.json");

const identity = (accessToken = "gho_token"): GithubIdentity => ({
  accessToken,
  scope: "public_repo",
  login: "peterng1618",
  obtainedAt: "2026-10-22T10:00:00.000Z",
});

describe("github token", () => {
  let dir: string;
  let store: ReturnType<typeof createGithubTokenStore>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-github-token-"));
    store = createGithubTokenStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads an absent file as no identity", async () => {
    expect(await store.read()).toBeUndefined();
  });

  it("round-trips an identity through github-token.json", async () => {
    await store.write(identity());

    expect(await store.read()).toEqual(identity());
    // The name is part of the contract: the file sits beside the origin record,
    // and a rename would be a migration rather than a detail.
    expect(JSON.parse(await readFile(tokenFile(dir), "utf8"))).toEqual(
      identity(),
    );
  });

  it("keeps the token file to its owner", async () => {
    // A mode is a POSIX idea; on Windows the file inherits the profile
    // directory's ACL, which is already this user's alone, and `stat` reports
    // the mode it would have on a POSIX filesystem rather than the one in
    // force. Asserted where it means something rather than asserted everywhere
    // and true nowhere.
    if (process.platform === "win32") return;

    await store.write(identity());

    const file = await stat(tokenFile(dir));
    expect(file.mode & 0o777).toBe(0o600);
  });

  it("removes the file on clear", async () => {
    await store.write(identity());

    await store.clear();

    expect(await store.read()).toBeUndefined();
    // Gone, not emptied: an empty file would still be a file to read.
    await expect(readFile(tokenFile(dir), "utf8")).rejects.toThrow();
  });

  it("clears a token a failed rename left in the temporary file", async () => {
    // The rename can fail with the target held open; the token then sits in
    // `.tmp`, and signing out has to mean it is gone.
    await writeFile(
      `${tokenFile(dir)}.tmp`,
      JSON.stringify(identity()),
      "utf8",
    );

    await store.clear();

    await expect(readFile(`${tokenFile(dir)}.tmp`, "utf8")).rejects.toThrow();
  });

  it("reads a login that is not a GitHub login as no identity", async () => {
    await writeFile(
      tokenFile(dir),
      JSON.stringify({ ...identity(), login: "../evil" }),
      "utf8",
    );

    expect(await store.read()).toBeUndefined();
  });

  it("clears a store that has nothing stored, without failing", async () => {
    await store.clear();

    expect(await store.read()).toBeUndefined();
  });

  it("reads a malformed file as no identity rather than throwing", async () => {
    await writeFile(tokenFile(dir), "{ not json", "utf8");

    expect(await store.read()).toBeUndefined();
  });

  it("reads a file that is not four usable strings as no identity", async () => {
    // One missing field is enough: a token without its scope or account cannot
    // be reported honestly, so it is not half an identity.
    await writeFile(
      tokenFile(dir),
      JSON.stringify({
        accessToken: "gho_token",
        scope: "public_repo",
        login: "peterng1618",
        obtainedAt: "not a date",
      }),
      "utf8",
    );

    expect(await store.read()).toBeUndefined();
  });

  it("answers a read issued during a write with the completed identity", async () => {
    // The read is requested before the write settles; it must still see the
    // write, not the absent file the write started from.
    const writing = store.write(identity("gho_first"));
    const reading = store.read();
    const [, read] = await Promise.all([writing, reading]);

    expect(read).toEqual(identity("gho_first"));
  });

  it("never answers a reader racing a write with a half-written file", async () => {
    // Unserialized, a reader can land between the truncating write and the
    // rename and parse a prefix of the JSON, which reads as no identity — a
    // lost sign-in rather than a reported fault.
    const writes = Promise.all(
      Array.from({ length: 20 }, (_unused, index) =>
        store.write(identity(`gho_${index}`)),
      ),
    );
    const answers = await Promise.all(
      Array.from({ length: 40 }, async (_unused, index) => {
        await new Promise((resolve) => setTimeout(resolve, index));
        return store.read();
      }),
    );
    await writes;

    for (const answer of answers) expect(answer).toBeDefined();
  });

  it("saves atomically, leaving no temporary file behind", async () => {
    await store.write(identity());

    await expect(readFile(`${tokenFile(dir)}.tmp`, "utf8")).rejects.toThrow();
  });

  it("refuses an identity that is not usable, and writes nothing", async () => {
    await expect(
      store.write({ ...identity(), accessToken: "" }),
    ).rejects.toThrow("Invalid");

    // A refused write is no write at all, so there is nothing on disk to read
    // back — the assertion that can go red, where `read()` answering
    // `undefined` on a directory that was never written to cannot.
    await expect(readFile(tokenFile(dir), "utf8")).rejects.toThrow();
  });

  it("refuses an obtainedAt that is not an instant", async () => {
    await expect(
      store.write({ ...identity(), obtainedAt: "yesterday" }),
    ).rejects.toThrow("Invalid");
  });
});
