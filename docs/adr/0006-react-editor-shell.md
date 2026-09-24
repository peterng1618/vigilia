# ADR-0006: React owns editor shell chrome

**Status:** Accepted

## Context

The editor needs structured application chrome without making Fabric scene state
declarative.

## Decision

React 19 + Base UI + Tailwind own the editor shell, menus, rail, inspector tabs
and canvas dock. Fabric remains imperative behind the editor interaction/session
boundary and is never mirrored into React state as a second scene model.

## Consequences

React controls application chrome; Fabric controls authored canvas objects.
Player and host keep their own UI implementations.
