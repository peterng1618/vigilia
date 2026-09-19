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