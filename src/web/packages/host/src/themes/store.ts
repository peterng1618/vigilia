import fs from 'node:fs/promises';
import path from 'node:path';
import type { FabricThemeEnvelope } from '@vigilia/renderer-core';
import { readThemePackage } from '@vigilia/theme-package';

export interface ThemeStoreEntry {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export interface ThemeStoreRecord extends ThemeStoreEntry {
  readonly ok: true;
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, Uint8Array>>;
  readonly bytes: Uint8Array;
}

export interface ThemeStore {
  list(): Promise<readonly ThemeStoreEntry[]>;
  read(id: string): Promise<ThemeStoreRecord | undefined>;
  write(id: string, bytes: Uint8Array): Promise<ThemeStoreEntry>;
}

const THEME_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const THEME_EXTENSION = '.vigilia-theme';

export function isValidThemeId(id: string): boolean {
  return THEME_ID_REGEX.test(id);
}

export function createThemeStore(directory: string): ThemeStore {
  return {
    async list(): Promise<readonly ThemeStoreEntry[]> {
      try {
        await fs.mkdir(directory, { recursive: true });
        const entries = await fs.readdir(directory, { withFileTypes: true });
        const themes: ThemeStoreEntry[] = [];

        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(THEME_EXTENSION)) {
            continue;
          }
          const id = entry.name.slice(0, -THEME_EXTENSION.length);
          if (!isValidThemeId(id)) {
            continue;
          }
          const filePath = path.join(directory, entry.name);
          try {
            const bytes = await fs.readFile(filePath);
            const parsed = readThemePackage(bytes);
            if (!parsed.ok) {
              continue;
            }
            const stat = await fs.stat(filePath);
            themes.push({
              id,
              name: parsed.envelope.metadata?.name ?? id,
              updatedAt: stat.mtime.toISOString(),
            });
          } catch {
            continue;
          }
        }

        return themes.sort((a, b) => a.id.localeCompare(b.id));
      } catch {
        return [];
      }
    },

    async read(id: string): Promise<ThemeStoreRecord | undefined> {
      if (!isValidThemeId(id)) {
        return undefined;
      }
      const filePath = path.join(directory, `${id}${THEME_EXTENSION}`);
      try {
        const bytes = await fs.readFile(filePath);
        const parsed = readThemePackage(bytes);
        if (!parsed.ok) {
          return undefined;
        }
        const stat = await fs.stat(filePath);
        return {
          ok: true,
          id,
          name: parsed.envelope.metadata?.name ?? id,
          updatedAt: stat.mtime.toISOString(),
          envelope: parsed.envelope,
          assets: parsed.assets,
          bytes: new Uint8Array(bytes),
        };
      } catch {
        return undefined;
      }
    },

    async write(id: string, bytes: Uint8Array): Promise<ThemeStoreEntry> {
      if (!isValidThemeId(id)) {
        throw new Error('Invalid theme id.');
      }
      const parsed = readThemePackage(bytes);
      if (!parsed.ok) {
        throw new Error(parsed.message);
      }
      if (parsed.envelope.id !== id) {
        throw new Error(`Theme package id "${parsed.envelope.id}" does not match target id "${id}".`);
      }

      await fs.mkdir(directory, { recursive: true });
      const targetPath = path.join(directory, `${id}${THEME_EXTENSION}`);
      const tempPath = path.join(
        directory,
        `${id}${THEME_EXTENSION}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
      );

      try {
        await fs.writeFile(tempPath, bytes);
        await fs.rename(tempPath, targetPath);
      } catch (error) {
        await fs.unlink(tempPath).catch(() => {});
        throw error;
      }

      const stat = await fs.stat(targetPath);
      return {
        id,
        name: parsed.envelope.metadata?.name ?? id,
        updatedAt: stat.mtime.toISOString(),
      };
    },
  };
}