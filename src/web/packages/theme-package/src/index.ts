import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { validateFabricThemeEnvelope, type FabricThemeEnvelope } from '@vigilia/renderer-core';

const MANIFEST = 'manifest.json';
const THEME = 'theme.json';

export type ThemePackageResult =
  | { readonly ok: true; readonly envelope: FabricThemeEnvelope; readonly assets: Readonly<Record<string, Uint8Array>> }
  | { readonly ok: false; readonly message: string };

export function writeThemePackage(input: { readonly envelope: FabricThemeEnvelope; readonly assets: Readonly<Record<string, Uint8Array>> }):
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string } {
  const validation = validateFabricThemeEnvelope(input.envelope);
  if (!validation.ok) return { ok: false, message: validation.issues[0]?.message ?? 'Invalid theme.' };
  const paths = new Set(input.envelope.assets?.map((asset) => asset.path) ?? []);
  if (Object.keys(input.assets).length !== paths.size || [...paths].some((path) => input.assets[path] === undefined)) return { ok: false, message: 'Package assets must exactly match the theme declaration.' };
  return { ok: true, bytes: zipSync({ [MANIFEST]: strToU8(JSON.stringify({ format: 'vigilia-theme-package', version: 1, theme: THEME })), [THEME]: strToU8(JSON.stringify(input.envelope)), ...input.assets }, { level: 6 }) };
}

export function readThemePackage(bytes: Uint8Array): ThemePackageResult {
  try {
    const files = unzipSync(bytes);
    const manifest = files[MANIFEST];
    const theme = files[THEME];
    if (manifest === undefined || theme === undefined) return fail('A package needs manifest.json and theme.json.');
    const parsedManifest = JSON.parse(strFromU8(manifest)) as Record<string, unknown>;
    if (parsedManifest['format'] !== 'vigilia-theme-package' || parsedManifest['version'] !== 1 || parsedManifest['theme'] !== THEME) return fail('Unsupported package manifest.');
    const parsedTheme = JSON.parse(strFromU8(theme));
    const validation = validateFabricThemeEnvelope(parsedTheme);
    if (!validation.ok) return fail(validation.issues[0]?.message ?? 'Invalid theme.');
    const paths = new Set(validation.envelope.assets?.map((asset) => asset.path) ?? []);
    const assets = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('assets/')));
    if (Object.keys(files).some((path) => path !== MANIFEST && path !== THEME && !paths.has(path)) || Object.keys(assets).length !== paths.size || [...paths].some((path) => assets[path] === undefined)) return fail('Package assets must exactly match the theme declaration.');
    return { ok: true, envelope: validation.envelope, assets };
  } catch {
    return fail('That file is not a readable theme package.');
  }
}

function fail(message: string): ThemePackageResult { return { ok: false, message }; }
