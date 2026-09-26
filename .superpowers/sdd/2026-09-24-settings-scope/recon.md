# Recon — two plans, real state from the code

Read-only. Nothing modified. Every claim carries a `file:line` or a commit sha.

## Plan 1 — `docs/superpowers/plans/2026-09-24-authoring-time-run-placeholders.md`

All five boxes unticked in the plan file (`:42-85`). The code says otherwise:
Tasks 1–3 landed in a single commit.

| Task | Deliverables | State | Evidence (file:line, symbol, commit sha) | What is missing |
|---|---|---|---|---|
| 1 — The placeholder rule | `run-placeholder.ts` + `.test.ts`; three distinct states | **landed** | `src/web/packages/editor/src/run-placeholder.ts:32` `runPlaceholder`, `:55` `toAuthoringSegments`, `:15/:18/:20` `PLACEHOLDER_PREFIX`/`RunDisplayMode`/`DEFAULT_RUN_DISPLAY_MODE`; test at `run-placeholder.test.ts` (three pairwise-distinct assertions, `:23`, `:42-44`); commit **51023c2** | — |
| 2 — Paint runs in the authoring mode | editor runtime swaps value-run text for the token, both modes, editor canvas only | **landed** | `src/web/packages/editor/src/live-runtime.ts:20` `#runDisplay` (default tokens), `:61-68` `applyAuthoredText(..., transform: toAuthoringSegments)` guarded by the mode, `:77-80` values mode reapplies authored text; `scene-fabric/src/fabric-text.ts:118` `applyAuthoredText` (`:107` comment: display never supplies it); exported `scene-fabric/src/index.ts:32`; unit tests `live-runtime.dom.test.ts:9,55,98`; commit **51023c2** | — |
| 3 — The control | View-menu "Value runs: tokens / values", default tokens, session-only | **landed** | `editor/src/editor-shell/shell-layout.tsx:196` `useState<RunDisplayMode>("tokens")`; `editor/src/editor-session.ts:48` import, `:412` `runDisplay()`, `:416` `setRunDisplay`; `session-facade.ts:38-39`; `editor-main.ts:60` `runDisplay: () => active?.extensions.runDisplay() ?? "tokens"`; copy `ui-copy.ts:78-80` `valueRuns`/`tokens`/`values`; e2e drives it `tests/e2e/editor.spec.ts:313,325,1012-1016`; commit **51023c2** | — |
| 4 — Prove display untouched (host player) | player through the real host shows value/gap, never a token; "add the token case" to the player spec | **partial** | Structural protection landed: `fabric-text.ts:107` notes a display never supplies the transform, and the player path (`selection-inspector/runs.ts:147` uses `bindings: {}`, no `transform`) proves the switch is editor-only. But `tests/e2e/host-player.spec.ts` (371 lines) has **no** token/placeholder case — `git log --oneline -- tests/e2e/host-player.spec.ts` ends at unrelated commits (`e56f890`, `13a3cef`, `d187f26`), none from 51023c2 | The token-negative player assertion the task names is not written. Declared boundary is real but not browser-proven. |
| 5 — Integration proof | broad gate; full e2e; capture 3 authoring states + player; update `ownership.md` and spec | **partial** | Capture exists and is registered: `docs/evidence/screenshots/authoring-tokens.png` added in **51023c2** (moved to `docs/evidence/` by **bd20b26**); `docs/architecture/ownership.md:38` "Authoring-time value-run tokens → `editor/src/placeholder`" present (added in **6908d9e** docs reorg). Gate (format/lint/typecheck/test/build/size) and full e2e: **unverified** — not run, and no artefact records them. Spec has no landing annotation (`git log -- specs/...run-placeholders.md` shows only creation **4a6fc7f**) | Only one capture (tokens state), not the three authoring states plus the player state the task lists. Gate + full e2e unverified. Spec not annotated as landed. |

### Plan 1 — Queue impact

**Not ready to archive.** Two tasks owe work:

- **Task 4** — add the token-negative case to `src/web/tests/e2e/host-player.spec.ts`: load a theme through the real host with a bound value run and assert the rendered display shows a value or gap, never `@…`.
- **Task 5** — run the broad gate + full `npm run test:e2e`, capture the three authoring states and the same theme in the player, annotate the spec's acceptance section.

Files two open tasks would both touch: **none** — Task 4 owns only `tests/e2e/host-player.spec.ts`; Task 5's edits are docs + a runtime gate over everything.

---

## Plan 2 — `docs/superpowers/plans/2026-09-24-settings-scope.md`

All 19 boxes ticked (plan `:44-85`). Checked against the code: **the ticks are true.** Landed in two commits — **eacaea2** (`feat(host): separate global settings from a theme's own questions`) and **fd5cbf8** (`test(host): drive the settings page, and publish every assignment change`).

