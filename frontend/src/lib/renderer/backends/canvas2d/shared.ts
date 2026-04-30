import {
  isTransparentCssColor,
  type BgValue,
  type GradientStop,
} from "../../../editor-paint";
import type {
  SaraswatiNodeOriginX,
  SaraswatiNodeOriginY,
} from "../../../saraswati/scene";

export type Canvas2DPreviewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Canvas2DTransformCommand = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  originX: SaraswatiNodeOriginX;
  originY: SaraswatiNodeOriginY;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function withCanvas2DTransform(
  ctx: CanvasRenderingContext2D,
  command: Canvas2DTransformCommand,
  width: number,
  height: number,
  draw: () => void,
) {
  const centerX = anchorToCenter(
    command.x,
    command.originX,
    width * Math.abs(command.scaleX),
    true,
  );
  const centerY = anchorToCenter(
    command.y,
    command.originY,
    height * Math.abs(command.scaleY),
    false,
  );
  ctx.save();
  ctx.globalAlpha *= clampCanvas2DOpacity(command.opacity);
  ctx.translate(centerX, centerY);
  if (command.rotation) ctx.rotate((command.rotation * Math.PI) / 180);
  ctx.scale(command.scaleX, command.scaleY);
  draw();
  ctx.restore();
}

export function fillAndStrokeCanvas2DPath(
  ctx: CanvasRenderingContext2D,
  fill: BgValue,
  stroke: BgValue | null,
  strokeWidth: number,
  box: Canvas2DPreviewBox,
) {
  const fillStyle = paintCanvas2DStyle(ctx, fill, box);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  const strokeStyle = paintCanvas2DStyle(ctx, stroke, box);
  if (strokeStyle && strokeWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

export function centeredCanvas2DBox(
  width: number,
  height: number,
): Canvas2DPreviewBox {
  return { x: -width / 2, y: -height / 2, width, height };
}

export function wrapCanvas2DTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
) {
  if (maxWidth <= 1) return lines;
  const wrapped: string[] = [];
  for (const rawLine of lines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrapped.push("");
      continue;
    }
    let current = words[0]!;
    for (let index = 1; index < words.length; index += 1) {
      const next = `${current} ${words[index]}`;
      if (ctx.measureText(next).width <= maxWidth) current = next;
      else {
        wrapped.push(current);
        current = words[index]!;
      }
    }
    wrapped.push(current);
  }
  return wrapped;
}

export function paintCanvas2DStyle(
  ctx: CanvasRenderingContext2D,
  paint: BgValue | null,
  box: Canvas2DPreviewBox,
): string | CanvasGradient | null {
  if (!paint) return null;
  if (paint.type === "solid") {
    return isTransparentCssColor(paint.color) ? null : paint.color;
  }
  return linearGradientForCanvas2DBox(ctx, paint.stops, paint.angle, box);
}

export function loadCanvas2DImage(src: string): Promise<HTMLImageElement> {
  let existing = imageCache.get(src);
  if (existing) return existing;
  existing = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
  imageCache.set(src, existing);
  return existing;
}

export function normalizeCanvas2DTextAlign(
  value: "left" | "center" | "right",
): CanvasTextAlign {
  return value;
}

export function roundedCanvas2DRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r === 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function clampCanvas2DOpacity(value: number) {
  return Math.max(0, Math.min(1, value));
}

function linearGradientForCanvas2DBox(
  ctx: CanvasRenderingContext2D,
  stops: GradientStop[],
  angleDeg: number,
  box: Canvas2DPreviewBox,
) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const tx =
    dx !== 0 ? box.width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty =
    dy !== 0 ? box.height / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const halfLen = Math.min(tx, ty);
  const gradient = ctx.createLinearGradient(
    cx - dx * halfLen,
    cy - dy * halfLen,
    cx + dx * halfLen,
    cy + dy * halfLen,
  );
  for (const stop of stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }
  return gradient;
}

function anchorToCenter(
  anchor: number,
  origin: SaraswatiNodeOriginX | SaraswatiNodeOriginY,
  renderedSize: number,
  isX: boolean,
) {
  const axisOrigin = origin ?? (isX ? "left" : "top");
  const factor =
    axisOrigin === "center"
      ? 0.5
      : axisOrigin === "right" || axisOrigin === "bottom"
        ? 1
        : 0;
  return anchor + (0.5 - factor) * renderedSize;
}