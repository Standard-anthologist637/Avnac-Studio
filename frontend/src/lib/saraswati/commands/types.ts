import type { SaraswatiNode } from "../types";

export type SaraswatiCommand =
  | { type: "MOVE_NODE"; id: string; dx: number; dy: number }
  | { type: "ADD_NODE"; node: SaraswatiNode }
  | { type: "DELETE_NODE"; id: string }
  | { type: "REPLACE_NODE"; node: SaraswatiNode }
  | { type: "SET_GROUP_CHILDREN"; id: string; children: string[] }
  | { type: "GROUP_NODES"; id: string; parentId: string; children: string[] }
  | { type: "UNGROUP_NODE"; id: string };

export type Command = SaraswatiCommand;
