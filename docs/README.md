# Vigilia documentation

This tree separates current project truth from change-specific Superpowers
artifacts and from Git history.

| Need | Canonical source |
|---|---|
| Fresh-session handoff / current work | [`../STATUS.md`](../STATUS.md) |
| Deferred and closed non-critical bugs | [GitHub issues](https://github.com/peterng1618/vigilia/issues) |
| Product goals, constraints and stable requirements | [`product/requirements.md`](product/requirements.md) |
| What the user has asked for, and whether it is *checked* | [`product/feedback.md`](product/feedback.md) |
| Current system shape and boundaries | [`architecture/README.md`](architecture/README.md) |
| Who owns each concept | [`architecture/ownership.md`](architecture/ownership.md) |
| Why major architecture choices were made | [`adr/`](adr/) |
| Active feature design/spec | [`superpowers/specs/`](superpowers/specs/) |
| Superpowers implementation plans | [`superpowers/plans/`](superpowers/plans/) |
| Non-obvious engineering traps | [`engineering/gotchas.md`](engineering/gotchas.md) |
| Dependency/licence provenance | [`engineering/dependencies.md`](engineering/dependencies.md) |
| Rendered verification evidence | [`evidence/screenshots/`](evidence/screenshots/) |

Implementation truth is always the code and tests. **A fix is not finished because an
agent said so** — `docs/product/feedback.md` carries that state, and
`npm run feedback:check` refuses a `verified` item whose check does not name the
thing the user asked about. A capability proven nearby is not a finding fixed. `STATUS.md` is a compact handoff, not history. Git stores chronology.
`STATUS.md` names exactly one active execution plan. Other incomplete plans are queued until that plan closes; parallelism happens inside the active phase, not across plans.
Superpowers owns change-specific design/planning and its temporary
`.superpowers/sdd/` execution ledger. Do not recreate a separate status,
lessons, spec or plan system elsewhere.
