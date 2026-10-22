import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStoreSessionStore, type StoreSession } from "./store-session.js";

const NOW = "2026-10-23T10:00:00.000Z";

const sessionFile = (dir: string) => path.join(dir, "store-session.json");

const session = (token = "session-token"): StoreSession => ({
  token,
  userId: "user-1",
  email: "a@example.com",
  obtainedAt: NOW,
});

describe("store session", () => {
  let dir: string;
  let store: ReturnType<typeof createStoreSessionStore>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "yunari-store-session-"));
    store = createStoreSessionStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads an absent file as no session", async () => {
    expect(await store.read()).toBeUndefined();
  });

  it("round-trips a session and clears both the file and its temporary sibling", async () => {
    await store.write(session());
    expect(await store.read()).toMatchObject({ token: "session-token" });
    // A mode is a POSIX idea; on Windows the file inherits the profile
    // directory's ACL, which is already this user's alone.
    if (process.platform !== "win32") {
      expect((await stat(sessionFile(dir))).mode & 0o777).toBe(0o600);
    }

    await writeFile(
      `${sessionFile(dir)}.tmp`,
      JSON.stringify(session()),
      "utf8",
    );
    await store.clear();

    expect(await store.read()).toBeUndefined();
    await expect(readFile(sessionFile(dir), "utf8")).rejects.toThrow();
    await expect(readFile(`${sessionFile(dir)}.tmp`, "utf8")).rejects.toThrow();
  });

  it("keeps the session file to its owner", async () => {
    if (process.platform === "win32") return;

    await store.write(session());

    expect((await stat(sessionFile(dir))).mode & 0o777).toBe(0o600);
  });

  it("reads a malformed or incomplete file as no session rather than throwing", async () => {
    await writeFile(sessionFile(dir), "{ not json", "utf8");
    expect(await store.read()).toBeUndefined();

    await writeFile(
      sessionFile(dir),
      JSON.stringify({ ...session(), obtainedAt: "yesterday" }),
      "utf8",
    );
    expect(await store.read()).toBeUndefined();

    await writeFile(sessionFile(dir), JSON.stringify({ token: "t" }), "utf8");
    expect(await store.read()).toBeUndefined();
  });

  it("refuses a session that is not four usable strings, and writes nothing", async () => {
    await expect(store.write({ ...session(), token: "" })).rejects.toThrow(
      "Invalid",
    );
    await expect(readFile(sessionFile(dir), "utf8")).rejects.toThrow();
  });

  it("answers a read issued during a write with the completed session", async () => {
    const writing = store.write(session("session-token"));
    const reading = store.read();
    const [, read] = await Promise.all([writing, reading]);

    expect(read).toMatchObject({ token: "session-token" });
  });
});
