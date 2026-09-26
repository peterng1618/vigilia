# Recon — consumer-journey and theme-thumbnails plans vs the working tree

Read-only. Every claim cites file:line or a commit sha. No checkboxes were trusted.
Branch at recon time: `claude/superpowers-workflow-cleanup`, HEAD `2a6d0ef`, tree clean.

Key finding up front: both plans were **implemented against an older design and superseded
in detail**, while their deliverable core landed.

- `required-devices.ts` (consumer-journey Task 2) was **added by a different plan**,
  `docs/superpowers/plans/2026-09-24-settings-scope.md`, commit `73ad33d`, which also
  **explicitly reverted** the consumer-journey Task 4 behaviour — filtering the Devices
  section by the active theme. A per-theme questions section replaced it, and that
  section is now owned by the settings-scope plan/spec
  (`docs/superpowers/specs/2026-09-24-settings-scope.md`).
- Both plans' final task is a **whole-repo integration proof whose text ("Update
  docs/architecture/README.md / ownership.md and the spec's acceptance section") was
  rewritten by later doc restructures** (`6908d9e docs: split architecture ownership and
  ADRs`, `bd20b26 docs: move project truth into conventional docs tree`). Judged as
  written, neither final task is met.

## Plan 1 — `docs/superpowers/plans/2026-09-24-consumer-journey.md`

