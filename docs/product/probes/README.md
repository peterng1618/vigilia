# Probes

Scripts a testing-as-human session reuses. Not a test suite — these are the
instruments, kept because rebuilding them is slow and because each one encodes a
lesson that is easy to relearn the hard way.

See [`../tester-runbook.md`](../tester-runbook.md) for the session procedure and
[`../probe-notes.md`](../probe-notes.md) for the traps these exist to prevent.

## Running them

They drive a browser over CDP against a private host. Set that up first — the
runbook's §0 has the exact commands, and the reason is that two agents sharing a
host, a theme library or a browser produce findings about *each other*.

```bash
# 1. host, on a port and themes dir of your own
node packages/host/bin/vigilia.js --no-browser --port 5311 \
  --app-dir <scratch> --themes-dir <scratch>/themes

# 2. chromium with a debugging port of your own
chrome.exe --remote-debugging-port=5312 --user-data-dir=<scratch>/chrome-profile \
  --no-first-run --no-default-browser-check about:blank

# 3. run a probe
node <scratch>/cdp.mjs <this-folder>/longtask.mjs
```

`cdp.mjs` is the harness the others expect to sit beside. **Keep its dialog
handler.** Playwright auto-dismisses `window.prompt`, and a dismissed prompt
returns early with no download, no toast and no error — the exact signature of a
button with no handler. That cost a false finding once.

| File | What it is for |
|---|---|
| `cdp.mjs` | The harness. Connects over CDP, picks the editor page, and records every dialog into `seenDialogs`. |
| `restore.mjs` | Resets the test library by re-saving the Starter from the editor, then verifies. The cheapest reset there is; run it between probes. |
| `maximize.mjs` | Maximizes the window. It is the intended editor size — a 1024-wide viewport is a real authoring condition, but test it deliberately rather than by default. |
| `document-vs-ui.mjs` | Diffs what the host stored against what the editor shows. **Start here.** Every worst defect on this product was that disagreement. |
| `instrument-control.mjs` | Installs the thing you claim is missing and proves the probe fires. Only then does silence mean absence. Run before filing any "it does nothing". |
| `longtask.mjs` | Turns "it feels sluggish" into numbers: main-thread blocks over 50 ms, the share of a human-paced interaction spent blocked, **and** how many times a text object was re-measured in a fixed idle interval. The counts are the ones to read: a share on this editor has read 4% and 46% for the same code minutes apart, because four agents were building into the bundle under it. |

## Why these three probes and not more

A session leaves behind hundreds of scripts and almost none are worth keeping —
the value is in the answer, not the script, and the answers are in the backlog
rows with their measurements. These four are the ones where the *technique* is
the reusable part: comparing against ground truth, proving the instrument, and
converting a subjective complaint into a measurement.

Add to this folder only when a probe has been used to reach a conclusion you
would otherwise have had to re-derive. A probe kept for its own sake is dead
weight that the next session has to read past.
