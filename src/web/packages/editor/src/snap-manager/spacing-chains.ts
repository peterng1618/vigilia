import { resolveDisplayDistance } from "./distance.js";
import type { Bounds, SpacingGuide, SpacingPattern } from "./types.js";
import {
  buildAxisSpacingPatternEntries,
  type SpacingPatternEntry,
  type SpacingPatternSource,
} from "./spacing-patterns.js";

/** Tolerance for floating-point and serialisation error in exact intervals. */
const SPACING_CHAIN_DISTANCE_TOLERANCE = 0.001;

/** The active object's id inside the full chain snapshot. */
export const ACTIVE_MOVEMENT_SPACING_SOURCE_ID = "movement-active-target";

/** An exact neighbour interval from the gesture-start snapshot. */
export type MovementSpacingInterval = Readonly<{
  id: string;
  type: SpacingPattern["type"];
  axis: number;
  beforeId: string;
  afterId: string;
  start: number;
  end: number;
  exactDistance: number;
}>;

/** A continuous chain of equal intervals within float tolerance. */
export type MovementSpacingChain = Readonly<{
  id: string;
  type: SpacingPattern["type"];
  axis: number;
  intervals: readonly MovementSpacingInterval[];
  exactRepresentative: number;
  displayDistance: number;
}>;

//** Full snapshot chains for both axes. */
export type MovementSpacingChains = Readonly<{
  vertical: readonly MovementSpacingChain[];
  horizontal: readonly MovementSpacingChain[];
}>;

/** Converts a found interval into the immutable domain model. */
function createMovementSpacingInterval({
  entry,
}: {
  entry: SpacingPatternEntry;
}): MovementSpacingInterval {
  const { pattern, beforeId, afterId } = entry;

  return Object.freeze({
    id: `${pattern.type}:${beforeId}:${afterId}`,
    type: pattern.type,
    axis: pattern.axis,
    beforeId,
    afterId,
    start: pattern.start,
    end: pattern.end,
    exactDistance: pattern.distance,
  });
}

/** Builds a shared chain when a run holds at least two intervals. */
function createMovementSpacingChain({
  entries,
  type,
}: {
  entries: SpacingPatternEntry[];
  type: SpacingPattern["type"];
}): MovementSpacingChain | null {
  if (entries.length < 2) return null;

  const intervals = entries.map((entry) =>
    createMovementSpacingInterval({ entry }),
  );
  const distanceSum = intervals.reduce(
    (sum, interval) => sum + interval.exactDistance,
    0,
  );
  const exactRepresentative = distanceSum / intervals.length;
  const first = intervals[0];
  if (first === undefined) return null;
  const last = intervals[intervals.length - 1];
  if (last === undefined) return null;
  const headEntry = entries[0];
  if (headEntry === undefined) return null;
  let commonCrossStart = headEntry.crossStart;
  let commonCrossEnd = headEntry.crossEnd;

  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === undefined) continue;
    commonCrossStart = Math.max(commonCrossStart, entry.crossStart);
    commonCrossEnd = Math.min(commonCrossEnd, entry.crossEnd);
  }

  return Object.freeze({
    id: `${type}:${first.beforeId}:${last.afterId}`,
    type,
    axis: (commonCrossStart + commonCrossEnd) / 2,
    intervals: Object.freeze(intervals),
    exactRepresentative,
    displayDistance: resolveDisplayDistance({ distance: exactRepresentative }),
  });
}

/** Splits a linked run at the largest spread of exact distances. */
function createConnectedSpacingChains({
  entries,
  type,
}: {
  entries: SpacingPatternEntry[];
  type: SpacingPattern["type"];
}): MovementSpacingChain[] {
  const chains: MovementSpacingChain[] = [];
  let chainStart = 0;

  while (chainStart < entries.length) {
    const firstEntry = entries[chainStart];
    if (firstEntry === undefined) break;
    let chainEnd = chainStart + 1;
    let minimumDistance = firstEntry.pattern.distance;
    let maximumDistance = minimumDistance;
    const displayDistance = resolveDisplayDistance({
      distance: minimumDistance,
    });
    let commonCrossStart = firstEntry.crossStart;
    let commonCrossEnd = firstEntry.crossEnd;

    while (chainEnd < entries.length) {
      const nextEntry = entries[chainEnd];
      if (nextEntry === undefined) break;
      const { distance } = nextEntry.pattern;
      const nextMinimum = Math.min(minimumDistance, distance);
      const nextMaximum = Math.max(maximumDistance, distance);
      const nextCrossStart = Math.max(commonCrossStart, nextEntry.crossStart);
      const nextCrossEnd = Math.min(commonCrossEnd, nextEntry.crossEnd);
      if (nextMaximum - nextMinimum > SPACING_CHAIN_DISTANCE_TOLERANCE) break;
      if (resolveDisplayDistance({ distance }) !== displayDistance) break;
      if (nextCrossEnd < nextCrossStart) break;

      minimumDistance = nextMinimum;
      maximumDistance = nextMaximum;
      commonCrossStart = nextCrossStart;
      commonCrossEnd = nextCrossEnd;
      chainEnd += 1;
    }

    const chain = createMovementSpacingChain({
      entries: entries.slice(chainStart, chainEnd),
      type,
    });
    if (chain) chains.push(chain);
    chainStart = chainEnd;
  }

  return chains;
}

