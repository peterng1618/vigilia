# Vigilia

A PC-hosted website for live hardware monitoring over local Wi-Fi. A desktop
browser runs the design editor; phones each show one assigned dashboard.
Windows-first, MIT-licensed, **personal-use-first**.

> **Early and unstable.** The host serves real telemetry and the editor works,
> but the format is heading for a breaking v2 and there is no release. Nothing
> here is packaged or published.

## Running it

From `src/web/`:

```bash
npm install
npm run build                                    # player, editor and host
node packages/host/bin/vigilia.js                # http://127.0.0.1:5227
```

Loopback only by default. `--host 0.0.0.0` lets phones connect and serves your
hardware telemetry to every device on the network — plain LAN HTTP has no
confidentiality, so trusted networks only, never the internet.

The published binary will be `vigilia-dashboard`. Plain `vigilia` on npm is an
unrelated package.

## Everything else

There is deliberately no user-facing documentation. Project documentation is
written for whoever works on this next and lives in **[`.agents/`](.agents)** —
start with [`AGENTS.md`](AGENTS.md), then
[`.agents/status.md`](.agents/status.md) for current state.

Third-party licences: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
