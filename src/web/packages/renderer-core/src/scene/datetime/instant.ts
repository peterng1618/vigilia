/**
 * The reading itself.
 *
 * Which time it *is* is a machine fact, so whoever acquires it sends an instant
 * with an offset ({@link instantIn}) and this renders those components as
 * written — the display never re-converts, so a dashboard shows the host's time
 * on every device.
 */

/**
 * The reading a clock provider reports: the instant `nowMs` names, written with
 * the offset of the zone it is read in — this machine's, unless the consumer
 * chose another. Deliberately not a formatted string: the author's tokens need
 * the components, and the offset is what makes it unambiguous to a display that
 * never re-converts.
 */
export function instantIn(nowMs: number, timeZone?: string): string {
  const offsetMs = offsetAt(nowMs, timeZone);
  const at = new Date(nowMs + offsetMs);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const minutes = Math.abs(offsetMs) / 60_000;
  const offset =
    offsetMs === 0
      ? "Z"
      : `${offsetMs < 0 ? "-" : "+"}${pad(Math.trunc(minutes / 60))}:${pad(minutes % 60)}`;

  return (
    `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}` +
    `T${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}` +
    offset
  );
}

/** The instant's own components, as its offset holder reads them. */
export interface Parts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly weekday: number;
}

/**
 * How far ahead of UTC the zone is at that instant. A named zone is measured
 * from its own wall clock rather than trusted to a formatted offset name, which
 * runtimes spell differently, and one they cannot resolve falls back to this
 * machine's — a clock is never allowed to disappear over a zone name.
 */
function offsetAt(nowMs: number, timeZone: string | undefined): number {
  if (timeZone !== undefined) {
    const parts = partsInZone(nowMs, timeZone);

    if (parts !== undefined) {
      const wall = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );
      return wall - Math.floor(nowMs / 1000) * 1000;
    }
  }

  // `getTimezoneOffset` is minutes *behind* UTC, so its sign is reversed.
  return -new Date(nowMs).getTimezoneOffset() * 60_000;
}

/**
 * Reads an ISO 8601 instant into the components its own offset describes.
 * A value that is not one returns undefined, so the caller shows the raw text
 * rather than inventing a date.
 */
export function parseInstant(value: string): Parts | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(
      value,
    );
  if (match === null) return undefined;

  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);

  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  return {
    year,
    month,
    day,
    hour: Number(h),
    minute: Number(mi),
    second: Number(s ?? 0),
    // The weekday of the calendar date itself, which the offset has settled.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/**
 * The instant's components as a named zone reads them. `Intl` resolves the
 * offset in force at that instant, so a DST boundary reads correctly rather than
 * by a fixed offset.
 */
export function partsInZone(at: number, timeZone: string): Parts | undefined {
  if (!Number.isFinite(at)) return undefined;

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(at));
    const get = (type: string): string =>
      parts.find((part) => part.type === type)?.value ?? "";

    const year = Number(get("year"));
    const month = Number(get("month"));
    const day = Number(get("day"));

    return {
      year,
      month,
      day,
      hour: Number(get("hour")),
      minute: Number(get("minute")),
      second: Number(get("second")),
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    };
  } catch {
    // An unknown zone falls back to the instant's own offset rather than
    // throwing: a theme must not break a display over a zone name.
    return undefined;
  }
}

/**
 * Whether `Intl` can read this zone name, which is the only thing that decides
 * whether `partsInZone` will. Aliases such as `US/Pacific` resolve, so a
 * membership check against the canonical list would refuse zones that work.
 */
export function isTimeZoneName(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every zone an author may pin a clock to, for the authoring control. `Intl`
 * resolves UTC but omits it from the canonical list, and server time is the zone
 * a dashboard most often pins, so it leads.
 */
export function knownTimeZones(): readonly string[] {
  return ["UTC", ...Intl.supportedValuesOf("timeZone")];
}
