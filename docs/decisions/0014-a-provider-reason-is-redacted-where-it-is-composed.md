# 0014 — a provider's reason is redacted where it is composed, not where it arrives

- **Date:** 2026-09-29
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/providers/provider.ts`, `src/web/packages/host/src/providers/lhm.ts`, `src/web/packages/host/src/providers/library.ts`

## The problem

A provider's `message` and `ProviderHealth` both reach a browser: the sample
stream serves them to every display on the network, and the contract at
`provider.ts` says so in as many words — *"messages may reach a browser and
must be redacted."* The strings that go into those messages are written by
something else. `lhm.ts` interpolated its own `baseUrl`; `library.ts` passed
through whatever a `systeminformation` error said, and that library shells out
to `WMIC.exe` and quotes both the command and the path it ran.

The shape is not "a URL in a message". It is **an unbounded third-party string
crossing a trust boundary on its way to a fixed-width strip on a wall**, and
the awkward part is that both ends of it are ours: the host composes the
sentence and the player renders it, and the same message crosses both.

## Rung 1 — Vigilia

Searched: `ProviderHealth` (`provider.ts:18`), `ProviderFailure` (`registry.ts`,
carrying the same "May reach a browser; keep redacted" note), every
`error.message` reaching a sample, and `availability-notice.ts` in the player.

Found: the player **already redacts URLs** and says why — *"One presentation
change: a URL inside a reason becomes 'its configured address', because
`ProviderHealth` already rules that a message reaching a browser must be
redacted."* So the rule was known, stated, and enforced one layer downstream
of where it was written. That is two owners of one contract, and the net
cannot see a filesystem path, which is the half `systeminformation` leaks.

## Rung 2 — dependencies

Searched: `packages/host/package.json` and the transitive set.

Found: the host declares *"ZERO RUNTIME DEPENDENCIES BEYOND THE RENDERER'S
TYPES, deliberately"* (`package.json`, the `//` field). `redact-for-log` and
`safe-regex` exist and are the usual answer, and both would be a new runtime
dependency for one substitution, a length bound and a whitespace collapse.

## Rung 3 — platform

Searched: `String.prototype.replace` with a global regex; `URL` for parsing.

Found: `replace` is the whole job. `URL` would parse an address and re-serialise
it, but the requirement is to *not* show the address, so parsing one is work
whose output is discarded. The one non-obvious part is the boundary: `\b` does
not work before a `/` (a space and a slash are both non-word, so there is no
word boundary between them), so the leading anchor is a lookbehind
`(?<![a-z\d])` — which has the useful side effect of leaving a date like
`2026/09/29` alone.

## Rung 4 — ecosystem

Searched: the shape "redact a message bound for a browser or a log", and
specifically whether anyone has solved *this* shape — a bounded reason string
where the words are the diagnostic and the coordinates are not.

Found: the ecosystem answer is a package (`redact-for-log`, `safe-regex`) or a
middleware, both of which target **whole log pipelines** — every record
serialised, every field scrubbed. Neither fits here: this is one function
applied at two call sites, where the alternative to redacting is a regex of
five lines and a dependency in a package whose defining constraint is having
none. The one thing worth taking from the ecosystem is the *phrase* the player
already chose, so this reuses "its configured address" rather than inventing a
second wording for the same fact.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Redact in the player only (today) | Wrong layer — the message is composed here | — | Paths and any non-URL leak; the host has no record of what it sent | Rejected |
| Redact at both ends | Same regex in two packages | Two owners, two lists | They drift; the player cannot see paths at all | Rejected |
| A redaction library | Right idea, wrong scale | A runtime dependency in a zero-dependency package | Licence entry, notices, install | Rejected |
| `redactForBrowser` in `provider.ts`, called where composed | Where the contract lives | Five lines of regex | A path form nobody wrote a test for | **Chosen** |

## Rung 6 — probe

What each error string actually contains, read from the sources rather than
assumed:

- `lhm.ts` — `connect ECONNREFUSED 127.0.0.1:8085` (dotted quad **and** port),
  `fetch failed` (no address), `LHM answered 500` (host-authored, safe).
- `library.ts` — `spawn C:\Windows\System32\wbem\WMIC.exe ENOENT` (a path),
  and anything the spawned command itself reports.
- The project's own vocabulary that a naive `\S+` would eat: `2340:1080`,
  `19.5:9`, `1080p/2K/4K`. A theme's artboard is not a transport address, and a
  redactor that changed what a theme says would be worse than the leak.

The dot in `19.5:9` is what a bare `host:port` rule matches. A `\b` alone does
not save it — the boundary lands mid-token — so the rule is spelled out rather
than borrowed, and `browser-reason.test.ts` pins each form including the aspect
ratio that must survive.

## Decision

One exported function beside the contract that states the rule,
`redactForBrowser`, called by every provider where it composes a message. It
replaces a URL, a `host:port`, and a filesystem path with *its configured
address*; bounds the result at 120 characters; collapses whitespace.

**What goes into a message, not how many distinct ones there are.** The
sentence each provider composes is unchanged, so the player's grouping by
distinct cause is untouched — `a34b838`'s tests pass unmodified, and
`availability-notice.ts` stays as the net it was written to be, one layer
behind a host that now sends it nothing to do for these two providers.

**The raw reason is kept host-side.** `this.failure` is the redacted string, so
a host operator debugging a missing sensor reads
"LibreHardwareMonitor is not reachable at its configured address: connect
ECONNREFUSED" and learns the cause without the address being on the wire. The
address is recoverable from the `--lhm-url` flag that set it.
