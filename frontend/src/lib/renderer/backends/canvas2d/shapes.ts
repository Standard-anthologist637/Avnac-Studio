import type { SaraswatiRenderRectCommand } from "../../../saraswati/render/commands";
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