import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import type { ThemeContent } from "./store.js";

/**
 * The host's theme library is a folder (ADR-0017), so a save carries the
 * document and its declared bytes as JSON rather than as an archive the host
 * would only have to unpack. Assets ride along base64-encoded, keyed by the
 * path the document declares.
 *
 *     { "envelope": { … }, "assets": { "assets/badge.svg": "<base64>" } }
 *
 * The archive is still the export format; this is the working path only.
 */

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function encodeThemeContent(content: ThemeContent): {
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, string>>;
} {
  return {
    envelope: content.envelope,
    assets: Object.fromEntries(
      Object.entries(content.assets).map(([assetPath, bytes]) => [
        assetPath,
        Buffer.from(bytes).toString("base64"),
      ]),
    ),
  };
}

export function decodeThemeContent(body: string): ThemeContent {
  const parsed = JSON.parse(body) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("That is not a theme.");
  }
  const { envelope, assets } = parsed as {
    readonly envelope?: unknown;
    readonly assets?: unknown;
  };
  if (typeof envelope !== "object" || envelope === null) {
    throw new Error("A theme needs its document.");
  }
  if (typeof assets !== "object" || assets === null || Array.isArray(assets)) {
    throw new Error("A theme needs an assets map.");
  }

  const decoded: Record<string, Uint8Array> = {};
  for (const [assetPath, encoded] of Object.entries(
    assets as Record<string, unknown>,
  )) {
    // `Buffer.from` silently drops what it does not understand, so a mangled
    // body would otherwise become a theme with silently truncated assets.
    if (
      typeof encoded !== "string" ||
      encoded.length % 4 !== 0 ||
      !BASE64.test(encoded)
    ) {
      throw new Error(`Asset "${assetPath}" is not base64.`);
    }
    decoded[assetPath] = new Uint8Array(Buffer.from(encoded, "base64"));
  }

  return { envelope: envelope as FabricThemeEnvelope, assets: decoded };
}
