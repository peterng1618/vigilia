# 0090 — Submission is a hand-rolled GitHub client on the host

- **Date:** 2026-10-22
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`, `src/web/packages/host/src/themes/`

## The problem

Phase E of the theme-store spec makes the app open a pull request on the
author's behalf: GitHub's device authorization flow for identity, then fork,
commit `catalogue/<id>/item.json` plus the package and a thumbnail to the
author's fork, and open a PR against the catalogue repo. The shape that makes
this more than "call an API" is that the client is **a locally-run host with no
client secret**, it must not be able to name the target path itself, and the
token it holds is the first credential this product stores.

## Rung 1 — Yunari

Searched: `github`, `oauth`, `device`, `fork`, `pulls`, `Bearer`, `Authorization`
across `src/web/packages/**`; the host's outbound calls (`themes/download.ts`);
the settings file pattern (`settings/theme-origins.ts`, `active-theme.ts`).
Found: `download.ts` is the host's only outbound third-party request and it
carries no credential. No OAuth, token storage or GitHub API client exists
anywhere in the tree, and no setting is a secret today.

## Rung 2 — dependencies

Searched: `package.json` across the workspace for HTTP and GitHub clients.
Found: nothing GitHub-specific and no HTTP client; the host uses Node's global
`fetch`. `@octokit/rest` is not installed and is not a transitive dependency.

## Rung 3 — platform

Searched: GitHub's documented device-flow endpoints and REST API.
Found: `POST https://github.com/login/device/code` and
`POST https://github.com/login/oauth/access_token` implement the device flow for
public clients, needing only a `client_id`; the REST endpoints needed are
`GET /user`, `POST /repos/{owner}/{repo}/forks`, `GET .../git/ref/heads/{base}`,
`POST .../git/refs`, `PUT .../contents/{path}` and `POST .../pulls`. What it
leaves to us: polling cadence and `slow_down`, fork eventual consistency, blob
`sha` on update, cross-repo `head` as `owner:branch`, and every retry.

## Rung 4 — ecosystem

Searched: **no live web search was available in this session** (the tool
returned no results and said so). Recorded rather than papered over: the
following is from existing knowledge and is **NOT ESTABLISHED** by a search run
for this note — npm's `octokit` family, the `gh` CLI, and GitHub Desktop all
implement this flow; `gh auth login` uses the same device flow and `gh pr create`
does the same fork-and-PR sequence. What that comparison suggests is that the
shape is well travelled, not that any of them is a drop-in: none exists in this
tree, and none can be adopted without adding a dependency.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `@octokit/rest` | full API surface, typed | a new dependency and its tree, for six endpoints | supply chain for a credential-bearing client | rejected |
| `gh` CLI subprocess | no dependency | requires `gh` installed **and** authenticated separately, which is a second identity owner | none of the token guarantees this spec asks for | rejected |
| hand-rolled `fetch` client | six endpoints, no dependency | we own polling, retries and error mapping | ~150 lines to get right | chosen |

## Rung 6 — probe

Measured 2026-10-22, not assumed:

- `POST https://github.com/login/device/code` with an invalid `client_id`
  answers **`404` `{"error":"Not Found"}`** — the endpoint exists and rejects an
  unknown client rather than failing at the network.
- `GET https://api.github.com/repos/peterng1618/yunari-store` answers **`200`**
  with `private: false`, `fork: false`, `default_branch: main`, `size: 5` — the
  catalogue repo is public and forkable, so the flow's premise holds.
- What this does **not** establish: that a real device code is issued. That
  needs a registered OAuth App and its client id, which only the account holder
  can create. The flow's happy path is therefore tested against a fake until a
  client id exists.

## Decision

A **hand-rolled client on the host**, in `host/src/themes/github-*.ts`, using
global `fetch` and no dependency. The specific reason is the one this note's
probes cannot give a library: the token is the first credential this product
stores, and a dependency that touches it buys typing we do not need for six
endpoints while adding a supply-chain surface to the one client holding it.
Rung 4's evidence is weak — no live search ran — so if a future reader finds a
solved shape that covers the token's storage and rotation, that is a reason to
revisit this note rather than to ignore it.
