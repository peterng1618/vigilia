# ADR-0005: Vigilia owns its native Fabric editor

**Status:** Accepted

**Supersedes:** the temporary decision to use an adopted image-editor fork as
the runtime editor foundation.

## Context

The fork proved useful as reference source, but maintaining an adopted editor
package plus Vigilia-specific extension/composition layers created another
integration boundary and duplicated ownership.

## Decision

`@vigilia/editor` owns interactive canvas lifecycle, history, selection,
transforms, grouping, duplication, object tools and layer operations directly
over pinned `fabric/es`. Reuse proven library/fork source where appropriate,
but do not recreate a generic editor framework or an intermediate fork API.

## Consequences

Generic behaviour is implemented only when Vigilia exercises it. Before adding
substantial generic editor mechanics, the reuse-before-build gate in
`AGENTS.md` applies.