| Task | Deliverables | State | Evidence (file:line, symbol, sha) | What is missing |
|---|---|---|---|---|
| 1 — host remembers an active theme | `settings/active-theme.ts` (read/write one id, reject invalid); `/` resolution `?theme=` → stored → only theme → library → first-run; `PUT /api/themes/active` loopback, validating existence; tests (default, stored, stale, invalid); restart proof on the real host | **landed** | `packages/host/src/settings/active-theme.ts:20` `createActiveThemeStore` (sha `c46ecf7`); wired `main.ts:113,130`; resolution `server.ts:1018-1053` (`?theme=` → stored at :1024-1029 → only-theme :1033 → `libraryPage`/`firstRunPage` :1041); route `server.ts:643-708` (loopback :644, existence check :686); tests `active-theme.test.ts:20,24,31,40` (+ corrupt :46, clear :52); `libraryPage` `server.ts:149`, `firstRunPage` `server.ts:224` | Two sub-items **unverified**: (a) "follows the stored id across a restart" — no e2e case reads/writes `active-theme.json` (grep `themes/active` in `src/web/tests/e2e/` → nothing); the `c46ecf7` message claims a manual restart check only; (b) a `?theme=` naming a theme that does not exist is passed to the player as-is (`server.ts:1030-1045`), unlike the stored id, which is validated against the store — the plan's resolution order does not say which is intended |
| 2 — derive what a theme needs configured | `settings/required-devices.ts` reporting `gpu`/`system-disk`/`data-disk` from bindings; tests (`cpu.load` → nothing, `disk.*` → system disk, `disk.data.*` → data disk, chart bindings read the same) | **landed** | `packages/host/src/settings/required-devices.ts:38` `requiredDeviceGroups` (**added by `73ad33d`**, the settings-scope plan, not the consumer-journey commits); tests `required-devices.test.ts:22,28,34,44,49,57,61`; consumed by `server.ts:27,669,766` | Nothing for the derivation itself. Chart bindings are covered only implicitly (the test treats every `envelope.bindings` entry alike — `required-devices.test.ts:12-18`), no chart-specific fixture |
| 3 — the library section | `/settings` Themes section above Devices: name + author, active marked, button to choose, a line naming what the theme displays; reads name/author from package metadata; browser verify (several themes, choosing one marks and changes `/`) | **landed** | `packages/host/public/settings.html:125-129` section, `:183-249` `renderThemes` (name/`:226-236`, author `:231`, `aria-pressed` `:219`, "Showing" `:239-244`, click `:245`), `:342-358` `chooseTheme` → `PUT /api/themes/active`; author in the list payload `themes/store.ts:58-62`; **later than the plan**: a real thumbnail replaces the "line naming what the theme displays" (`:204-217`, sha `9176957`) — the plan's stated device list at :126 of the plan is materially different from what landed | The library-page capture (`settings-themes.png`, `choose-theme.png`, both in `docs/evidence/screenshots/`) is **not registered** in `docs/evidence/screenshots/README.md` (:51-56 lists only `settings-theme-question`), and no e2e names those files |
| 4 — ask only what the active theme needs | Devices section shows a group only when the active theme binds it; with no theme, or a theme binding no device keys, explain that nothing needs configuring instead of empty groups; tests; browser verify | **landed (superseded)** | The feature and its tests exist, but **in the per-theme section, not the Devices section**: `settings.html:153-157` ("This theme needs") + `:251-293` `renderQuestions` + `:322-340` `loadQuestions` → `GET /api/themes/:id/answers` `server.ts:746-789` with `required: requiredDeviceGroups(...)` `:766`; tests `host-settings.spec.ts:247-293` (asks once) and `:295-307` (asks nothing); state module `settings/theme-settings.ts` | The Devices section, the only part consumers see without picking a theme, is deliberately **unfiltered** — `settings.html:419-421` renders every group the machine has, and `host-settings.spec.ts:90-115` is the *revert* regression test, introduced by `73ad33d` ("filtering the machine's own settings by the active theme hides a drive the consumer chose"). Do not "restore" this Task 4 wording into the Devices section: `docs/architecture/README.md:123` forbids a global setting reading the active theme |
| 5 — a paired display follows the host | A display loading `/` without `?theme=` receives the active theme, so no per-device parameter; verify through the real host **with a session token**, as the browser suite does for the player | **partial** | Path A is landed: the host resolves `/` for whoever is allowed to read it (`server.ts:1018-1053`) and the LAN read gate is `allowed()` `server.ts:426-432` (loopback or a valid session token); no separate consumer route needed. Path B ("with a session token") is **not proven**: no code passes a token to `/`, `host-player.spec.ts` never exercises `/api/pairing`, and the "unless `/api/pairing`" carve-out in `server.ts:446-447` means no test covers the non-loopback `/` read of an active theme | A real paired-session test: pair, then load `/` from a non-loopback peer path and assert the host's active theme is served |
| 6 — integration proof | six workspace gate commands; full local `test:e2e`; capture + inspect the library with several themes, a theme needing no configuration, `/` after a restart; update `docs/architecture/README.md` / `ownership.md` and the spec's acceptance section; commit | **open** | Partial docs touch: `docs/architecture/ownership.md:39` ("Which theme a host displays"), `:107` ("Which device slots a theme needs") and `README.md:121` were written by `6908d9e`, a general ownership split, not by this plan. **Unverified**: whether the six commands and the full e2e suite pass on HEAD — not run per instructions | As written: the six-command gate, the full e2e run, a `/`-after-restart capture, and spec-acceptance updates. `docs/superpowers/specs/2026-09-24-consumer-journey.md` is unchanged since `ce716f5` (its creation), so none of its Acceptance section (:100-112) records observed results. Also absent: any capture or capture-registry entry for "library with several themes" or "a theme that needs no configuration" |

### Queue impact — consumer-journey

Landed 4, partial 1, open 1. An implementer still owes:

1. **Task 5** — a paired-session browser test for `/` (see above).
2. **Task 6** — run and record the gate; add the missing captures; register them in
   `docs/evidence/screenshots/README.md`; update the spec's acceptance section.

Tasks 5 and 6 both touch `src/web/tests/e2e/` (a pairing case plus the full-suite run and
the capture fixture) and both need the spec file
`docs/superpowers/specs/2026-09-24-consumer-journey.md`. Prefer doing both in one pass.

## Plan 2 — `docs/superpowers/plans/2026-09-24-theme-thumbnails.md`

