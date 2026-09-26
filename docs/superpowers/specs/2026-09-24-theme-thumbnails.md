# Theme Thumbnails

- **Status:** in progress. Plan: [`2026-09-24-theme-thumbnails.md`](../plans/2026-09-24-theme-thumbnails.md).
- **Plan:** [`2026-09-24-theme-thumbnails.md`](../plans/2026-09-24-theme-thumbnails.md)

## Why

The theme library lists themes as text. A consumer choosing between "Unanswerable
sensor" and "Twilight system dashboard" is choosing a **look**, and the only way
to see it is to open it — which is the editor trip the consumer journey exists to
avoid.

Observed: the library page renders name-only buttons; the envelope carries no
preview imagery; and the package format admits only `manifest.json`,
`theme.json` and `assets/*`.

## What a thumbnail is

A still image of the theme's artboard, captured with the same renderer the
display uses. It is a **consumer affordance**: it must be viewable without
opening the editor, and it must never be the thing a display loads.

## Design

### Rendered, then stored beside the package

The host renders the thumbnail at save time using the player's existing renderer
path, and stores it next to the package in the theme store. The package format
does **not** change.

Why not inside the package: `theme-package` deliberately admits exactly
`manifest.json`, `theme.json` and `assets/*`, and it is a validated, portable
artifact that is explicitly format-free of presentation concerns. A thumbnail is
a rendering of a machine's fonts and GPU, so it is not portable and does not
belong in the immutable share artifact (§139).

Why not render on demand per request: a headless browser in the host is a large
runtime dependency for a picture, and the host currently has zero non-renderer
runtime dependencies beyond `systeminformation`.

### One renderer, no second path (§31)

The capture uses the player's scene mount, not the editor's, so what a consumer
sees in the library is what the display draws. The still is the same
`static=1` deterministic path the browser suite already uses for stable
captures: no animation, a fixed clock, fonts awaited before the shot.

### When it is produced

- **On save**, by the editor's save path, so a theme is never in the library
  without one.
- **On demand**, for a theme saved before this existed, so the library does not
  show a blank for older packages.
- **Refreshed** when the theme changes, keyed to the package's own modified
  time, so a stale picture is never shown for an edited theme.

### Storage

Beside the package, under the theme store's directory, named for the theme id.
A missing or unreadable thumbnail is not an error: the library falls back to the
name-only listing it has today.

### Served like any other theme read

`GET /api/themes/:id/thumbnail` follows the same rules as the declared-asset
route: valid id, read from the store, `404` when absent. A paired display needs
no thumbnail, so this route is for the consumer pages and stays behind the same
access rules as the theme document.

## Non-goals

- Thumbnails inside packages, or in a future store's metadata.
- Animated previews, video, or a live iframe of the running display.
- Thumbnail editing, custom artwork or user-supplied covers.
- Any thumbnail in a saved theme envelope: it is derived, never authored.

## Boundaries

- The render path is the player's; the editor does not grow a second renderer.
- The theme store owns the bytes; the package format is untouched.
- Capture failure degrades to no thumbnail, never to a failed save.

## Acceptance

- Saving a theme from the editor produces a thumbnail the library displays.
- A theme saved before this change gets one on first library view.
- Editing and re-saving a theme replaces its thumbnail.
- A theme whose thumbnail is missing still lists, without an error.
- The image matches the display's rendering of the same theme: the same
  artboard, fit mode, and fonts at a still moment.
- A paired display is unaffected: it does not fetch thumbnails.
- Rendered inspection of the library with three themes, at desktop and phone
  widths.

## Verification

Capture is checked by comparing the stored image against the rendered artboard
for the same theme, not only by its presence. The library is inspected visually
at both widths, and the full local browser suite remains the gate.

## Open question for the maintainer

Headless capture needs a renderer in the host process, which contradicts the
host's zero-extra-dependency stance unless it reuses something already present.
Three options, in preference order:

1. **Browser-side capture at save time.** The editor is already a browser with
   the theme loaded: it renders the still and uploads it with the package. The
   host only stores bytes, and gains no dependency. A theme saved before the
   feature has no picture until it is opened and re-saved.
2. **Host-side render with a headless browser.** One package (`playwright`
   already exists as a dev dependency), but it promotes a test tool to a
   runtime dependency and roughly doubles the host's install size.
3. **No thumbnails; preview on open.** Cheapest, but keeps the consumer
   opening themes to see them, which is the problem this solves.

Option 1 is recommended: it uses the renderer already on screen, adds nothing to
the host, and matches "the picture is of this machine's fonts".
