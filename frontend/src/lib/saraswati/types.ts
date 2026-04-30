import type { ArrowLineStyle, ArrowPathType } from "../avnac-shape-meta";
import type { BgValue } from "../editor-paint";

export type SaraswatiPoint = { x: number; y: number };

export type SaraswatiObjectOriginX = "left" | "center" | "right";
export type SaraswatiObjectOriginY = "top" | "center" | "bottom";

export type SaraswatiSceneObjectBase = {
  id?: string;
  name?: string;
  visible?: boolean;
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  opacity?: number;
  originX?: SaraswatiObjectOriginX;
  originY?: SaraswatiObjectOriginY;
  flipX?: boolean;
  flipY?: boolean;
};

export type SaraswatiScenePaintObjectBase = SaraswatiSceneObjectBase & {
  fill?: BgValue | null;
  stroke?: BgValue | null;
  strokeWidth?: number;
};

export type SaraswatiSceneRectObject = SaraswatiScenePaintObjectBase & {
  kind: "rect";
  width: number;
  height: number;
  radiusX?: number;
  radiusY?: number;
};

export type SaraswatiSceneEllipseObject = SaraswatiScenePaintObjectBase & {
  kind: "ellipse";
  rx: number;
  ry: number;
};

export type SaraswatiScenePolygonObject = SaraswatiScenePaintObjectBase & {
  kind: "polygon";
  points: SaraswatiPoint[];
};

export type SaraswatiSceneTextObject = SaraswatiScenePaintObjectBase & {
  kind: "text";
  text: string;
  width?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  underline?: boolean;
};

type SaraswatiSceneStrokeObjectBase = SaraswatiSceneObjectBase & {
  stroke?: BgValue | null;
  strokeWidth?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineStyle?: ArrowLineStyle;
  roundedEnds?: boolean;
  pathType?: ArrowPathType;
  curveBulge?: number;
  curveT?: number;
};

export type SaraswatiSceneLineObject = SaraswatiSceneStrokeObjectBase & {
  kind: "line";
};

export type SaraswatiSceneArrowObject = SaraswatiSceneStrokeObjectBase & {
  kind: "arrow";
  arrowHead?: number;
};

export type SaraswatiSceneImageObject = SaraswatiScenePaintObjectBase & {
  kind: "image";
  width: number;
  height: number;
  src?: string;
  cropX?: number;
  cropY?: number;
};

export type SaraswatiSceneGroupObject = SaraswatiSceneObjectBase & {
  kind: "group";
  children: SaraswatiSceneObject[];
};

export type SaraswatiSceneVectorBoardObject = SaraswatiSceneObjectBase & {
  kind: "vector-board";
  vectorBoardId: string;
};

export type SaraswatiSceneCompatObject = SaraswatiSceneObjectBase & {
  kind: "compat";
  sourceType: string;
  reason: string;
  raw: Record<string, unknown>;
};

export type SaraswatiSceneObject =
  | SaraswatiSceneRectObject
  | SaraswatiSceneEllipseObject
  | SaraswatiScenePolygonObject
  | SaraswatiSceneTextObject
  | SaraswatiSceneLineObject
  | SaraswatiSceneArrowObject
  | SaraswatiSceneImageObject
  | SaraswatiSceneGroupObject
  | SaraswatiSceneVectorBoardObject
  | SaraswatiSceneCompatObject;

export type SaraswatiPreviewRenderableObject =
  | SaraswatiSceneRectObject
  | SaraswatiSceneEllipseObject
  | SaraswatiScenePolygonObject
  | SaraswatiSceneTextObject
  | SaraswatiSceneLineObject
  | SaraswatiSceneArrowObject;

export type SaraswatiSceneDocumentV1 = {
  v: 1;
  artboard: { width: number; height: number };
  bg: BgValue;
  objects: SaraswatiSceneObject[];
};
