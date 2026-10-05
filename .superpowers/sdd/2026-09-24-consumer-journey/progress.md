# SDD ledger — plan: docs/superpowers/plans/2026-09-24-consumer-journey.md

Spec: docs/superpowers/specs/2026-09-24-consumer-journey.md

No prior ledger; every checkbox unticked. State established from the code by a read-only recon pass on
2026-09-26 (`recon.md`, same directory): **4 landed, 1 partial, 1 open.**

| Task | State | Evidence |
|---|---|---|
| 1 — the host remembers an active theme | landed | `settings/active-theme.ts:20` (`c46ecf7`), wired `main.ts:113,130`; resolution `server.ts:1018-1053`; route `server.ts:643-708`; tests `active-theme.test.ts:20-52` |
| 2 — derive what a theme needs configured | landed | `settings/required-devices.ts:38`, tests `required-devices.test.ts:22-61`. **Landed by the settings-scope plan (`73ad33d`), not by this one.** |
| 3 — the library section | landed | `settings.html:125-129`, `:183-249`, `:342-358`; author in payload `themes/store.ts:58-62`. A real thumbnail later replaced the plan's "line naming what the theme displays" (`9176957`) |
| 4 — ask only what the active theme needs | landed (superseded) | Feature + tests live in the **per-theme section**, not the Devices section: `settings.html:153-157`, `:251-293`; route `server.ts:746-789`; tests `host-settings.spec.ts:247-307` |
| 5 — a paired display follows the host | **partial** | The host resolves `/` for whoever may read it (`server.ts:1018-1053`, gate `:426-432`). No paired-session test: nothing passes a token to `/`, and no test covers the non-loopback read |
| 6 — integration proof | **open** | `docs/superpowers/specs/2026-09-24-consumer-journey.md` unchanged since `ce716f5`, so its Acceptance section `:100-112` records nothing observed |

## Ruling: Task 4 is landed and its Devices-section wording must NOT be restored

The plan's Task 4 says the **Devices** section shows a group only when the active theme binds it. That
behaviour was implemented and then **deliberately reverted** by the settings-scope plan: `settings.html:419-421`
renders every group the machine has, and `host-settings.spec.ts:90-115` is the revert's regression test,
introduced by `73ad33d` ("filtering the machine's own settings by the active theme hides a drive the consumer
chose"). `docs/architecture/README.md:123` forbids a global setting reading the active theme. The per-theme
questions section that replaced it is owned by `specs/2026-09-24-settings-scope.md`.

So the requirement survives, in the right owner, and the plan text is the stale half. **Cost if wrong:** an
implementer restoring the plan's wording would reintroduce a defect the project already found and fixed, and
would break a landed regression test — loudly, which is why this is safe to rule on rather than ask about.

## Open work

**Task 5** — one paired-session browser test: pair, then read `/` from a non-loopback peer path and assert the
host's active theme is served. The code path exists; only the proof is missing.

**Task 6** — the six-command gate and the full browser suite on this state, the missing captures (library with
several themes; a theme needing no configuration) registered in `docs/evidence/screenshots/README.md`, and the
spec's Acceptance section annotated with what was observed.

`settings-themes.png` and `choose-theme.png` already exist in `docs/evidence/screenshots/` but are **not
registered** (`README.md:51-56` lists only `settings-theme-question`) — so Task 6's registry work is partly
catching up with captures an earlier task wrote.

Tasks 5 and 6 both touch `src/web/tests/e2e/` and the spec, so they run as one pass, Task 5 first.

## Recon folded — Task 5 and Task 6 are the only open work, and they are one pass (2026-09-26)

`recon.md` in this workspace establishes the state from the code at `2929f87`. Summary:

- **Tasks 1, 2, 3 landed.** Task 2's `required-devices.ts` was added by the **settings-scope** plan
  (`73ad33d`), not by this one; Task 3's library section landed and was later given a real thumbnail
  (`9176957`), so its "line naming what the theme displays" was materially replaced.
- **Task 4 landed but deliberately superseded.** The per-theme questions section
  (`settings.html:153-157`, `:251-293`; `GET /api/themes/:id/answers` at `server.ts:746-789`) replaced
  the Devices-section filtering this task asked for, and `73ad33d` added the *revert* regression test
  (`host-settings.spec.ts:90-115`) with the reason "filtering the machine's own settings by the active
  theme hides a drive the consumer chose". `docs/architecture/README.md:123` forbids a global setting
  reading the active theme. **Do not restore this Task 4 wording** — the queue ruling stands.
- **Task 5 partial.** Path A landed (the host resolves `/` for anyone allowed to read it,
  `server.ts:1018-1053`, gate at `:426-432`). Path B — "with a session token" — is unproven: nothing
  passes a token to `/`, `host-player.spec.ts` never exercises `/api/pairing`, and the
  "unless `/api/pairing`" carve-out at `:446-447` means no test covers the non-loopback `/` read.
- **Task 6 open.** No gate run, no captures for "library with several themes" or "a theme needing no
  configuration", and the spec's Acceptance section (`:100-112`) is unchanged since its creation
  `ce716f5`. Two captures exist on disk (`settings-themes.png`, `choose-theme.png`) but are **not
  registered** in `docs/evidence/screenshots/README.md` — which the capture rule requires.

**Ruling: Tasks 5 and 6 are one dispatch, not two.** Both touch `src/web/tests/e2e/` (a pairing case;
the full-suite run and the capture fixture) and both need the same spec file. Splitting them would put
two implementers on the same two files for no benefit. Cost if wrong: one larger dispatch, against two
serialized dispatches that each re-establish the same context.

**Sequencing:** after the snapping plan's Task 2 commits — the browser suite is serial
(`VIGILIA_CAPTURE=1 --workers=1`) and must not contend with another plan's e2e work.
