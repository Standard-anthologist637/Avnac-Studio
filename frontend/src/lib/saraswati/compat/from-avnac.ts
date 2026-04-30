import type { AvnacDocumentV1 } from "../../avnac-document";
import type { AvnacShapeMeta } from "../../avnac-shape-meta";
import type { BgValue } from "../../editor-paint";
import {
  createSaraswatiSceneDocument,
  type SaraswatiPoint,
  type SaraswatiSceneCompatObject,
  type SaraswatiSceneObject,
  type SaraswatiSceneObjectBase,
  type SaraswatiScenePaintObjectBase,
  type SaraswatiSceneTextObject,
} from "../scene";

type RawFabricPoint = { x: number; y: number };

type RawFabricObject = Record<string, unknown> & {
  type?: string;
  visible?: boolean;
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  opacity?: number;
  originX?: "left" | "center" | "right";
  originY?: "top" | "center" | "bottom";
  flipX?: boolean;
  flipY?: boolean;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  strokeWidth?: number;
  points?: RawFabricPoint[];
  pathOffset?: RawFabricPoint;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  lineHeight?: number;
  underline?: boolean;
  fill?: unknown;
  stroke?: unknown;
  clipPath?: unknown;
  avnacFill?: BgValue;
  avnacStroke?: BgValue;
  avnacShape?: AvnacShapeMeta;
  avnacVectorBoardId?: string;
  avnacLayerId?: string;
  avnacLayerName?: string;
  src?: string;
  cropX?: number;
  cropY?: number;
};

export function avnacDocumentToSaraswatiScene(doc: AvnacDocumentV1) {
  return createSaraswatiSceneDocument({
    artboard: { ...doc.artboard },
    bg: doc.bg,
    objects: readFabricObjects(doc.fabric).map(fabricObjectToSaraswatiObject),
  });
}

function readFabricObjects(fabric: Record<string, unknown>): RawFabricObject[] {
  const objects = (fabric as { objects?: unknown[] }).objects;
  if (!Array.isArray(objects)) return [];
  return objects.filter(
    (object): object is RawFabricObject =>
      !!object && typeof object === "object",
  );
}

function fabricObjectToSaraswatiObject(
  raw: RawFabricObject,
): SaraswatiSceneObject {
  if (typeof raw.avnacVectorBoardId === "string" && raw.avnacVectorBoardId) {
    return {
      kind: "vector-board",
      vectorBoardId: raw.avnacVectorBoardId,
      ...readBase(raw),
    };
  }

  if (raw.clipPath) return compatObject(raw, "clip-path");

  const meta = raw.avnacShape;
  const endpoints = meta?.arrowEndpoints;
  if (endpoints && (meta.kind === "line" || meta.kind === "arrow")) {
    return {
      kind: meta.kind,
      ...readBase(raw),
      stroke: readPaint(raw.avnacStroke, raw.stroke),
      strokeWidth: meta.arrowStrokeWidth ?? readNumber(raw.strokeWidth),
      x1: endpoints.x1,
      y1: endpoints.y1,
      x2: endpoints.x2,
      y2: endpoints.y2,
      lineStyle: meta.arrowLineStyle,
      roundedEnds: meta.arrowRoundedEnds,
      pathType: meta.arrowPathType,
      curveBulge: meta.arrowCurveBulge,
      curveT: meta.arrowCurveT,
      ...(meta.kind === "arrow" ? { arrowHead: meta.arrowHead ?? 1 } : {}),
    };
  }

  switch (raw.type) {
    case "rect":
      if (!isPositiveNumber(raw.width) || !isPositiveNumber(raw.height)) {
        return compatObject(raw, "missing-rect-size");
      }
      return {
        kind: "rect",
        ...readPaintBase(raw),
        width: raw.width,
        height: raw.height,
        radiusX: readNumber(raw.rx),
        radiusY: readNumber(raw.ry),
      };
    case "ellipse":
      if (!isPositiveNumber(raw.rx) || !isPositiveNumber(raw.ry)) {
        return compatObject(raw, "missing-ellipse-radii");
      }
      return {
        kind: "ellipse",
        ...readPaintBase(raw),
        rx: raw.rx,
        ry: raw.ry,
      };
    case "polygon": {
      const points = readPolygonPoints(raw);
      if (!points || points.length < 3) {
        return compatObject(raw, "missing-polygon-points");
      }
      return {
        kind: "polygon",
        ...readPaintBase(raw),
        points,
      };
    }
    case "textbox":
    case "i-text":
    case "text": {
      if (typeof raw.text !== "string") {
        return compatObject(raw, "missing-text-content");
      }
      const textObject: SaraswatiSceneTextObject = {
        kind: "text",
        ...readPaintBase(raw),
        text: raw.text,
        width: readNumber(raw.width),
        fontSize: readNumber(raw.fontSize),
        fontFamily:
          typeof raw.fontFamily === "string" ? raw.fontFamily : undefined,
        fontWeight: raw.fontWeight,
        fontStyle: raw.fontStyle === "italic" ? "italic" : "normal",
        textAlign: normalizeTextAlign(raw.textAlign),
        lineHeight: readNumber(raw.lineHeight),
        underline: raw.underline === true,
      };
      return textObject;
    }
    case "image":
      if (!isPositiveNumber(raw.width) || !isPositiveNumber(raw.height)) {
        return compatObject(raw, "missing-image-size");
      }
      return {
        kind: "image",
        ...readPaintBase(raw),
        width: raw.width,
        height: raw.height,
        src: typeof raw.src === "string" ? raw.src : undefined,
        cropX: readNumber(raw.cropX),
        cropY: readNumber(raw.cropY),
      };
    default:
      return compatObject(
        raw,
        raw.type ? `unsupported-${raw.type}` : "unknown-type",
      );
  }
}

