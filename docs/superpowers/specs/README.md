# Superpowers specs

Superpowers owns Vigilia's design/spec workflow. New design/spec artifacts belong
here; do not create a parallel `.agents/specs/` system.

## Where a spec stands

Every spec opens with a `- **Status:**` line, so the directory is readable without
opening files. The states, and what each obliges:

| Status | Means |
|---|---|
| `active` | Named by `STATUS.md` as the one executing plan's authority |
| `in progress` | Its plan has landed tasks and open ones, but is queued behind the active plan |
| `queued` | Recon says work remains; no part is executing |
| `implemented` | Every acceptance item is met or explicitly carried elsewhere |
| `backlog` | Review notes, not accepted requirements — `2026-09-24-editor-behaviour-review.md` |
| `design` | An origin document whose product shipped through other plans |

`implemented` is a claim about evidence, not about checkboxes. A spec is not
implemented because its tasks look done; it is implemented when its Acceptance
section records what was actually observed. Record that observation in the same
commit that lands the last item.

## Archiving

Specs stay here after their work ships. `docs/product/requirements.md` and
`docs/architecture/ownership.md` link **into** this directory (`Design: [...]`
lines), and a shipped spec is the design record for the requirement it produced —
moving it breaks those links and orphans the requirement.

Move a spec to `archive/` only when its requirements have been promoted into
`docs/product/requirements.md` **and** its plan is archived, and update the
inbound `Design:` links in the same commit. Nothing in the directory currently
qualifies. `archive/` mirrors `plans/archive/`; create it with the first move.

Delete a spec only when it is neither a current contract, nor a requirement's
design record, nor a useful review backlog — and then delete its `Design:` links
too, reporting the requirement as having lost its design.
