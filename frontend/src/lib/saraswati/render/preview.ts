import type { AvnacDocumentV1 } from "../../avnac-document";
import {
  isTransparentCssColor,
  type BgValue,
  type GradientStop,
} from "../../editor-paint";
import { avnacDocumentToSaraswatiScene } from "../compat/from-avnac";
import {
  isSaraswatiFastPreviewCapable,
  type SaraswatiPreviewRenderableObject,
  type SaraswatiSceneArrowObject,
  type SaraswatiSceneDocumentV1,
  type SaraswatiSceneObject,
  type SaraswatiSceneObjectBase,
  type SaraswatiScenePaintObjectBase,
} from "../scene";

type PreviewBox = { x: number; y: number; width: number; height: number };

export function renderAvnacDocumentFastPreviewDataUrl(
  doc: AvnacDocumentV1,
  options?: { maxCssPx?: number },
): string | null {
  return renderSaraswatiScenePreviewDataUrl(
    avnacDocumentToSaraswatiScene(doc),
    options,
  );
}

export function renderSaraswatiScenePreviewDataUrl(
  scene: SaraswatiSceneDocumentV1,
  options?: { maxCssPx?: number },
): string | null {
  if (typeof document === "undefined") return null;
  const aw = scene.artboard.width;
  const ah = scene.artboard.height;
  if (!Number.isFinite(aw) || !Number.isFinite(ah) || aw < 1 || ah < 1) {
    return null;
  }
  if (!isSaraswatiFastPreviewCapable(scene)) return null;

  const maxCssPx = options?.maxCssPx ?? 400;
  const maxEdge = Math.max(aw, ah);
  const scale = maxEdge > 0 ? Math.min(1, maxCssPx / maxEdge) : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(aw * scale));
  canvas.height = Math.max(1, Math.round(ah * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.save();
  ctx.scale(scale, scale);
  paintBackground(ctx, scene.bg, aw, ah);
  for (const obj of scene.objects) {
    renderObject(ctx, obj);
  }
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  bg: BgValue,
  width: number,
  height: number,
) {
  const style = paintStyle(ctx, bg, { x: 0, y: 0, width, height });
  if (!style) return;
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, width, height);
}

function renderObject(
  ctx: CanvasRenderingContext2D,
  obj: SaraswatiSceneObject,
) {
  if (obj.visible === false) return;
  if (isArrowLike(obj)) {
    renderArrowLike(ctx, obj);
    return;
  }
  switch (obj.kind) {
    case "rect":
      renderRect(ctx, obj);
      return;
    case "ellipse":
      renderEllipse(ctx, obj);
      return;
    case "polygon":
      renderPolygon(ctx, obj);
      return;
    case "text":
      renderText(ctx, obj);
      return;
    default:
      return;
  }
}

function renderRect(
  ctx: CanvasRenderingContext2D,
  obj: Extract<SaraswatiPreviewRenderableObject, { kind: "rect" }>,
) {
  const width = obj.width;
  const height = obj.height;
  if (width <= 0 || height <= 0) return;
  const radius = Math.max(0, Math.max(obj.radiusX ?? 0, obj.radiusY ?? 0));

  withObjectTransform(ctx, obj, width, height, () => {
    const box = centeredBox(width, height);
    ctx.beginPath();
    roundedRectPath(ctx, box.x, box.y, box.width, box.height, radius);
    fillAndStrokePath(ctx, obj, box);
  });
}

function renderEllipse(
  ctx: CanvasRenderingContext2D,
  obj: Extract<SaraswatiPreviewRenderableObject, { kind: "ellipse" }>,
) {
  const rx = obj.rx;
  const ry = obj.ry;
  if (rx <= 0 || ry <= 0) return;
  const box = centeredBox(rx * 2, ry * 2);

  withObjectTransform(ctx, obj, box.width, box.height, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    fillAndStrokePath(ctx, obj, box);
  });
}

