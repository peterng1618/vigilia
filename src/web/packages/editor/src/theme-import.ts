/**
 * The package picker's half, which is this file's and not `editor-main.ts`'s:
 * importing writes to the library, where opening a document would need the
 * whole editor shell mounted (R129).
 *
 * The browser's whole half is a post and a mapping — **it does not read the
 * package**. The reader is the host's (§141), and the host owns the folder the
 * bytes land in, the id they land under and the no-overwrite rule, so a client
 * that parsed a package here would be a second place that decided all three.
 */

/** Where a package is handed over. The host's own route, named once. */
const IMPORT_PATH = "/api/themes/import";

export type ThemeImportResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly message: string };

/**
 * Posts a `.vigilia-theme` package to the host and answers where it landed.
 *
 * Every refusal is the host's own words — the reader's for a package it will
 * not read, the store's for a write it would not take — because the reason is
 * what the author has to act on, and a sentence composed here would hide it.
 */
export async function importThemePackage(
  bytes: Uint8Array,
  options?: { readonly baseUrl?: string; readonly fetch?: typeof fetch },
): Promise<ThemeImportResult> {
  const fetcher = options?.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options?.baseUrl ?? "";

  let response: Response;
  try {
    response = await fetcher(`${baseUrl}${IMPORT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: bytes as unknown as BodyInit,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    const reason = await response.text().catch(() => "");
    return {
      ok: false,
      message:
        reason.trim() === ""
          ? `The host refused the import (${response.status}).`
          : reason,
    };
  }

  const body = (await response.json().catch(() => undefined)) as
    | { readonly id?: unknown }
    | undefined;
  // An id invented here would name a theme the library does not hold, so a host
  // that does not report one is a failure rather than something to paper over.
  if (typeof body?.id !== "string") {
    return {
      ok: false,
      message: "The host did not say where the theme landed.",
    };
  }
  return { ok: true, id: body.id };
}
