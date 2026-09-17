# Vigilia

A Windows-first, PC-hosted hardware-monitoring dashboard. The PC acquires sensor
data and serves a local website; a desktop browser authors dashboards and phones
render them over local Wi-Fi.

> **Early and unstable.** The host serves real baseline CPU/RAM telemetry and the
> player is Fabric-based. The editor now runs on the adopted
> `fabricjs-image-editor` fork and reads/writes the development v2 Fabric theme
> envelope, but authoring features, live editor telemetry and media integration
> are still incomplete. Nothing is packaged or published.

## Run locally

From `src/web/`:

```bash
npm install
npm run build
node packages/host/bin/vigilia.js
```

The host defaults to `http://127.0.0.1:5227`. A non-loopback `--host` exposes the
player and hardware telemetry to the LAN; the editor remains loopback-only. Plain
LAN HTTP has no confidentiality, so do not expose it to the internet.

The eventual CLI name is `vigilia-dashboard`. Plain `vigilia` on npm is an
unrelated package.

## Project docs

Start with [`AGENTS.md`](AGENTS.md), then
[`.agents/status.md`](.agents/status.md). Durable product requirements,
architecture and active specs live under [`.agents/`](.agents).

Third-party notices: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
