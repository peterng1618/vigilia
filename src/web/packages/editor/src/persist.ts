import type { FabricThemeEnvelope } from '@vigilia/renderer-core';
import { readThemePackage, writeThemePackage } from '@vigilia/theme-package';

export type PackageParseResult =
  | { readonly ok: true; readonly envelope: FabricThemeEnvelope; readonly assets: Readonly<Record<string, Uint8Array>> }
  | { readonly ok: false; readonly message: string };

export type PackageSerializeResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string };

export function parseThemePackage(bytes: Uint8Array): PackageParseResult {
  const result = readThemePackage(bytes);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, envelope: result.envelope, assets: result.assets };
}

export function serializeThemePackage(envelope: FabricThemeEnvelope, assets: Readonly<Record<string, Uint8Array>> = {}): PackageSerializeResult {
  return writeThemePackage({ envelope, assets });
}

export function fileNameFor(theme: { readonly id: string }): string {
  const base = /^[A-Za-z0-9_-]{1,64}$/.test(theme.id) ? theme.id : 'theme';
  return `${base}.vigilia-theme`;
}
