import type { BgValue } from "../editor-paint";

export const SARASWATI_SCENE_VERSION = 1 as const;

export const SARASWATI_NODE_TYPES = [
  "rect",
  "ellipse",
  "polygon",
  "line",
  "text",
  "image",
  "group",
] as const;

export type SaraswatiNodeType = (typeof SARASWATI_NODE_TYPES)[number];

export type SaraswatiNodeId = string;
export type SaraswatiNodeOriginX = "left" | "center" | "right";
export type SaraswatiNodeOriginY = "top" | "center" | "bottom";

export type SaraswatiNodeBase = {
  id: SaraswatiNodeId;
  parentId: SaraswatiNodeId | null;
  visible: boolean;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  originX: SaraswatiNodeOriginX;
  originY: SaraswatiNodeOriginY;
};

export type SaraswatiPaintNodeBase = SaraswatiNodeBase & {
  fill: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
};

export type SaraswatiRectNode = SaraswatiPaintNodeBase & {
  type: "rect";
  width: number;
  height: number;
  radiusX: number;
  radiusY: number;
};

export type SaraswatiEllipseNode = SaraswatiPaintNodeBase & {
  type: "ellipse";
  width: number;
  height: number;
};

export type SaraswatiPolygonNode = SaraswatiPaintNodeBase & {
  type: "polygon";
  width: number;
  height: number;
  points: Array<{ x: number; y: number }>;
};

export type SaraswatiLineStyle = "solid" | "dashed" | "dotted";
export type SaraswatiLinePathType = "straight" | "curved";

export type SaraswatiLineNode = SaraswatiNodeBase & {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: BgValue;
  strokeWidth: number;
  arrowStart: boolean;
  arrowEnd: boolean;
  lineStyle: SaraswatiLineStyle;
  pathType: SaraswatiLinePathType;
  /** Quadratic control-point perpendicular offset in scene px (positive = below the line). */
  curveBulge: number;
  /** Position of the control point along the shaft (0–1). Default 0.5. */
  curveT: number;
};

export type SaraswatiTextNode = SaraswatiNodeBase & {
  type: "text";
  text: string;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  underline: boolean;
  color: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
};

export type SaraswatiImageClipPath =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      radiusX: number;
      radiusY: number;
    }
  | {
      type: "ellipse";
      x: number;
      y: number;
      width: number;
      height: number;
    };

export type SaraswatiImageNode = SaraswatiNodeBase & {
  type: "image";
  width: number;
  height: number;
  src: string;
  cropX: number;
  cropY: number;
  clipPath: SaraswatiImageClipPath | null;
};

export type SaraswatiGroupNode = {
  id: SaraswatiNodeId;
  type: "group";
  parentId: SaraswatiNodeId | null;
  visible: boolean;
  opacity: number;
  children: SaraswatiNodeId[];
};

export type SaraswatiNode =
  | SaraswatiRectNode
  | SaraswatiEllipseNode
  | SaraswatiPolygonNode
  | SaraswatiLineNode
  | SaraswatiTextNode
  | SaraswatiImageNode
  | SaraswatiGroupNode;

export type SaraswatiRenderableNode =
  | SaraswatiRectNode
  | SaraswatiEllipseNode
  | SaraswatiPolygonNode
  | SaraswatiLineNode
  | SaraswatiTextNode
  | SaraswatiImageNode;

export type SaraswatiSceneArtboard = {
  width: number;
  height: number;
  bg: BgValue;
};

export type SaraswatiScene = {
  version: typeof SARASWATI_SCENE_VERSION;
  root: SaraswatiNodeId;
  nodes: Record<SaraswatiNodeId, SaraswatiNode>;
  artboard: SaraswatiSceneArtboard;
};

export type SaraswatiSceneValidationIssue = {
  reason: string;
  nodeId?: SaraswatiNodeId;
};

export type SaraswatiAdapterIssue = {
  reason: string;
  sourceType: string;
  sourceId?: SaraswatiNodeId;
};

export type SaraswatiAdapterResult = {
  scene: SaraswatiScene;
  fullySupported: boolean;
  issues: SaraswatiAdapterIssue[];
};

export type Scene = SaraswatiScene;
export type Node = SaraswatiNode;
