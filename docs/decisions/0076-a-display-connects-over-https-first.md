# 0076 — A display connects over https first, and http is kept as the fallback

- **Date:** 2026-10-20
- **Status:** accepted
- **Paths:** `src/web/packages/player/src/host-refind.ts`,
  `src/web/packages/host/src/main.ts`,
  `src/web/packages/editor/src/hosting-client.ts`,
  `src/web/packages/editor/src/editor-shell/publish-control.tsx`

## The problem

A display is a secure context only at an https origin, and two of its controls are gated on that:
the Screen Wake Lock API, and arbitrary-element fullscreen on a client that has it. The host has
served https beside http on the same port, from a certificate it issues itself, since
`docs/decisions/0070` — and the owner confirmed by hand that adding `https://` to the address and
accepting the warning makes the awake control work. What is missing is that **nothing advertises
it**, and the player cannot survive it: `host-refind.ts`'s `originFor` builds `http://` for every
probe, so from an https page every probe is mixed content and can never match (`vg-623`).

The owner's ruling, 2026-10-20: **https first, with http kept as a fallback.**

## Rung 1 — Vigilia

Searched: `originFor`, `refindTarget`, `host-refind.ts`, `lanAddress`, `caCertificate`,
`CA_CERTIFICATE_PATH`, `createDisplayLauncher`, `displayUrl`, `pairingUrl`, and every `http://`
literal under `packages/`.

Found: the mechanism exists and only the addresses are wrong.

- `host/src/cli/args.ts:66` — "The host serves https beside http on the same port, from a
  certificate it issues itself, and prints the root certificate to install."
- `host/src/main.ts:190-206` — the certificate is not optional: a host that cannot produce one
  refuses to start. So the https listener is a **given**, not something this change adds.
- `host-refind.ts:104` — `originFor(address, port)` returns `http://…`, unconditionally, and it is
  the ladder's only origin builder (`vg-623`).
- Every printed address is http: `main.ts:348`, `:421`, `:436`, `:438`, and
  `hosting-client.ts:152`'s pairing link. `main.ts:384` prints the **root certificate** at an http
  path, deliberately.

## Rung 2 — dependencies

Searched: the packages that build or print a display address, and Node's `https`/`tls` surface.

Found: nothing to add. The listener, the CA and the certificate path all exist; this change moves
strings and one function's scheme.

## Rung 3 — platform

Searched: the secure-context rule, and what a certificate warning does to it.

Found: an https origin with a **user-accepted** certificate is a secure context — the owner's own
test, the awake control working after accepting the warning. So the fallback is not merely a
courtesy: a device that has not installed the root can still reach the display and get the wake
lock after accepting, and the only thing it cannot do is the things that require a trusted
certificate outright (service worker, install prompt).

## Rung 4 — ecosystem

**The live search could not be run in this session.** What is recorded is the shape the ecosystem
uses, and it is written as such: a device-pairing flow that serves its own CA prints the CA at an
unauthenticated path, because the client cannot be asked to trust the host before it can fetch the
thing that makes the host trustworthy. That is why `main.ts:384`'s http path stays.

## Rung 5 — comparison

| Option | Fit | Cost | Verdict |
|---|---|---|---|
| https first, http kept | Both origins work; the secure one is what is printed first | Two addresses to explain | **chosen** — the owner's ruling |
| https only | One address | A fresh phone cannot load the display at all until the warning is accepted, and the certificate fetch still needs http, so the flow has two origins anyway | rejected |
| http only (today) | Nothing to explain | No wake lock, no fullscreen, no service worker on any display that is not loopback | rejected — this is the state being replaced |

## Rung 6 — probe

Not a measurement: the owner's own reading on a real display, that `https://` plus an accepted
warning makes the awake control work, is the probe. The ladder's breakage under https is established
by reading `originFor` and is filed as `vg-623`.

## Rung 7 — decision

**The printed address is https; the http address is printed beside it as the fallback.** The ladder
probes the page's **own** scheme, so a display served over https re-finds its host over https and one
served over http keeps working. **The root certificate's own URL stays http** — a device that has not
installed the root must be able to fetch it, and asking it to trust the host first is the loop this
path exists to break.

**What this does not change:** the host still serves both on the same port, the pairing code is still
the only secret printed, and no display is forced onto https.