function renderPolygon(
  ctx: CanvasRenderingContext2D,
  obj: Extract<SaraswatiPreviewRenderableObject, { kind: "polygon" }>,
) {
  if (obj.points.length < 3) return;
  const bounds = pointsBounds(obj.points);
  const box = {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };

  withObjectTransform(ctx, obj, box.width, box.height, () => {
    ctx.beginPath();
    ctx.moveTo(obj.points[0]!.x, obj.points[0]!.y);
    for (let i = 1; i < obj.points.length; i += 1) {
      const point = obj.points[i]!;
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    fillAndStrokePath(ctx, obj, box);
  });
}

function renderText(
  ctx: CanvasRenderingContext2D,
  obj: Extract<SaraswatiPreviewRenderableObject, { kind: "text" }>,
) {
  const text = obj.text;
  if (!text.trim()) return;
  const fontSize = Math.max(1, numberOr(obj.fontSize, 16));
  const fontFamily = String(obj.fontFamily ?? "Inter");
  const fontWeight = obj.fontWeight ? String(obj.fontWeight) : "";
  const fontStyle = obj.fontStyle === "italic" ? "italic" : "";
  const font = [fontStyle, fontWeight, `${fontSize}px`, fontFamily]
    .filter(Boolean)
    .join(" ");

  ctx.save();
  ctx.font = font;
  const rawLines = text.split(/\r?\n/);
  const widthHint = Math.max(1, numberOr(obj.width, 0));
  const lines = wrapTextLines(ctx, rawLines, widthHint);
  const measuredWidth = Math.max(
    widthHint,
    ...lines.map((line) => ctx.measureText(line).width),
  );
  const lineHeightPx = fontSize * Math.max(1, numberOr(obj.lineHeight, 1.16));
  const boxWidth = Math.max(1, measuredWidth);
  const boxHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  const box = centeredBox(boxWidth, boxHeight);
  const align = normalizeTextAlign(obj.textAlign);
  const fill = obj.fill ?? null;
  const stroke = obj.stroke ?? null;
  const strokeWidth = Math.max(0, numberOr(obj.strokeWidth, 0));
  ctx.restore();

  withObjectTransform(ctx, obj, box.width, box.height, () => {
    ctx.font = font;
    ctx.textBaseline = "top";
    ctx.textAlign = align;
    const fillStyle = paintStyle(ctx, fill, box);
    const strokeStyle = paintStyle(ctx, stroke, box);
    const drawX =
      align === "center"
        ? 0
        : align === "right"
          ? box.width / 2
          : -box.width / 2;
    let y = -box.height / 2;
    for (const line of lines) {
      if (strokeStyle && strokeWidth > 0) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(line, drawX, y);
      }
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fillText(line, drawX, y);
      }
      if (obj.underline && fillStyle) {
        const measured = ctx.measureText(line).width;
        const underlineY = y + fontSize;
        const startX =
          align === "center"
            ? -measured / 2
            : align === "right"
              ? drawX - measured
              : drawX;
        ctx.beginPath();
        ctx.strokeStyle = fillStyle;
        ctx.lineWidth = Math.max(1, fontSize * 0.06);
        ctx.moveTo(startX, underlineY);
        ctx.lineTo(startX + measured, underlineY);
        ctx.stroke();
      }
      y += lineHeightPx;
    }
  });
}

