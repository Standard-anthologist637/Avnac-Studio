import {
  isTransparentCssColor,
  type BgValue,
  type GradientStop,
} from "../../editor-paint";
import type { SaraswatiNodeOriginX, SaraswatiNodeOriginY } from "../scene";
import type {
  SaraswatiRenderCommand,
  SaraswatiRenderImageCommand,
  SaraswatiRenderRectCommand,
  SaraswatiRenderTextCommand,
} from "./commands";

type PreviewBox = { x: number; y: number; width: number; height: number };

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export async function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  commands: readonly SaraswatiRenderCommand[],
): Promise<void> {
  for (const command of commands) {
    switch (command.type) {
      case "rect":
        renderRect(ctx, command);
        break;
      case "text":
        renderText(ctx, command);
        break;
      case "image":
        await renderImage(ctx, command);
        break;
    }
  }
}

function renderRect(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderRectCommand,
) {
  withTransform(ctx, command, command.width, command.height, () => {
    const box = centeredBox(command.width, command.height);
    ctx.beginPath();
    roundedRectPath(
      ctx,
      box.x,
      box.y,
      box.width,
      box.height,
      Math.max(command.radiusX, command.radiusY),
    );
    fillAndStrokePath(
      ctx,
      command.fill,
      command.stroke,
      command.strokeWidth,
      box,
    );
  });
}

function renderText(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderTextCommand,
) {
  if (!command.text.trim()) return;
  const font = [
    command.fontStyle === "italic" ? "italic" : "",
    command.fontWeight,
    `${Math.max(1, command.fontSize)}px`,
    command.fontFamily,
  ]
    .filter(Boolean)
    .join(" ");

  ctx.save();
  ctx.font = font;
  const rawLines = command.text.split(/\r?\n/);
  const lines = wrapTextLines(ctx, rawLines, Math.max(1, command.width));
  const measuredWidth = Math.max(
    command.width,
    ...lines.map((line) => ctx.measureText(line).width),
  );
  const lineHeightPx =
    Math.max(1, command.fontSize) * Math.max(1, command.lineHeight);
  const boxWidth = Math.max(1, measuredWidth);
  const boxHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  const box = centeredBox(boxWidth, boxHeight);
  const align = normalizeTextAlign(command.textAlign);
  ctx.restore();

  withTransform(ctx, command, box.width, box.height, () => {
    ctx.font = font;
    ctx.textBaseline = "top";
    ctx.textAlign = align;
    const fillStyle = paintStyle(ctx, command.color, box);
    const strokeStyle = paintStyle(ctx, command.stroke, box);
    const drawX =
      align === "center"
        ? 0
        : align === "right"
          ? box.width / 2
          : -box.width / 2;
    let y = -box.height / 2;
    for (const line of lines) {
      if (strokeStyle && command.strokeWidth > 0) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = command.strokeWidth;
        ctx.strokeText(line, drawX, y);
      }
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fillText(line, drawX, y);
      }
      if (command.underline && fillStyle) {
        const measured = ctx.measureText(line).width;
        const underlineY = y + command.fontSize;
        const startX =
          align === "center"
            ? -measured / 2
            : align === "right"
              ? drawX - measured
              : drawX;
        ctx.beginPath();
        ctx.strokeStyle = fillStyle;
        ctx.lineWidth = Math.max(1, command.fontSize * 0.06);
        ctx.moveTo(startX, underlineY);
        ctx.lineTo(startX + measured, underlineY);
        ctx.stroke();
      }
      y += lineHeightPx;
    }
  });
}

async function renderImage(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderImageCommand,
) {
  const image = await loadImage(command.src);
  withTransform(ctx, command, command.width, command.height, () => {
    const targetX = -command.width / 2;
    const targetY = -command.height / 2;
    const cropX = Math.max(0, Math.round(command.cropX));
    const cropY = Math.max(0, Math.round(command.cropY));
    const sourceWidth = Math.max(
      1,
      Math.min(command.width, image.naturalWidth - cropX),
    );
    const sourceHeight = Math.max(
      1,
      Math.min(command.height, image.naturalHeight - cropY),
    );
    ctx.drawImage(
      image,
      cropX,
      cropY,
      sourceWidth,
      sourceHeight,
      targetX,
      targetY,
      command.width,
      command.height,
    );
  });
}

function withTransform(
  ctx: CanvasRenderingContext2D,
  command: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
    originX: SaraswatiNodeOriginX;
    originY: SaraswatiNodeOriginY;
  },
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
  ctx.globalAlpha *= clampOpacity(command.opacity);
  ctx.translate(centerX, centerY);
  if (command.rotation) ctx.rotate((command.rotation * Math.PI) / 180);
  ctx.scale(command.scaleX, command.scaleY);
  draw();
  ctx.restore();
}

function fillAndStrokePath(
  ctx: CanvasRenderingContext2D,
  fill: BgValue,
  stroke: BgValue | null,
  strokeWidth: number,
  box: PreviewBox,
) {
  const fillStyle = paintStyle(ctx, fill, box);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  const strokeStyle = paintStyle(ctx, stroke, box);
  if (strokeStyle && strokeWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function centeredBox(width: number, height: number): PreviewBox {
  return { x: -width / 2, y: -height / 2, width, height };
}

function wrapTextLines(
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
    for (let i = 1; i < words.length; i += 1) {
      const next = `${current} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) current = next;
      else {
        wrapped.push(current);
        current = words[i]!;
      }
    }
    wrapped.push(current);
  }
  return wrapped;
}

function paintStyle(
  ctx: CanvasRenderingContext2D,
  paint: BgValue | null,
  box: PreviewBox,
): string | CanvasGradient | null {
  if (!paint) return null;
  if (paint.type === "solid") {
    return isTransparentCssColor(paint.color) ? null : paint.color;
  }
  return linearGradientForBox(ctx, paint.stops, paint.angle, box);
}

function linearGradientForBox(
  ctx: CanvasRenderingContext2D,
  stops: GradientStop[],
  angleDeg: number,
  box: PreviewBox,
) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const tx = dx !== 0 ? box.width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
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

function loadImage(src: string): Promise<HTMLImageElement> {
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

function normalizeTextAlign(
  value: "left" | "center" | "right",
): CanvasTextAlign {
  return value;
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

function roundedRectPath(
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

function clampOpacity(value: number) {
  return Math.max(0, Math.min(1, value));
}
