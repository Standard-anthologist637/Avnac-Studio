import type { SaraswatiNode } from "../types";

export type SaraswatiCommand =
  | { type: "MOVE_NODE"; id: string; dx: number; dy: number }
  | { type: "ADD_NODE"; node: SaraswatiNode }
  | { type: "DELETE_NODE"; id: string };

export type Command = SaraswatiCommand;
