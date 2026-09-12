# ADR-0006 — Sequence the .NET host after the frontend milestones

- **Status:** Accepted
- **Date:** 2026-09-12
- **Supersedes:** the gate ordering in §158 of the design document, for
  *sequencing only* — not the content or the acceptance criteria of any gate
- **Decided by:** the agent, with delegated authority from the user, on
  2026-09-12: "move everything related to the C# backend to a later milestone so
  earlier milestones aren't being blocked."

## Context

§158 orders the gates 0 → 5, with Gate 3 ("Live display") carrying the provider
registry, the Windows and API providers, the custom-sensor wizard, pairing and
reconnect. All of that is C#.

**No .NET code in this repository has ever been compiled.** The development
machine has no .NET SDK — only the EOL 6.0.35 runtime — so every `dotnet`
command fails, and `src/Vigilia.*` plus `tests/Vigilia.*` are
authored-but-unbuilt. The CI job that would build them is paused for the same
reason.

Read strictly, that blocks Gate 3 and everything after it. Read as written, it
also *stalls* work that has no dependency on the host at all: the renderer, the
theme format, the editor, packaging and the display path have progressed to 472
unit tests and 76 browser tests without a single line of C# executing.

The two halves are genuinely separable, and the seam already exists in code:
`SampleSource` is the only thing the renderer knows about live data. The player
is fed by `@vigilia/fake-source` today and by a SignalR client later; that is a
two-line change in `packages/player/src/main.ts`.

## Decision

Sequence the work **frontend-first**, and treat the .NET host as a later
milestone rather than a mid-sequence one.

Working order from here:

| Order | Work | Depends on a .NET SDK? |
|---|---|---|
| 1 | Document, renderer, display path (Gate 1) | No |
| 2 | Authoring: editor, inspectors, presets (Gate 2) | No |
| 3 | Reuse and packages: widgets, theme packs, import/export (Gate 4) | No |
| 4 | **Host and live display** (Gate 3) | **Yes** |
| 5 | Release (Gate 5) | Yes |

Nothing about any gate's *content* changes. Gate 3's acceptance criteria — real
sensors, provider replacement without theme edits, secret redaction,
subscription sharing, slow clients — stand exactly as §158 states them. Only
their position in the queue moves.

Two rules keep this from becoming an excuse:

1. **The frontend does not fake the host's job to stay unblocked.** §116 assigns
   acquisition to the PC, and `@vigilia/fake-source` exists to develop the
   display path, not to substitute for a provider. It stays a dev-and-test
   package, it must never be a dependency of a shipped bundle, and while it is
   wired up the player says on screen that the data is synthetic (§97).
2. **Unbuilt C# is not counted as progress.** It is reported as
   authored-but-unbuilt everywhere it appears — in `dev-status.html`, the
   handoff and this ADR — and first-build errors are expected when an SDK
   arrives. Writing *more* of it before it can compile would add unverified
   surface, which is why the existing unbuilt code is named as the largest risk
   in the repository.

## Consequences

- **Three milestones become workable that were previously described as
  blocked.** Gate 2 in particular was blocked twice over — once on the editor
  decision (now [ADR-0005](0005-own-the-editor-layer.md)) and once on this
  ordering.
- **The client half of Gate 3 can still proceed**, because it does not need the
  server to exist: the sample-source contract, bounded history with reconnect
  replacement, and status handling are done and tested. What waits is the wire
  format and the transport — and the wire format is precisely the part that
  should not be invented against a server nobody can run, since the C# ↔
  TypeScript mirror is already the highest-risk edit here.
- **The risk moves later, it does not shrink.** A host that has never compiled
  will produce a cluster of failures whenever it is first built, and the frontend
  will by then have made assumptions about a protocol it cannot test. The
  `contracts-mirror` guard exists for exactly that seam; it is a mitigation, not
  a cure.
- **Gate 0 remains partly open regardless**, because its open items are
  human-only: naming reference hardware (§126), running the elevation and
  anti-cheat probes on real hardware, and agreeing the engine-gap alternatives
  (§85). Those are unaffected by this ordering.