/** Collects linked interval runs of one axis without recursion. */
function createAxisSpacingChains({
  entries,
  type,
}: {
  entries: SpacingPatternEntry[];
  type: SpacingPattern["type"];
}): MovementSpacingChain[] {
  const entryByBeforeId = new Map<string, SpacingPatternEntry>();
  const sourceIdsWithIncomingInterval = new Set<string>();
  const chains: MovementSpacingChain[] = [];

  for (const entry of entries) {
    entryByBeforeId.set(entry.beforeId, entry);
    sourceIdsWithIncomingInterval.add(entry.afterId);
  }

  for (const firstEntry of entries) {
    if (sourceIdsWithIncomingInterval.has(firstEntry.beforeId)) continue;

    const connected: SpacingPatternEntry[] = [];
    let current: SpacingPatternEntry | undefined = firstEntry;
    for (let step = 0; current && step < entries.length; step += 1) {
      connected.push(current);
      current = entryByBeforeId.get(current.afterId);
    }

    chains.push(...createConnectedSpacingChains({ entries: connected, type }));
  }

  return chains;
}

/** Builds immutable chains from the full snapshot, active object included. */
export function createMovementSpacingChains({
  sources,
}: {
  sources: SpacingPatternSource[];
}): MovementSpacingChains {
  const verticalEntries = buildAxisSpacingPatternEntries({
    sources,
    type: "vertical",
    primaryStart: "top",
    primaryEnd: "bottom",
  });
  const horizontalEntries = buildAxisSpacingPatternEntries({
    sources,
    type: "horizontal",
    primaryStart: "left",
    primaryEnd: "right",
  });

  return Object.freeze({
    vertical: Object.freeze(
      createAxisSpacingChains({ entries: verticalEntries, type: "vertical" }),
    ),
    horizontal: Object.freeze(
      createAxisSpacingChains({
        entries: horizontalEntries,
        type: "horizontal",
      }),
    ),
  });
}

//** Checks whether an exact interval belongs to the given chain. */
export function movementSpacingChainIncludesPattern({
  chain,
  pattern,
}: {
  chain: MovementSpacingChain;
  pattern: SpacingPattern | null;
}): boolean {
  if (!pattern) return false;

  return chain.intervals.some((interval) => {
    return (
      interval.type === pattern.type &&
      interval.axis === pattern.axis &&
      interval.start === pattern.start &&
      interval.end === pattern.end &&
      interval.exactDistance === pattern.distance
    );
  });
}

//** Ensures the object participates in at least one chain interval. */
export function movementSpacingChainIncludesSource({
  chain,
  sourceId,
}: {
  chain: MovementSpacingChain;
  sourceId: string;
}): boolean {
  return chain.intervals.some((interval) => {
    return interval.beforeId === sourceId || interval.afterId === sourceId;
  });
}

//** Returns a chain from the immutable snapshot by its stable id. */
export function findMovementSpacingChainById({
  chains,
  chainId,
}: {
  chains: MovementSpacingChains;
  chainId: string | null;
}): MovementSpacingChain | null {
  if (!chainId) return null;

  for (const chain of [...chains.horizontal, ...chains.vertical]) {
    if (chain.id === chainId) return chain;
  }

  return null;
}

//** Substitutes the active object's final bounds into one interval. */
function materializeMovementSpacingInterval({
  interval,
  activeSourceId,
  activeBounds,
}: {
  interval: MovementSpacingInterval;
  activeSourceId: string;
  activeBounds: Bounds;
}): { start: number; end: number } {
  const isHorizontal = interval.type === "horizontal";
  const activeStart = isHorizontal ? activeBounds.left : activeBounds.top;
  const activeEnd = isHorizontal ? activeBounds.right : activeBounds.bottom;

  return {
    start: interval.beforeId === activeSourceId ? activeEnd : interval.start,
    end: interval.afterId === activeSourceId ? activeStart : interval.end,
  };
}

//** Builds guides that together render every interval of a verified chain. */
export function createMovementSpacingChainGuides({
  chain,
  activeSourceId,
  activeBounds,
}: {
  chain: MovementSpacingChain;
  activeSourceId: string;
  activeBounds: Bounds;
}): SpacingGuide[] {
  const includesActive = movementSpacingChainIncludesSource({
    chain,
    sourceId: activeSourceId,
  });
  if (!includesActive) return [];
  const activeCrossStart =
    chain.type === "horizontal" ? activeBounds.top : activeBounds.left;
  const activeCrossEnd =
    chain.type === "horizontal" ? activeBounds.bottom : activeBounds.right;
  if (chain.axis < activeCrossStart || chain.axis > activeCrossEnd) return [];

  const intervals = chain.intervals.map((interval) => {
    return materializeMovementSpacingInterval({
      interval,
      activeSourceId,
      activeBounds,
    });
  });
  const guides: SpacingGuide[] = [];

  for (let index = 1; index < intervals.length; index += 1) {
    const reference = intervals[index - 1];
    const active = intervals[index];
    if (reference === undefined || active === undefined) continue;
    guides.push({
      type: chain.type,
      axis: chain.axis,
      refStart: reference.start,
      refEnd: reference.end,
      activeStart: active.start,
      activeEnd: active.end,
      distance: chain.displayDistance,
    });
  }

  return guides;
}
