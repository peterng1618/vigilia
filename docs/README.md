# Vigilia documentation

This tree separates current project truth from change-specific Superpowers
artifacts and from Git history.

| Need | Canonical source |
|---|---|
| Fresh-session handoff / current work | [`../STATUS.md`](../STATUS.md) |
| Deferred non-critical bugs | [`bugs-registry.md`](bugs-registry.md) |
| Product goals, constraints and stable requirements | [`product/requirements.md`](product/requirements.md) |
| Current system shape and boundaries | [`architecture/README.md`](architecture/README.md) |
| Who owns each concept | [`architecture/ownership.md`](architecture/ownership.md) |
| Why major architecture choices were made | [`adr/`](adr/) |
| Active feature design/spec | [`superpowers/specs/`](superpowers/specs/) |
| Superpowers implementation plans | [`superpowers/plans/`](superpowers/plans/) |
| Non-obvious engineering traps | [`engineering/gotchas.md`](engineering/gotchas.md) |
| Dependency/licence provenance | [`engineering/dependencies.md`](engineering/dependencies.md) |
| Rendered verification evidence | [`evidence/screenshots/`](evidence/screenshots/) |

Implementation truth is always the code and tests. `STATUS.md` is a compact handoff, not history. Git stores chronology.
`STATUS.md` names exactly one active execution plan. Other incomplete plans are queued until that plan closes; parallelism happens inside the active phase, not across plans.
Superpowers owns change-specific design/planning and its temporary
`.superpowers/sdd/` execution ledger. Do not recreate a separate status,
lessons, spec or plan system elsewhere.
