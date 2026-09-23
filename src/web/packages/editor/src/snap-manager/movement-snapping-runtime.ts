/* eslint-disable no-use-before-define -- the public runtime sits above its internal checks. */
import {
  type FinalMovementGeometry,
  FREE_MOVEMENT_HOLD_STATE,
  type MovementGestureBaseline,
  type MovementHoldState,
  type MovementRawIntent,
  type MovementSnapPlan,
  type MovementSnapVerification,
  resolveMovementSnapPlan,
  verifyMovementSnapPlan,
} from "./movement-snapping-resolver.js";

/** A single-use movement plan id. */
export type MovementPlanToken = Readonly<{
  sessionId: number;
  step: number;
}>;

/** A fresh pointer step that may be applied exactly once. */
export type PlannedMovementRuntimeStep = Readonly<{
  kind: "planned";
  token: MovementPlanToken;
  plan: MovementSnapPlan;
}>;

/** A repeat of an already computed native pointer step. */
export type DuplicateMovementRuntimeStep = Readonly<{
  kind: "duplicate";
  phase: "pending" | "verified";
  token: MovementPlanToken;
  plan: MovementSnapPlan;
  verification: MovementSnapVerification | null;
}>;

/** A fresh or repeated movement-runtime result. */
export type MovementRuntimeStep =
  | PlannedMovementRuntimeStep
  | DuplicateMovementRuntimeStep;

/** The idempotent result of ending a movement session. */
export type MovementRuntimeCleanup = Readonly<{
  didCleanup: boolean;
}>;

/** State of one native pointer marker. */
type MovementRuntimeStepRecord = {
  token: MovementPlanToken;
  plan: MovementSnapPlan;
  verification: MovementSnapVerification | null;
};

/** Mutable state of one active drag gesture. */
type ActiveMovementRuntimeSession = {
  id: number;
  baseline: MovementGestureBaseline;
  holdState: MovementHoldState;
  markerRecords: WeakMap<object, MovementRuntimeStepRecord>;
  pendingStep: MovementRuntimeStepRecord | null;
  nextStep: number;
};

//** Next local movement-session id. */
let nextMovementRuntimeSessionId = 1;

/** The immutable result of a repeated teardown. */
const EMPTY_MOVEMENT_RUNTIME_CLEANUP: MovementRuntimeCleanup = Object.freeze({
  didCleanup: false,
});

/**
 * Ties a native pointer marker to one movement plan and updates the hold after
 * verification. The runtime never mutates Fabric objects.
 */
export class MovementSnappingRuntime {
  private _session: ActiveMovementRuntimeSession | null = null;

  private readonly _issuedTokens = new WeakSet<MovementPlanToken>();

  private readonly _consumedTokens = new WeakSet<MovementPlanToken>();

  /** Starts a new movement session with an immutable baseline. */
  startSession({ baseline }: { baseline: MovementGestureBaseline }): void {
    if (this._session) {
      throw new Error(
        "Movement snapping runtime already has an active session",
      );
    }

    this._session = {
      id: nextMovementRuntimeSessionId,
      baseline,
      holdState: FREE_MOVEMENT_HOLD_STATE,
      markerRecords: new WeakMap<object, MovementRuntimeStepRecord>(),
      pendingStep: null,
      nextStep: 1,
    };
    nextMovementRuntimeSessionId += 1;
  }

  /** Returns the cached result instead of re-reading a mutated target. */
  getDuplicateStep({
    marker,
  }: {
    marker: object;
  }): DuplicateMovementRuntimeStep | null {
    const session = this._getActiveSession();
    const record = session.markerRecords.get(marker);
    if (!record) return null;

    return createDuplicateMovementStep({ record });
  }

  //** Issues at most one plan per native pointer marker. */
  resolveMovementPlan({
    marker,
    intent,
  }: {
    marker: object;
    intent: MovementRawIntent;
  }): MovementRuntimeStep {
    const session = this._getActiveSession();
    const duplicate = session.markerRecords.get(marker);
    if (duplicate) {
      assertSameMovementIntent({
        first: duplicate.plan.rawIntent,
        second: intent,
      });
      return createDuplicateMovementStep({ record: duplicate });
    }
    if (session.pendingStep) {
      throw new Error(
        "Previous movement plan token must be verified before the next pointer marker",
      );
    }

    const plan = resolveMovementSnapPlan({
      baseline: session.baseline,
      intent,
      holdState: session.holdState,
    });
    const token = this._createPlanToken({ session });
    const record = {
      token,
      plan,
      verification: null,
    };
    session.markerRecords.set(marker, record);
    session.pendingStep = record;

    return Object.freeze({
      kind: "planned",
      token,
      plan,
    });
  }

