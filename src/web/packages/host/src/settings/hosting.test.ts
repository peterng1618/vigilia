import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHostingSettingsStore } from "./hosting.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "vigilia-hosting-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("hosting settings", () => {
  // Every default below is the literal `{ lan: false }` rather than
  // DEFAULT_HOSTING_SETTINGS. A default asserted against the constant it is
  // meant to pin passes whatever that constant says, so it could not fail and
  // Step 5's break would break nothing.
  it("serves loopback until somebody asks otherwise (§145)", async () => {
    expect(await createHostingSettingsStore(directory).read()).toEqual({
      lan: false,
    });
  });

  it("remembers the choice across a restart", async () => {
    await createHostingSettingsStore(directory).write({ lan: true });
    expect(await createHostingSettingsStore(directory).read()).toEqual({
      lan: true,
    });
  });

  it("refuses a value it cannot obey rather than coercing it", async () => {
    const store = createHostingSettingsStore(directory);
    await expect(store.write({ lan: "yes" })).rejects.toThrow(/lan/i);
    // No `lan` stated is the *absence* of a choice rather than an invalid one,
    // which is the rule `normalizeDisplaySettings` already follows: an emptied
    // field is the consumer going back to the default, not a third value. For
    // this setting that default is off, which is the safe direction (§145).
    expect(await store.write({})).toEqual({ lan: false });
  });

  it("answers loopback for a file it cannot read", async () => {
    await writeFile(path.join(directory, "hosting.json"), "{ not json", "utf8");
    expect(await createHostingSettingsStore(directory).read()).toEqual({
      lan: false,
    });
  });

  it("answers loopback for a file that states no choice", async () => {
    await writeFile(path.join(directory, "hosting.json"), "{}\n", "utf8");
    expect(await createHostingSettingsStore(directory).read()).toEqual({
      lan: false,
    });
  });
});
