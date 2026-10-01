# Tester's probe notes

Findings an automation-driven pass produced that were about the instrument, not
the product. Kept because the next pass will repeat the same probes.

## A native dialog looks exactly like a dead command

Playwright auto-dismisses `window.prompt`, `alert` and `confirm`. A prompt that
is dismissed with `null` returns early in the handler, so the command produces
no download, no toast and no page error — the same signature as a button with no
handler at all. A native file chooser is worse: a script cannot observe it.

Measured on `File > Release package`: dismissed, it looked inert. With a
`page.on("dialog")` handler it prompts **"Release bump: major, minor or patch"**
(default `patch`), and answering `patch` downloads
`vigilia-demo-dashboard.vigilia-theme`. `File > Open package` opens a file
chooser the same way. The sibling `Save package` has neither, which is exactly
why comparing the three made the working ones look broken.

**Rule:** any finding of the form *a command does nothing at all* must first be
re-run with a dialog handler and a file-chooser handler before it is filed. See
the archived vg-064.

## It cuts both ways — check before filing, and check before retracting

A finding can also be *right about the product and wrong about the cause*. I
filed vg-062 (Insert > Text does not put the caret in the new object) from a
probe with no dialog handler, and it turned out to be a true defect that the
agent fixed — but my measurement of it was contaminated, and a re-run with a
dialog handler no longer reproduced the "typing goes nowhere" half. The caret
now goes in because of the fix, not because of the handler.

The practical order that avoids both errors:

1. Probe with `page.on("dialog")` **accepting** and a `filechooser` handler from
   the start. This is the cheap default and it removes the whole class.
2. If a probe claims nothing happened, re-run it under (1) before filing.
3. If a previously filed row claims nothing happened and is about to be worked,
   re-run it under (1) before spending an agent on it.

## A stale page against a restarted host looks exactly like a broken product

Hit on this pass, and it produced the most convincing false finding I came
close to filing. I had stopped the host to clean up and restarted it; the
browser still held a page from before. Opening the editor from that stale page
gave **zero layer rows, a completely empty inspector, and an uncaught
`Cannot read properties of undefined (reading 'width')`** — which reads as a
severe first-run defect, and the library really was empty at the time.

It was not a first-run defect. With the same empty library and a **fresh** page
load, four consecutive runs gave 52 layer rows, a populated inspector and zero
errors every time. The empty-panels state was the old page failing against a
host that had gone away and come back.

The tell is cheap: **wipe the library and load fresh, twice, before believing
any state that looks broken.** If it only reproduces on a page you already had
open, you are looking at your own harness, not the product. Note that this is
worse than the dialog trap, because a stale page also *renders* — the canvas
still drew the Starter, so the screenshot looked plausible.

## The editor reloads the Starter, so a reload is not a round trip

`File > Save to library`, then reload, shows the Starter again rather than the
saved theme (open vg-060). Any test that saves, reloads, and then asserts
something about the saved document is asserting about the Starter. Measure the
saved state through `GET /api/themes/<id>/document` in the same session instead,
or the reload will silently undo the thing under test.
