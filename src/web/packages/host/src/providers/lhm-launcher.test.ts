import { describe, expect, it, vi } from "vitest";
import { launchLhm } from "./lhm-launcher.js";

describe("LHM launcher", () => {
  it("leaves an LHM that is already answering alone", async () => {
    const spawnProcess = vi.fn();
    const result = await launchLhm({
      executable: "/nope/LibreHardwareMonitor.exe",
      baseUrl: "http://127.0.0.1:8085",
      fetcher: async () => ({ ok: true }),
      spawnProcess,
    });

    // Never starts a second copy over one the owner is already running.
    expect(result.started).toBe(false);
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("reports a missing executable instead of starting nothing", async () => {
    const result = await launchLhm({
      executable: "/definitely/not/here/LibreHardwareMonitor.exe",
      baseUrl: "http://127.0.0.1:8085",
      fetcher: async () => ({ ok: false }),
    });

    expect(result.started).toBe(false);
    expect(result.reason).toContain("was not found");
  });

  it("reports a server that never answers, naming the setting to enable", async () => {
    const kill = vi.fn();
    const result = await launchLhm({
      executable: import.meta.filename,
      baseUrl: "http://127.0.0.1:8085",
      timeoutMs: 50,
      fetcher: async () => ({ ok: false }),
      spawnProcess: () => ({ kill, killed: false, once: vi.fn() }) as never,
    });

    expect(result.started).toBe(false);
    expect(result.reason).toContain("Run web server");
    // A process it started is stopped again.
    result.stop();
    expect(kill).toHaveBeenCalled();
  });

  it("reports a spawn that fails asynchronously, as spawn actually does", async () => {
    const kill = vi.fn();
    const result = await launchLhm({
      executable: import.meta.filename,
      baseUrl: "http://127.0.0.1:8085",
      timeoutMs: 5000,
      fetcher: async () => ({ ok: false }),
      // spawn emits "error" on the next tick rather than throwing.
      spawnProcess: () =>
        ({
          kill,
          killed: false,
          once: (event: string, handler: (error: Error) => void) => {
            if (event === "error")
              setImmediate(() => handler(new Error("EACCES")));
          },
        }) as never,
    });

    // Reported promptly instead of waiting out the timeout, and never thrown.
    expect(result.started).toBe(false);
    expect(result.reason).toContain("EACCES");
  });

  it("reports a spawn failure without throwing", async () => {
    const result = await launchLhm({
      executable: import.meta.filename,
      baseUrl: "http://127.0.0.1:8085",
      fetcher: async () => ({ ok: false }),
      spawnProcess: () => {
        throw new Error("EPERM");
      },
    });

    expect(result.started).toBe(false);
    expect(result.reason).toContain("EPERM");
  });
});
