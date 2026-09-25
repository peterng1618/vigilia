// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/scaling-step-snap-guards.ts
/* eslint-disable no-use-before-define -- the public resolver sits above its internal calculations. */
import type { FabricObject, Transform } from "fabric/es";
import {
  getObjectBounds,
  getObjectExactBounds,
  type ObjectBounds,
} from "../bounds.js";
import {
  SNAP_GUARD_POSITION_EPSILON,
  SOURCE_SCALED_GUIDE_HOLD_EPSILON,
  getBoundsSnapGuardDistance,
  isBoundsInsideSnapGuard,
  isBoundsOnSnapGuide,
  type ScalingStepSnapGuard,
} from "./scaling-snap-guard.js";

export type { ScalingStepSnapGuard } from "./scaling-snap-guard.js";

/** Tolerance for the current scale around a fractional guide after bounds rounding. */
const SOURCE_SCALED_RAW_GUIDE_POSITION_EPSILON = 0.5;

/** Tolerance for comparing the source-image size with a whole pixel. */
const DISPLAY_SIZE_INTEGER_EPSILON = 0.000001;

/** Tolerance for size drift after the resize plan is applied. */
const SNAP_PLAN_DISPLAY_SIZE_EPSILON = 0.02;

/** Tolerance for comparing the source image's scale with the canvas scale. */
const SOURCE_DISPLAY_SCALE_EPSILON = 0.000001;

/** A scale candidate after the size has been rounded to a whole pixel. */
export type ScalingStepCandidate = {
  scaleX: number;
  scaleY: number;
};

/** The reference point that must be preserved while the scale is rounded. */
type ScalingStepPlacement = {
  left: number;
  top: number;
  originX: FabricObject["originX"];
  originY: FabricObject["originY"];
};

/** The reference-point restoration contract for one scale-rounding step. */
export type ScalingStepPlacementPreserver = {
  placement: ScalingStepPlacement;
  applyPlacement: (placement: ScalingStepPlacement) => void;
};

/** Parameters for choosing the scale that preserves the active guides. */
export type GuardedScalingStepParams = {
  target: FabricObject;
  transform?: Transform | null;
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  fallbackScale: ScalingStepCandidate;
  isUniform: boolean;
  preservePlacement?: ScalingStepPlacementPreserver;
  snapGuards: ScalingStepSnapGuard[];
};

/** The candidate's position relative to the held guide. */
type ScalingStepCandidateSnapState = "on-guide" | "inside" | "outside";

/** A candidate's check against the held guide. */
type ScalingStepCandidateSnapMatch = {
  state: ScalingStepCandidateSnapState;
  distance: number;
};

/** Parameters for enumerating scale candidates against the active guides. */
interface GuardedScalingCandidateMatchParams {
  target: FabricObject;
  candidates: ScalingStepCandidate[];
  preservePlacement?: ScalingStepPlacementPreserver;
  snapGuards: ScalingStepSnapGuard[];
}

/** Parameters for choosing the candidate that preserves the active guides. */
interface GuardedScalingCandidateSelectorParams
  extends GuardedScalingCandidateMatchParams {
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  shouldPreferInsideCandidate: boolean;
}

/** Parameters for checking a scale that already holds an edge on a guide. */
interface RetainedGuideScalingCandidateParams {
  target: FabricObject;
  transform?: Transform | null;
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  preservePlacement?: ScalingStepPlacementPreserver;
  snapGuards: ScalingStepSnapGuard[];
}

/** The best candidates for the mode that prioritises being inside the guide. */
interface InsideFirstScalingCandidateSelection {
  insideCandidate: ScalingStepCandidate | null;
  onGuideCandidate: ScalingStepCandidate | null;
}

/** An object whose indicator size may be measured in source-image pixels. */
interface SourceDisplaySizeTarget extends FabricObject {
  cropSource?: FabricObject | null;
  cropSourceScaleX?: number;
  cropSourceScaleY?: number;
  /** The fork declares this on its global Fabric augmentation; here it is local. */
  getObjectDisplaySize?(): { width: number; height: number };
}

/** The result of checking one candidate against the active guides. */
interface ScalingStepCandidateMatchResult {
  candidate: ScalingStepCandidate;
  snapMatch: ScalingStepCandidateSnapMatch;
}

