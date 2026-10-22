# Architecture Decision Records

**This series is closed.** It ran 0001–0010 and stopped on 2026-09-25; decisions
taken since are `docs/decisions/` notes. The numbers here are this directory's
own, and `docs/decisions/` numbers from 0001 as well, so the two series collide
across 0001–0010 — both hold a `0004`, on different decisions. Nothing here is
merged, removed or renumbered: a merge would renumber one series and break every
citation to the other, and 0001–0010 still govern. **Cite a decision by its
directory** — `adr/0004` against `decisions/0004` — because the bare number alone
is ambiguous between the two.

ADRs record durable choices that a future agent could otherwise plausibly
reverse. They are not a changelog and do not duplicate feature-level Superpowers
specs.

| ADR | Decision |
|---|---|
| [0001](0001-node-typescript-host.md) | Node/TypeScript host and `yunari-dashboard` CLI |
| [0002](0002-fabric-is-the-single-renderer.md) | Fabric is the single player/editor scene renderer |
| [0003](0003-yunari-envelope-persists-fabric-scene.md) | Persist Fabric JSON inside the Yunari envelope |
| [0004](0004-theme-package-is-the-portable-artifact.md) | Theme ZIP is the portable asset-bearing artifact |
| [0005](0005-yunari-owns-native-fabric-editor.md) | Yunari owns its Fabric editor directly |
| [0006](0006-react-editor-shell.md) | React + Base UI + Tailwind own editor shell chrome |
| [0007](0007-typed-yunari-charts-over-echarts.md) | Charts remain typed Yunari objects over ECharts |
| [0008](0008-video-is-background-media.md) | Video is an aligned background layer, not a scene object |
| [0009](0009-capability-driven-sensors.md) | Sensor providers are capability-driven and never fabricate readings |
| [0010](0010-dispatch-record-owns-recovery-state.md) | A live dispatch record owns subagent recovery state |

When a durable architecture choice changes, the new decision is a
`docs/decisions/` note that supersedes the old one — this file is not rewritten
and gains no new numbers. Smaller implementation choices belong in current
architecture/product docs or the relevant Superpowers spec.
