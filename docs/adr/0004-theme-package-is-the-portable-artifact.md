# ADR-0004: Theme package is the portable artifact

**Status:** Accepted

## Context

Themes can reference fonts, images and background media, so a standalone theme
file is insufficient for sharing or future distribution.

## Decision

`@vigilia/theme-package` owns the bounded ZIP layout and validation for
asset-bearing themes. A validated package ZIP is the immutable portable/share
artifact. Local folders may be authoring workspaces but never a competing
published format.

## Consequences

Callers own storage/UI while the package library owns archive layout and safety.
Export creates an explicit snapshot; folder and package state do not silently
synchronize.
