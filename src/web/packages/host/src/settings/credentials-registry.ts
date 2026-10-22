import type { CredentialRow } from "@yunari/renderer-core";

/**
 * The credentials this host knows how to store.
 *
 * A key for an id this table does not name is refused, so a request cannot
 * fill `credentials.json` with arbitrary entries. Empty in v1: no source needs
 * a key yet, and the first keyed source adds its entry here.
 */
export type CredentialKind = "bearer" | "cookie";

export interface KnownCredential {
  readonly id: string;
  readonly label: string;
  readonly kind: CredentialKind;
  /** Absent when nothing can be checked without spending a real request. */
  readonly verify?: (
    value: string,
    fetchImpl: typeof fetch,
  ) => Promise<
    { readonly ok: true } | { readonly ok: false; readonly message: string }
  >;
}

/** What `GET /api/credentials` answers. Never carries the value. */
export type { CredentialRow };

export const KNOWN_CREDENTIALS: readonly KnownCredential[] = [];
