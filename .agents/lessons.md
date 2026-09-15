# Lessons

Durable rules learned from real failures. Keep the rule; git keeps the story.

## Verification

- **Check the claim, not the handoff.** Status/docs can be wrong.
- **Disable a fix before trusting its regression test.** A test that still passes
  is asserting something else.
- **Render visible work and look.** Geometry/object-count tests can pass over
  missing or malformed pixels.
- **“Some ink exists” is not enough.** Compare the spatial result needed by the
  feature, not merely non-transparent pixel count.
- **Measure library/harness behaviour when it decides architecture.** Reading
  source or warnings is not a substitute for a one-line experiment.
- **A fresh-object identity comparison is not a change detector.** Compare the
  fields that matter or preserve stable identities deliberately.
- **An optimization needs an assertion.** If nothing tests that work is skipped,
  nothing notices when it stops being skipped.
- **Browser E2E does not exercise the host.** Preview-server success says nothing
  about host routing/asset behaviour.
- **Rebuild after reverting deliberate test breakage.** Playwright previews
  build output, not source.

## Libraries and duplication

- **Read a dependency for what it already donates before reimplementing it.**
  Fabric already supplied serialization hooks, revival, defaults and dirty
  propagation that early custom code got subtly wrong.
- **One owner must have real consumers.** Creating a canonical module without
  repointing callers leaves duplication intact.
- **Prefer mechanisms to reminders.** Derive, type-check or test synchronization.
- **Persist authored state, not derived state.** Derived renderer/runtime values
  become stale and can leak telemetry into saved data/history.
- **Try the smallest executable probe before writing an adapter.** Library
  serialization/default behaviour overturned several source-reading assumptions
  in minutes.

## Editor architecture

- **Do not build generic editor mechanics when a foundation can own them.**
  Selection, controls, grouping, clipboard and object tools are not Vigilia's
  product.
- **Evaluate a candidate against the true blocker first.** The earlier Fabric
  rejection was about two renderers; once Fabric became the one renderer, that
  premise disappeared.
- **Evaluate small libraries as source when a fork is acceptable.** Missing npm
  exports/types are weak objections if the source already implements the needed
  behaviour and permanent divergence is acceptable.
- **A capability model must express the distinctions the product needs.** Split
  broad capabilities instead of piling exceptions onto one flag.
- **Do not render controls that cannot work.** Conversely, authorable properties
  need a property control.
- **Refuse invalid input rather than coercing it.** Empty/bad numeric input can
  otherwise become a destructive zero.

## Rendering

- Canvas and DOM differ in culling, text inheritance, image decoding and media
  behaviour; parity must be checked fixture by fixture.
- Fabric chart objects need explicit ECharts disposal and Fabric invalidation.
- Live/derived chart data must never enter serialized authored properties.
- Video does not belong inside the Fabric scene when it forces full-scene frame
  repaint; keep it on a separate aligned background layer.

## Toolchain

- Bare gitignore rules match at any depth.
- `npx <name>` may execute an unrelated public package; verify the binary name.
- Node 25 may warn against Vitest's engine range while still running; use the
  supported Node versions instead of debugging the warning.
- `document.fonts.check()` is not a reliable font-availability test.
- A chart whose visible content is animated may paint nothing at time zero;
  deterministic captures must control time deliberately.