import type {
  SaraswatiRenderCommand,
  SaraswatiRenderImageCommand,
} from "../../../saraswati/render/commands";
import type { RendererBackend } from "../../types";
import {
  renderCanvas2DEllipseCommand,
  renderCanvas2DLineCommand,
  renderCanvas2DPolygonCommand,
  renderCanvas2DRectCommand,
} from "./shapes";
import { loadCanvas2DImage, withCanvas2DTransform } from "./shared";
import { renderCanvas2DTextCommand } from "./text";

function clipCanvas2DImagePath(
  ctx: CanvasRenderingContext2D,
  command: SaraswatiRenderImageCommand,
) {
  const clip = command.clipPath;
  if (!clip) return;
  ctx.beginPath();
  if (clip.type === "ellipse") {
    ctx.ellipse(
      clip.x,
      clip.y,
      clip.width / 2,
      clip.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    const x = clip.x - clip.width / 2;
    const y = clip.y - clip.height / 2;
    const radius = Math.max(clip.radiusX, clip.radiusY, 0);
    if (radius <= 0) {
      ctx.rect(x, y, clip.width, clip.height);
    } else {
      const r = Math.min(radius, clip.width / 2, clip.height / 2);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + clip.width - r, y);
      ctx.quadraticCurveTo(x + clip.width, y, x + clip.width, y + r);
      ctx.lineTo(x + clip.width, y + clip.height - r);
      ctx.quadraticCurveTo(
        x + clip.width,
        y + clip.height,
        x + clip.width - r,
        y + clip.height,
      );
      ctx.lineTo(x + r, y + clip.height);
      ctx.quadraticCurveTo(x, y + clip.height, x, y + clip.height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }
  ctx.clip();
}

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
      case "line":
        renderCanvas2DLineCommand(ctx, command);
        break;
      case "text":
        renderCanvas2DTextCommand(ctx, command);
        break;
      case "image":
        try {
          await renderCanvas2DImageCommand(ctx, command);
        } catch {
          // Image failed to load — skip this shape, continue rendering others
        }
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
    clipCanvas2DImagePath(ctx, command);
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