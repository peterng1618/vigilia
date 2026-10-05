# SDD ledger — plan: docs/superpowers/plans/2026-09-24-theme-thumbnails.md

Spec: docs/superpowers/specs/2026-09-24-theme-thumbnails.md

No prior ledger; every checkbox unticked, but the work substantially landed — all from commit `9176957`.
Recon on 2026-09-26 (`recon.md` under `2026-09-24-consumer-journey/`): **0 landed, 4 partial, 1 open.** The
zero is a strict reading — every task has its core in the tree and each is short of a specific clause.

| Task | State | What is actually there | What is missing |
|---|---|---|---|
| 1 — store and serve | partial | `themes/thumbnails.ts:35` `createThumbnailStore`; routes `server.ts:791-862`; tests `thumbnails.test.ts:23-64` | The route is `PUT /api/themes/:id/thumbnail`, not "`PUT /api/themes/:id` alongside the package"; `ThumbnailStore.remove` (`:66`) has **no production caller** and `ThemeStore` exposes no delete, so "a deleted theme leaves no badge" has nothing to test |
| 2 — capture at save time | partial | `editor/thumbnail-capture.ts:14`, wired `editor-session.ts:497-529`, upload `theme-library-client.ts:84-99` | The capture renders the **editor's own Fabric canvas**, not the player's scene mount the spec's §31 requires, and not at artboard size. No `thumbnail-capture.test.ts` exists; neither "save includes bytes" nor "a throw still saves" is asserted |
| 3 — the library shows pictures | partial | `settings.html:204-217` image + error fallback, `:87-107` CSS | Fallback is a hatched rectangle rather than a name-only entry; no phone-width media query (the only `@media` is dark mode, `:18`); no test for a 404 thumbnail; `library-thumbnails.png` is unregistered |
| 4 — backfill older themes | partial | Listing without a picture works (`settings.html:211-216`; `host-settings.spec.ts:295-307`) | No "picture is pending" state; backfill (open-then-save) untested; the spec's on-demand and mtime-keyed refresh (spec `:49-52`) unimplemented |
| 5 — integration proof | open | — | Gate, full suite, spec Acceptance (`:80-91`) untouched since creation `863d7ef` |

## Rulings taken before dispatch

**Ruling (Task 3, layout): the phone-width clause is already satisfied by construction; do not add a redundant
media query.** The task asks that "layout holds at phone width: one column, image above the label". The list is
a single column by default and the card is already `flex-direction: column` (`settings.html:87-107`), so the
label sits under the image with no rule needed. Adding a media query that restates the default would be
decoration. **Cost if wrong:** a genuine narrow-width overlap that the browser suite's phone project will show
as a failure — cheap to find, and the acceptance item requires a browser check anyway.

**Ruling (Task 3, fallback): the hatched placeholder is accepted as the fallback.** The task says a name-only
entry; the code swaps in a same-size hatched rectangle keeping the name below it. The author-visible purpose —
the grid does not break and the entry still reads as a theme — holds, and the difference is cosmetic. **Cost if
wrong:** one visual-polish change to `settings.html`, against a consumer seeing a hatch instead of a plain row.

**Ruling (Task 1, deleted-theme clause): drop it from the plan.** The plan asks for a test that a deleted theme
leaves no badge, but no delete path exists anywhere — `ThemeStore` has no delete and nothing calls
`ThumbnailStore.remove`. Inventing a theme-delete route to satisfy a test clause is building a feature to reach
a test. **Cost if wrong:** if a delete route is added later, `remove` is already written and the test is three
lines; nothing is lost by deferring it.

## Recon folded — five ordered gaps, all short one clause (2026-09-26)

The recon table at the top of this ledger is the state. Reading it as one ordered work list, because
the gaps have dependencies and dispatching them out of order would build the same file twice:

1. **Task 2's renderer decision** — the capture uses the editor's own Fabric canvas
   (`editor/thumbnail-capture.ts:8,21-27`, capped at 640 px), not the player's scene mount at the
   artboard size, which spec §31 (`spec:38-43`) requires. Either make the capture use the player's
   mount with a fixed clock and awaited fonts, or amend the spec to name the editor canvas as the
   accepted source. **Also owed regardless of that choice:** there is no test at all for capture —
   no `thumbnail-capture.test.ts`, and `editor-session.dom.test.ts:75-79,98,118` mocks a
   `libraryClient` with only `list/open/save`, so neither "a save includes the bytes" nor "a throwing
   capture still saves" is asserted. `host-player.spec.ts:69-93` exercises the path but asserts only
   the status text.
2. **Task 4** — the "picture is pending" state, and the spec's on-demand/mtime-keyed refresh
   (`spec:49-52`), both unimplemented. This touches `server.ts` and `settings.html`, the same files as
   3 — do it in the same dispatch.
3. **Task 3** — a browser test for the 404 fallback, and registering `library-thumbnails.png` in
   `docs/evidence/screenshots/README.md`.
4. **Task 1** — ruled dropped (see below).
5. **Task 5** — the gate, full e2e, and the spec's Acceptance annotation (`:80-91`, untouched since
   creation `863d7ef`). Two of its lines (`:83-84` first-library-view backfill, `:84` re-save replaces
   the thumbnail) remain unimplemented as designed.

**Rulings already taken (above, unchanged):** the phone-width clause is satisfied by construction — no
redundant media query; the hatched placeholder is accepted as the fallback; Task 1's deleted-theme
clause is dropped because no delete path exists (`ThemeStore` has no delete, `ThumbnailStore.remove`
at `:66` has no production caller).

**Ruling: Tasks 2, 3 and 4 dispatch as one wave, in that order, then Task 5.** They share
`server.ts` (2 and 4), `settings.html` (3 and 4) and `editor-session.ts` (2 and 4); splitting them
would put three implementers on two files. Cost if wrong: one larger wave to review, against three
serialized dispatches re-reading the same code.

**Sequencing:** after the snapping plan's active task, and after the browser suite is free — Task 3's
404-fallback test and Task 5's full e2e both need it.
