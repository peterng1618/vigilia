import type { CredentialRow } from "@yunari/renderer-core";
import { verifyUnsplash } from "../assets/images/unsplash.js";

/**
 * The credentials this host knows how to store.
 *
 * A key for an id this table does not name is refused, so a request cannot
 * fill `credentials.json` with arbitrary entries.
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
  /** How a person gets a key: one sentence, and the page that issues one. */
  readonly help?: { readonly text: string; readonly url: string };
}

/** What `GET /api/credentials` answers. Never carries the value. */
export type { CredentialRow };

export const KNOWN_CREDENTIALS: readonly KnownCredential[] = [
  {
    id: "unsplash",
    label: "Unsplash",
    kind: "bearer",
    verify: verifyUnsplash,
    help: {
      text: "Create an app on your Unsplash developer page and copy its access key.",
      url: "https://unsplash.com/oauth/applications",
    },
  },
];
