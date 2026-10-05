import { type Control, util } from "fabric/es";

/** Editor chrome, deliberately not theme palette: handles are not document paint. */
const STROKE = "#3D8BF4";
const FILL = "#FFFFFF";
const ROTATE_BACKGROUND = "#2B2D33";
const LINE_WIDTH = 1;

export const SQUARE_SIZE = 12;
export const SQUARE_RADIUS = 2;
export const VERTICAL_WIDTH = 8;
export const VERTICAL_HEIGHT = 20;
export const HORIZONTAL_WIDTH = 20;
export const HORIZONTAL_HEIGHT = 8;
export const PILL_RADIUS = 100;
export const ROTATE_DIAMETER = 32;

type Renderer = NonNullable<Control["render"]>;

/** `roundRect` is unavailable in jsdom, where handles are never painted. */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(-width / 2, -height / 2, width, height, radius);
  } else {
    ctx.rect(-width / 2, -height / 2, width, height);
  }
}

export function roundedHandle(
  width: number,
  height: number,
  radius: number,
): Renderer {
  return (ctx, left, top, _styleOverride, fabricObject) => {
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(util.degreesToRadians(fabricObject.angle));
    ctx.fillStyle = FILL;
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = LINE_WIDTH;
    roundedPath(ctx, width, height, radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
}

/** Drawn rather than embedded so no base64 asset enters source. */
export const renderRotationHandle: Renderer = (
  ctx,
  left,
  top,
  _styleOverride,
  fabricObject,
) => {
  const radius = ROTATE_DIAMETER / 2;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(util.degreesToRadians(fabricObject.angle));
  ctx.fillStyle = ROTATE_BACKGROUND;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = FILL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius / 2, Math.PI * 0.25, Math.PI * 1.75);
  ctx.stroke();
  ctx.fillStyle = FILL;
  ctx.beginPath();
  ctx.moveTo(radius / 2 + 3, -3);
  ctx.lineTo(radius / 2 - 3, -3);
  ctx.lineTo(radius / 2, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
