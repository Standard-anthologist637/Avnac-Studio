import type { SaraswatiClipPath, SaraswatiNode } from "../types";

export type SaraswatiResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type SaraswatiCommand =
  | { type: "MOVE_NODE"; id: string; dx: number; dy: number }
  | {
      type: "RESIZE_NODE";
      id: string;
      /** New bounding-box x (top-left, scene coords). */
      x: number;
      /** New bounding-box y (top-left, scene coords). */
      y: number;
      width: number;
      height: number;
    }
  | { type: "ADD_NODE"; node: SaraswatiNode }
  | { type: "DELETE_NODE"; id: string }
  | { type: "REPLACE_NODE"; node: SaraswatiNode }
  | { type: "SET_GROUP_CHILDREN"; id: string; children: string[] }
  | { type: "GROUP_NODES"; id: string; parentId: string; children: string[] }
  | { type: "UNGROUP_NODE"; id: string }
  | { type: "SET_NODE_VISIBLE"; id: string; visible: boolean }
  | { type: "SET_NODE_NAME"; id: string; name: string }
  | { type: "SET_NODE_CLIP_PATH"; id: string; clipPath: SaraswatiClipPath | null };

export type Command = SaraswatiCommand;