/**
 * Returns the nearest scale that does not carry the held edge past the guide.
 */
export function resolveGuardedScalingStep({
  target,
  transform,
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  fallbackScale,
  isUniform,
  preservePlacement,
  snapGuards,
}: GuardedScalingStepParams): ScalingStepCandidate {
  const retainedGuideCandidate = resolveRetainedGuideScalingCandidate({
    target,
    ...(transform !== undefined ? { transform } : {}),
    rawScaleX,
    rawScaleY,
    effectiveWidth,
    effectiveHeight,
    ...(preservePlacement ? { preservePlacement } : {}),
    snapGuards,
  });
  if (retainedGuideCandidate) return retainedGuideCandidate;

  const candidates = collectScalingStepCandidates({
    rawScaleX,
    rawScaleY,
    effectiveWidth,
    effectiveHeight,
    isUniform,
  });
  const shouldPreferInsideCandidate = shouldPreferInsideScalingCandidate({
    target,
    snapGuards,
  });

  const guardedCandidate = selectGuardedScalingCandidate({
    target,
    rawScaleX,
    rawScaleY,
    effectiveWidth,
    effectiveHeight,
    candidates,
    ...(preservePlacement ? { preservePlacement } : {}),
    shouldPreferInsideCandidate,
    snapGuards,
  });

  return guardedCandidate ?? fallbackScale;
}

/**
 * Returns the scale if the current resize already holds the needed edge on the guide.
 */
function resolveRetainedGuideScalingCandidate({
  target,
  transform,
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  preservePlacement,
  snapGuards,
}: RetainedGuideScalingCandidateParams): ScalingStepCandidate | null {
  if (
    shouldKeepCurrentGuideSnap({
      target,
      snapGuards,
    })
  ) {
    return {
      scaleX: rawScaleX,
      scaleY: rawScaleY,
    };
  }

  const heldSourceCandidate = resolveSourceScaledGuideHoldCandidate({
    target,
    effectiveWidth,
    effectiveHeight,
    ...(transform !== undefined ? { transform } : {}),
    ...(preservePlacement ? { preservePlacement } : {}),
    snapGuards,
  });
  if (heldSourceCandidate) return heldSourceCandidate;

  return resolveSourceScaledRawGuideCandidate({
    target,
    rawScaleX,
    rawScaleY,
    effectiveWidth,
    effectiveHeight,
    ...(preservePlacement ? { preservePlacement } : {}),
    snapGuards,
  });
}

/**
 * Returns the current scale if the resize plan already put the crop frame on an inner guide.
 * For the source's outer boundary the current scale does not qualify: there the candidate
 * exactly on the guide takes priority.
 */
function resolveSourceScaledRawGuideCandidate({
  target,
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  preservePlacement,
  snapGuards,
}: {
  target: FabricObject;
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  preservePlacement?: ScalingStepPlacementPreserver;
  snapGuards: ScalingStepSnapGuard[];
}): ScalingStepCandidate | null {
  if (!usesScaledDisplaySizeForSnapGuards({ target, snapGuards })) return null;
  if (usesSourceBoundarySnapGuards({ target, snapGuards })) return null;

  const candidate = {
    scaleX: rawScaleX,
    scaleY: rawScaleY,
  };
  const isNearGuide = isScalingCandidateNearSnapGuards({
    target,
    candidate,
    ...(preservePlacement ? { preservePlacement } : {}),
    maxDistance: SOURCE_SCALED_RAW_GUIDE_POSITION_EPSILON,
    snapGuards,
  });
  if (!isNearGuide) return null;
  if (
    !isScalingCandidateInsideRoundedSourceGuideDisplayLimits({
      target,
      candidate,
      effectiveWidth,
      effectiveHeight,
      snapGuards,
    })
  ) {
    return null;
  }

  return candidate;
}

/**
 * Returns the scale from the start of the Fabric transform if the crop frame already held
 * an inner source guide.
 */
