# 0072 — Display management lives in the route table `server.ts` already has

- **Date:** 2026-10-18
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`

## The problem

Ruling 12 makes a display's credential durable, so pairing stops minting
sessions and starts minting **displays**: the same routes now list, rename,
rotate and remove a record, and the credential is a field of that record rather
than an entry in a session map.

The shape that is not obvious is the *dispatch*. These are the first routes in
this host addressed by an **id in the path** (`/api/displays/:id`), the first
that answer a **partial update** of a stored record, and the first where the
thing in the path is also the thing the credential belongs to. A wrong decision
here is invisible: a route that reads the parameter before it checks loopback
leaks the display list to the LAN and nothing fails, and a route that answers the
record unredacted puts every credential hash on the wire and nothing fails
either.

## Rung 1 — Yunari

Searched: `settings/displays.ts` (the `DisplayStore` interface — `list`,
`create`, `createLocal`, `find`, `authenticate`, `rotate`, `update`, `touch`,
`remove`), `server.ts`'s existing route table and its `route`/`peerOf` helpers,
`session/pairing.ts`, and `packages/*/src` for `"PATCH"`.

Found: **the store already owns every act these routes perform**, including the
label rules (`mintedDisplayId`, `normalizeLabel`) and the write chain, so the
routes are a translation layer and nothing more. **Nothing in the tree matches a
path segment to a record**: every existing route is a literal path or a
`^/api/themes/([^/]+)/…$` regex over a theme id, and no route anywhere answers
`PATCH` (the only `"PATCH"` strings in the tree are the tests this task writes).
There is no router module and no per-route object; the route table is one
`if`-chain inside `handle`, which ten existing notes already claim on this
watchlisted path — `0004`, `0009`–`0010`, `0017`–`0019`, `0021`, `0043`, `0070`,
`0071`, read from each note's own `Paths:` bullet rather than counted, and this
note is the eleventh claim.

## Rung 2 — dependencies

Searched: `packages/host/package.json` and its own `//` note, plus the workspace
root's `package.json`.

Found: **nothing.** The host's runtime dependencies are `@yunari/renderer-core`,
`@yunari/scene-fabric`, `@yunari/theme-package`, `node-forge` and
`systeminformation`. No router (`express`, `find-my-way`, `hono`), no schema
validator, no `zod`. The host's note states the policy this task inherits —
serving is `node:http` — and adding a runtime dependency needs a
`THIRD-PARTY-NOTICES.md` entry first.

## Rung 3 — platform

Searched: `node:http`, the WHATWG `URL`, `node:crypto`, and what the existing
`route` wrapper already provides.

Found: `URL` hands over a decoded `pathname` and `searchParams`, so
`?label=`/`?displayId=` need no parsing of their own; `http.ServerResponse`
gives the status and the body and nothing else — **no routing, no method table,
no path parameters, no body parsing, no status semantics**. `crypto.createHash`
already sits behind `hashToken`, and `readBody` already bounds a body. What the
platform leaves to us is exactly the part this note is about: matching, the
method-to-status mapping, and the order of the guards. A native capability that
exists is not a decision discharged.

## Rung 4 — ecosystem

Searched: how a local-first host models a durable per-device credential and the
routes around it — the study this design already rests on, `decolua/9remote` at
`033dd6e3` (the spec's own section, `:30`), Jellyfin's Quick Connect
(`Emby.Server.Implementations/QuickConnect/QuickConnectManager.cs` in
`github.com/jellyfin/jellyfin`, and `jellyfin.org/docs/general/server/quick-connect/`),
Syncthing's device ids (`docs.syncthing.net/dev/device-ids.html`) and
`lib/api/tokenmanager.go`, and the pairing/registry reference of a comparable
local gateway, Revka (`revka.ai/docs/gateway-api/pairing-and-auth/`). Also the
obvious route-matcher candidates by name (`express`, `find-my-way`, `hono`)
against what this server already does.

Found: **the closest prior art is already in this repo.** The design studies
`decolua/9remote` — read 2026-10-18 at the user's suggestion at `033dd6e3` — in
"What the 9remote study contributes, and what it does not"
(`docs/superpowers/specs/2026-10-18-per-display-themes-design.md:30`), and leans
on it four times after that. It pairs and manages devices, splits a one-time code
from a durable credential, defends a code short enough to type by rate limiting
rather than by length, and keeps one admission table in which a kicked device
outranks auto-approve — most of what Task 1.4 builds. **What does not transfer is
where the credential lives**: 9remote pairs to a cloud relay, so its one-time code
is revoked at a Worker and its permanent key is a bearer credential for a service
somebody runs, where this host is the only thing that can revoke anything. That
divergence is also why it is not a candidate in rung 5: its dispatch belongs to a
relay. The study is cited here, not restated.

**One project outside this repo has solved the route shape itself.** Revka's
gateway persists paired devices in a file and answers `GET /api/devices`,
`DELETE /api/devices/{id}`
for revocation and `POST /api/devices/{id}/token/rotate` to issue a fresh
credential **in place, keeping the record** — the same three acts, the same
address-by-id, the same split between "the record survives" and "the credential
does not". Their record carries `id`, `name`, `paired_at`, `last_seen`: ours is
`id`, `label`, `createdAt`, `lastSeenAt` plus `kind` and `monitor`. The
independent arrival at the same shape is the strongest evidence available that
the shape is right, and it is the reason this task rotates instead of re-minting.
**The rotate-in-place decision itself rests on ruling 12**, which the user made
without reference to any of these projects; the citation is what makes the shape
checkable rather than a claim to have derived it.

**Syncthing is the model ruling 12 rejected, and it says why.** Its
`tokenManager` holds tokens in a map keyed by the token itself, with a lifetime
and an eviction limit, persisted in `miscDB` — a *session* store, exactly what
this host just deleted. The cost is structural rather than a matter of taste: a
token map cannot answer "which display is this" without a second lookup, so
nothing keyed by a display id can be reached from a request, and the twelve-hour
TTL it implies is what the user's ruling removed. Jellyfin separates the
short-lived code from what it buys, which is the split Task 1.4 will add — its
code is four random bytes formatted as a decimal, and the credential it hands
over is the durable one.

Nothing found for the dispatch half: no project ships a router for a route table
this small, and every comparable host keeps its routes in one file.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `express` / `find-my-way` / `hono` for the new routes | Partial: a second router beside the existing `if`-chain, so two owners for one table | A shipped dependency, a `THIRD-PARTY-NOTICES.md` entry, a licence review, and every existing route either migrated or left behind | The existing table's guards (`isBundleAsset`, the loopback rules, the `route` wrapper's rejection handling) would have to be re-expressed in the router's terms; a route that misses one fails silently | Rejected |
| A `routes/` module per resource, dispatching from `handle` | Good for a large table | A new directory, an interface for one implementation, and a second place that knows how a request becomes a display | A split table is how the loopback guard gets applied on one side of it and not the other | Rejected |
| Extend the `if`-chain in `server.ts`, in the shape the neighbouring blocks already have | Exact: the guard order, `peerOf`, `route` and the display store are already in scope and already the owners | ~60 lines in a file already past the 800-line stop | None new — the file's size is the pre-existing cost, recorded rather than paid here | **Chosen** |

## Rung 6 — probe

Two measurements, both from this task's own runs rather than from reasoning.

1. **The guard order is observable.** The suite builds a second server over the
   same directory whose store records every `find` and `rotate` call, then sends
   a non-loopback `POST /api/pairing/sessions?displayId=kitchen-tablet`. The
   answer is 403 with the pairing copy and the recorded call list is `[]`: the
   loopback check precedes the parameter read, which is the property no status
   code alone proves.
2. **The old behaviour is what the new tests catch.** Before the routes existed,
   `POST /api/pairing/sessions?displayId=nobody` answered **201** (measured:
   `expected 404 to be 201`, in the case "answers 404 for a displayId it does not
   know, on both routes") — the parameter was ignored
   and a display named `display` was minted. After the change the same request is
   404 and the display list is unchanged. A case that passed before and after
   would have been evidence of nothing.

## Rung 7 — build

`server.ts` only, plus its test. The pairing block keeps its position and its
loopback guard, and gains the `displayId` branch; a new `/api/displays` block
follows it with `PATCH` (rename, through `normalizeLabel` — the label rule, not
the id rule, because a rename does not mint an id) and `DELETE` (which refuses
`LOCAL_DISPLAY_ID` with 409, because this PC is not a client anyone paired).
`DELETE /api/pairing/sessions/:token` is retired with the session store it read:
it took a durable credential in a path, and revoking *is* removing.

## Decision

**Extend the existing route table, and let the store stay the only owner of the
rules.** The comparison's first two options both cost a second owner for
something that already has one, and rung 4 shows no project solves this by
routing differently — Revka's gateway answers the same three acts over the same
kind of file-backed registry. What rung 6 adds is that the two properties worth
having here (the guard before the read, and a refusal instead of a mint) are
checkable, so this note's claim is testable rather than asserted.
