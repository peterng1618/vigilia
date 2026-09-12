# Vigilia

A PC-hosted website for live hardware monitoring over local Wi-Fi. Editing happens
in a desktop browser; phones show one assigned dashboard each. Windows-first,
MIT-licensed.

The full design is [`docs/pc-stats-display-agent-plan.md`](docs/pc-stats-display-agent-plan.md)
(revision 9). Section references throughout the code — `§93`, `§122` — point into it.

> ## Status: scaffold
>
> This repository contains structure, contracts and verified research. It is **not
> a working application**. What runs today:
>
> | | |
> | --- | --- |
> | Frontend renderer + tests | **Works** — 19 tests pass, typechecks clean |
> | Display-only player bundle | **Builds** — 111.7 KB gzipped JS |
> | .NET projects | **Unverified — never compiled.** No .NET SDK on the dev machine |
> | Sensor collection, pairing, theme library | Not implemented |
>
> Endpoints that would imply unbuilt behaviour return `501` rather than pretending.

---

## Prerequisites

- **.NET 10 SDK** ([ADR-0002](docs/decisions/0002-target-net10.md)).
  ⚠️ Currently **not installed** — the machine has only the EOL 6.0.35 *runtime*.
  Nothing under `src/*.csproj` has been compiled; expect first-build errors.
- **Node 22.12+, 24, or 26+** (`vitest` 5 rejects odd releases such as 25).
- **PawnIO** — optional. Only needed for temperatures, fan speeds and voltages
  ([ADR-0004](docs/decisions/0004-tiered-sensor-access.md)).

## Getting started

```bash
# Frontend — this part works today
cd src/web
npm install
npx vitest run                              # 19 tests
npx vite build packages/player              # display-only bundle
node packages/player/scripts/check-size.mjs # §47 bundle budget

# Backend — needs the .NET 10 SDK first
dotnet restore Vigilia.slnx
dotnet build Vigilia.slnx
dotnet test Vigilia.slnx
dotnet run --project src/Vigilia.Host   # binds 127.0.0.1:5227
```

## Layout

```
src/
  Vigilia.Contracts/         Provider interface, Sample, SensorDescriptor. No Windows types.
  Vigilia.Core/              Registry, scheduling, normalization, bounded history.
  Vigilia.Host/              ASP.NET Core + SignalR. Loopback-only by default.
  Vigilia.Platform.Abstractions/  ISecretStore and friends.
  Vigilia.Platform.Windows/  Tray, secrets, startup, firewall.
  Vigilia.Providers.Fake/    Deterministic provider for contract + visual tests.
  Vigilia.Providers.Http/    Custom API sensors (§99).
  Vigilia.Providers.Windows/ LibreHardwareMonitor + PawnIO probe.
  web/
    packages/renderer-core/         Shared renderer. No editor deps, ever.
    packages/player/                Display-only bundle for phones.
    packages/editor/                Desktop authoring. Layer over the renderer (ADR-0005).
tests/
  Vigilia.Contracts.Tests/   Provider conformance suite.
schema/                             The owned theme format.
docs/
  decisions/                        ADRs.
  gates/                            Gate checklists and evidence.
  research/                         Verified dependency findings, with method.
```

### Two boundaries worth knowing before you edit

**Platform (§97).** `Contracts`, `Core` and the renderer must not reference
Windows types. Projects that legitimately do set
`IsWindowsPlatformProject=true`, which switches them to `net10.0-windows`;
everywhere else `CA1416` is an error.

**Player vs editor (§47).** `renderer-core` and `player` must not depend on
editor UI, inspectors or a component framework. `check-size.mjs` runs in CI to
catch a leak — if the budget fails, look for a stray dependency before raising
the budget.

## Decisions made

| ADR | Decision |
| --- | --- |
| [0001](docs/decisions/0001-editor-foundation-evaluated-in-parallel.md) | Evaluate **both** editor candidates in parallel at Gate 0, not sequentially |
| [0002](docs/decisions/0002-target-net10.md) | Target .NET 10 — 8 and 9 both EOL 2026-11-10 |
| [0003](docs/decisions/0003-pin-stable-lhm-not-prerelease.md) | Pin `LibreHardwareMonitorLib` 0.9.6 stable, not the 735-strong prerelease train |
| [0004](docs/decisions/0004-tiered-sensor-access.md) | Kernel driver is **optional**; the app works without it |

## The kernel driver, in short

Temperatures and fan speeds need ring-0 access. The old route, WinRing0, is
**permanently dead**: it sits in Microsoft's vulnerable-driver blocklist under 29
unconditional hash denies, and that blocklist is on by default and always enforced
under HVCI — which is itself default-on for most new Windows 11 machines.

LibreHardwareMonitor already solved this by moving to **PawnIO**, a signed
scriptable driver, in stable 0.9.6. PawnIO installs separately, so this app treats
it as optional: everything works without it except the sensors that physically
cannot.

Full detail and method: [docs/research/verified-dependency-findings.md](docs/research/verified-dependency-findings.md).

## Security posture

- Binds **loopback only** by default; LAN serving is opt-in with explicit
  interface and port selection (§147).
- Full editing is localhost-only by default; phones get revocable,
  display-scoped sessions (§149).
- Plain LAN HTTP provides **no confidentiality**. Trusted networks only — never
  expose this to the internet.
- Credentials go through `ISecretStore`, are redacted in errors, and are never
  included in browser responses or exported packages (§101, §143).

## Contributing

Per §164, each change needs a short proposal, acceptance scenarios and test
evidence. Schema breaks, major dependency changes and scope expansion need human
review. **Report untested behaviour** — a ticked checkbox without observable
behaviour and a test is not a pass (§33).

## Licence

MIT — see [LICENSE](LICENSE). Third-party components and their obligations are in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md); MPL-2.0, LGPL-2.1 and
Apache-2.0 components all require notices to survive into distributed packages.