function resolveSourceScaledGuideHoldCandidate({
  target,
  transform,
  effectiveWidth,
  effectiveHeight,
  preservePlacement,
  snapGuards,
}: {
  target: FabricObject;
  transform?: Transform | null;
  effectiveWidth: number;
  effectiveHeight: number;
  preservePlacement?: ScalingStepPlacementPreserver;
  snapGuards: ScalingStepSnapGuard[];
}): ScalingStepCandidate | null {
  if (!shouldPreferInsideScalingCandidate({ target, snapGuards })) return null;

  const { scaleX, scaleY } = transform?.original ?? {};
  if (typeof scaleX !== "number" || typeof scaleY !== "number") return null;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return null;

  const candidate = {
    scaleX,
    scaleY,
  };
  const isNearGuide = isScalingCandidateNearSnapGuards({
    target,
    candidate,
    ...(preservePlacement ? { preservePlacement } : {}),
    snapGuards,
  });
  const isInsideSourceGuideLimit =
    isScalingCandidateInsideSourceGuideDisplayLimits({
      target,
      candidate,
      effectiveWidth,
      effectiveHeight,
      snapGuards,
    });

  if (!isNearGuide) return null;
  if (!isInsideSourceGuideLimit) return null;

  return candidate;
}

/**
 * Checks that the candidate stays near the guide the scale was already held at.
 */
