import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ASSIGNABLE_GROUPS, type AssignableGroup } from "./devices.js";

/**
 * The answers a particular theme needed, stored per theme.
 *
 * "Which GPU does this dashboard show" is a fact about the theme on this
 * machine, not about the machine, so it lives here rather than beside the global
 * device settings. Only the answers where a theme *differs* from the global
 * choice are recorded, which is what lets a consumer answer a question once and
 * never see it again.
 */

export type ThemeAnswers = Readonly<Partial<Record<AssignableGroup, string>>>;

export interface ThemeSettingsStore {
  read(themeId: string): Promise<ThemeAnswers>;
  write(themeId: string, answers: unknown): Promise<ThemeAnswers>;
  /** Everything answered, for a theme that has been deleted to be swept. */
  remove(themeId: string): Promise<void>;
}

const FILE = "theme-answers.json";
const THEME_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DEVICE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isGroup(value: string): value is AssignableGroup {
  return (ASSIGNABLE_GROUPS as readonly string[]).includes(value);
}

/** Keeps only known groups with a usable device id. */
export function normalizeAnswers(input: unknown): ThemeAnswers {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }

  const answers: Partial<Record<AssignableGroup, string>> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isGroup(key) && typeof value === "string" && DEVICE_ID.test(value)) {
      answers[key] = value;
    }
  }

  return answers;
}

type File = Record<string, ThemeAnswers>;

async function readFile_(file: string): Promise<File> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([id]) => THEME_ID.test(id))
        .map(([id, answers]) => [id, normalizeAnswers(answers)]),
    );
  } catch {
    // No file, or an unreadable one: nothing has been answered.
    return {};
  }
}

export function createThemeSettingsStore(
  directory: string,
): ThemeSettingsStore {
  const file = path.join(directory, FILE);

  const save = async (all: File): Promise<void> => {
    await mkdir(directory, { recursive: true });
    await writeFile(file, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  };

  return {
    async read(themeId) {
      if (!THEME_ID.test(themeId)) return {};
      return (await readFile_(file))[themeId] ?? {};
    },

    async write(themeId, answers) {
      if (!THEME_ID.test(themeId)) {
        throw new Error(`Invalid theme id "${themeId}".`);
      }

      const normalized = normalizeAnswers(answers);
      const all = await readFile_(file);
      await save({ ...all, [themeId]: normalized });
      return normalized;
    },

    async remove(themeId) {
      if (!THEME_ID.test(themeId)) return;
      const all = await readFile_(file);
      if (!(themeId in all)) return;
      delete all[themeId];
      await save(all);
    },
  };
}
