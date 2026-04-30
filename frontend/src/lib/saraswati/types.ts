import type { BgValue } from "../editor-paint";

export const SARASWATI_SCENE_VERSION = 1 as const;

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

export type SaraswatiImageNode = SaraswatiNodeBase & {
  type: "image";
  width: number;
  height: number;
  src: string;
  cropX: number;
  cropY: number;
};

export type SaraswatiGroupNode = {
  id: SaraswatiNodeId;
  type: "group";
  parentId: SaraswatiNodeId | null;
  visible: boolean;
  children: SaraswatiNodeId[];
};

export type SaraswatiNode =
  | SaraswatiRectNode
  | SaraswatiEllipseNode
  | SaraswatiPolygonNode
  | SaraswatiTextNode
  | SaraswatiImageNode
  | SaraswatiGroupNode;

export type SaraswatiRenderableNode =
  | SaraswatiRectNode
  | SaraswatiEllipseNode
  | SaraswatiPolygonNode
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
