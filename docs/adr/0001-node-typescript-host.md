# ADR-0001: Node/TypeScript host

**Status:** Accepted

## Context

Vigilia's browser contracts and application code are TypeScript. Earlier .NET
host scaffolding was never built or required by the product.

## Decision

The PC host is Node/TypeScript in the existing workspace. The published CLI is
`vigilia-dashboard`; plain `vigilia` on npm is unrelated. Vigilia requires no
.NET or Python runtime.

## Consequences

Host/browser contracts can share TypeScript types and tests. Platform-specific
hardware integrations stay behind host/provider boundaries rather than adding a
second application runtime.
