# ADR-0007 — Host in Node/TypeScript, shipped as an npm CLI

- **Status:** Accepted
- **Date:** 2026-09-13
- **Supersedes:** [ADR-0002](0002-target-net10.md) (target .NET 10) entirely;
  [ADR-0003](0003-pin-stable-lhm-not-prerelease.md) in its *packaging* only —
  its stability reasoning survives, its NuGet pin does not; the language choice
  in draft spec
  [`0009`](../../.agents/specs/0009-python-telemetry-host-and-sensor-providers.md)
  (Python), which never reached `accepted` and never produced code
- **Decided by:** the agent, with delegated authority, on 2026-09-13, after the
  user reviewed [9router's CLI host](https://github.com/decolua/9router/tree/master/cli)
  and said: "I like this approach."

## Context

**No backend code exists in this repository in any language.** The C# tree
(`src/Vigilia.*`, 12 files) has never compiled — the machine has the EOL 6.0.35
runtime and no SDK. [ADR-0006](0006-sequence-the-net-host-after-the-frontend.md)
sequenced the host after the frontend gates for that reason. Draft spec 0009
then proposed replacing C# with Python (`psutil` for baseline, the prebuilt
LibreHardwareMonitor executable for extended sensors, plain WebSocket with
keep-latest). It left five decisions open and was never implemented.

Meanwhile the frontend reached a genuinely shippable state: 757 unit tests, 134
browser tests, both bundles building, the player at 199.4 KB against a 400 KB
budget. The editor now opens and saves real theme files
([spec 0009](../../.agents/specs/0009-editor-open-and-save.md)). One thing stands
between that and a product a person can use: **the player renders invented
numbers**, because there is no host and no transport.

The user reviewed 9router's launcher and endorsed its shape: `npm i -g` or
`npx`, one command that starts the server and opens the browser, port fallback,
the LAN address printed for peers to reach, a Windows tray built on PowerShell
`NotifyIcon` rather than a shipped binary, and user data under `%APPDATA%`.

## Decision

Write the host in **Node 22+/TypeScript**, inside the existing `src/web/` npm
workspace, and ship it as a `bin` CLI.

Five reasons, in the order that decided it:

1. **The endorsed distribution model is intrinsically Node.** `npx vigilia-dashboard`
   cannot front a Python host without shipping a Node launcher that spawns
   Python — two runtimes for a user to install, and two for us to debug. The
   thing the user liked is not separable from the runtime it is built on.

2. **It deletes the highest-risk edit in the repository.** `AGENTS.md` names
   `Vigilia.Contracts` ↔ `renderer-core/src/types.ts` exactly that: hand-mirrored,
   compiles cleanly on both sides when wrong, produces bad values at runtime,
   and guarded only by a names-only text comparison. A Node host **imports
   `types.ts` directly** — the class of bug stops existing rather than getting a
   better guard. A Python host would instead owe a *new* Python↔TS drift guard,
   a debt the handoff already records as owed.

3. **Python's advantage was narrower than the draft assumed.** Spec 0009 chose
   Python for `psutil`. But the *extended* tier — temperatures, fans, power,
   clocks, the part that actually needs privileged access — is the prebuilt LHM
   executable read over HTTP, which is language-agnostic. `psutil`'s edge
   therefore reduces to baseline OS metrics, where CPU and memory are Node
   built-ins (`os.cpus()` diffed over an interval, `os.totalmem`/`freemem`) and
   disk/network come from `systeminformation` — pure JavaScript, no native build
   step.

4. **One toolchain, already installed.** npm and `tsc` are required to build the
   frontend regardless. Spec 0009 asked that a normal Windows install need no
   compiler or SDK; this satisfies that with the runtime already present, and
   without adding Python or restoring a .NET SDK.

5. **Serving the bundles becomes a file read.** The player and editor `dist/`
   directories are built by the same workspace the host lives in.

### What this deliberately does *not* copy from 9router

**9router binds `0.0.0.0` by default.** §7 of the design document requires the
opposite: LAN serving starts **disabled**, with explicit interface and port
selection, phones paired by short-lived codes, and full editing localhost-only.
Vigilia binds `127.0.0.1` until a human turns LAN on. Convenience that widens
the listening surface by default is the one part of the approach that does not
transfer.

## Consequences

- **The C# tree and `Vigilia.slnx` are slated for deletion**, along with the
  paused `backend` CI job. The platform boundary those projects enforced
  mechanically (`CA1416` as an error, `IsWindowsPlatformProject` as the opt-in)
  dies with them. Whatever provider-vs-host isolation the Node host needs must
  be **designed and enforced afresh**, not assumed to have been inherited.
- **`contracts-mirror.test.ts` loses its subject.** It should be deleted in the
  same commit as the C# tree, not left passing against files nothing reads.
  `theme/schema-sync.test.ts` is unaffected and still earns its place.
- **Node becomes an end-user runtime dependency**, not only a build dependency.
  That is a real cost and is the price of reason 1.
- **ADR-0004's two sensor tiers are unaffected.** Baseline-without-driver and
  extended-needing-PawnIO are a property of Windows and LHM, not of the host's
  language. Tiers stay discovered and reported, never hardcoded.
- **§47's budget gate still only covers the player.** A host in the same
  workspace must not become an excuse to let editor or host code reach
  `renderer-core`; the leak direction that gate catches is unchanged.
- **What would flip this:** if baseline telemetry through Node on Windows proves
  materially worse than `psutil` — concretely, disk and network counters, the
  only place `systeminformation` is doing real work rather than wrapping a
  built-in — then Python re-enters as **one provider behind the sample
  contract**, not as the host. That is the whole point of keeping acquisition
  behind a provider boundary, and it is why this decision is cheap to revisit.
