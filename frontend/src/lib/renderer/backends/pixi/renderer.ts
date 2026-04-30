import type { SaraswatiRenderCommand } from "../../../saraswati/render/commands";
import type { RendererBackend } from "../../types";

export type PixiRendererTarget = unknown;

export const pixiRendererBackend: RendererBackend<PixiRendererTarget> = {
  kind: "pixi",
  render: renderPixiCommands,
};

export async function renderPixiCommands(
  target: PixiRendererTarget,
  commands: readonly SaraswatiRenderCommand[],
): Promise<void> {
  void target;
  void commands;
  throw new Error("Pixi renderer backend is not implemented yet.");
}