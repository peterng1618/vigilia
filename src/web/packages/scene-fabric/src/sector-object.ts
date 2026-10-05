import { Circle, classRegistry } from "fabric/es";

/**
 * The two halves of a swept primitive: an open curve and the sector that
 * closes it. Fabric 7 ships no arc, and the two halves are not symmetrical in
 * what the library already gives.
 *
 * `Circle` already owns `startAngle` and `endAngle` and draws `ctx.arc`
 * between them, so the **open** sweep needs no geometry at all — only a type of
 * its own, and {@link Arc} exists for that reason alone (below). But a
 * fill under `ctx.arc` closes the subpath with a straight chord, so a filled
 * `Circle` from 0° to 90° is a circular *segment*, not a quarter-disc. Measured
 * on a radius-80 sweep: 1933 painted pixels against the 5027 a quarter-disc
 * occupies — the chord, not the sector. The closed sweep is therefore the half
 * that has to be built, and it is the two radii that build it.
 *
 * Both keep Fabric's own angle properties and go through Fabric's own
 * serializer, so a save writes the sweep and a reopen reads it back with no
 * Vigilia-side parsing — which is what keeps the round trip from needing a
 * second model of the shape beside it.
 */

/**
 * An open sweep: the arc, with the sector's closing radii left off.
 *
 * No render override, because `Circle._render` already draws exactly this. The
 * class exists for its `type`, and the reason is a defect rather than a
 * preference: an arc saved under `"Circle"` is indistinguishable from a full
 * disc, and `supportsGlass` admits `Circle` because a disc has an interior to
 * sample a backdrop through. An arc has none, so a theme could carry a frosted
 * treatment over nothing at all. Its own type is what lets that be refused.
 *
 * Named plainly, beside `Circle`, because that is what its `type` says and what
 * the scene file spells — the same bare geometry noun every other shape in the
 * document uses.
 */
export class Arc extends Circle {
  /** The name a scene JSON carries, so `classRegistry` can revive it. */
  public static override type = "Arc";
}

/**
 * A closed sweep: a wedge of a circle, from `startAngle` to `endAngle`.
 *
 * {@link Arc}'s sweep with the two radii that close it, so the sector is a
 * region and can be filled like any other closed shape.
 */
export class Wedge extends Circle {
  /** The name a scene JSON carries, so `classRegistry` can revive it. */
  public static override type = "Wedge";

  /**
   * The sector, as `Circle` draws an arc plus the two radii that close it.
   *
   * Written out rather than delegated, because `Circle._render` is exactly the
   * behaviour being corrected — but the path itself is {@link sectorPath}, not a
   * second copy of it.
   */
  override _render(ctx: CanvasRenderingContext2D): void {
    sectorPath(
      ctx,
      this.radius,
      this.startAngle,
      this.endAngle,
      this.counterClockwise,
    );
    this._renderPaintInOrder(ctx);
  }
}

/**
 * A closed sweep in a context already translated to the object's own centre,
 * which is where both callers draw it: Fabric's default origin is `center`, so
 * `calcTransformMatrix` puts the centre at the translation.
 *
 * One helper because the frost has to clip to **the figure the shape paints**.
 * Two copies of these five calls is two chances to spell the angle conversion
 * differently, and when they drift the frost samples the backdrop through a
 * region the shape does not cover — a wrong render that throws nothing.
 */
export function sectorPath(
  ctx: CanvasRenderingContext2D,
  radius: number,
  startDegrees: number,
  endDegrees: number,
  counterClockwise: boolean,
): void {
  const start = (startDegrees * Math.PI) / 180;
  ctx.beginPath();
  // The centre first, then out to where the sweep begins, so the region
  // enclosed is between the two radii rather than the region under the arc.
  // `arc` joins from the current point, so this is also what keeps the join from
  // cutting the corner.
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(start) * radius, Math.sin(start) * radius);
  ctx.arc(0, 0, radius, start, (endDegrees * Math.PI) / 180, counterClockwise);
  ctx.closePath();
}

// Without these lines `loadFromJSON` cannot revive an `"Arc"` or a `"Wedge"`,
// and each is silently dropped on reopen. `package.json` lists this module in
// `sideEffects` for the same reason it lists `chart-object.ts`: tree-shaking a
// registration away costs a shape per document and reports nothing.
classRegistry.setClass(Arc);
classRegistry.setClass(Wedge);
