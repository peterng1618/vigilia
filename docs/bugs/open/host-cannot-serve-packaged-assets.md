# Hosted themes cannot load their packaged assets in the player

**Found while:** Task 4 of `docs/superpowers/plans/2026-09-26-reference-theme-fidelity.md`,
building the frosted-glass browser proof. Not caused by that work; found by it.

**Severity:** non-critical. No crash, no data loss. A theme's background media is
simply absent, so anything that depends on sampling it renders with nothing
behind it.

## What happens

`createAssetResolver` (`src/web/packages/renderer-core/src/theme/assets.ts:32-33`)
is given a base URL of the theme root and appends the **whole** declared asset
path, `assets/badge.svg`, producing `/api/themes/<id>/assets/badge.svg`. The
host's route (`/^\/api\/themes\/([^/]+)\/assets\/(.+)$/`,
`src/web/packages/host/src/server.ts:710-730`) matches that, and its second
group must **still contain** `assets/badge.svg` to find the declaration - but
that group's leading `/assets/` is the route's own literal, so the remainder
decodes to `badge.svg`. The prefix is consumed by the route, and the declaration
is never matched.

Measured against a running host with the seeded `e2e-hosted` theme, which
declares `assets/badge.svg`:

| URL | result |
|---|---|
| `/api/themes/e2e-hosted/assets/assets/badge.svg` | 200 |
| `/api/themes/e2e-hosted/assets/badge.svg` | 404 |
| `/api/themes/e2e-hosted/assets/assets%2Fbadge.svg` | 200 |

The player's URL is the second row, so it 404s. The route is not at fault: the
first and third rows match, which is why the host's own server test — written
against the URL-encoded form — passes.

## Why it has gone unnoticed

`fixtures` and the editor's file-open path both hand the player a `blob:` URL
built from bytes already in memory, so neither goes through this route. Only a
theme fetched from the real host does.

## Impact here

A hosted theme's background media never loads, so a frosted-glass panel over
media has no media to sample. Task 4's browser proof is therefore run through
the **editor** mount, whose file-open path does produce a decoded image, and
the player mount's media path stays unproven end to end.

## Next pickup action

Decide which side moves, then prove it with a request against a running host —
the three rows above are the whole test:

- **Base URL on the resolver's side** — give the player `.../assets/` as its
  base and stop the resolver prefixing. Smallest change, but it changes a
  `renderer-core` contract other callers share.
- **Route on the host's side** — take the theme root and the full path in one
  group, so `/api/themes/<id>/<path>` is unambiguous. Larger, and it changes a
  published route.

Whichever is chosen, the resolution needs a browser test that loads a hosted
theme whose background media is a real image, because no current test exercises
this path.
