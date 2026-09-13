---
name: vigilia:code-review
description: Reviews a Vigilia diff for the defects static analysis cannot catch — contract mirror drift, fabricated sensor readings, boundary leaks, non-deterministic test data, and schema compatibility breaks. Use when reviewing a PR or diff, checking a change before requesting review, or asked to look for bugs in Vigilia code.
---

# Reviewing Vigilia changes

The compiler, analyzers and CI already catch style, nullability, unused code and
bundle size. **Do not spend review effort restating them.** What follows is what
they cannot see.

Order findings by blast radius, most severe first.

## 1. Contract mirror drift — the highest-risk defect here

A shape both the host and a display read lives in the shared library —
`renderer-core/src/data/protocol.ts` for the wire contract,
`data/semantic-keys.ts` for the vocabulary. A message shape defined in
`packages/host` with a reader in a display is the old C#/TypeScript mirror
rebuilt: it compiles on both sides and produces wrong values at runtime.

**If the diff touches `Sample`, `SensorStatus`, `SensorValueType`,
`SensorDescriptor` or the wire shape on either side, verify the other side
changed too.** A rename, a new status value, a changed optionality — each
compiles cleanly on both sides and produces wrong values at runtime.

Specifically check: a new `SensorStatus` member added in C# but absent from the
TypeScript union means the renderer's exhaustive `switch` silently stops being
exhaustive for real data.

## 2. Fabricated or zeroed readings

§83 and §97 are behavioural requirements, not style preferences.

- A non-`Ok` sample must carry **no value**. Look for code that sets `Value`
  alongside `Missing`, `Error` or `Unavailable`.
- A missing sample must render as a **gap**. A zero-length arc, a `0` label, or a
  series point at zero all read as "the sensor says zero" and are wrong.
- An unavailable sensor must report `Unavailable` **with an actionable reason** —
  never a substituted default, never a guess from a neighbouring sensor.
- Clamping is display-only. If a diff clamps a value *before* storage or
  publication, the raw reading has been lost.

## 3. Boundary leaks

**Platform:** does anything in `Contracts`, `Core`, `Providers.Http` or the
renderer now reference a Windows type, or add `IsWindowsPlatformProject=true` to
a project that should stay neutral?

**Player vs editor:** does `renderer-core` or `player` gain a dependency on
editor UI, inspectors, or a component framework? The size check catches weight,
but a small editor-only utility can slip under the budget and still violate §47.

**Typed chart settings:** raw ECharts options must not reach the theme format.
There is exactly **one** legitimate engine-boundary cast, in
`packages/player/src/main.ts`. A second cast appearing anywhere is the finding.

**Provider responsibilities:** a provider that starts a timer, caches history, or
pushes samples has taken over the host's job (§95).

## 4. Non-deterministic test data

The fake provider exists to make visual tests reproducible. Flag anything that
reintroduces nondeterminism:

- `string.GetHashCode()` — randomized per process
- `DateTime.Now` / `DateTimeOffset.UtcNow` in sample generation — the fake
  provider has a virtual clock; use `Advance()`
- `Random` without a fixed seed
- Animation left enabled in a screenshot path

## 5. Schema and persistence compatibility

If `schema/theme-document.schema.json` changed:

- Can a theme saved under the previous version still load? If not, was
  `schemaVersion` bumped, and does an unsupported version **fail without
  changing the library** (§141)?
- Did a field become required, or an enum lose a member? Both break existing
  documents.
- Are new asset paths still constrained against traversal and absolute paths?

## 6. Security-relevant paths

- Does an error message, log line, or API response now carry a secret, a token,
  or a full request with headers? §101 requires redaction before anything
  reaches a browser.
- Does a new endpoint bind beyond loopback, or bypass the display-scoped session
  check? LAN serving is opt-in and editing is localhost-only by default
  (§147, §149).
- Does an importer fetch a URL the user did not explicitly configure? Theme
  imports must never trigger network access on their own (§130).

## 7. Tests that assert nothing

- A provider added without extending the host's provider tests has skipped
  the conformance definition entirely.
- A test that only asserts a call did not throw. What is the observable
  behaviour?
- A gate checklist item ticked with no committed evidence (§33).

## Reporting

State each finding as: the defect, a concrete failure scenario (inputs → wrong
output), and the file and line. If you are unsure whether something is real, say
so rather than padding the list — and never claim you verified a build or test
run you did not perform.
