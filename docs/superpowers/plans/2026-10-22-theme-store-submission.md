# Theme store submission (phase E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An author with a GitHub account submits a theme from the library, and the app opens the pull request that lists it.

**Architecture:** The host owns identity and the PR — the browser never sees a token, and the host is the only process that can hold one. GitHub's device flow gives a token; a hand-rolled `fetch` client forks the catalogue repo, commits `catalogue/<id>/` into the author's fork, and opens a PR. The catalogue repo validates each PR and auto-merges only when the author is verified, validation is green and the diff touches only that author's own item.

**Tech Stack:** Node 22+ global `fetch`, TypeScript, Vitest; GitHub Actions (Node) in `peterng1618/vigilia-store`.

**Spec:** `docs/superpowers/specs/2026-10-12-theme-store-design.md` — read § "Submission: the app opens the pull request", § "The trust ladder", § "Identity: the device flow" and the Acceptance line for **E**. The plan argues from the spec; where they disagree, the spec wins.

## Global Constraints

- **No new dependency.** Global `fetch` only; `docs/decisions/0090` is the reason.
- **The token never reaches the browser.** No response body, no log, no error message carries it.
- **The client cannot name the target path.** The path is derived from the author's login and the item's id, never from a request field (spec § "The trust ladder").
- **Loopback only**, and every new mutating route carries the origin + loopback-`Host` guard `isForeignOrigin` (`server.ts`) — the check `2bf41947` added to the install route.
- **Persist authored state only.** The token is consumer state, stored beside `theme-origins.json`, never inside a theme.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse an invalid value rather than coercing it.
- 500 lines is a signal, 800 a stop for a source file.
- `host/src/server.ts` and `host/src/themes/` are watchlisted: `docs/decisions/0090` claims both.

## Review Focus

1. **A token is written somewhere it can be read.** The settings file's mode, what an error message prints, and what survives a failure.
2. **A failed submission leaves a half-made fork or branch.** What the author sees, and whether a retry resumes or duplicates.
3. **A PR whose diff escapes the author's own directory.** The auto-merge rule must refuse it even when the author is verified.
4. **The device code expiring while the author is looking at it.** What the dialog says, and whether a poll after expiry loops forever.
5. **A catalogue repo the author's fork is behind on.** What branch base the client uses and whether an old fork produces a conflicted PR.

---

## Phase 1 — Identity

### Task 1: The device flow client

**Files:**
- Create: `src/web/packages/host/src/themes/github-oauth.ts`
- Test: `src/web/packages/host/src/themes/github-oauth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DeviceCode { readonly deviceCode: string; readonly userCode: string; readonly verificationUri: string; readonly expiresIn: number; readonly interval: number }
  export type DeviceOutcome = { readonly state: "pending" } | { readonly state: "slow_down" } | { readonly state: "denied" } | { readonly state: "expired" } | { readonly state: "ok"; readonly accessToken: string; readonly scope: string }
  export function requestDeviceCode(clientId: string, options?: { readonly fetch?: typeof fetch }): Promise<DeviceCode | { readonly error: string }>
  export function pollDeviceToken(clientId: string, deviceCode: string, options?: { readonly fetch?: typeof fetch }): Promise<DeviceOutcome | { readonly error: string }>
  ```

