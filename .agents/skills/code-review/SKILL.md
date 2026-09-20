---
name: vigilia:code-review
description: Review Vigilia diffs for contract drift, fabricated data, Fabric/editor boundary leaks, persistence mistakes, ineffective tests, and unnecessary complexity.
---

# Reviewing Vigilia changes

Order findings by severity. Do not restate compiler/linter output.

## 1. Shared contracts

A shape used by host and browser belongs in `renderer-core`. Flag duplicated wire
or semantic-key definitions across packages.

## 2. Data honesty

- Non-`ok` samples carry no plottable value.
- Missing/unavailable/error never becomes zero/default.
- Display clamping must not overwrite the raw reading.
- Fake data is explicit test/demo data, never runtime fallback.

## 3. Architecture boundaries

- `renderer-core` must stay Fabric/DOM-free.
- Player may use `scene-fabric`, not editor UI/managers or interactive `Canvas`.
- Raw ECharts options must not enter persisted theme data.
- Providers acquire; the host schedules/history-buffers.
- During Fabric editor work, flag new home-grown generic editor mechanics that should come
  from the `fabricjs-image-editor` source fork.

## 4. Persistence

For theme/schema/Fabric-scene changes verify:

- schema/version policy is explicit;
- unsupported versions fail cleanly;
- Fabric identity survives round-trip;
- telemetry, built ECharts options, playback and render scale are not persisted;
- no second simplified scene tree/write-back mapping is introduced.

## 5. Tests

- New regression tests should fail with the fix removed.
- Visible renderer changes need browser/visual evidence, not only object counts.
- Browser E2E does not exercise the host; do not infer host correctness from it.
- Flag assertions that only prove “did not throw”.

## 6. Security/external effects

Check secret redaction, path traversal, LAN exposure, auth/session boundaries and
imports that trigger network access.

## 7. Complexity and prose

Flag unnecessary custom infrastructure when a dependency already owns the
behaviour. Also flag documentation/comment bloat:

- comments that narrate implementation/debug history;
- comments over ~8 lines without a real invariant/API trap;
- specs/status entries that repeat chronology already in git;
- the same rationale copied into several docs/source comments.

Prefer a precise helper/test/doc link over an essay comment.

## Reporting

For each finding: defect, concrete failure scenario, file/line, and severity.
Do not pad the review with speculative or stylistic findings.
