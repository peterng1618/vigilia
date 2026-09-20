import { type FabricThemeEnvelope, validateFabricThemeEnvelope } from '@vigilia/renderer-core';

export async function loadHostedTheme(
  id: string,
  fetcher: typeof fetch,
): Promise<FabricThemeEnvelope> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new Error('Invalid theme id.');
  }

  const response = await fetcher(`/api/themes/${encodeURIComponent(id)}/document`);
  if (!response.ok) {
    throw new Error(`Could not load theme (${response.status}).`);
  }

  const result = validateFabricThemeEnvelope(await response.json());
  if (!result.ok) {
    throw new Error(result.issues[0]?.message ?? 'Invalid hosted theme.');
  }

  return result.envelope;
}

/** Downloads only declared packaged font bytes; other assets remain renderer-owned URLs. */
export async function loadHostedFontAssets(
  id: string,
  theme: FabricThemeEnvelope,
  fetcher: typeof fetch,
): Promise<Readonly<Record<string, Uint8Array>>> {
  const fonts = (theme.assets ?? []).filter((asset) => asset.kind === 'font');
  const entries = await Promise.all(fonts.map(async (asset) => {
    const response = await fetcher(`/api/themes/${encodeURIComponent(id)}/assets/${encodeURIComponent(asset.path)}`);
    if (!response.ok) throw new Error(`Could not load font asset "${asset.id}" (${response.status}).`);
    return [asset.path, new Uint8Array(await response.arrayBuffer())] as const;
  }));
  return Object.fromEntries(entries);
}
