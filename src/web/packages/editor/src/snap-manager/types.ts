import type { ObjectBounds } from "./bounds.js";

export type Bounds = ObjectBounds;

export type AnchorBuckets = {
  vertical: number[];
  horizontal: number[];
};

/** The exact gap between neighbouring objects. */
export type SpacingPattern = {
  type: "vertical" | "horizontal";
  axis: number;
  start: number;
  end: number;
  distance: number;
};

export type GuideBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type GuideLine = {
  type: "vertical" | "horizontal";
  position: number;
};

export type SpacingGuide = {
  type: "vertical" | "horizontal";
  axis: number;
  refStart: number;
  refEnd: number;
  activeStart: number;
  activeEnd: number;
  distance: number;
};