- [ ] **Step 1: Write the failing tests** — a fake `fetch` returning the documented bodies: `{device_code, user_code, verification_uri, expires_in, interval}`; then `{error:"authorization_pending"}`, `{error:"slow_down"}`, `{error:"access_denied"}`, `{error:"expired_token"}`, `{access_token, token_type, scope}`. Assert each maps to its `DeviceOutcome`. Assert `Accept: application/json` is sent (GitHub's default body is form-encoded).
- [ ] **Step 2: Run them and watch them fail** (`npx vitest run packages/host/src/themes/github-oauth.test.ts`).
- [ ] **Step 3: Implement** with `POST https://github.com/login/device/code` (`client_id`, `scope=public_repo`) and `POST https://github.com/login/oauth/access_token` (`grant_type=urn:ietf:params:oauth:grant-type:device_code`). No secret is sent. A non-JSON body or an unknown error is `{ error }`.
- [ ] **Step 4: Re-run** — green.
- [ ] **Step 5: Commit** `feat(store): the device flow, as one client`.

### Task 2: The token store

**Files:**
- Create: `src/web/packages/host/src/settings/github-token.ts`
- Test: `src/web/packages/host/src/settings/github-token.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface GithubIdentity { readonly accessToken: string; readonly scope: string; readonly login: string; readonly obtainedAt: string }
  export interface GithubTokenStore { read(): Promise<GithubIdentity | undefined>; write(identity: GithubIdentity): Promise<void>; clear(): Promise<void> }
  export function createGithubTokenStore(directory: string): GithubTokenStore
  ```

- [ ] **Step 1: Failing tests** — write then read round-trips; the file is `github-token.json`; on POSIX its mode is `0o600`; `clear` removes it; a malformed file reads `undefined` rather than throwing; write and read are serialised (reuse the `writeExclusively` shape `theme-origins.ts` uses) and saving is atomic (temp + rename).
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement.** The token is plaintext at mode `0600`; the file's docblock says so, and why (a local host has nowhere to keep a key that a local attacker cannot read).
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): the token sits beside the origin record, at 0600`.

### Task 3: The identity routes

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: Task 1's client, Task 2's store.
- Produces: `POST /api/github/device` → `{ userCode, verificationUri, expiresIn, interval }`; `POST /api/github/device/poll` → `{ state, login? }`; `DELETE /api/github/token` → `{ ok: true }`.

- [ ] **Step 1: Failing tests** — device start answers the four fields and never the `device_code`; poll answers `pending` then `ok` with `login`; `DELETE` clears the file; all three refuse a foreign `Origin` and a non-loopback `Host` (reuse the existing cases); with no `VIGILIA_GITHUB_CLIENT_ID` the start answers `503` naming registration.
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement.** The pending device code lives in host memory, keyed by nothing the browser sends: the browser polls one route for the one pending flow. On `ok`, the host fetches `GET https://api.github.com/user` with the token to learn the login, writes the identity, and answers `{ state: "ok", login }`. The token is never in a response or a log.
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): the host signs in, and the browser sees only a code`.

---

## Phase 2 — The pull request

### Task 4: The item file, built from a library theme

**Files:**
- Create: `src/web/packages/host/src/themes/github-item.ts`
- Test: `src/web/packages/host/src/themes/github-item.test.ts`

**Interfaces:**
- Consumes: `parseCatalogueItemFile` from `renderer-core`; `writeThemePackage` from `theme-package`; the theme store.
- Produces:
  ```ts
  export interface SubmissionFiles { readonly itemJson: string; readonly packageBytes: Uint8Array; readonly thumbnail: Uint8Array | undefined; readonly path: string }
  export function submissionFiles(themeId: string, store: ThemeStore, options?: { readonly thumbnails?: ThumbnailStore; readonly now?: () => Date }): Promise<{ ok: true; files: SubmissionFiles } | { ok: false; message: string }>
  ```
  `path` is `catalogue/<themeId>` — derived from the store's own validated id, never from a request field.

- [ ] **Step 1: Failing tests** — the item file parses through `parseCatalogueItemFile`; `kind` is `dashboard-theme`; `createdAt`/`updatedAt` are ISO instants; `downloads` and `favorites` are `0` under option B; `packageUrl` points at the raw path inside the catalogue repo for that id; `thumbnail` is the repo path; an invalid theme id is refused; a theme without a thumbnail still submits.
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): a library theme becomes an item the catalogue accepts`.

### Task 5: Fork, commit, PR

**Files:**
- Create: `src/web/packages/host/src/themes/github-submit.ts`
- Test: `src/web/packages/host/src/themes/github-submit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SubmitResult = { readonly ok: true; readonly url: string } | { readonly ok: false; readonly stage: "identity" | "fork" | "commit" | "pull"; readonly message: string }
  export function submitToCatalogue(input: { readonly login: string; readonly accessToken: string; readonly files: SubmissionFiles }, options?: { readonly fetch?: typeof fetch; readonly owner?: string; readonly repo?: string }): Promise<SubmitResult>
  ```

- [ ] **Step 1: Failing tests** with a fake `fetch` that records every request: the fork is requested from the catalogue repo; the commit goes to `<login>/<repo>` on branch `submit/<id>`; every file is a `PUT /contents/catalogue/<id>/…`; the PR's `head` is `<login>:submit/<id>` and its `base` is `main`; the branch is created from the fork's current `main` head, not from a stale local ref; a 422 on PR creation (already open) is answered as "a pull request for this item is already open" rather than a bare error; no request URL or body contains the token outside the `Authorization` header.
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement**, with the fork's eventual consistency handled by polling `GET /repos/<login>/<repo>` for up to ten attempts.
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): the fork, the commit and the pull request`.

### Task 6: The submit route

**Files:**
- Modify: `src/web/packages/host/src/server.ts`
- Test: `src/web/packages/host/src/server.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 5.
- Produces: `POST /api/themes/submit` with `{ id }` → `{ ok: true, url }` or `{ ok: false, stage, message }`; `401` when no identity is stored; `503` when no client id is configured.

