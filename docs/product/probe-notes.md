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

## The editor reloads the Starter, so a reload is not a round trip

`File > Save to library`, then reload, shows the Starter again rather than the
saved theme (open vg-060). Any test that saves, reloads, and then asserts
something about the saved document is asserting about the Starter. Measure the
saved state through `GET /api/themes/<id>/document` in the same session instead,
or the reload will silently undo the thing under test.
