import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isTimeZoneName } from "@vigilia/renderer-core";

/**
 * How this PC's readings are displayed, where the choice is the consumer's
 * rather than the author's.
 *
 * Only the clock's zone so far, and the split matters: a theme decides how a
 * clock *reads* (its tokens, and any zone it pins to show another city), while
 * which zone this PC's time is shown in is a fact about the person reading it.
 * A display never re-converts, so this is applied where the reading is acquired
 * (§116) and every screen then agrees.
 */

export interface DisplaySettings {
  /** A zone name `Intl` resolves. Absent means this PC's own zone. */
  readonly timeZone?: string;
}

export const EMPTY_DISPLAY_SETTINGS: DisplaySettings = {};

export interface DisplaySettingsStore {
  read(): Promise<DisplaySettings>;
  write(input: unknown): Promise<DisplaySettings>;
}

const FILE = "display.json";

/**
 * Keeps a zone this runtime can resolve, and nothing else. A name it cannot is
 * refused rather than stored: the clock would otherwise silently fall back and
 * a consumer would be left with a setting that appears to do nothing.
 */
export function normalizeDisplaySettings(input: unknown): DisplaySettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return EMPTY_DISPLAY_SETTINGS;
  }

  const value = (input as Record<string, unknown>)["timeZone"];

  if (typeof value !== "string") {
    return EMPTY_DISPLAY_SETTINGS;
  }

  // An emptied field is the consumer going back to this PC's own zone, which is
  // the absence of a choice rather than a choice of "".
  const timeZone = value.trim();
  if (timeZone.length === 0) {
    return EMPTY_DISPLAY_SETTINGS;
  }

  if (!isTimeZoneName(timeZone)) {
    throw new Error(`"${timeZone}" is not a time zone this runtime knows.`);
  }

  return { timeZone };
}

export function createDisplaySettingsStore(
  directory: string,
): DisplaySettingsStore {
  const file = path.join(directory, FILE);

  return {
    async read(): Promise<DisplaySettings> {
      try {
        return normalizeDisplaySettings(
          JSON.parse(await readFile(file, "utf8")),
        );
      } catch {
        // No file, an unreadable one, or a zone this runtime has since dropped:
        // this PC's own zone. Never fail a poll over a stored setting.
        return EMPTY_DISPLAY_SETTINGS;
      }
    },

    async write(input: unknown): Promise<DisplaySettings> {
      const normalized = normalizeDisplaySettings(input);
      await mkdir(directory, { recursive: true });
      await writeFile(file, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
      return normalized;
    },
  };
}