| Task | Deliverables | State | Evidence (file:line, symbol, sha) | What is missing |
|---|---|---|---|---|
| 1 — store and serve | `themes/thumbnails.ts` write/read `thumbnails/<id>.png` bounded >2 MiB, PNG-magic checked, never in the package; `GET /api/themes/:id/thumbnail` image bytes or 404 (never 500); `PUT /api/themes/:id` accepts an optional thumbnail, loopback only; tests absent/null, invalid refused, round-trip, deleted theme leaves no badge | **partial** | `packages/host/src/themes/thumbnails.ts:35` `createThumbnailStore` (bound :17, signature :20, `isPng` :28), wired `main.ts:124`; routes `server.ts:791-862` (GET 404 :804-807, `image/png` :809-813, loopback PUT :817-821, 413 :840-841); tests `thumbnails.test.ts:23,27,34,42,50,64` (sha `9176957`) | The route is **not** on `PUT /api/themes/:id` "alongside the package" — it is a separate `PUT /api/themes/:id/thumbnail` (`server.ts:817-848`) that accepts no package. The test "a deleted theme leaves no badge" has **no counterpart**: `ThumbnailStore.remove` (`thumbnails.ts:66`) has no production caller (grep: only `thumbnails.test.ts:67`), and `ThemeStore` exposes no delete at all (`themes/store.ts:21-25`), so there is no route or path that deletes a theme and therefore no stale-badge coverage |
| 2 — capture at save time | Editor save path renders the current theme **through the player's scene mount**, at the artboard size, fixed clock, fonts awaited, canvas → PNG; capture failure warns via `errorManager.warn` and never fails the save; tests (successful save includes bytes; a throwing capture still saves); rendered proof comparing the stored image against a separately rendered still | **partial** | Capture `editor/thumbnail-capture.ts:14` `captureThumbnail` (`canvas.toCanvasElement` :27 → PNG `:28-36`); save wiring `editor/editor-session.ts:497-529` — `captureThumbnail` :512, `client.saveThumbnail` :514 inside its own try, warn at `:516-521`; upload `theme-library-client.ts:84-99`; sha `9176957` | **The render is not the player's scene mount and not the artboard size**: it is the editor's own Fabric canvas at whatever size it happens to be (`thumbnail-capture.ts:8,21-27`, capped at 640 px). The plan's and spec's §31 claim ("the capture uses the player's render path, never a second renderer", `spec:38-43`) is not what the code does — no `static=1` path or player mount is invoked. Also missing: **no test at all** for capture — no `thumbnail-capture.test.ts`, and `editor-session.dom.test.ts:75-79,98,118` mocks a `libraryClient` with only `list/open/save`, so neither "save includes bytes" nor "a throw still saves" is asserted; the capture path runs in `host-player.spec.ts:69-93` but that case asserts only the "Saved to library" status (`:90-92`). The byte-fidelity comparison is absent (`grep thumbnail src/web/tests/` → nothing) |
| 3 — the library shows pictures | Library renders each theme's picture with its name, falls back to a name-only entry when the picture 404s; phone width: one column, image above the label; verify in a browser with three themes at both widths; capture and inspect | **partial** | `settings.html:204-217` `<img class="theme-shot" src="…/thumbnail">` with an `error` handler swapping in a same-size placeholder `:211-216`; label appended after the image `:221-237`; CSS `:87-107` (`flex-direction: column` means text is below the image as authored); sha `9176957` | The failed-image fallback is replaced by a **hatched rectangle** (`settings.html:98-107` `[data-placeholder]`), not the plain name-only listing the task states. There is **no phone-width layout rule**: the only `@media` in the file is `prefers-color-scheme: dark` (`:18`), nothing collapses `.theme-list` to one column, and `.theme-shot` is fixed at 96 px (`:89-97`). No e2e proves a 404 thumbnail degrades gracefully. The capture exists (`docs/evidence/screenshots/library-thumbnails.png`, from `9176957`) but is not registered in `docs/evidence/screenshots/README.md` |
| 4 — backfill older themes | A theme with no thumbnail gains one the first time it is opened in the editor **and saved**; the library states a picture is pending rather than showing a broken image; verify an older package lists without error and gains a picture after a save | **partial** | Listing without a picture is landed (404 → placeholder, `settings.html:211-216`; `host-settings.spec.ts:295-307` proves a pictureless theme lists). Backfill is Task 2's mechanism reached through `editor-session.ts:531-549` `#openLibrary`/`onOpenTheme` then `#saveLibrary` — **unverified**, no test covers open-then-save backfill | No "picture is pending" state anywhere — the nearest is the hatched placeholder div (`settings.html:98-107`, no text, `alt=""` at `:206`). No route or job reconstructs a thumbnail on library view (the spec's "on demand" clause, `spec:49-51`, and "refreshed … keyed to the package's own modified time", `spec:52`, are unimplemented: no `updatedAt`/mtime key appears near the thumbnail route, `server.ts:791-813`) |
| 5 — integration proof | six workspace gate commands; full local `test:e2e`; update `docs/architecture/ownership.md` and the spec's acceptance section; commit | **open** | `docs/architecture/ownership.md:41-42` names the two owners, but from `6908d9e`, a general split, not this plan. **Unverified**: the six commands and the full e2e on HEAD — not run | As written: the gate, the full e2e run, and spec-acceptance updates. `docs/superpowers/specs/2026-09-24-theme-thumbnails.md` is unchanged since `863d7ef` (its creation), so its Acceptance section (:80-91) records nothing observed; two of its lines (":83-84 a theme saved before this change gets one on first library view", ":84 editing and re-saving replaces its thumbnail") remain unimplemented as designed |

