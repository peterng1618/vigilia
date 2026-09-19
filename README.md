# Vigilia

Windows-first hardware-monitoring dashboards: the PC collects sensor data and
serves a local site; desktop authors dashboards and phones display them over
local Wi-Fi.

> **Early and unstable.** CPU/RAM telemetry, the Fabric player, and the adopted
> `fabricjs-image-editor` fork work. Theme v2, authoring, live editor telemetry,
> and media support are still evolving. Nothing is published.

## Run

From `src/web/`:

```bash
npm install
npm run build
node packages/host/bin/vigilia.js
```

The host defaults to `http://127.0.0.1:5227`. Non-loopback `--host` exposes
the player and telemetry to the LAN; the editor stays loopback-only. Do not
expose plain LAN HTTP to the internet.

CLI package name: `vigilia-dashboard` (`vigilia` on npm is unrelated).

## Docs

Start with [`AGENTS.md`](AGENTS.md) and [`.agents/status.md`](.agents/status.md).
Product, architecture, decisions and active specs live under [`.agents/`](.agents).
Licences: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
