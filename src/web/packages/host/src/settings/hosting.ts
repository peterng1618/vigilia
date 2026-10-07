import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Whether this PC serves the LAN (§145). A fact about this machine, so it sits
 * with the other settings and never in a theme folder.
 *
 * LAN serving is explicit opt-in, and that is what the default is for: a
 * missing file, an unreadable file, a malformed one and one that states no
 * choice all answer "loopback only", because the failure that matters is
 * serving a home network because something could not be read.
 */

export interface HostingSettings {
  readonly lan: boolean;
}

export const DEFAULT_HOSTING_SETTINGS: HostingSettings = { lan: false };

export interface HostingSettingsStore {
  read(): Promise<HostingSettings>;
  write(input: unknown): Promise<HostingSettings>;
}

const FILE = "hosting.json";

export function normalizeHostingSettings(input: unknown): HostingSettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return DEFAULT_HOSTING_SETTINGS;
  }

  const lan = (input as Record<string, unknown>)["lan"];
  // Absent is no choice, which is off; present and not a boolean is a value
  // this runtime cannot obey, which is the case `normalizeDisplaySettings`
  // throws for rather than storing.
  if (lan === undefined) return DEFAULT_HOSTING_SETTINGS;
  if (typeof lan !== "boolean") {
    throw new Error("Hosting's `lan` is on or off, and nothing else.");
  }

  return { lan };
}

export function createHostingSettingsStore(
  directory: string,
): HostingSettingsStore {
  const file = path.join(directory, FILE);

  return {
    async read() {
      try {
        return normalizeHostingSettings(
          JSON.parse(await readFile(file, "utf8")) as unknown,
        );
      } catch {
        // No file yet, or an unreadable one: loopback only.
        return DEFAULT_HOSTING_SETTINGS;
      }
    },

    async write(input) {
      const settings = normalizeHostingSettings(input);
      await mkdir(directory, { recursive: true });
      await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
      return settings;
    },
  };
}
