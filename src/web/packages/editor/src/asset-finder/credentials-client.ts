import type { CredentialRow } from "@yunari/renderer-core";

/**
 * The Connections tab's half: list, save, clear and verify through the host.
 *
 * A credential value goes one way. `listCredentials` answers `set` and a hint;
 * nothing this module returns can echo a value back into the page.
 */
export type { CredentialRow };

export interface ClientOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
}

export type CredentialResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

function request(options?: ClientOptions): {
  readonly fetcher: typeof fetch;
  readonly url: (path: string) => string;
} {
  return {
    fetcher: options?.fetch ?? globalThis.fetch.bind(globalThis),
    url: (path) => `${options?.baseUrl ?? ""}${path}`,
  };
}

async function refusal(
  response: Response,
  fallback: string,
): Promise<CredentialResult> {
  const reason = await response.text().catch(() => "");
  return {
    ok: false,
    message: reason.trim() === "" ? fallback : reason,
  };
}

function thrown(error: unknown): CredentialResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function listCredentials(
  options?: ClientOptions,
): Promise<readonly CredentialRow[]> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(url("/api/credentials"));
    // A host with no credential store is "none", not a broken tab: this build
    // still works standalone, and the tab says the honest empty sentence.
    if (!response.ok) return [];

    const body = (await response.json()) as unknown;
    return Array.isArray(body) ? (body as readonly CredentialRow[]) : [];
  } catch {
    return [];
  }
}

export async function saveCredential(
  id: string,
  value: string,
  options?: ClientOptions,
): Promise<CredentialResult> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(url(`/api/credentials/${id}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      return refusal(
        response,
        `The host refused to save this credential (${response.status}).`,
      );
    }
    return { ok: true };
  } catch (error: unknown) {
    return thrown(error);
  }
}

export async function clearCredential(
  id: string,
  options?: ClientOptions,
): Promise<CredentialResult> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(url(`/api/credentials/${id}`), {
      method: "DELETE",
    });
    if (!response.ok) {
      return refusal(
        response,
        `The host refused to clear this credential (${response.status}).`,
      );
    }
    return { ok: true };
  } catch (error: unknown) {
    return thrown(error);
  }
}

export async function verifyCredential(
  id: string,
  options?: ClientOptions,
): Promise<CredentialResult> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(url(`/api/credentials/${id}/verify`), {
      method: "POST",
    });
    if (!response.ok) {
      return refusal(
        response,
        `The host could not check this credential (${response.status}).`,
      );
    }

    const body = (await response.json().catch(() => undefined)) as
      | { readonly ok?: unknown; readonly message?: unknown }
      | undefined;

    if (body?.ok === true) return { ok: true };

    return {
      ok: false,
      message:
        typeof body?.message === "string" && body.message.trim() !== ""
          ? body.message
          : "The host did not accept this credential.",
    };
  } catch (error: unknown) {
    return thrown(error);
  }
}
