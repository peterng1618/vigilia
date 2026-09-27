import { createCanvas } from "canvas";

/**
 * The authored glass scene both mounts are inspected with.
 *
 * One envelope serves the real editor (through its file-open path) and the real
 * player (through the host), so the two are provably the same scene rather
 * than two scenes that look alike.
 *
 * **The media is the only backdrop, and nothing opaque is drawn over it.** A
 * first version put 160 opaque bars in the scene as texture; they hid the media
 * layer completely, so the panel sampled bars and the media-offset claim had
 * nothing to measure. The media image now carries the high-frequency texture
 * itself, so one source answers both questions: is the backdrop softened, and
 * does the panel show the part of the media behind it.
 *
 * The artboard is 4:3 and the stage is not, so the media layer carries a real
 * horizontal offset. A 16:9 board in a 16:9 stage letterboxes to zero offset,
 * where a sampler that ignored the layer's position would still look right.
 *
 * No foreground **text**: this container has no usable font and renders
 * "FROST" as a placeholder dash, so the sharp-foreground claim is not
 * measurable here. That half is Task 11's, where font work is already in
 * scope.
 */

export const GLASS_ARTBOARD = { width: 640, height: 480 } as const;
export const GLASS_PANEL = {
  left: 300,
  top: 120,
  width: 240,
  height: 160,
  radius: 24,
  blurRadius: 16,
} as const;

export const GLASS_MEDIA_SOURCE = { width: 800, height: 450 } as const;
export const GLASS_STRIPE_SOURCE_X = 480;
export const GLASS_STRIPE_SOURCE_WIDTH = 80;

/** Every 16 source px. Coarse enough that a 16-unit blur smooths the bars to
 *  near-flat, so the marker's measured midpoint is not riding a residual
 *  ripple, and sharp enough that a tint still leaves them intact. */
const MEDIA_BAR_PITCH = 16;

/**
 * PNG, not SVG: a packaged SVG is served as an opaque byte stream and an
 * `<img>` will not decode it, so there would be nothing to sample.
 */
export function glassStripesPng(): Uint8Array {
  const surface = createCanvas(
    GLASS_MEDIA_SOURCE.width,
    GLASS_MEDIA_SOURCE.height,
  );
  const context = surface.getContext("2d");
  for (let x = 0; x < surface.width; x += MEDIA_BAR_PITCH * 2) {
    context.fillStyle = "#e4e4e4";
    context.fillRect(x, 0, MEDIA_BAR_PITCH, surface.height);
    context.fillStyle = "#3a3a3a";
    context.fillRect(x + MEDIA_BAR_PITCH, 0, MEDIA_BAR_PITCH, surface.height);
  }
  // The marker: wide and dark, so a blur preserves its centre exactly.
  context.fillStyle = "#000000";
  context.fillRect(
    GLASS_STRIPE_SOURCE_X,
    0,
    GLASS_STRIPE_SOURCE_WIDTH,
    surface.height,
  );
  return surface.toBuffer("image/png");
}

export const GLASS_ENVELOPE = {
  schemaVersion: 2 as const,
  fabricVersion: "7.4.0",
  id: "e2e-glass",
  metadata: { name: "E2E glass", locale: "en" },
  artboard: {
    width: GLASS_ARTBOARD.width,
    height: GLASS_ARTBOARD.height,
    fitMode: "contain" as const,
    // Transparent, or the artboard paint would hide the media layer the glass
    // has to sample, on screen and in the sampled region alike.
    background: { ref: "palette.none" },
    barColor: { ref: "palette.bar" },
    backgroundMedia: { assetId: "stripes", fit: "contain" as const },
  },
  globals: {
    palette: {
      none: {
        name: "None",
        value: { kind: "solid" as const, color: "transparent" },
      },
      bar: { name: "Bar", value: { kind: "solid" as const, color: "#101318" } },
      panel: {
        name: "Panel",
        value: { kind: "solid" as const, color: "rgba(255, 255, 255, 0.10)" },
      },
      edge: {
        name: "Edge",
        value: { kind: "solid" as const, color: "rgba(255, 255, 255, 0.35)" },
      },
    },
  },
  assets: [
    {
      id: "stripes",
      kind: "image" as const,
      path: "assets/stripes.png",
      license: { name: "MIT", attribution: "Vigilia test fixture." },
    },
  ],
  scene: {
    version: "7.4.0",
    objects: [
      {
        type: "Rect",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: GLASS_PANEL.left,
        top: GLASS_PANEL.top,
        width: GLASS_PANEL.width,
        height: GLASS_PANEL.height,
        rx: GLASS_PANEL.radius,
        ry: GLASS_PANEL.radius,
        fill: "rgba(255, 255, 255, 0.10)",
        stroke: "rgba(255, 255, 255, 0.35)",
        strokeWidth: 2,
        id: "glass",
        selectable: false,
        evented: false,
        vigiliaPaint: { fill: "palette.panel", stroke: "palette.edge" },
        vigiliaGlass: { blurRadius: GLASS_PANEL.blurRadius },
      },
      {
        // No treatment: the control that proves an ordinary panel is untouched.
        type: "Rect",
        version: "7.4.0",
        originX: "left",
        originY: "top",
        left: 40,
        top: 210,
        width: 200,
        height: 80,
        rx: 12,
        ry: 12,
        fill: "rgba(255, 255, 255, 0.10)",
        id: "plain",
        selectable: false,
        evented: false,
        vigiliaPaint: { fill: "palette.panel" },
      },
    ],
  },
};
