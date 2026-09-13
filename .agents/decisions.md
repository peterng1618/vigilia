# Decisions

Every architectural decision, **current position only**. A reversed decision is
rewritten here rather than kept alongside its replacement — the full text of
each original is in git history if the reasoning is ever needed.

Feature-level decisions live in the spec for that feature, not here.

---

## Settled

### The host is Node/TypeScript, shipped as a CLI

Same npm workspace as the renderer, published binary `vigilia-dashboard`.

The C# host never compiled; a Python draft produced no code. Node wins on one
argument that outranks the rest: **the wire contract and the theme types live in
one place and both ends import them.** A C# host meant hand-mirroring `Sample`
and `SensorDescriptor` into TypeScript, where a change compiles cleanly on both
sides and produces wrong values at runtime. That defect class no longer has
anywhere to live.

`src/Vigilia.*`, `Vigilia.slnx` and `global.json` are dead and slated for
deletion. **Do not install a .NET SDK or Python to unblock anything.** `dotnet`
exists with only an EOL 6.0.35 runtime and its error reads like a broken command
rather than a missing SDK.

Plain `vigilia` on npm is an unrelated package — `npx vigilia` fetches a
stranger's CLI and crashes.

*Supersedes: target .NET 10; sequence-the-.NET-host-after-the-frontend (whose
ordering stands — the host was built last and took a different runtime
entirely, which would have been a rewrite on top of three milestones of
dependent work).*

### The editor is a layer over the renderer, not a canvas editor

Both Fabric candidates were rejected: they are canvas editors, this renderer is
DOM plus ECharts, so adopting either meant rendering the scene twice — which §31
forbids. The editor adds interaction and an inspector **over** `renderer-core`,
so there is one renderer and no editor/display drift.

**Do not add a Fabric dependency.**

The durable lesson from that evaluation: test a foundation against the
constraint that would disqualify it, first.

### Two sensor tiers, discovered and never hardcoded

Baseline works with no driver and no elevation. Extended needs PawnIO and may
legitimately be unavailable. A provider reports what it can actually read on the
machine it is running on; an unavailable sensor is `Unavailable` with a reason,
never a zero and never a guess (§97).

This is why per-sensor elevation probing was dropped as a gate item — a table
established up front for one machine is a table the provider then has to
contradict at runtime.

### LibreHardwareMonitor is external, and its stable line is preferred

LHM runs as a **prebuilt executable** read over its local HTTP endpoint. Vigilia
does not reference or compile `LibreHardwareMonitorLib`.

The stability argument stands even though the NuGet pin is gone: LHM publishes a
handful of stable releases against a continuous prerelease stream, and tooling
resolving "latest" picks up a prerelease. A monitoring tool whose sensor
coverage changes silently between builds makes every "unavailable" report
untrustworthy.

Because LHM is external, its version is a property of the user's machine. Vigilia
cannot pin it — only detect what it found and say so. Not implemented yet; spec
0010 has the contract.

### Performance budgets are not tracked yet

Dropped 2026-09-13: nothing built is resource intensive. The host polls
`node:os` once a second for a handful of keys; the display renders a bounded
scene from a bounded buffer.

This deviates from §126, which requires budgets on named reference hardware —
see [`status.md`](status.md).

**The caveat, because it is the whole point of a budget:** it exists to catch
the regression nobody predicted. Two on the roadmap plausibly cost something —
the LHM provider reading a full sensor tree every cycle, and a 600-point line
chart on a low-end phone. Reinstate this the moment anything starts costing.

---

## Open — need a human

### Two §85 engine gaps

§85 requires explicit human agreement on an alternative wherever the engine
cannot draw what the theme format expresses. Two remain:

- **Gauge gradients.** ECharts cannot draw a true angular gradient, so the arc
  is approximated in segments (`gradientSegments`, default 64). Accept the
  approximation, or change what the format permits.
- **Line thresholds.** Discrete threshold bands on a line series have no direct
  engine equivalent.

Both now gate the gradient work, since spec 0011 D9 defines the gradient token
and §85 governs what can honestly be drawn from it.

### Anti-cheat coexistence, unanswered rather than closed

Whether PawnIO being loaded causes problems with Vanguard, EAC or BattlEye was
dropped as a gate probe and moved to the provider's concern. **The risk did not
move with it.** If a conflict exists, it surfaces on a user's machine rather
than in a checklist.

---

## Resolved by a later spec

- **Chart colours could not reference a global** (was G2-D1). A chart `Fill`'s
  colour was a plain string, so no chart could follow the palette and §170's
  dark/light overrides were unreachable for any theme with a chart. Spec 0011
  D3 and D9 settle it: colour and gradients are theme-level tokens, and a chart
  references them. Pending implementation in schema v2.
- **Editor property model** — which entity carries which property, colour and
  typography ownership, the gradient shape, the identifier merge. All in
  [spec 0011](specs/0011-editor-property-model.md) D0–D10.