- [ ] **Step 1: Failing tests** — a stored identity and a library theme produce a `200` with the PR URL from the fake; no identity answers `401` with a sentence that asks the author to sign in; loopback/origin/Host guards hold; a package-stage refusal names it.
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): the host submits a library theme`.

---

## Phase 3 — The surface

### Task 7: Submit, from the theme's own surface

**Files:**
- Modify: `src/web/packages/editor/src/store-mode/item-modal.tsx`, `store-mode/region.tsx`, `store-mode/use-submit.ts` (create), `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/store-mode/region.dom.test.tsx`, `src/web/packages/editor/src/ui-copy.test.ts`

**Interfaces:**
- Consumes: the routes from Tasks 3 and 6.
- Produces: a `useSubmit` hook owning `state: "idle" | "authorising" | "submitting" | "submitted" | "refused"`, the device `userCode`, and the PR URL; a Submit control in the modal for a library theme.

- [ ] **Step 1: Failing tests** — signing in shows the code and the verification link; a refusal states the host's sentence; a success states the PR link and disables the control; the announcement region says each of the three; copy keys land in `ui-copy.test.ts` as literals.
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement**, reusing the install control's busy/refusal shape rather than inventing a second one.
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): submission, from the theme's own surface`.

### Task 8: The boundary — submission seen in a browser

**Files:**
- Modify: `src/web/tests/e2e/editor-rail.spec.ts`, `docs/evidence/screenshots/README.md`

**Interfaces:**
- Consumes: Task 7.

- [ ] **Step 1: Register the captures** in the Theme store section before taking them: the code dialog, and a submitted theme with its PR link.
- [ ] **Step 2: Add the claims** against routed host routes: signing in shows a code; a submitted theme shows the PR link and the control no longer offers Submit; a refusal states the host's sentence.
- [ ] **Step 3: Rebuild, then** `VIGILIA_CAPTURE=1 npx playwright test tests/e2e/editor-rail.spec.ts --workers=1`, exit read directly; then the same without capture.
- [ ] **Step 4: Look at each capture** and say what it shows in the report.
- [ ] **Step 5: Commit** `test(store): submission, seen in a browser`.

---

## Phase 4 — The catalogue repo

### Task 9: Validation, as a command the Action can run

**Files:**
- Create: `src/web/packages/host/src/themes/validate-item.ts` (+ test), wired as a host binary command (`packages/host/bin/vigilia.js`) or a second bin entry.
- Modify: `C:\tmp\vigilia-store\.github\workflows\` (the catalogue repo, outside this tree).

**Interfaces:**
- Produces: `vigilia validate-item <catalogueDir>` → exit 0 and a line, or exit 1 naming the first refusal.

- [ ] **Step 1: Failing tests** — a valid `catalogue/<id>/` passes; a missing `item.json`, an unknown kind, a package that does not parse, and a `packageUrl` that does not name the package beside it each fail with their own sentence.
- [ ] **Step 2: Run, watch fail.**
- [ ] **Step 3: Implement**, reusing `parseCatalogueItemFile`, `readThemePackage` and the store's caps.
- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit** `feat(store): a catalogue directory validates as one command`.

### Task 10: The two workflows, and the verified list

**Files (catalogue repo, outside this tree):**
- Create: `C:\tmp\vigilia-store\.github\workflows\validate.yml`, `.github\workflows\auto-merge.yml`, `verified-authors.txt`
- Modify: `.github\workflows\index.yml` if it must exclude PR branches

- [ ] **Step 1: `validate.yml`** — on `pull_request` touching `catalogue/**`, check the app out at a pinned commit, run `validate-item` for each changed `catalogue/<dir>`, fail the job on the first refusal.
- [ ] **Step 2: `auto-merge.yml`** — on `pull_request` (`opened`, `synchronize`, `reopened`): read the author; refuse unless the author is in `verified-authors.txt`; refuse unless every changed path is under `catalogue/<id>/` for **one** id, and none is under `.github/`; require the validate workflow's conclusion through `workflow_run` or by making auto-merge depend on validate via `needs`; merge with `gh pr merge --squash`.
- [ ] **Step 3: Prove the refusal** — build a PR that touches `.github/` from a login in the list on a scratch branch and show the job refuses it. Record the run URL.
- [ ] **Step 4: Push is an external action** — the controller asks the user before the first push to `peterng1618/vigilia-store`; a local clone is enough for the task's tests.
- [ ] **Step 5: Commit** in the catalogue repo, and record the sha in the plan ledger.

---

## What this plan does not cover

- **F** (the publish-time normalizer and the media caps): its own plan, after E.
- **Removal, moderation, favorites and the download counter** — spec open questions 4, 5 and option B's known cost.
- **A live end-to-end submission.** It needs an OAuth App registered by the account holder; every task's tests run against a fake until that client id exists.
