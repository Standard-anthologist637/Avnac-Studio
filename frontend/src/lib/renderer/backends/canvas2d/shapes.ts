import type {
  SaraswatiRenderEllipseCommand,
  SaraswatiRenderPolygonCommand,
  SaraswatiRenderRectCommand,
} from "../../../saraswati/render/commands";
import {
  centeredCanvas2DBox,
  fillAndStrokeCanvas2DPath,
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
