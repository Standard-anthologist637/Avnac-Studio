import type {
  SaraswatiRenderCommand,
  SaraswatiRenderImageCommand,
} from "../../../saraswati/render/commands";
import type { RendererBackend } from "../../types";
import {
  renderCanvas2DEllipseCommand,
  renderCanvas2DPolygonCommand,
  renderCanvas2DRectCommand,
} from "./shapes";
import { loadCanvas2DImage, withCanvas2DTransform } from "./shared";
import { renderCanvas2DTextCommand } from "./text";

export type Canvas2DRendererTarget = CanvasRenderingContext2D;

export const canvas2DRendererBackend: RendererBackend<Canvas2DRendererTarget> =
  {
    kind: "canvas2d",
    render: renderCanvas2DCommands,
  };

export async function renderCanvas2DCommands(
  ctx: Canvas2DRendererTarget,
  commands: readonly SaraswatiRenderCommand[],
): Promise<void> {
  for (const command of commands) {
    switch (command.type) {
      case "rect":
        renderCanvas2DRectCommand(ctx, command);
        break;
      case "ellipse":
        renderCanvas2DEllipseCommand(ctx, command);
        break;
      case "polygon":
        renderCanvas2DPolygonCommand(ctx, command);
        break;
      case "text":
        renderCanvas2DTextCommand(ctx, command);
        break;
      case "image":
        await renderCanvas2DImageCommand(ctx, command);
        break;
    }
  }
}

async function renderCanvas2DImageCommand(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderImageCommand,
) {
  const image = await loadCanvas2DImage(command.src);
  withCanvas2DTransform(ctx, command, command.width, command.height, () => {
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