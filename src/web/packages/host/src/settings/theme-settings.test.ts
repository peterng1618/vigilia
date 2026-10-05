import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createThemeSettingsStore,
  normalizeAnswers,
} from "./theme-settings.js";

describe("theme answers", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-theme-answers-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("has no answers for a theme nobody has answered for", async () => {
    expect(await createThemeSettingsStore(dir).read("living-room")).toEqual({});
  });

  it("answers each theme separately", async () => {
    const store = createThemeSettingsStore(dir);
    await store.write("living-room", { "system-disk": "c" });
    await store.write("office", { gpu: "nvidia-geforce-rtx-3080-ti" });

    expect(await store.read("living-room")).toEqual({ "system-disk": "c" });
    expect(await store.read("office")).toEqual({
      gpu: "nvidia-geforce-rtx-3080-ti",
    });
  });

  it("keeps only known groups with a usable device id", () => {
    expect(
      normalizeAnswers({
        gpu: "nvidia-geforce-rtx-3080-ti",
        cpu: "intel-core-i9",
        "system-disk": "../../etc/passwd",
        "data-disk": "",
      }),
    ).toEqual({ gpu: "nvidia-geforce-rtx-3080-ti" });
  });

  it("drops a stale theme's answers when told to", async () => {
    const store = createThemeSettingsStore(dir);
    await store.write("living-room", { gpu: "nvidia-geforce-rtx-3080-ti" });
    await store.remove("living-room");

    expect(await store.read("living-room")).toEqual({});
  });

  it("refuses an id that is not a theme id", async () => {
    const store = createThemeSettingsStore(dir);

    await expect(store.write("../escape", {})).rejects.toThrow("Invalid");
    // A read of one is nothing, rather than an error.
    expect(await store.read("../escape")).toEqual({});
  });

  it("treats a corrupt file as nothing answered", async () => {
    await writeFile(path.join(dir, "theme-answers.json"), "not json", "utf8");

    expect(await createThemeSettingsStore(dir).read("living-room")).toEqual({});
  });
});