function readBase(raw: RawFabricObject): SaraswatiSceneObjectBase {
  return {
    id: typeof raw.avnacLayerId === "string" ? raw.avnacLayerId : undefined,
    name:
      typeof raw.avnacLayerName === "string" ? raw.avnacLayerName : undefined,
    visible: raw.visible === false ? false : undefined,
    left: readNumber(raw.left),
    top: readNumber(raw.top),
    scaleX: readNumber(raw.scaleX),
    scaleY: readNumber(raw.scaleY),
    angle: readNumber(raw.angle),
    opacity: readNumber(raw.opacity),
    originX: raw.originX,
    originY: raw.originY,
    flipX: raw.flipX === true,
    flipY: raw.flipY === true,
  };
}

function readPaintBase(raw: RawFabricObject): SaraswatiScenePaintObjectBase {
  return {
    ...readBase(raw),
    fill: readPaint(raw.avnacFill, raw.fill),
    stroke: readPaint(raw.avnacStroke, raw.stroke),
    strokeWidth: readNumber(raw.strokeWidth),
  };
}

function readPaint(stored: BgValue | undefined, raw: unknown): BgValue | null {
  if (stored) return stored;
  if (typeof raw === "string" && raw.length > 0) {
    return { type: "solid", color: raw };
  }
  return null;
}

function compatObject(
  raw: RawFabricObject,
  reason: string,
): SaraswatiSceneCompatObject {
  return {
    kind: "compat",
    ...readBase(raw),
    sourceType: typeof raw.type === "string" ? raw.type : "unknown",
    reason,
    raw,
  };
}

function readPolygonPoints(raw: RawFabricObject): SaraswatiPoint[] | null {
  if (!Array.isArray(raw.points) || raw.points.length < 3) return null;
  const points = raw.points.filter(isPointLike);
  if (points.length < 3) return null;
  const offset = raw.pathOffset;
  if (isPointLike(offset)) {
    return points.map((point) => ({
      x: point.x - offset.x,
      y: point.y - offset.y,
    }));
  }
  const bounds = pointsBounds(points);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return points.map((point) => ({ x: point.x - cx, y: point.y - cy }));
}

function pointsBounds(points: readonly SaraswatiPoint[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function normalizeTextAlign(
  value: unknown,
): SaraswatiSceneTextObject["textAlign"] {
  return value === "center" || value === "right" ? value : "left";
}

function isPointLike(value: unknown): value is RawFabricPoint {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as RawFabricPoint).x === "number" &&
    typeof (value as RawFabricPoint).y === "number"
  );
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
