import type { GradientStop } from "@/lib/editor-paint";

/**
 * Fabric's linear gradient coords in `pixels` units for a w×h box (object or artboard).
 * `angleDeg` matches CSS `linear-gradient`: 0° = up, 90° = right (canvas Y grows downward).
 */
export function linearGradientForBox(
  mod: {
    Gradient: new (options: {
      type: "linear";
      gradientUnits: "pixels";
      coords: { x1: number; y1: number; x2: number; y2: number };
      colorStops: Array<{ offset: number; color: string }>;
    }) => unknown;
  },
  stops: GradientStop[],
  angleDeg: number,
  w: number,
  h: number,
) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const cx = w / 2;
  const cy = h / 2;
  const tx = dx !== 0 ? w / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = dy !== 0 ? h / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const halfLen = Math.min(tx, ty);
  return new mod.Gradient({
    type: "linear",
    gradientUnits: "pixels",
    coords: {
      x1: cx - dx * halfLen,
      y1: cy - dy * halfLen,
      x2: cx + dx * halfLen,
      y2: cy + dy * halfLen,
    },
    colorStops: stops.map((s) => ({ offset: s.offset, color: s.color })),
  });
}
