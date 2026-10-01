# 0019 — A pairing guard protects dashboard content, not the bundle that fetches it

- **Date:** 2026-10-01
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`

## The problem

The host's LAN guard is one condition placed before most of the routing: from
anywhere but loopback, a request without a valid session is refused. It is right
about what it protects — a phone on the network should not read dashboard content
it was never paired for.

It is placed **too early**. The player's own HTML references its bundle:

```
<script src="/assets/index-DKPxU5E6.js">
```

A session token rides in the query string, because `fetch` and `EventSource` can
carry one and `<script src>` cannot. So a paired phone gets the document — the
302 to the theme resolves, the token is accepted — and is then **refused its own
scripts**:

```
200 /?session=…            the document
403 /assets/index-DKPxU5E6.js
403 /assets/echarts-2OkV-78u.js
403 /favicon.svg
```

A blank page. The shape worth solving: **a guard whose credential cannot reach
the very request it is protecting.**

## Rung 1 — Vigilia

Searched: `server.ts` (every `403`), `isLoopbackRemote`, `allowed`,
`displaySession`, `SAMPLE_STREAM_PATH`.

Found: the guard sits at line ~578 with the comment *"Display reads stay open on
loopback; from the LAN they need a session so dashboard content is not served to
every device on the network."* `/editor` is separately guarded at ~973
(`"The editor is available on this PC only."`), and theme assets resolve under
`/api/themes/<id>/assets/…`, so both are already inside the guard's scope and
stay there. Only the **bundle's own** `/assets/*` is over-reached.

## Rung 2 — dependencies

Found: `node:http` and `node:fs` only. Nothing to consult.

## Rung 3 — platform

Found: the platform gives no way to put a credential in a `<script src>`. The
options are a cookie (which a token-in-URL design deliberately avoids, since the
link the host *prints* is the pairing mechanism), a service worker, or serving
the bytes without requiring one.

The last is the answer here, because the bundle is **not dashboard content**.
It is the same JavaScript any loopback visitor already has; it contains no
reading, no theme and no device. A guard that protects a dashboard from being
read by an unpaired device gains nothing by refusing a device the file.

## Rung 4 — ecosystem

Searched: how a SPA served to a paired device gets its own assets; CSP,
`<script integrity>`, cookie sessions, signed URLs.

Found: the standard shape is **a cookie** — set once when the pairing link is
opened, sent on every subsequent request including `<script src>`. That is the
conventional answer and this design is not using it, because pairing here *is* a
printed link with an expiring token, not a login. Two conventions apply
regardless: **statically-hashed bundle filenames** (`index-DKPxU5E6.js`) exist
precisely so assets can be cached immutably and need no credential at all; and
signed-URL auth schemes exempt static assets for the same reason.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Cookie session instead of the URL token | Conventional | Changes pairing, printing and expiry | Large; the token model is §145's | rejected |
| Move the guard below the static-bundle routes | Exact: the guard keeps protecting everything it protects | one condition | The editor is separately guarded, theme assets are under `/api` | **chosen** |
| Serve the bundle without any check, everywhere | Same | none | Identical exposure to loopback | chosen as above |
| Embed the bundle in the HTML | No separate request | — | A 1.5 MB inline script per page | rejected |

## Rung 6 — probe

Measured, host bound to `0.0.0.0`, pairing link opened at 390×844 in a
brand-new context:

| via | result |
|---|---|
| `http://127.0.0.1:8958/?session=…` | **1 canvas, dashboard drawn, 0 console errors, every asset 200** |
| `http://192.168.2.56:8958/?session=…` | **0 canvases, blank, 3× 403 on the bundle and the favicon** |

The difference between the two is the host's own interface, and the product is
otherwise identical — so the defect is exactly the guard's placement, not the
phone, not the pairing, and not the renderer.

## Decision

The pairing guard covers **dashboard content** and not the bundle that fetches
it. The bundle's `/assets/*` is served before the guard, on the grounds that it
is the same bytes any loopback visitor already has. Everything the guard exists
to protect — `/api/themes/**`, the sample stream, `/api/display` — stays behind
it, and `/editor` keeps its own loopback guard.
