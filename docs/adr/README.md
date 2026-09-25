# Architecture Decision Records

ADRs record durable choices that a future agent could otherwise plausibly
reverse. They are not a changelog and do not duplicate feature-level Superpowers
specs.

| ADR | Decision |
|---|---|
| [0001](0001-node-typescript-host.md) | Node/TypeScript host and `vigilia-dashboard` CLI |
| [0002](0002-fabric-is-the-single-renderer.md) | Fabric is the single player/editor scene renderer |
| [0003](0003-vigilia-envelope-persists-fabric-scene.md) | Persist Fabric JSON inside the Vigilia envelope |
| [0004](0004-theme-package-is-the-portable-artifact.md) | Theme ZIP is the portable asset-bearing artifact |
| [0005](0005-vigilia-owns-native-fabric-editor.md) | Vigilia owns its Fabric editor directly |
| [0006](0006-react-editor-shell.md) | React + Base UI + Tailwind own editor shell chrome |
| [0007](0007-typed-vigilia-charts-over-echarts.md) | Charts remain typed Vigilia objects over ECharts |
| [0008](0008-video-is-background-media.md) | Video is an aligned background layer, not a scene object |
| [0009](0009-capability-driven-sensors.md) | Sensor providers are capability-driven and never fabricate readings |
| [0010](0010-dispatch-record-owns-recovery-state.md) | A live dispatch record owns subagent recovery state |

When a durable architecture choice changes, add a new ADR that supersedes the
old one instead of rewriting history. Smaller implementation choices belong in
current architecture/product docs or the relevant Superpowers spec.
