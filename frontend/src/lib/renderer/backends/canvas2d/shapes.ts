import type {
  SaraswatiRenderEllipseCommand,
  SaraswatiRenderLineCommand,
  SaraswatiRenderPolygonCommand,
  SaraswatiRenderRectCommand,
} from "../../../saraswati/render/commands";
import {
  centeredCanvas2DBox,
  fillAndStrokeCanvas2DPath,
  paintCanvas2DStyle,
  roundedCanvas2DRectPath,
  withCanvas2DTransform,
} from "./shared";

export function renderCanvas2DRectCommand(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderRectCommand,
) {
  withCanvas2DTransform(ctx, command, command.width, command.height, () => {
    const box = centeredCanvas2DBox(command.width, command.height);
    ctx.beginPath();
    roundedCanvas2DRectPath(
      ctx,
      box.x,
      box.y,
      box.width,
      box.height,
      Math.max(command.radiusX, command.radiusY),
    );
    fillAndStrokeCanvas2DPath(
      ctx,
      command.fill,
      command.stroke,
      command.strokeWidth,
      box,
    );
  });
}

export function renderCanvas2DEllipseCommand(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderEllipseCommand,
) {
  withCanvas2DTransform(ctx, command, command.width, command.height, () => {
    const box = centeredCanvas2DBox(command.width, command.height);
    ctx.beginPath();
    ctx.ellipse(0, 0, command.width / 2, command.height / 2, 0, 0, Math.PI * 2);
    fillAndStrokeCanvas2DPath(
      ctx,
      command.fill,
      command.stroke,
      command.strokeWidth,
      box,
    );
  });
}

export function renderCanvas2DPolygonCommand(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderPolygonCommand,
) {
  if (command.points.length < 2) return;
  withCanvas2DTransform(ctx, command, command.width, command.height, () => {
    const box = centeredCanvas2DBox(command.width, command.height);
    ctx.beginPath();
    ctx.moveTo(command.points[0]!.x, command.points[0]!.y);
    for (let index = 1; index < command.points.length; index += 1) {
      const point = command.points[index]!;
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    fillAndStrokeCanvas2DPath(
      ctx,
      command.fill,
      command.stroke,
      command.strokeWidth,
      box,
    );
  });
}

const ARROWHEAD_ANGLE = Math.PI / 6;
const ARROWHEAD_LENGTH_RATIO = 12;

export function renderCanvas2DLineCommand(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderLineCommand,
) {
  const { x1, y1, x2, y2 } = command;
  const bx = Math.min(x1, x2);
  const by = Math.min(y1, y2);
  const strokeBox = {
    x: bx,
    y: by,
    width: Math.max(1, Math.abs(x2 - x1)),
    height: Math.max(1, Math.abs(y2 - y1)),
  };
  const strokeStyle = paintCanvas2DStyle(ctx, command.stroke, strokeBox);
  if (!strokeStyle || command.strokeWidth <= 0) return;

  // Compute quadratic control point for curved paths
  let cpX = (x1 + x2) / 2;
  let cpY = (y1 + y2) / 2;
  const isCurved = command.pathType === "curved" && command.curveBulge !== 0;
  if (isCurved) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L > 0) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const perpX = -dy / L;
      const perpY = dx / L;
      cpX = x1 + command.curveT * dx + command.curveBulge * perpX;
      cpY = y1 + command.curveT * dy + command.curveBulge * perpY;
    }
  }

  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, command.opacity));
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = command.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Apply dash pattern
  if (command.lineStyle === "dashed") {
    const d = command.strokeWidth * 4;
    ctx.setLineDash([d, d]);
  } else if (command.lineStyle === "dotted") {
    const d = command.strokeWidth;
    ctx.setLineDash([d, d * 2]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  if (isCurved) {
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
  } else {
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // Arrowheads — use tangent direction at the tip, not the chord
  if (command.arrowEnd) {
    const fromX = isCurved ? cpX : x1;
    const fromY = isCurved ? cpY : y1;
    drawArrowhead(ctx, x2, y2, fromX, fromY, command.strokeWidth, strokeStyle);
  }
  if (command.arrowStart) {
    const fromX = isCurved ? cpX : x2;
    const fromY = isCurved ? cpY : y2;
    drawArrowhead(ctx, x1, y1, fromX, fromY, command.strokeWidth, strokeStyle);
  }

  ctx.restore();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  strokeWidth: number,
  strokeStyle: string | CanvasGradient,
) {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const length = ARROWHEAD_LENGTH_RATIO * Math.max(1, strokeWidth * 0.8);
  ctx.save();
  ctx.fillStyle = strokeStyle;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - length * Math.cos(angle - ARROWHEAD_ANGLE),
    tipY - length * Math.sin(angle - ARROWHEAD_ANGLE),
  );
  ctx.lineTo(
    tipX - length * Math.cos(angle + ARROWHEAD_ANGLE),
    tipY - length * Math.sin(angle + ARROWHEAD_ANGLE),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