  /** Verifies the applied plan and updates the transient hold state. */
  verifyMovementPlan({
    token,
    finalGeometry,
  }: {
    token: MovementPlanToken;
    finalGeometry: FinalMovementGeometry;
  }): MovementSnapVerification {
    const session = this._getActiveSession();
    this._assertUsableToken({ session, token });

    const { pendingStep } = session;
    if (!pendingStep) {
      throw new Error(
        "Movement snapping runtime has no pointer step to verify",
      );
    }

    const verification = verifyMovementSnapPlan({
      baseline: session.baseline,
      plan: pendingStep.plan,
      finalGeometry,
    });
    this._consumedTokens.add(token);
    pendingStep.verification = verification;
    session.pendingStep = null;
    session.holdState = verification.holdState;

    return verification;
  }

  /** Ends the active session exactly once. */
  finishSession(): MovementRuntimeCleanup {
    const session = this._session;
    if (!session) return EMPTY_MOVEMENT_RUNTIME_CLEANUP;

    const pendingToken = session.pendingStep?.token;
    if (pendingToken) this._consumedTokens.add(pendingToken);

    this._session = null;

    return Object.freeze({
      didCleanup: true,
    });
  }

  /** Returns the active session or fails loudly on a lifecycle violation. */
  private _getActiveSession(): ActiveMovementRuntimeSession {
    if (!this._session) {
      throw new Error("Movement snapping runtime has no active session");
    }

    return this._session;
  }

  //** Creates a single-use token for the current pointer step. */
  private _createPlanToken({
    session,
  }: {
    session: ActiveMovementRuntimeSession;
  }): MovementPlanToken {
    const token = Object.freeze({
      sessionId: session.id,
      step: session.nextStep,
    });
    session.nextStep += 1;
    this._issuedTokens.add(token);

    return token;
  }

  /** Rejects foreign, stale or already-spent tokens. */
  private _assertUsableToken({
    session,
    token,
  }: {
    session: ActiveMovementRuntimeSession;
    token: MovementPlanToken;
  }): void {
    if (!this._issuedTokens.has(token)) {
      throw new Error("Foreign movement plan token");
    }
    if (this._consumedTokens.has(token)) {
      throw new Error("Movement plan token has already been used");
    }
    if (!session.pendingStep || session.pendingStep.token !== token) {
      throw new Error(
        "Movement plan token does not belong to the current pointer step",
      );
    }
  }
}

/** Returns the immutable duplicate step from the stored record. */
function createDuplicateMovementStep({
  record,
}: {
  record: MovementRuntimeStepRecord;
}): DuplicateMovementRuntimeStep {
  return Object.freeze({
    kind: "duplicate",
    phase: record.verification ? "verified" : "pending",
    token: record.token,
    plan: record.plan,
    verification: record.verification,
  });
}

//** Ensures one marker is never reused with a different raw intent. */
function assertSameMovementIntent({
  first,
  second,
}: {
  first: MovementRawIntent;
  second: MovementRawIntent;
}): void {
  const sameBounds = areMovementBoundsEqual({
    first: first.bounds,
    second: second.bounds,
  });
  const samePosition =
    first.position.left === second.position.left &&
    first.position.top === second.position.top;
  const sameAxes =
    first.axes.x === second.axes.x && first.axes.y === second.axes.y;
  const sameModifiers = first.modifiers.ctrlKey === second.modifiers.ctrlKey;

  if (!sameBounds || !samePosition || !sameAxes || !sameModifiers) {
    throw new Error(
      "Native movement pointer marker was reused with a different raw intent",
    );
  }
}

/** Compares exact bounds of two raw intents with no hidden tolerance. */
function areMovementBoundsEqual({
  first,
  second,
}: {
  first: MovementRawIntent["bounds"];
  second: MovementRawIntent["bounds"];
}): boolean {
  return (
    first.left === second.left &&
    first.right === second.right &&
    first.top === second.top &&
    first.bottom === second.bottom &&
    first.centerX === second.centerX &&
    first.centerY === second.centerY
  );
}
