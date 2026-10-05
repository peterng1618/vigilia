# ADR-0008: Video is background media, not a scene object

**Status:** Accepted

## Context

Putting continuously changing video inside Fabric would force whole-scene
repainting and couple media playback to authored object mechanics.

## Decision

A theme may have one aligned video background beneath the transparent Fabric
canvas. It follows the artboard transform but is not a normal scene object and
does not participate in grouping, rotation or object history.

## Consequences

Video decoding/playback stays separate from the Fabric scene. Static authored
objects do not repaint merely because the background advances a frame.