function isScalingCandidateNearSnapGuards({
  target,
  candidate,
  preservePlacement,
  maxDistance = SOURCE_SCALED_GUIDE_HOLD_EPSILON,
  snapGuards,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  preservePlacement?: ScalingStepPlacementPreserver;
  maxDistance?: number;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  const bounds = readScalingStepCandidateBounds({
    target,
    candidate,
    ...(preservePlacement ? { preservePlacement } : {}),
  });
  if (!bounds) return false;

  for (const snapGuard of snapGuards) {
    const distance = getBoundsSnapGuardDistance({
      bounds,
      snapGuard,
    });
    if (distance > maxDistance) return false;
  }

  return true;
}

/**
 * Checks that the held size does not leave the part of the source inside the guide.
 */
function isScalingCandidateInsideSourceGuideDisplayLimits({
  target,
  candidate,
  effectiveWidth,
  effectiveHeight,
  snapGuards,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  return isScalingCandidateInsideSourceGuideLimits({
    target,
    candidate,
    effectiveWidth,
    effectiveHeight,
    snapGuards,
    shouldRoundSourceLimit: false,
  });
}

/**
 * Checks that the rounded size near the guide does not exceed the rounded part of the source.
 */
function isScalingCandidateInsideRoundedSourceGuideDisplayLimits({
  target,
  candidate,
  effectiveWidth,
  effectiveHeight,
  snapGuards,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  return isScalingCandidateInsideSourceGuideLimits({
    target,
    candidate,
    effectiveWidth,
    effectiveHeight,
    snapGuards,
    shouldRoundSourceLimit: true,
  });
}

/**
 * Checks the candidate's size on every axis the guide holds.
 */
function isScalingCandidateInsideSourceGuideLimits({
  target,
  candidate,
  effectiveWidth,
  effectiveHeight,
  snapGuards,
  shouldRoundSourceLimit,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuards: ScalingStepSnapGuard[];
  shouldRoundSourceLimit: boolean;
}): boolean {
  for (const snapGuard of snapGuards) {
    const displaySize = getCandidateDisplaySizeForSnapGuard({
      candidate,
      effectiveWidth,
      effectiveHeight,
      snapGuard,
    });
    const isInsideLimit = shouldRoundSourceLimit
      ? isInsideRoundedSourceGuideDisplayLimit({
          target,
          displaySize,
          snapGuard,
        })
      : isInsideSourceGuideDisplayLimit({
          target,
          displaySize,
          snapGuard,
        });

    if (!isInsideLimit) return false;
  }

  return true;
}

/**
 * Returns the candidate's size on the axis the guide holds.
 */
function getCandidateDisplaySizeForSnapGuard({
  candidate,
  effectiveWidth,
  effectiveHeight,
  snapGuard,
}: {
  candidate: ScalingStepCandidate;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuard: ScalingStepSnapGuard;
}): number {
  return snapGuard.type === "vertical"
    ? Math.abs(candidate.scaleX) * effectiveWidth
    : Math.abs(candidate.scaleY) * effectiveHeight;
}

/**
 * Returns the current movement's size on the axis the guide holds.
 */
function getRawDisplaySizeForSnapGuard({
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  snapGuard,
}: {
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuard: ScalingStepSnapGuard;
}): number {
  return snapGuard.type === "vertical"
    ? Math.abs(rawScaleX) * effectiveWidth
    : Math.abs(rawScaleY) * effectiveHeight;
}

/**
 * Checks the rounded size against the part of the source inside the guide.
 */
function isInsideRoundedSourceGuideDisplayLimit({
  target,
  displaySize,
  snapGuard,
}: {
  target: FabricObject;
  displaySize: number;
  snapGuard: ScalingStepSnapGuard;
}): boolean {
  const sourceDisplayLength = resolveSourceGuideDisplayLength({
    target,
    snapGuard,
  });
  if (sourceDisplayLength === null) return false;

  const roundedSourceDisplayLimit = Math.round(
    sourceDisplayLength + DISPLAY_SIZE_INTEGER_EPSILON,
  );

  return Math.round(displaySize) <= roundedSourceDisplayLimit;
}

/**
 * Chooses the candidate that stays inside the active guides.
 */
function selectGuardedScalingCandidate({
  target,
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  candidates,
  preservePlacement,
  shouldPreferInsideCandidate,
  snapGuards,
}: GuardedScalingCandidateSelectorParams): ScalingStepCandidate | null {
  if (!shouldPreferInsideCandidate) {
    return selectOnGuideFirstScalingCandidate({
      target,
      candidates,
      ...(preservePlacement ? { preservePlacement } : {}),
      snapGuards,
    });
  }

  const { insideCandidate, onGuideCandidate } =
    selectInsideFirstScalingCandidates({
      target,
      candidates,
      ...(preservePlacement ? { preservePlacement } : {}),
      snapGuards,
    });

  if (
    onGuideCandidate &&
    shouldKeepOnGuideScalingCandidate({
      target,
      candidate: onGuideCandidate,
      rawScaleX,
      rawScaleY,
      effectiveWidth,
      effectiveHeight,
      snapGuards,
    })
  ) {
    return onGuideCandidate;
  }

  if (insideCandidate) return insideCandidate;
  if (onGuideCandidate) return onGuideCandidate;

  return null;
}

/**
 * Chooses the first candidate exactly on a guide, falling back to the first inside one.
 */
function selectOnGuideFirstScalingCandidate({
  target,
  candidates,
  preservePlacement,
  snapGuards,
}: GuardedScalingCandidateMatchParams): ScalingStepCandidate | null {
  let insideCandidate: ScalingStepCandidate | null = null;

  for (const candidate of candidates) {
    const snapMatch = resolveScalingStepCandidateSnapMatch({
      target,
      candidate,
      ...(preservePlacement ? { preservePlacement } : {}),
      snapGuards,
    });

    if (snapMatch.state === "on-guide") return candidate;

    if (snapMatch.state === "inside" && !insideCandidate) {
      insideCandidate = candidate;
    }
  }

  return insideCandidate;
}

/**
 * The best candidates for the mode where being inside the guide outranks landing exactly on it.
 */
function selectInsideFirstScalingCandidates({
  target,
  candidates,
  preservePlacement,
  snapGuards,
}: GuardedScalingCandidateMatchParams): InsideFirstScalingCandidateSelection {
  const matches = candidates.map((candidate) => {
    return {
      candidate,
      snapMatch: resolveScalingStepCandidateSnapMatch({
        target,
        candidate,
        ...(preservePlacement ? { preservePlacement } : {}),
        snapGuards,
      }),
    };
  });

  return {
    insideCandidate: findClosestInsideScalingCandidate({ matches }),
    onGuideCandidate: findFirstOnGuideScalingCandidate({ matches }),
  };
}

/**
 * Returns the first candidate that sits exactly on every guide.
 */
function findFirstOnGuideScalingCandidate({
  matches,
}: {
  matches: ScalingStepCandidateMatchResult[];
}): ScalingStepCandidate | null {
  const match = matches.find((candidateMatch) => {
    return candidateMatch.snapMatch.state === "on-guide";
  });

  return match?.candidate ?? null;
}

/**
 * Returns the nearest candidate that stays inside every guide.
 */
function findClosestInsideScalingCandidate({
  matches,
}: {
  matches: ScalingStepCandidateMatchResult[];
}): ScalingStepCandidate | null {
  let closestCandidate: ScalingStepCandidate | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const { candidate, snapMatch } of matches) {
    if (snapMatch.state !== "inside") continue;
    if (snapMatch.distance >= closestDistance) continue;

    closestCandidate = candidate;
    closestDistance = snapMatch.distance;
  }

  return closestCandidate;
}

/**
 * Keeps the candidate on the guide if the active axes already landed on a whole source pixel.
 */
function shouldKeepOnGuideScalingCandidate({
  target,
  candidate,
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  snapGuards,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  for (const snapGuard of snapGuards) {
    if (
      !shouldKeepOnGuideSnapGuardCandidate({
        target,
        candidate,
        rawScaleX,
        rawScaleY,
        effectiveWidth,
        effectiveHeight,
        snapGuard,
      })
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Checks one guide for the candidate that sits exactly on the guide.
 */
function shouldKeepOnGuideSnapGuardCandidate({
  target,
  candidate,
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  snapGuard,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  snapGuard: ScalingStepSnapGuard;
}): boolean {
  const displaySize = getCandidateDisplaySizeForSnapGuard({
    candidate,
    effectiveWidth,
    effectiveHeight,
    snapGuard,
  });
  const rawDisplaySize = getRawDisplaySizeForSnapGuard({
    rawScaleX,
    rawScaleY,
    effectiveWidth,
    effectiveHeight,
    snapGuard,
  });

  if (!isIntegerDisplaySize({ displaySize })) return false;
  if (
    !isSameSnappedDisplaySize({
      displaySize,
      rawDisplaySize,
    })
  ) {
    return false;
  }

  return isInsideSourceGuideDisplayLimit({
    target,
    displaySize,
    snapGuard,
  });
}

/**
 * Checks that the size already matches a whole pixel.
 */
function isIntegerDisplaySize({
  displaySize,
}: {
  displaySize: number;
}): boolean {
  const integerSize = Math.round(displaySize);

  return Math.abs(displaySize - integerSize) <= DISPLAY_SIZE_INTEGER_EPSILON;
}

/**
 * Checks that the candidate on the guide does not grow the size, only removes float drift.
 */
function isSameSnappedDisplaySize({
  displaySize,
  rawDisplaySize,
}: {
  displaySize: number;
  rawDisplaySize: number;
}): boolean {
  return (
    Math.abs(displaySize - rawDisplaySize) <= SNAP_PLAN_DISPLAY_SIZE_EPSILON
  );
}

/**
 * Checks that the candidate on the guide has not grown past the part of the source the crop
 * frame is held inside.
 */
function isInsideSourceGuideDisplayLimit({
  target,
  displaySize,
  snapGuard,
}: {
  target: FabricObject;
  displaySize: number;
  snapGuard: ScalingStepSnapGuard;
}): boolean {
  const sourceDisplayLimit = resolveSourceGuideDisplayLimit({
    target,
    snapGuard,
  });
  if (sourceDisplayLimit === null) return false;

  return Math.round(displaySize) <= sourceDisplayLimit;
}

/**
 * Returns the size of the part of the source inside the guide.
 */
function resolveSourceGuideDisplayLimit({
  target,
  snapGuard,
}: {
  target: FabricObject;
  snapGuard: ScalingStepSnapGuard;
}): number | null {
  const sourceDisplayLength = resolveSourceGuideDisplayLength({
    target,
    snapGuard,
  });
  if (sourceDisplayLength === null) return null;

  return Math.round(sourceDisplayLength + DISPLAY_SIZE_INTEGER_EPSILON);
}

/**
 * Returns the length of the part of the source inside the guide.
 */
function resolveSourceGuideDisplayLength({
  target,
  snapGuard,
}: {
  target: FabricObject;
  snapGuard: ScalingStepSnapGuard;
}): number | null {
  const displayTarget = target as SourceDisplaySizeTarget;
  const { cropSource } = displayTarget;
  if (!cropSource) return null;

  const sourceBounds = getObjectExactBounds({ object: cropSource });
  if (!sourceBounds) return null;

  const sourceScale =
    snapGuard.type === "vertical"
      ? Math.abs(displayTarget.cropSourceScaleX ?? 1)
      : Math.abs(displayTarget.cropSourceScaleY ?? 1);
  if (!Number.isFinite(sourceScale) || sourceScale <= 0) return null;

  const sceneLength = getSourceGuideSceneLength({
    sourceBounds,
    snapGuard,
  });
  if (!Number.isFinite(sceneLength) || sceneLength <= 0) return null;

  return sceneLength / sourceScale;
}

/**
 * Returns the canvas length from the inner guide to the source's outer boundary.
 */
function getSourceGuideSceneLength({
  sourceBounds,
  snapGuard,
}: {
  sourceBounds: ObjectBounds;
  snapGuard: ScalingStepSnapGuard;
}): number {
  const { edge, position } = snapGuard;

  if (edge === "left") return sourceBounds.right - position;
  if (edge === "right") return position - sourceBounds.left;
  if (edge === "top") return sourceBounds.bottom - position;

  return position - sourceBounds.top;
}

/**
 * Returns true if the source-pixel size must be held inside the guide while rounding.
 * For the source's outer boundary the candidate on the guide keeps priority, so the snap
 * does not eat a pixel.
 */
function shouldPreferInsideScalingCandidate({
  target,
  snapGuards,
}: {
  target: FabricObject;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  if (!usesScaledDisplaySizeForSnapGuards({ target, snapGuards })) return false;

  return !usesSourceBoundarySnapGuards({ target, snapGuards });
}

/**
 * Returns true if the current scale already holds an edge on the guide,
 * and the object's size is measured in the same canvas coordinates as the guide.
 */
function shouldKeepCurrentGuideSnap({
  target,
  snapGuards,
}: {
  target: FabricObject;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  if (usesScaledDisplaySizeForSnapGuards({ target, snapGuards })) return false;

  const bounds = getObjectBounds({ object: target });
  if (!bounds) return false;

  for (const snapGuard of snapGuards) {
    if (!isBoundsOnSnapGuide({ bounds, snapGuard })) return false;
    if (!hasValidRoundedBoundsSize({ bounds, snapGuard })) return false;
  }

  return true;
}

/**
 * Returns true if an active guide axis shows the size in source pixels with a separate scale.
 */
function usesScaledDisplaySizeForSnapGuards({
  target,
  snapGuards,
}: {
  target: FabricObject;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  const displayTarget = target as SourceDisplaySizeTarget;
  if (typeof displayTarget.getObjectDisplaySize !== "function") return false;

  const usesScaledX = snapGuards.some((snapGuard) => {
    return (
      snapGuard.type === "vertical" &&
      !isSceneDisplayScale({
        ...(displayTarget.cropSourceScaleX !== undefined
          ? { scale: displayTarget.cropSourceScaleX }
          : {}),
      })
    );
  });
  const usesScaledY = snapGuards.some((snapGuard) => {
    return (
      snapGuard.type === "horizontal" &&
      !isSceneDisplayScale({
        ...(displayTarget.cropSourceScaleY !== undefined
          ? { scale: displayTarget.cropSourceScaleY }
          : {}),
      })
    );
  });

  return usesScaledX || usesScaledY;
}

/**
 * Returns true if at least one active guide is pinned to the source's outer boundary.
 */
function usesSourceBoundarySnapGuards({
  target,
  snapGuards,
}: {
  target: FabricObject;
  snapGuards: ScalingStepSnapGuard[];
}): boolean {
  const displayTarget = target as SourceDisplaySizeTarget;
  const { cropSource } = displayTarget;
  if (!cropSource) return false;

  const sourceBounds = getObjectBounds({ object: cropSource });
  if (!sourceBounds) return false;

  return snapGuards.some((snapGuard) => {
    return isSnapGuardAtSourceBoundary({
      snapGuard,
      sourceBounds,
    });
  });
}

/**
 * Checks whether the guide coincides with the corresponding outer boundary of the source.
 */
function isSnapGuardAtSourceBoundary({
  snapGuard,
  sourceBounds,
}: {
  snapGuard: ScalingStepSnapGuard;
  sourceBounds: ObjectBounds;
}): boolean {
  const { edge, position } = snapGuard;
  let boundary = sourceBounds.bottom;

  if (edge === "left") boundary = sourceBounds.left;
  if (edge === "right") boundary = sourceBounds.right;
  if (edge === "top") boundary = sourceBounds.top;

  return isCloseToSourceBoundary({
    position,
    boundary,
  });
}

/**
 * Compares the guide with the source's boundary in canvas coordinates.
 */
function isCloseToSourceBoundary({
  position,
  boundary,
}: {
  position: number;
  boundary: number;
}): boolean {
  return Math.abs(position - boundary) <= SNAP_GUARD_POSITION_EPSILON;
}

/**
 * Returns true if the size axis coincides with the canvas pixel axis.
 */
function isSceneDisplayScale({ scale }: { scale?: number }): boolean {
  const safeScale = Math.abs(scale ?? 1);

  return Math.abs(safeScale - 1) <= SOURCE_DISPLAY_SCALE_EPSILON;
}

/**
 * Checks that the actual size on the guide's axis can be shown as a valid pixel size.
 */
function hasValidRoundedBoundsSize({
  bounds,
  snapGuard,
}: {
  bounds: ObjectBounds;
  snapGuard: ScalingStepSnapGuard;
}): boolean {
  const boundsSize =
    snapGuard.type === "vertical"
      ? bounds.right - bounds.left
      : bounds.bottom - bounds.top;

  if (!Number.isFinite(boundsSize) || boundsSize <= 0) return false;

  return Math.round(boundsSize) > 0;
}

/**
 * Collects the scale-rounding candidates, starting with the nearest to the current scale.
 */
function collectScalingStepCandidates({
  rawScaleX,
  rawScaleY,
  effectiveWidth,
  effectiveHeight,
  isUniform,
}: {
  rawScaleX: number;
  rawScaleY: number;
  effectiveWidth: number;
  effectiveHeight: number;
  isUniform: boolean;
}): ScalingStepCandidate[] {
  const scaleXCandidates = collectAxisScaleCandidates({
    rawScale: rawScaleX,
    effectiveSize: effectiveWidth,
  });
  const scaleYCandidates = collectAxisScaleCandidates({
    rawScale: rawScaleY,
    effectiveSize: effectiveHeight,
  });

  if (isUniform) {
    return collectUniformScaleCandidates({
      scaleXCandidates,
      scaleYCandidates,
      rawScale: rawScaleX,
    });
  }

  return collectAxisScaleCandidatePairs({
    scaleXCandidates,
    scaleYCandidates,
    rawScaleX,
    rawScaleY,
  });
}

/**
 * Collects one axis's scale candidates from the current size and the neighbouring pixel sizes.
 */
function collectAxisScaleCandidates({
  rawScale,
  effectiveSize,
}: {
  rawScale: number;
  effectiveSize: number;
}): number[] {
  if (effectiveSize <= 0) return [rawScale];

  const scaleSign = rawScale < 0 ? -1 : 1;
  const rawDisplaySize = Math.abs(rawScale) * effectiveSize;
  const roundedDisplaySize = Math.round(rawDisplaySize);
  const floorDisplaySize = Math.floor(rawDisplaySize);
  const ceilDisplaySize = Math.ceil(rawDisplaySize);
  const displaySizes = [
    roundedDisplaySize,
    floorDisplaySize,
    ceilDisplaySize,
    floorDisplaySize - 1,
    ceilDisplaySize + 1,
  ];
  const candidates: number[] = [];

  for (const displaySize of displaySizes) {
    const safeDisplaySize = Math.max(1, displaySize);
    addUniqueScaleCandidate({
      candidates,
      scale: (safeDisplaySize / effectiveSize) * scaleSign,
    });
  }

  candidates.sort((first, second) => {
    return Math.abs(first - rawScale) - Math.abs(second - rawScale);
  });

  return candidates;
}

/**
 * Adds a scale candidate without duplicates from coinciding pixel sizes.
 */
function addUniqueScaleCandidate({
  candidates,
  scale,
}: {
  candidates: number[];
  scale: number;
}): void {
  if (!Number.isFinite(scale)) return;
  if (candidates.includes(scale)) return;

  candidates.push(scale);
}

/**
 * Collects the uniform scale candidates from both axes.
 */
function collectUniformScaleCandidates({
  scaleXCandidates,
  scaleYCandidates,
  rawScale,
}: {
  scaleXCandidates: number[];
  scaleYCandidates: number[];
  rawScale: number;
}): ScalingStepCandidate[] {
  const scaleCandidates = [...scaleXCandidates];

  for (const scale of scaleYCandidates) {
    addUniqueScaleCandidate({
      candidates: scaleCandidates,
      scale,
    });
  }

  scaleCandidates.sort((first, second) => {
    return Math.abs(first - rawScale) - Math.abs(second - rawScale);
  });

  return scaleCandidates.map((scale) => ({
    scaleX: scale,
    scaleY: scale,
  }));
}

/**
 * Collects the scale candidate pairs for independent scaling on each axis.
 */
function collectAxisScaleCandidatePairs({
  scaleXCandidates,
  scaleYCandidates,
  rawScaleX,
  rawScaleY,
}: {
  scaleXCandidates: number[];
  scaleYCandidates: number[];
  rawScaleX: number;
  rawScaleY: number;
}): ScalingStepCandidate[] {
  const candidates: ScalingStepCandidate[] = [];

  for (const scaleX of scaleXCandidates) {
    for (const scaleY of scaleYCandidates) {
      candidates.push({ scaleX, scaleY });
    }
  }

  candidates.sort((first, second) => {
    const firstError =
      Math.abs(first.scaleX - rawScaleX) + Math.abs(first.scaleY - rawScaleY);
    const secondError =
      Math.abs(second.scaleX - rawScaleX) + Math.abs(second.scaleY - rawScaleY);

    return firstError - secondError;
  });

  return candidates;
}

/**
 * Checks the rounded scale against the held guide.
 */
function resolveScalingStepCandidateSnapMatch({
  target,
  candidate,
  preservePlacement,
  snapGuards,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  preservePlacement?: ScalingStepPlacementPreserver;
  snapGuards: ScalingStepSnapGuard[];
}): ScalingStepCandidateSnapMatch {
  const bounds = readScalingStepCandidateBounds({
    target,
    candidate,
    ...(preservePlacement ? { preservePlacement } : {}),
  });

  if (!bounds) {
    return {
      state: "outside",
      distance: Number.POSITIVE_INFINITY,
    };
  }

  return resolveBoundsSnapMatch({
    bounds,
    snapGuards,
  });
}

/**
 * Reads the candidate's bounds by temporarily applying the scale and restoring the target.
 */
function readScalingStepCandidateBounds({
  target,
  candidate,
  preservePlacement,
}: {
  target: FabricObject;
  candidate: ScalingStepCandidate;
  preservePlacement?: ScalingStepPlacementPreserver;
}): ObjectBounds | null {
  const originalScaleX = target.scaleX ?? 1;
  const originalScaleY = target.scaleY ?? 1;
  let bounds: ObjectBounds | null = null;

  try {
    target.set({
      scaleX: candidate.scaleX,
      scaleY: candidate.scaleY,
    });

    if (preservePlacement) {
      preservePlacement.applyPlacement(preservePlacement.placement);
    } else {
      target.setCoords();
    }

    bounds = getObjectBounds({ object: target });
  } finally {
    target.set({
      scaleX: originalScaleX,
      scaleY: originalScaleY,
    });

    if (preservePlacement) {
      preservePlacement.applyPlacement(preservePlacement.placement);
    } else {
      target.setCoords();
    }
  }

  return bounds;
}

/**
 * Checks the candidate's bounds against every active guide.
 */
function resolveBoundsSnapMatch({
  bounds,
  snapGuards,
}: {
  bounds: ObjectBounds;
  snapGuards: ScalingStepSnapGuard[];
}): ScalingStepCandidateSnapMatch {
  let isOnGuide = true;
  let distance = 0;
  for (const snapGuard of snapGuards) {
    if (!isBoundsInsideSnapGuard({ bounds, snapGuard })) {
      return {
        state: "outside",
        distance: Number.POSITIVE_INFINITY,
      };
    }
    if (!isBoundsOnSnapGuide({ bounds, snapGuard })) {
      isOnGuide = false;
    }

    distance = Math.max(
      distance,
      getBoundsSnapGuardDistance({
        bounds,
        snapGuard,
      }),
    );
  }

  return {
    state: isOnGuide ? "on-guide" : "inside",
    distance,
  };
}