| Task | Deliverables | State | Evidence (file:line, symbol, commit sha) | What is missing |
|---|---|---|---|---|
| 1 — Per-theme answers, stored | `theme-settings.ts` read/write per theme id, validating groups + ids; tests | **landed** | `src/web/packages/host/src/settings/theme-settings.ts:15` `ThemeAnswers`, `:17` `ThemeSettingsStore`, `:33` `normalizeAnswers` (drops unknown groups / unsafe ids, `:41`), `:74` `createThemeSettingsStore`, `:101-107` `remove` for a deleted theme; tests `theme-settings.test.ts` (absent, round-trip, unknown groups, stale removal, bad id, corrupt file); commit **eacaea2** | — |
| 2 — Global settings unaffected by theme | Global section renders every machine slot, states applicability, no theme read | **landed** | `src/web/packages/host/public/settings.html:130-137` devices section with the "apply to every theme, unless a theme asks for something different" hint (`:133`); rendered from `availableDevices()` in `server.ts:396`; e2e `tests/e2e/host-settings.spec.ts:90` ("keeps this PC's devices on screen whatever theme is shown"); commit **eacaea2** | — |
| 3 — Ask a theme's questions when first chosen | Only the slots it reads, one question each, global as default; four states | **landed** | `settings.html:153-157` hidden questions section, `:181` `themeAnswers`, `:299-339` render/choose/save flow; `server.ts:669` `requiredDevices: requiredDeviceGroups(...)`; route `server.ts:745-776` (`GET`/`PUT /api/themes/:id/answers`); `required-devices.ts` untouched, serves only this section; e2e `host-settings.spec.ts:247` (question once), `:295` (theme reading nothing) | — |
| 4 — Resolve theme over the global answer | theme → global → provider default at the one assignment boundary; override isolated; unanswered follows global | **landed** | `server.ts:359-389` `currentAssignment` — `pick = perTheme[group] ?? stored.assigned[group]` (`:376-378`); tests `packages/host/src/server.test.ts:844` ("overrides the global choice for its theme, and tells the providers" — asserts `{systemDisk:"disk-d"}` for its theme, `{systemDisk:"disk-c"}` for another at `:875`), `:878` ("publishes the assignment a chosen theme implies"); store wired `main.ts:20,125`; commit **fd5cbf8** | — |
| 5 — Integration proof | broad gate; full e2e; capture 4 states + Global; update `README.md`/`ownership.md` and spec | **partial** | Docs **landed**: `docs/architecture/ownership.md:106` "A theme's own device answers → `host/src/settings/theme-settings.ts`"; `docs/architecture/README.md:121` same row plus `:125` delegates the theme→global→provider resolution; both added by later docs commits (**6908d9e**, **bd20b26**) after eacaea2. Captures: in-repo `.agents/screenshots/settings-scope.png` (eacaea2); tracked `docs/evidence/screenshots/settings-theme-question-desktop-chromium.png` registered `docs/evidence/screenshots/README.md:51`. Gate + full e2e: **unverified** (not run). Spec acceptance section: **unverified** — `specs/2026-09-24-settings-scope.md` last touched at creation (**73ad33d**), no landing annotation | Gate and full-suite runs not recorded; spec acceptance not annotated. Capture covers the one-slot theme question, not all four states named. |

### Plan 2 — Queue impact

No implementation work owed. All four product tasks are landed and wired: storage (eacaea2), the global invariant + the asking (eacaea2, with the resolver at `server.ts:376`), the resolution and its two-direction test (fd5cbf8), and the named docs. Two things are only *process* claims, not code: the broad gate/full e2e were not run here, and the spec's acceptance section was never annotated after 73ad33d. The one capture on disk is the single-slot question, not the four-state set.

Recommendation: **ready to archive** once the plan owner confirms the gate was run at the merge boundary; the spec acceptance annotation is the one concrete gap. No open task and no shared file — nothing an implementer must pick up.

---

## Ambiguous / unverified

- **Plan 1, Task 4** — the plan says "add the token case" to the existing host-player spec, but no such case exists in `host-player.spec.ts`. The boundary is structurally enforced (`fabric-text.ts:107`), so this could be read as "already proven elsewhere" — it is not proven by a browser test. I called it **partial**, not landed.
- **Plan 2, Task 5** and **Plan 1, Task 5** — both tick/claim the broad gate and full e2e. Not run under this read-only mandate and no artefact records them: **unverified**, not "landed".
- **Plan 2 spec acceptance** — the task says update the spec; the spec file has no post-implementation commit. Whether "update" was satisfied by the docs rows alone is ambiguous; I report **unverified**.
