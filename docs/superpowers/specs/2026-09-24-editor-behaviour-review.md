# Editor behaviour review

- **Status:** review backlog; not accepted requirements
- **Purpose:** retain only legacy/editor QoL ideas worth reconsidering against
  the current native Fabric editor.

Before implementing an item below, inspect the current authoring workflow and
choose **keep**, **replace with native behaviour**, or **drop**. If kept, promote
it into the relevant product requirement or a new Superpowers design/spec before
implementation.

## Candidates

### Resize-time snapping

Movement snapping and smart guides are implemented, but their fidelity against
the fork's original is under review (§64, §175): the port reportedly guides worse
than the source in practice. Resize-time line/equal-space snapping was
intentionally not ported because the old fork's scaling subsystem was large and
coupled to object types Vigilia does not have. Revisit only if actual use shows
the gap matters.

### Rulers, configurable grid/guides and pixel snapping

No active requirement. Evaluate the authoring need and Fabric-native options
before adding any of them. Do not restore old custom snapping code by default.

### Global-management UX

Reference integrity is implemented. Optional conveniences remain:

- where-used navigation/counts;
- display-name vs key/rekey UI;
- bulk reassignment before token deletion.

### Session/file UX

New/Open protect dirty work and package/host storage exists. Reconsider
save-in-place, recent files, unload warnings or draft recovery only when the
current host-backed workflow demonstrates a real need.

### Rotated-image crop

Current crop refuses rotated images because the crop frame is image-local while
the authored frame is canvas-space. Keep the refusal until a real need justifies
the transform work.

### Vendored snapping geometry split

The two large vendored geometry files intentionally remain byte-comparable with
their source. Split them only when maintenance cost outweighs the risk of
transcription errors.

### Size-indicator refresh

The old fork used a private Fabric transform hook for a late text pipeline that
Vigilia does not have. Restore extra refresh work only if the label is observed
stale during real authoring.

### Alt-drag distance measurement guides

Useful QoL, not a requirement. Reconsider only after higher-value authoring gaps
are resolved.

### Worker-based image resize

Current resize is main-thread. Add a worker only if measured import latency
becomes a problem.

## Promoted to requirements

- **Canvas zoom and pan** — dropped while fit-to-panel sufficed; revived as
  §174 on a demonstrated precise-placement need, together with group entry,
  reachable multi-select, keyboard nudge and a canvas context menu.
- **Layer panel shape and action ownership** — decided as §172: a tree with
  per-row lock/visibility state, and one action registry behind the dock, the
  layer-panel action row and the canvas context menu.

## Dropped unless a new product need appears

- custom hit-testing/transform/group math from the original editor;
- immutable-document history and the old DOM renderer;
- the old inspector layout and multi-selection property editing;
- the fork template manager until Vigilia has an actual templates feature;
- a generic interaction blocker without a long-running operation that needs it;
- fork-specific pixel-grid/type heuristics that do not match Vigilia objects.

Git retains the original implementations and migration detail.
