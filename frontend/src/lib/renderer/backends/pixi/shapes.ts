import type { SaraswatiRenderRectCommand } from "../../../saraswati/render/commands";

export function renderPixiRectCommand(command: SaraswatiRenderRectCommand) {
  void command;
  throw new Error("Pixi renderer backend is not implemented yet.");
}