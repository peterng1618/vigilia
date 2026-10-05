# Theme Thumbnails Implementation Plan

> **For agentic workers:** execute task-by-task, committing after each task.

**Goal:** The theme library shows a picture of each theme, so a consumer picks
by look rather than by name.

**Spec:** `docs/superpowers/specs/2026-09-24-theme-thumbnails.md`

**Decision required first:** the spec's three capture options. The plan below
implements **option 1** (browser-side capture at save time), which adds nothing
to the host. If the maintainer prefers option 2 or 3, Tasks 1–2 change.

## Global Constraints

- The capture uses the player's render path, never a second renderer (§31).
- The package format is untouched; the thumbnail lives beside the package.
- A missing or failed thumbnail degrades to the name-only listing.
- The route follows the declared-asset route's rules and access model.
- Copy in the consumer page or `ui-copy.ts`; no new owners.

## Evidence already gathered

| Fact | Where |
|---|---|
| The envelope carries no preview imagery | `renderer-core/src/theme/fabric-envelope.ts` has no thumbnail field |
| The package admits only `manifest.json`, `theme.json`, `assets/*` | `theme-package/src/index.ts`'s filter |
| The player already renders a deterministic still | `main.ts`'s `static=1` path, used by the browser suite for stable captures |
| The host has no renderer | `host/package.json` has no browser dependency |

## File Structure

| Path | Responsibility |
|---|---|
| `host/src/themes/thumbnails.ts` | Store, read and validate thumbnail bytes |
| `host/src/themes/thumbnails.test.ts` | Absent, invalid and round-trip cases |
| `host/src/server.ts` | `GET /api/themes/:id/thumbnail`; accept one on save |
| `editor/src/persistence-manager/` | Capture the still and include it on save |
| `editor/src/theme-library-client.ts` | Send the thumbnail with the package |
| `host/public/settings.html` | Show the picture in the library |

## Tasks

### Task 1 — Store and serve

- [ ] `thumbnails.ts`: write/read `thumbnails/<id>.png` beside the packages,
      bounded (reject > 2 MiB), PNG-magic checked, and never part of the package.
- [ ] `GET /api/themes/:id/thumbnail`: valid id in the store → bytes with an
      image content type; absent or unreadable → 404, never a 500.
- [ ] `PUT /api/themes/:id` accepts an optional thumbnail alongside the package,
      loopback only, consistent with the existing save.
- [ ] Tests: absent reads as nothing; invalid bytes are refused; a round-trip
      returns what was stored; a deleted theme leaves no badge.
- [ ] Commit.

### Task 2 — Capture at save time

- [ ] The editor's save path renders the current theme through the player's
      scene mount at the artboard size with a fixed clock, awaits fonts, and
      reads the canvas as a PNG.
- [ ] Capture failure must not fail the save: the package saves, the thumbnail
      is skipped, and the reason goes through `errorManager.warn`.
- [ ] Tests: a successful save includes bytes; a capture that throws still saves.
- [ ] Rendered proof: save a theme and compare the stored image against a
      separately rendered still of the same theme.
- [ ] Commit.

### Task 3 — The library shows pictures

- [ ] The library page renders each theme's picture with its name, and falls
      back to a name-only entry when the picture 404s.
- [ ] Layout holds at phone width: one column, image above the label.
- [ ] Verify in a browser with three themes, at both widths; capture and inspect.
- [ ] Commit.

### Task 4 — Backfill older themes

- [ ] A theme with no thumbnail gets one the first time it is opened in the
      editor and saved; the library states that a picture is pending rather than
      showing a broken image.
- [ ] Verify: an older package lists without error and gains a picture after a
      save.
- [ ] Commit.

### Task 5 — Integration proof

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [ ] Full local `npm run test:e2e`.
- [ ] Update `docs/architecture/ownership.md` and
      the spec's acceptance section.
- [ ] Commit.

## Self-Review

- Spec coverage: Task 1 is storage and access, 2 the capture, 3 the library, 4
  the older-package path, 5 the proof.
- Ownership: the theme store owns the bytes; the player's renderer produces the
  picture; the package format is unchanged.
- Risk: capture fidelity. Task 2 compares the stored image against a separately
  rendered still, so "it is a picture" is not mistaken for "it is the theme".
