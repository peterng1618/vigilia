# Consumer Journey Implementation Plan

> **For agentic workers:** execute task-by-task, committing after each task.

**Goal:** A consumer can pick a saved theme, answer only what that theme needs
for their machine, and have it stick — without opening the editor.

**Spec:** `docs/superpowers/specs/2026-09-24-consumer-journey.md`

## Global Constraints

- The host owns active-theme and device state, both under
  `host/src/settings/`; no new envelope field.
- The consumer page stays dependency-free HTML served from source, loopback
  only, consistent with the existing settings page.
- Required configuration is **derived** from a theme's bindings, never authored.
- Copy lives in the page or `ui-copy.ts`; no new copy owners.
- Every control has an accessible name; the page works at phone width.
- Visible changes need rendered inspection plus the full local browser suite.

## Evidence already gathered

Driven against the running host, not read from code:

| Observed | Evidence |
|---|---|
| A consumer has no route but the editor | `/` shows one link, "Open the editor" |
| No way to choose a theme | No theme control on `/` or `/settings`; `/` silently takes the first |
| Consumer settings cover devices only | `/settings` sections: Devices, Graphics card, System disk, Data disk |

## File Structure

| Path | Responsibility |
|---|---|
| `host/src/settings/active-theme.ts` | Which theme this host displays, persisted |
| `host/src/settings/active-theme.test.ts` | Default, persistence, invalid id |
| `host/src/server.ts` | Serve the library and accept a choice; resolve `/` through it |
| `host/public/settings.html` | Themes section; devices section asks only what the theme binds |
| `host/src/settings/required-devices.ts` | Derive required slots from a theme's bindings |
| `host/src/settings/required-devices.test.ts` | The derivation, including "asks nothing" |
| `tests/e2e/host-player.spec.ts` | Rendered proof through the real host |

## Tasks

### Task 1 — The host remembers an active theme

- [ ] `active-theme.ts`: read/write one id beside the device settings, rejecting
      an id that is not a valid theme id. A missing or stale file means "none".
- [ ] `/` resolves: explicit `?theme=` → stored active → the only theme → the
      library → the first-run page.
- [ ] `PUT /api/themes/active` (loopback only) sets it, validating that the
      theme exists.
- [ ] Tests: default when unset; a stored id is returned; a stale id is treated
      as unset rather than crashing; an invalid id is refused.
- [ ] Verify with the real host that `/` follows the stored id across a restart.
- [ ] Commit.

### Task 2 — Derive what a theme needs configured

- [ ] `required-devices.ts`: from an envelope's bindings, report which device
      slots it uses (`gpu`, `system-disk`, `data-disk`).
- [ ] Tests: a theme binding only `cpu.load` requires nothing; `disk.*` requires
      a system disk; `disk.data.*` requires a data disk; a chart's bindings are
      read the same way.
- [ ] Commit.

### Task 3 — The library section

- [ ] Extend `/settings` with a Themes section above Devices: every saved theme
      by name and author, the active one marked, a button to choose another, and
      a line naming what the theme displays.
- [ ] `GET /api/themes` already lists them; the page reads name/author from the
      package metadata.
- [ ] Verify in a browser: several themes listed, choosing one marks it and
      changes what `/` shows.
- [ ] Commit.

### Task 4 — Ask only what the active theme needs

- [ ] The Devices section shows a group only when the active theme binds it;
      with no theme active, or a theme that binds no device keys, it explains
      that nothing needs configuring rather than showing empty groups.
- [ ] Tests: the derivation drives the visible groups.
- [ ] Verify in a browser with a theme that binds no device keys and one that
      does.
- [ ] Commit.

### Task 5 — A paired display follows the host

- [ ] A display loading `/` without `?theme=` receives the active theme, so a
      phone URL needs no per-device parameter.
- [ ] Verify through the real host with a session token, as the browser suite
      already does for the player.
- [ ] Commit.

### Task 6 — Integration proof

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [ ] Full local `npm run test:e2e`.
- [ ] Capture and inspect: the library with several themes, a theme that needs
      no configuration, and `/` after a restart.
- [ ] Update `docs/architecture/README.md` / `docs/architecture/ownership.md` and the spec's
      acceptance section with what was observed.
- [ ] Commit.

## Self-Review

- Spec coverage: Tasks 1–2 are the state and its derivation, 3–4 the page and
  its questions, 5 the display, 6 the acceptance proof.
- Ownership: one settings module per fact; the page is one consumer surface;
  no envelope change.
- Risk: `/` resolution order is the whole feature; Task 1 tests each branch, and
  Task 6 re-checks it across a restart.