function renderArrowLike(
  ctx: CanvasRenderingContext2D,
  obj: Extract<SaraswatiPreviewRenderableObject, { kind: "line" | "arrow" }>,
) {
  const strokeWidth = Math.max(1, numberOr(obj.strokeWidth, 10));
  const strokePaint = obj.stroke ?? {
    type: "solid",
    color: "#262626",
  };
  const style = paintStyle(ctx, strokePaint, {
    x: Math.min(obj.x1, obj.x2),
    y: Math.min(obj.y1, obj.y2),
    width: Math.max(1, Math.abs(obj.x2 - obj.x1)),
    height: Math.max(1, Math.abs(obj.y2 - obj.y1)),
  });
  if (!style) return;

  ctx.save();
  ctx.globalAlpha *= clampOpacity(obj.opacity);
  ctx.strokeStyle = style;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = obj.roundedEnds
    ? "round"
    : obj.lineStyle === "dotted"
      ? "round"
      : "butt";
  ctx.setLineDash(lineDashForStyle(obj.lineStyle, strokeWidth));

  let tangentX = obj.x2 - obj.x1;
  let tangentY = obj.y2 - obj.y1;
  ctx.beginPath();
  ctx.moveTo(obj.x1, obj.y1);
  if (obj.pathType === "curved") {
    const control = quadraticControlPoint(obj);
    ctx.quadraticCurveTo(control.x, control.y, obj.x2, obj.y2);
    tangentX = obj.x2 - control.x;
    tangentY = obj.y2 - control.y;
  } else {
    ctx.lineTo(obj.x2, obj.y2);
  }
  ctx.stroke();

  if (obj.kind === "arrow" && (obj.arrowHead ?? 1) > 0) {
    const angle = Math.atan2(tangentY, tangentX);
    const headSize = Math.max(strokeWidth * 2.4, 10) * (obj.arrowHead ?? 1);
    const headColor = representativePaintColor(strokePaint);
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.moveTo(obj.x2, obj.y2);
    ctx.lineTo(
      obj.x2 - Math.cos(angle) * headSize + Math.sin(angle) * headSize * 0.45,
      obj.y2 - Math.sin(angle) * headSize - Math.cos(angle) * headSize * 0.45,
    );
    ctx.lineTo(
      obj.x2 - Math.cos(angle) * headSize - Math.sin(angle) * headSize * 0.45,
      obj.y2 - Math.sin(angle) * headSize + Math.cos(angle) * headSize * 0.45,
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function withObjectTransform(
  ctx: CanvasRenderingContext2D,
  obj: SaraswatiSceneObjectBase,
  width: number,
  height: number,
  draw: () => void,
) {
  const scaleX = effectiveScaleX(obj);
  const scaleY = effectiveScaleY(obj);
  const centerX = anchorToCenter(
    numberOr(obj.left, 0),
    obj.originX,
    width * Math.abs(scaleX),
    true,
  );
  const centerY = anchorToCenter(
    numberOr(obj.top, 0),
    obj.originY,
    height * Math.abs(scaleY),
    false,
  );

  ctx.save();
  ctx.globalAlpha *= clampOpacity(obj.opacity);
  ctx.translate(centerX, centerY);
  if (obj.angle) ctx.rotate((obj.angle * Math.PI) / 180);
  ctx.scale(scaleX, scaleY);
  draw();
  ctx.restore();
}

function fillAndStrokePath(
  ctx: CanvasRenderingContext2D,
  obj: SaraswatiScenePaintObjectBase,
  box: PreviewBox,
) {
  const fill = paintStyle(ctx, obj.fill ?? null, box);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  const stroke = paintStyle(ctx, obj.stroke ?? null, box);
  const strokeWidth = Math.max(0, numberOr(obj.strokeWidth, 0));
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function centeredBox(width: number, height: number): PreviewBox {
  return { x: -width / 2, y: -height / 2, width, height };
}

function pointsBounds(points: ReadonlyArray<{ x: number; y: number }>) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function normalizeTextAlign(value: string | undefined): CanvasTextAlign {
  return value === "center" || value === "right" ? value : "left";
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
): string[] {
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

function representativePaintColor(paint: BgValue): string {
  if (paint.type === "solid") return paint.color;
  return (
    paint.stops[paint.stops.length - 1]?.color ??
    paint.stops[0]?.color ??
    "#262626"
  );
}

function effectiveScaleX(obj: SaraswatiSceneObjectBase) {
  const scale = numberOr(obj.scaleX, 1);
  return (obj.flipX ? -1 : 1) * scale;
}

function effectiveScaleY(obj: SaraswatiSceneObjectBase) {
  const scale = numberOr(obj.scaleY, 1);
  return (obj.flipY ? -1 : 1) * scale;
}

function anchorToCenter(
  anchor: number,
  origin:
    | SaraswatiSceneObjectBase["originX"]
    | SaraswatiSceneObjectBase["originY"],
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

function isArrowLike(
  obj: SaraswatiSceneObject,
): obj is Extract<
  SaraswatiPreviewRenderableObject,
  { kind: "line" | "arrow" }
> {
  return obj.kind === "line" || obj.kind === "arrow";
}

function quadraticControlPoint(
  obj: Extract<SaraswatiPreviewRenderableObject, { kind: "line" | "arrow" }>,
) {
  const t = obj.curveT ?? 0.5;
  const bulge = obj.curveBulge ?? 0;
  const dx = obj.x2 - obj.x1;
  const dy = obj.y2 - obj.y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  return {
    x: obj.x1 + dx * t + nx * bulge,
    y: obj.y1 + dy * t + ny * bulge,
  };
}

function lineDashForStyle(
  style: SaraswatiSceneArrowObject["lineStyle"],
  strokeWidth: number,
) {
  if (style === "dashed") return [strokeWidth * 4, strokeWidth * 2];
  if (style === "dotted") return [strokeWidth * 0.6, strokeWidth * 1.4];
  return [];
}

function clampOpacity(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value!));
}

function numberOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? value! : fallback;
}
