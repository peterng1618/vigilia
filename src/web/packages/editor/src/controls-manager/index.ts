import {
  InteractiveFabricObject,
  Textbox,
  controlsUtils,
  type Control,
} from "fabric/es";
import {
  HORIZONTAL_HEIGHT,
  HORIZONTAL_WIDTH,
  PILL_RADIUS,
  ROTATE_DIAMETER,
  SQUARE_RADIUS,
  SQUARE_SIZE,
  VERTICAL_HEIGHT,
  VERTICAL_WIDTH,
  renderRotationHandle,
  roundedHandle,
} from "./renderers.js";

const CORNER = {
  render: roundedHandle(SQUARE_SIZE, SQUARE_SIZE, SQUARE_RADIUS),
  sizeX: SQUARE_SIZE,
  sizeY: SQUARE_SIZE,
  offsetX: 0,
  offsetY: 0,
} as const satisfies Partial<Control>;

const VERTICAL_EDGE = {
  render: roundedHandle(VERTICAL_WIDTH, VERTICAL_HEIGHT, PILL_RADIUS),
  sizeX: VERTICAL_WIDTH,
  sizeY: VERTICAL_HEIGHT,
  offsetX: 0,
  offsetY: 0,
} as const satisfies Partial<Control>;

const HORIZONTAL_EDGE = {
  render: roundedHandle(HORIZONTAL_WIDTH, HORIZONTAL_HEIGHT, PILL_RADIUS),
  sizeX: HORIZONTAL_WIDTH,
  sizeY: HORIZONTAL_HEIGHT,
  offsetX: 0,
  offsetY: 0,
} as const satisfies Partial<Control>;

const ROTATION = {
  render: renderRotationHandle,
  sizeX: ROTATE_DIAMETER,
  sizeY: ROTATE_DIAMETER,
  offsetX: 0,
  offsetY: -ROTATE_DIAMETER,
  cursorStyle: "grab",
} as const satisfies Partial<Control>;

const OVERRIDES: Readonly<Record<string, Partial<Control>>> = {
  tl: CORNER,
  tr: CORNER,
  bl: CORNER,
  br: CORNER,
  ml: VERTICAL_EDGE,
  mr: VERTICAL_EDGE,
  mt: HORIZONTAL_EDGE,
  mb: HORIZONTAL_EDGE,
  mtr: ROTATION,
};

function applyOverrides(controls: Record<string, Control>): void {
  for (const [key, override] of Object.entries(OVERRIDES)) {
    const control = controls[key];
    if (control === undefined) continue;
    Object.assign(control, override);
  }
  const rotate = controls["mtr"];
  if (rotate === undefined) return;
  rotate.mouseDownHandler = (_eventData, transform) => {
    const { target } = transform;
    if (target.get("locked") !== true && !target.lockRotation) {
      target.canvas?.setCursor("grabbing");
    }
    return true;
  };
}

let applied = false;

/**
 * Fabric reads `ownDefaults` when an object is constructed, so this runs before
 * the canvas exists. Excludes the fork's ActiveSelection bounds patch and its
 * Textbox width-control wrapping; neither has a Vigilia type to serve.
 */
export function applyEditorControls(): void {
  if (applied) return;
  applied = true;

  const objectControls = controlsUtils.createObjectDefaultControls();
  applyOverrides(objectControls);
  InteractiveFabricObject.ownDefaults.controls = objectControls;

  const textboxControls = controlsUtils.createTextboxDefaultControls();
  applyOverrides(textboxControls);
  // Vertical resize would fight Textbox's own height derivation.
  if (textboxControls["mt"] !== undefined)
    textboxControls["mt"].visible = false;
  if (textboxControls["mb"] !== undefined)
    textboxControls["mb"].visible = false;
  Textbox.ownDefaults.controls = textboxControls;

  InteractiveFabricObject.ownDefaults.snapAngle = 1;
}
