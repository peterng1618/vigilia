import { describe, expect, it } from "vitest";
import { redactForBrowser } from "./provider.js";

/**
 * What a provider may say in a message that reaches a browser.
 *
 * `ProviderHealth` and a sample's `message` both travel to a display, and both
 * are written by providers that quote an error string. The error string is
 * written by something else — undici, `systeminformation`, a JSON parser — and
 * it carries whatever that thing had: a transport address, a path, a command
 * line. None of it is the consumer's business, and a wall display has no use
 * for it.
 *
 * The player redacts too (`availability-notice.ts`), as a net. That is the
 * second owner of one contract, and the two disagreeing is the defect: the
 * host is where the message is composed, so the host is where it is made safe.
 */

describe("redactForBrowser", () => {
  it("replaces a transport address with the words the display already reads", () => {
    // The player's net already substitutes this phrase, so a host that says it
    // here produces the same sentence the player would have produced — one
    // wording, two layers, no disagreement.
    expect(redactForBrowser("not reachable at http://127.0.0.1:8085")).toBe(
      "not reachable at its configured address",
    );
    expect(redactForBrowser("connect ECONNREFUSED 127.0.0.1:8085")).toBe(
      "connect ECONNREFUSED its configured address",
    );
    expect(redactForBrowser("cannot reach localhost:8085")).toBe(
      "cannot reach its configured address",
    );
  });

  it("leaves the sentence's own colon where the URL was", () => {
    // The player's net draws this line for a reason worth keeping: a reason
    // reads `... at http://host:8085: fetch failed`, and the colon after the
    // port belongs to the sentence rather than to the URL.
    expect(
      redactForBrowser(
        "LibreHardwareMonitor is not reachable at http://127.0.0.1:8085: fetch failed",
      ),
    ).toBe(
      "LibreHardwareMonitor is not reachable at its configured address: fetch failed",
    );
  });

  it("replaces a filesystem path, which is as identifying as a port", () => {
    // `systeminformation` shells out and quotes the command it ran, so a path
    // reaches the display through the same message a transport address would.
    expect(
      redactForBrowser("spawn C:\\Windows\\System32\\wbem\\WMIC.exe ENOENT"),
    ).toBe("spawn its configured address ENOENT");
    expect(redactForBrowser("cannot read /etc/smartd.conf")).toBe(
      "cannot read its configured address",
    );
  });

  it("keeps the words, which are the diagnostic", () => {
    // The address is what must not travel; "connect ECONNREFUSED" is why the
    // sensor is missing, and a display that says only "a sensor has no
    // reading" has learned nothing a person can act on.
    expect(redactForBrowser("connect ECONNREFUSED 127.0.0.1:8085")).toContain(
      "ECONNREFUSED",
    );
    expect(redactForBrowser("LHM answered 500")).toBe("LHM answered 500");
  });

  it("leaves an aspect ratio alone, because it looks like an address", () => {
    // The dashboard's own vocabulary is full of `w:h`, and a redactor that ate
    // it would be a redactor that changed what a theme says.
    expect(redactForBrowser("artboard 2340:1080 at 19.5:9")).toBe(
      "artboard 2340:1080 at 19.5:9",
    );
  });

  it("bounds what a third-party error string can put on a wall", () => {
    const verbose = `systeminformation failed: ${"wmic ".repeat(60)}`;

    // A reason is a line on a fixed strip, not a log. An unbounded third-party
    // string is how one line becomes a paragraph nobody reads.
    expect(redactForBrowser(verbose).length).toBeLessThanOrEqual(121);
  });

  it("collapses the whitespace a wrapped error leaves behind", () => {
    expect(redactForBrowser("failed\n\n   badly")).toBe("failed badly");
  });
});
