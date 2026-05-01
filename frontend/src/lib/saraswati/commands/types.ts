import type { SaraswatiColor } from "../types";
import type { SaraswatiClipPath, SaraswatiNode } from "../types";

export type SaraswatiResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type SaraswatiCommand =
  | { type: "MOVE_NODE"; id: string; dx: number; dy: number }
  | { type: "ROTATE_NODE"; id: string; rotation: number }
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
  | {
      type: "SET_NODE_CLIP_PATH";
      id: string;
      clipPath: SaraswatiClipPath | null;
    }
  | {
      type: "SET_NODE_CLIP_STACK";
      id: string;
      clipPathStack: SaraswatiClipPath[];
    }
  | {
      /** Resize the artboard and/or change its background. Omit fields to leave them unchanged. */
      type: "SET_ARTBOARD";
      width?: number;
      height?: number;
      bg?: SaraswatiColor;
    }
  | {
      /** Set fill color/gradient on any paint node (rect, ellipse, polygon, star, text). */
      type: "SET_NODE_FILL";
      id: string;
      fill: SaraswatiColor;
    }
  | {
      /** Set stroke color/gradient + width on any paint node or line. */
      type: "SET_NODE_STROKE";
      id: string;
      stroke: SaraswatiColor | null;
      strokeWidth?: number;
    }
  | {
      /** Set corner radius on a rect node. */
      type: "SET_NODE_CORNER_RADIUS";
      id: string;
      radiusX: number;
      radiusY: number;
    }
  | {
      /** Set text formatting properties on a text node. */
      type: "SET_TEXT_FORMAT";
      id: string;
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: "normal" | "italic";
      textAlign?: "left" | "center" | "right";
      underline?: boolean;
      color?: SaraswatiColor;
      lineHeight?: number;
    };

export type Command = SaraswatiCommand;
