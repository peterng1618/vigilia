# Vigilia status

Updated: 2026-09-29
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

Prove the author journey from blank to a finished theme by hand, through the UI
alone. The composition exists because a generator emitted it; rebuilding it by
hand is what finds the authoring control that is missing.

## Active work

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md), executing in subagent mode. Phase 0 is three product changes; **Task 1 (artboard presets) has landed** — the module and its unit test, then the inspector wiring.
- **The rule that governs the whole pass:** fix what you find using what the repo already decides — owner, idiom, copy, existing control pattern — and move past it. A property not exposed, a misaligned layout, something hard to read, a non-Lucide icon: each is fixed, not noted. Only a genuine product unknown with no precedent is recorded and passed over. **Nothing waits on a human.**
- **Product decisions, recorded in the plan:** minimal blank palette; starter stays a library template; artboard chooser over 16:9, 19.5:9 and 4:3, both orientations, at 1080p/2K/4K named on the **short edge**, driving the inspector's artboard controls too. The starter keeps its own 1672 × 941 — 16:9 is its *ratio*, and the presets are a separate list.
- **[The 2026-09-24 author-journey plan](docs/superpowers/plans/2026-09-24-author-journey.md) is not dispatchable and is not the active plan.** Tasks 1–5 shipped, Task 2 mis-owns alignment/wrap/overflow, and the reference-theme surface is absent from it.
- **The glass verdict is still the user's to give.** [0013](docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md) carries the measurement behind every choice in it; the proof will rebuild that card by hand.

## Last completed change

- **F1.24: a provider's reason is redacted where it is composed.** `redactForBrowser` sits in `provider.ts` — the file whose `ProviderHealth` comment already said *"messages may reach a browser and must be redacted"* — and both providers call it before the string becomes a message. Decision note [0014](docs/decisions/0014-a-provider-reason-is-redacted-where-it-is-composed.md).
- **What it removes is the machine, not the diagnosis.** A URL, a `host:port` and a filesystem path become *"its configured address"* — the exact phrase `a34b838`'s player net already substitutes, so the two layers cannot disagree. `connect ECONNREFUSED` and `ENOENT` stay: a display that says only "no reading" has learned nothing a person can act on.
- **The sentence is unchanged, so the player's grouping is untouched.** `lhm.ts` still composes one reason per cause; the player's seven tests pass unmodified and its net stays as the net it was written to be.
- **Probed each real error string** rather than assuming: LHM gives `connect ECONNREFUSED 127.0.0.1:8085` and host-authored `LHM answered 500`; `systeminformation` gives `spawn C:\Windows\System32\wbem\WMIC.exe ENOENT`. A `\b` does not work before a `/`, so the anchor is a lookbehind — which also leaves `2026/09/29` alone, and `2340:1080` and `19.5:9` are a test, not a hope. 2070 unit tests green; `typecheck`, `lint`, `format:check` exit 0. Red-without-fix: the sample message carried `127.0.0.1` and `WMIC.exe`.

## Next

1. Execute the proof plan in subagent mode; the rebuild is one author's hands and cannot be split across workers.
2. Look at the frosted card in both mounts and say whether it reads as glass — the proof rebuilds that card by hand and will show it again.
3. Then the font trio catalogue, then the queued specs.

## Blockers / unverified

- [#7](https://github.com/peterng1618/vigilia/issues/7) is open against the active pass: the `Ctrl+N` discard prompt on a saved document, cause not established and pre-existing.
- The frosted CPU card, twice: the glass verdict is unverified by definition (no agent can see whether a panel reads as glass, and the last human judgement came from a sampler cropping the wrong part of the photograph), and its own `mr` handle does not track the pointer — a resize aiming 10 units right landed 4.24 units left, where the same gesture on the un-frosted RAM card landed on the neighbouring edge. Task 5-shaped, open, in `task-7-report.md`.
- Task 9's three open edges, named: the `Promise.allSettled` split frame, the POSIX drive→volume join proven only on Windows, and `storage-card-value`'s box ending 28 units past its card.
- The video frame callback is now measured on the player and provably not load-bearing there — 92 render requests already became 40 renders with it removed. It is load-bearing in the editor, which nothing browser-tests.
- The crop strip is measured once at mount, not per frame: Fabric does not move objects on a data refresh, and re-measuring every 30 s would only cost. A theme whose *authored* geometry changed under a running display would not re-notice — no such path exists today.
