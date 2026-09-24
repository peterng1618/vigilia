# ADR-0009: Sensor providers are capability-driven

**Status:** Accepted

## Context

Hardware capability differs by machine and provider. Pretending unsupported
values exist would make a monitoring product untrustworthy.

## Decision

Providers discover/report actual capability and never fabricate readings.
Themes bind semantic sensor keys, not provider instances. Providers acquire;
the host owns scheduling, failure isolation and fallback. A non-`ok` sample
does not claim a key if a later provider can answer it.

## Consequences

Missing/unavailable data remains explicit. Existing external programs or
maintained libraries are preferred over building a new hardware collector.
