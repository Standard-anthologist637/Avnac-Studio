import type { SaraswatiResizeHandle } from "../saraswati/commands/types";
import type { SaraswatiBounds } from "../saraswati/spatial";
import type { SaraswatiClipPath } from "../saraswati/types";

export function clipPathToBounds(clipPath: SaraswatiClipPath): SaraswatiBounds {
  return {
    x: clipPath.x - clipPath.width / 2,
    y: clipPath.y - clipPath.height / 2,
    width: clipPath.width,
    height: clipPath.height,
  };
}

export function boundsToClipPath(
  source: SaraswatiClipPath,
  bounds: SaraswatiBounds,
): SaraswatiClipPath {
  if (source.type === "ellipse") {
    return {
      type: "ellipse",
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
  }
  return {
    type: "rect",
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
    radiusX: Math.max(0, Math.min(source.radiusX, bounds.width / 2)),
    radiusY: Math.max(0, Math.min(source.radiusY, bounds.height / 2)),
  };
}

export function resizeBoundsFromHandle(
  startBounds: SaraswatiBounds,
  handle: SaraswatiResizeHandle,
  dx: number,
  dy: number,
): SaraswatiBounds {
  const minSize = 1;
  let x = startBounds.x;
  let y = startBounds.y;
  let width = startBounds.width;
  let height = startBounds.height;

  if (handle === "nw" || handle === "sw" || handle === "w") {
    const newWidth = Math.max(minSize, startBounds.width - dx);
    x = startBounds.x + startBounds.width - newWidth;
    width = newWidth;
  } else if (handle === "ne" || handle === "se" || handle === "e") {
    width = Math.max(minSize, startBounds.width + dx);
  }

  if (handle === "nw" || handle === "ne" || handle === "n") {
    const newHeight = Math.max(minSize, startBounds.height - dy);
    y = startBounds.y + startBounds.height - newHeight;
    height = newHeight;
  } else if (handle === "sw" || handle === "se" || handle === "s") {
    height = Math.max(minSize, startBounds.height + dy);
  }

  return { x, y, width, height };
}
