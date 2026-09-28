# Vigilia status

Updated: 2026-09-28
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

The plan's acceptance is met and the one measurement it carried as open is now
closed. What the user put in front of the work next is not a plan task: the
frosted card does not **read** as glass, and the four canonical glassmorphism
behaviours are the spec to make it read that way.

## Active work

- **Active plan:** [reference theme fidelity](docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md) — acceptance met, **ready to archive**; no task is open.
- **The live item is the glass, not the plan.** The user rejected the frosted card on sight — "just tinted, semi-transparent fill" — and supplied the four canonical glassmorphism behaviours as the specification.
- **Mapped against what shipped:** diffusion ✅ `blur(16px)`, edge ✅ `panelStroke`, **tint inverted** — `palette.frost` is 72 % opaque where the principle is a *very low* opacity — and **texture absent**: no grain anywhere in the renderer.
- **0012 landed.** The sampler reproduces `object-fit` now, so a panel blurs the photograph the element beside it is showing; the editor's 16.54 and the player's 5.08 both fall to the photograph's own 7.45.
- **Archived:** `2026-09-25-snapping-fidelity.md`, `2026-09-26-clock-and-theme-locale.md`, the GitHub-issues backlog — `docs/bugs/` is gone. Open [#2](https://github.com/peterng1618/vigilia/issues/2) is delete inside a group.
- **Unfinished from that same session:** the video frame-callback proof in `host-media.spec.ts` is written but carries a debug block and has never been run.

## Last completed change

- **`mediaDrawArgs` cropped the source to a window the size of the *device* rect and drew it 1:1**, so a panel blurred a pixel-for-pixel crop of the middle of the file while the element beside it showed all of it.
- `cover` now takes the largest source rect of the device rect's aspect and lets `drawImage` scale it into the whole device rect; `contain` takes the whole source at its fitted size — [0012](docs/decisions/0012-the-glass-samples-the-media-the-element-shows.md).
- **The divergence the plan carried as an open question was this.** The editor read 16.54 and the player 5.08 off the same band where the photograph itself measures 7.45, because the editor's 0.3744 camera addressed source columns 1036–1089 of a file the element was showing 686–881.
- **Both mounts now read 7.45**, each asserted against a control that reads the photograph with no product code in the path — the editor's assertion and the player's are the same claim on two mounts.
- The defect was invisible while every backdrop was authored as scene geometry or square-in-square, which is why a packaged photograph is what exposed it.

## Next

1. Look at the frosted card again before redesigning it: the last verdict was made against a sampler cropping the wrong part of the photograph, and 0012 changed exactly that.
2. Decide the tint's opacity and where a grain texture is authored and painted. It is a product call, and it is paid for in text contrast — name the price before building it.
3. Run the video frame-callback proof or drop it; `host-media.spec.ts` carries a finished fixture and an unfinished test.
4. Archive the plan, then the author-journey proof plan, then the font catalogue.
5. Then the queued specs.

## Blockers / unverified

- The glass question is open because nobody has looked at the card since 0012. Fixing the crop may change the verdict and may not; it has to be looked at, not argued from the old screenshot.
- The frosted CPU card's own `mr` handle does not track the pointer: a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is unproved on the player and provably not load-bearing there — `startHostedTheme` repaints at 30 fps. It is load-bearing in the editor.
- `library.ts` is 785 lines and its extraction into `library-devices.ts` is required before any future selection work; the `line` family applies `areaStyle` to the first series only (`charts/line.ts:254`).
