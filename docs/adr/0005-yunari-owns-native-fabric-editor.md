# ADR-0005: Yunari owns its native Fabric editor

**Status:** Accepted

**Supersedes:** the temporary decision to use an adopted image-editor fork as
the runtime editor foundation.

## Context

The fork proved useful as reference source, but maintaining an adopted editor
package plus Yunari-specific extension/composition layers created another
integration boundary and duplicated ownership.

## Decision

`@yunari/editor` owns interactive canvas lifecycle, history, selection,
transforms, grouping, duplication, object tools and layer operations directly
over pinned `fabric/es`. Reuse proven library/fork source where appropriate,
but do not recreate a generic editor framework or an intermediate fork API.

## Consequences

Generic behaviour is implemented only when Yunari exercises it. Before adding
substantial generic editor mechanics, the reuse-before-build gate in
`AGENTS.md` applies.
