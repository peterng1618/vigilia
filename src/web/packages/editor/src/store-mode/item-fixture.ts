import {
  type FabricThemeEnvelope,
  facetRecordOf,
} from "@vigilia/renderer-core";
import type { ThemeLibraryEntry } from "../theme-library-client.js";
import { DASHBOARD_THEME_KIND, type StoreItem } from "./local-source.js";

/**
 * The store's own fixtures, in a file of their own rather than in the tests that
 * read them.
 *
 * **The reason is the design-token gate.** A `*.dom.test.tsx` beside a gated
 * source is itself gated (`vg-228`), and a theme's ground is a colour a fixture
 * cannot spell except as a hex literal — so the two grounds live here, where a
 * fixture's own values are not a surface going around the language.
 *
 * **The record is derived, never written.** `facetRecordOf` is the host's own
 * derivation and the record is what the facets are read off, so a hand-written
 * `{label: "CPU", family: "system"}` would answer something the host never would
 * — the trap A.4a's review found in a fixture.
 */

/** A ground dark enough for the record to read `dark`. */
export const DARK_GROUND = "#101010";

/** One light enough to read `light`. */
export const LIGHT_GROUND = "#f4f4f4";

/** One fixture theme, as the few facts a test varies. */
export interface FixtureTheme {
  readonly id: string;
  readonly name?: string;
  readonly author?: string;
  /** The document's own version, which the caption line prints beside the date
   *  (`1.4.0 · 2026-10-14`). Absent is a document that declares none, which is
   *  the case that must draw no separator. */
  readonly version?: string;
  readonly width?: number;
  readonly height?: number;
  /** The artboard's paint, as a document stores it. **Absent is a document with
   *  no paint at all**, which the record reads as `unclassified` — the one
   *  colour mode no facet offers and no pill is drawn for. */
  readonly ground?: string;
  /** What the theme binds, keyed the way a document keys them. */
  readonly bindings?: FabricThemeEnvelope["bindings"];
}

/** The document behind a fixture theme. */
export function fixtureEnvelope(theme: FixtureTheme): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: theme.id,
    artboard: {
      width: theme.width ?? 1920,
      height: theme.height ?? 1080,
      ...(theme.ground === undefined
        ? {}
        : { background: { value: theme.ground } }),
    },
    metadata: {
      name: theme.name ?? theme.id,
      themeLanguage: "en",
      ...(theme.author === undefined ? {} : { author: theme.author }),
      ...(theme.version === undefined ? {} : { version: theme.version }),
    },
    scene: { version: "7.4.0", objects: [] },
    ...(theme.bindings === undefined ? {} : { bindings: theme.bindings }),
  };
}

/** The listing entry the host derives for a fixture theme. */
export function fixtureEntry(theme: FixtureTheme): ThemeLibraryEntry {
  return {
    id: theme.id,
    name: theme.name ?? theme.id,
    ...(theme.author === undefined ? {} : { author: theme.author }),
    ...(theme.version === undefined ? {} : { version: theme.version }),
    updatedAt: "2026-10-14T00:00:00.000Z",
    facets: facetRecordOf(fixtureEnvelope(theme)),
  };
}

/** The item a source would hand the gallery for a fixture theme. */
export function fixtureItem(theme: FixtureTheme): StoreItem {
  const entry = fixtureEntry(theme);
  return {
    id: entry.id,
    kind: DASHBOARD_THEME_KIND,
    name: entry.name,
    author: entry.author,
    version: entry.version,
    updatedAt: entry.updatedAt,
    thumbnailUrl: undefined,
    ground: theme.ground,
    facets: entry.facets,
  };
}
