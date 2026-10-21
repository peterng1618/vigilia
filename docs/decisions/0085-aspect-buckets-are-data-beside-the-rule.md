# 0085 — The aspect buckets are a ratio-ordered table beside the rule

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/facet-record.ts`

## The problem

The store's facet record has to file an arbitrary artboard into a *published*
vocabulary of ratios, and the owner has ruled the set gains `19.5:9` and `4:1`.
Two facts make this more than adding two strings: a ratio is compared with a
tolerance, so some artboards legitimately fall outside every bucket, and
`aspectOf` returns the **first** entry within that tolerance, so the table's
order silently decides which bucket wins when two are close. The set has to stay
cheap to extend, and extending it must not quietly re-file a neighbour's
artboards.

## Rung 1 — Vigilia

Searched: `facet-record.ts` (`AspectBucket`, `ASPECT_BUCKETS`, `aspectOf`,
`ASPECT_TOLERANCE`), `renderer-core/src/index.ts`'s exports, `artboard-presets.ts`
(`ARTBOARD_RATIOS`, `ArtboardRatioId`), `store-mode/local-source.ts`
(`SHAPE_GROUPS`, `SHAPE_RATIO`, `shapeGroupOf`), the schema for an `aspect` key,
and every `ratio`/`aspect` hit in `renderer-core/src`.

Found: `facet-record.ts` already owns the classification — a ratio table plus a
log-space tolerance and an `other` fallback. `artboard-presets.ts` already names
`19.5:9`, but for a different question: which sizes a *new document* offers. It
has no tolerance and no `other`, so it cannot classify an existing document.
`local-source.ts` deliberately recognises a shape value by form (`/^\d+:\d+$/`)
rather than by a second copy of the bucket list — its own comment says a copy
would be "a list to keep in step for no gain". The schema has no aspect key:
the record is derived from the artboard, not persisted.

## Rung 2 — dependencies

Searched: `src/web/packages/renderer-core/package.json`, `src/web/packages/editor/package.json`,
and the workspace manifests for anything ratio-related.

Found: renderer-core depends only on `echarts@6.1.0`; the editor adds React,
Base UI and Fabric. Nothing installed computes or classifies an aspect ratio,
and the arithmetic is `Math.log` and two comparisons.

## Rung 3 — platform

Searched: CSS `aspect-ratio` and the `aspect-ratio` media query, `Intl`'s
formatters, and the ECMAScript `Math` surface.

Found: CSS consumes a ratio to size a box and media queries compare one against
a viewport, but neither maps a numeric ratio to a name; `Intl` has no ratio
vocabulary. The platform gives arithmetic and nothing about which ratios are
"published" or how close is close enough — those are this product's decisions,
so the classification stays ours.

## Rung 4 — ecosystem

Searched: the npm registry search API for `aspect ratio` (20 results) and
`aspect ratio closest` (20 results); read the metadata and README of
`nearest-normal-aspect-ratio`; considered `aspectratio`, `calculate-aspect-ratio`,
`get-aspect-ratio` and `aspect-ratio` (device screen) from the same result sets.

Found: one package classifies at all — `nearest-normal-aspect-ratio` (MIT,
1.2.1) picks the nearest simple ratio whose components are capped at 16, and
its README's own example is `649x360` → `9:5`. That is precisely the answer
this module must refuse: an unreleased 2.35:1 board belongs in `other`, not in
an invented ratio. The rest only compute or simplify, and `aspect-ratio` reports
the device's screen ratio. **Nobody has solved this shape** — a fixed published
vocabulary, a tolerance, and an honest `other` past it.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `nearest-normal-aspect-ratio` | Nearest simple ratio | A dependency, its licence notice, a new input contract | Files 2.35:1 under an invented ratio instead of `other` | rejected |
| CSS `aspect-ratio` / media query | Consumes a ratio | none | No classification, no vocabulary | rejected |
| Reduce `gcd(width, height)` and match exactly | No tolerance | a few lines | 1366×768 and 1920×1200-ish artboards miss every bucket | rejected |
| Keep the ordered ratio table in `facet-record.ts`, extend it | Already the owner's shape | two entries and an export | Order is load-bearing; a misplaced entry steals its neighbour's artboards | **chosen** |

## Rung 6 — probe

Measured 2026-10-21 in Node against the candidate ordering, printing the
log-space gap between adjacent buckets and the distance of representative
artboards:

| Bucket | Ratio | Gap to next |
|---|---|---|
| `1:1` | 1.0000 | 28.77% |
| `4:3` | 1.3333 | 11.78% |
| `3:2` | 1.5000 | **6.45%** (tightest) |
| `16:10` | 1.6000 | 10.54% |
| `16:9` | 1.7778 | 19.78% |
| `19.5:9` | 2.1667 | 7.41% |
| `21:9` | 2.3333 | 42.12% |
| `32:9` | 3.5556 | 11.78% |
| `4:1` | 4.0000 | — |

`ASPECT_TOLERANCE` stays `0.005`, and two different bounds meet here. The one
that **binds** is the 2.35:1 artboard: it sits 0.712% from `21:9`, so a
tolerance of 0.0071 or more starts filing it under that bucket, and 0.005 keeps
it `other`. The tightest half-gap *between adjacent buckets* is 3.2% (3:2 against
16:10) — a wider, structural limit on how far any entry can claim. Other measured
distances: 2340×1080 is 0.0000% from `19.5:9`; 3840×960 is 0.0000% from `4:1`;
1366×768 is 0.0488% from `16:9` and still lands there.

## Rung 7 — build

- `facet-record.ts` — `AspectBucket` gains `"19.5:9"` and `"4:1"`; `ASPECT_BUCKETS`
  gains `19.5 / 9` between `16:9` and `21:9`, and `4` after `32:9`, keeping the
  ascending order the first-match rule depends on; a `PUBLISHED_BUCKETS` table
  beside it makes a union member without its entry a compile error, and a test
  holds the other direction — every entry has a row in `ASPECT_BUCKETS` — which
  is what the table's export is for. `ASPECT_TOLERANCE` and `aspectOf` are
  unchanged.
- `store-mode/region.tsx` — no table is added: `shapeOptions` names each option
  with `item.facets.aspect` and maps only `other` to `uiCopy.store.otherShape`,
  so the two new ids label themselves and need no second list.
- `store-mode/local-source.ts` — `SHAPE_RATIO` widens from `/^\d+:\d+$/` to
  `/^\d+(?:\.\d+)?:\d+$/`; the old form would read `19.5:9` as naming no shape
  group, so the new option would match no theme.

## Decision

**Keep the classification as one ordered data table beside the rule, and extend
the table.** The specific reason: the tolerance is a promise — an artboard past
every published ratio is `other`, not the nearest wrong bucket — and the table
is the only place where both the vocabulary and its order can be read and
tested together. A library that snaps to the nearest simple ratio contradicts
that promise by construction, and the platform offers no vocabulary at all.
