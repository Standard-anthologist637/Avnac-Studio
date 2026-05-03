import type { SaraswatiRenderTextCommand } from "../../../saraswati/render/commands";

export function renderPixiTextCommand(command: SaraswatiRenderTextCommand) {
  void command;
  throw new Error("Pixi renderer backend is not implemented yet.");
}