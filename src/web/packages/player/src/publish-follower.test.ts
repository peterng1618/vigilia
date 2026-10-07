import { describe, expect, it, vi } from "vitest";
import { followPublished } from "./publish-follower.js";

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("followPublished", () => {
  it("does not reload while the revision sits still", async () => {
    const reload = vi.fn();
    const stop = followPublished(
      { fetch: answer({ id: "living-room", revision: 4 }) },
      reload,
      { intervalMs: 5 },
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once the revision moves", async () => {
    let revision = 4;
    const reload = vi.fn();
    const stop = followPublished(
      {
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify({ id: "living-room", revision })),
        ),
      },
      reload,
      { intervalMs: 5 },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    revision = 5;
    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops, and says so, when the host refuses the session", async () => {
    const reload = vi.fn();
    const refused = vi.fn();
    const stop = followPublished(
      { fetch: answer({ error: "not paired" }, 403) },
      reload,
      { intervalMs: 5, onRefused: refused },
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    const calls = refused.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();

    expect(calls).toBeGreaterThan(0);
    // Stopped: a refusal is reported once, not polled forever.
    expect(refused.mock.calls.length).toBe(calls);
    expect(reload).not.toHaveBeenCalled();
  });
});