### Queue impact — theme-thumbnails

Landed 0, partial 4, open 1. An implementer would have to do, in order:

1. **Task 2 gaps** — decide the renderer: either make the capture use the player's scene
   mount at the artboard size with a fixed clock and awaited fonts (§31, `spec:38-43`), or
   amend the spec to state that the editor's canvas is the accepted source. Either way add
   the tests the task names (save includes bytes; a throwing capture still saves) and the
   stored-vs-separately-rendered comparison.
2. **Task 1 gap** — a delete path (route + `themeStore` removal) that also calls
   `thumbnails.remove`, or drop the "deleted theme leaves no badge" test from the plan.
3. **Task 3 gap** — a phone-width rule for the theme list/image and a browser test for the
   404 fallback; register the library capture.
4. **Task 4** — the "picture is pending" state, and the on-demand/refreshed capture the
   spec promises (or trim both from the spec).
5. **Task 5** — the gate, full e2e, doc and spec-acceptance updates.

Files two of those tasks would both touch: `packages/host/src/server.ts` (Tasks 1 and 4 —
the thumbnail route and any on-demand/mtime route), `packages/host/public/settings.html`
(Tasks 3 and 4 — the picture element and the pending state),
`packages/editor/src/editor-session.ts` (Tasks 2 and 4 — the save path both capture and
backfill use), and `docs/superpowers/specs/2026-09-24-theme-thumbnails.md` (Tasks 2, 4
and 5 — the renderer decision, the on-demand claim, and the acceptance record).

## Genuinely ambiguous

1. **theme-thumbnails Task 4** — the "on the first time it is opened in the editor and
   saved" backfill is entirely Task 2's mechanism, so it is unclear whether this task owns
   any code or only a verification; and the "states that a picture is pending" requirement
   is satisfied by the existing hatched placeholder only if you read that as the statement.
   Both readings change whether the task is partial or landed.
2. **theme-thumbnails Task 3** — "layout holds at phone width: one column, image above the
   label". No media query exists, but the flex column already puts the label under the
   image and the list is a single column by default, so whether an explicit rule is
   required is a judgement call; the fallback wording (placeholder vs "name-only entry")
   is a second such call.
3. **consumer-journey Task 1** — an unknown `?theme=` is forwarded to the player unchanged
   (`server.ts:1030-1045`) while the stored id is validated against the store. The plan's
   resolution order does not distinguish these, so whether this is by design or a gap
   cannot be settled from the code.
