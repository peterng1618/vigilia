import type { Sample } from "@vigilia/renderer-core";
import { uiCopy } from "./ui-copy.js";

/**
 * Names the sensors this display cannot read, and why, for `showAvailabilityNotice`.
 *
 * The reason is the provider's own words: the host owns that vocabulary
 * (`server.ts` composes the messages, the providers write the rest) and this
 * module only decides how many times a wall display is told it. A cause shared
 * by four sensors is said once with a count, not repeated four times in a row.
 */

/** Distinct causes shown before the strip names how many it left out. The
 *  banner is a full-width fixed strip read at a glance; past this the line
 *  wraps past the point of being read. */
const MAX_REASONS = 3;

/** Any scheme, so `file://` paths are dropped with the rest. The last character
 *  may not be a colon, because a reason reads `... at http://host:8085: fetch
 *  failed` and that colon is the sentence's, not the URL's. `ponytail:` this
 *  catches a written URL, not a bare `host:port` in prose; widen it if a
 *  provider ever reports one that way. */
const URL = /\b[a-z][a-z\d+.-]*:\/\/[^\s]*[^\s:]/gi;

/**
 * The strip for one batch of readings, or `undefined` when every requested
 * sensor has a reading. `readings` holds one entry per semantic key the display
 * asked for, so its length is the denominator; a key nothing has answered for
 * yet counts as neither read nor unread, which is what keeps the strip quiet
 * before the first batch instead of naming every key on the display.
 */
export function availabilityNoticeText(
  readings: readonly (Sample | undefined)[],
): string | undefined {
  const counts = new Map<string, number>();

  for (const sample of readings) {
    if (sample === undefined || sample.status === "ok") {
      continue;
    }
    const reason = reasonFor(sample);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return undefined;
  }

  let unread = 0;
  for (const count of counts.values()) {
    unread += count;
  }

  // Most-shared cause first; `Map` order breaks ties, so a stable sort leaves
  // equal counts in the order the keys were requested.
  const ordered = [...counts].sort((a, b) => b[1] - a[1]);
  const shown = ordered.slice(0, MAX_REASONS);

  return uiCopy.availability.notice(
    unread,
    readings.length,
    shown.map(([reason, count]) => ({ count, reason })),
    ordered.length - shown.length,
  );
}

/**
 * One sensor's cause. A sample the host sent without a reason still names
 * itself, so every unread key is accounted for. The address is dropped because
 * a wall display has no use for it and `ProviderHealth` already rules that a
 * message reaching a browser must be redacted.
 */
function reasonFor(sample: Sample): string {
  const reason =
    sample.message === undefined || sample.message === ""
      ? `${sample.sensorId}: ${sample.status}`
      : sample.message;

  return reason.replace(URL, uiCopy.availability.address);
}
