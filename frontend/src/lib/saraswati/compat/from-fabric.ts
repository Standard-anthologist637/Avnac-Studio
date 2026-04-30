import type { AvnacDocumentV1 } from "../../avnac-document";
import type { BgValue } from "../../editor-paint";
import {
  createEmptySaraswatiScene,
  type SaraswatiAdapterIssue,
  type SaraswatiAdapterResult,
  type SaraswatiEllipseNode,
  type SaraswatiImageNode,
  type SaraswatiNode,
  type SaraswatiNodeOriginX,
  type SaraswatiNodeOriginY,
  type SaraswatiPolygonNode,
  type SaraswatiRectNode,
  type SaraswatiTextNode,
} from "../scene";

const FABRIC_SERIAL_KEYS = [
  "avnacFill",
  "avnacStroke",
  "avnacShape",
  "avnacLayerId",
  "avnacLayerName",
  "avnacVectorBoardId",
] as const;

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
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  r?: number;
  strokeWidth?: number;
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
  avnacShape?: unknown;
  avnacVectorBoardId?: string;
  avnacLayerId?: string;
  src?: string;
  cropX?: number;
  cropY?: number;
  points?: RawFabricPoint[];
  pathOffset?: RawFabricPoint;
};

type NormalizedFabricObjectType =
  | "rect"
  | "ellipse"
  | "polygon"
  | "text"
  | "textbox"
  | "i-text"
  | "image"
  | "unknown";

type FabricCanvasLike = {
  width?: number;
  height?: number;
  backgroundColor?: unknown;
  toObject: (
    propertiesToInclude?: readonly string[],
  ) => Record<string, unknown>;
};

export function fromAvnacDocument(
  doc: AvnacDocumentV1,
): SaraswatiAdapterResult {
  return fromSerializedFabric({
    artboard: {
      width: doc.artboard.width,
      height: doc.artboard.height,
      bg: doc.bg,
    },
    fabric: doc.fabric,
  });
}

export function fromFabric(canvas: FabricCanvasLike): SaraswatiAdapterResult {
  const width = typeof canvas.width === "number" ? canvas.width : 4000;
  const height = typeof canvas.height === "number" ? canvas.height : 4000;
  return fromSerializedFabric({
    artboard: {
      width,
      height,
      bg: readCanvasBgValue(canvas.backgroundColor),
    },
    fabric: canvas.toObject(FABRIC_SERIAL_KEYS),
  });
}

function fromSerializedFabric(input: {
  artboard: { width: number; height: number; bg: BgValue };
  fabric: Record<string, unknown>;
}): SaraswatiAdapterResult {
  const scene = createEmptySaraswatiScene(input.artboard);
  const root = scene.nodes[scene.root];
  if (!root || root.type !== "group") {
    return {
      scene,
      fullySupported: false,
      issues: [{ reason: "missing-root", sourceType: "scene" }],
    };
  }

  const issues: SaraswatiAdapterIssue[] = [];
  const objects = readFabricObjects(input.fabric);
  const nodes: Record<string, SaraswatiNode> = { ...scene.nodes };
  const children: string[] = [];

  objects.forEach((raw, index) => {
    const adapted = adaptRawFabricObject(raw, scene.root, index);
    if (!adapted.node) {
      issues.push(adapted.issue);
      return;
    }
    nodes[adapted.node.id] = adapted.node;
    children.push(adapted.node.id);
  });

  nodes[scene.root] = { ...root, children };
  return {
    scene: {
      ...scene,
      nodes,
    },
    fullySupported: issues.length === 0,
    issues,
  };
}

function adaptRawFabricObject(
  raw: RawFabricObject,
  parentId: string,
  index: number,
): { node: SaraswatiNode | null; issue: SaraswatiAdapterIssue } {
  const sourceId =
    typeof raw.avnacLayerId === "string" && raw.avnacLayerId.length > 0
      ? raw.avnacLayerId
      : `fabric-node-${index}`;

  if (raw.clipPath) {
    return {
      node: null,
      issue: { reason: "clip-path", sourceType: readSourceType(raw), sourceId },
    };
  }
  if (typeof raw.avnacVectorBoardId === "string" && raw.avnacVectorBoardId) {
    return {
      node: null,
      issue: {
        reason: "vector-board",
        sourceType: readSourceType(raw),
        sourceId,
      },
    };
  }
  const shapeKind = readShapeKind(raw.avnacShape);
  if (shapeKind === "arrow" || shapeKind === "line") {
    return {
      node: null,
      issue: {
        reason: "shape-meta",
        sourceType: readSourceType(raw),
        sourceId,
      },
    };
  }

  const normalizedType = normalizeFabricObjectType(raw.type);

  switch (normalizedType) {
    case "rect": {
      if (!isPositiveNumber(raw.width) || !isPositiveNumber(raw.height)) {
        return {
          node: null,
          issue: { reason: "missing-rect-size", sourceType: "rect", sourceId },
        };
      }
      const node: SaraswatiRectNode = {
        id: sourceId,
        type: "rect",
        parentId,
        visible: raw.visible !== false,
        x: readNumber(raw.left, 0),
        y: readNumber(raw.top, 0),
        rotation: readNumber(raw.angle, 0),
        scaleX: readNumber(raw.scaleX, 1),
        scaleY: readNumber(raw.scaleY, 1),
        opacity: clampOpacity(readNumber(raw.opacity, 1)),
        originX: normalizeOriginX(raw.originX),
        originY: normalizeOriginY(raw.originY),
        width: raw.width,
        height: raw.height,
        fill: readPaint(raw.avnacFill, raw.fill, {
          type: "solid",
          color: "transparent",
        }),
        stroke: readOptionalPaint(raw.avnacStroke, raw.stroke),
        strokeWidth: readNumber(raw.strokeWidth, 0),
        radiusX: readNumber(raw.rx, 0),
        radiusY: readNumber(raw.ry, 0),
      };
      return { node, issue: unsupportedIssue(sourceId, "rect") };
    }
    case "ellipse": {
      const radius = readNumber(raw.r, 0);
      const rx = readNumber(raw.rx, radius > 0 ? radius : readNumber(raw.width, 0) / 2);
      const ry = readNumber(raw.ry, radius > 0 ? radius : readNumber(raw.height, 0) / 2);
      const width = rx > 0 ? rx * 2 : 0;
      const height = ry > 0 ? ry * 2 : 0;
      if (!isPositiveNumber(width) || !isPositiveNumber(height)) {
        return {
          node: null,
          issue: {
            reason: "missing-ellipse-size",
            sourceType: normalizedType,
            sourceId,
          },
        };
      }
      const node: SaraswatiEllipseNode = {
        id: sourceId,
        type: "ellipse",
        parentId,
        visible: raw.visible !== false,
        x: readNumber(raw.left, 0),
        y: readNumber(raw.top, 0),
        rotation: readNumber(raw.angle, 0),
        scaleX: readNumber(raw.scaleX, 1),
        scaleY: readNumber(raw.scaleY, 1),
        opacity: clampOpacity(readNumber(raw.opacity, 1)),
        originX: normalizeOriginX(raw.originX),
        originY: normalizeOriginY(raw.originY),
        width,
        height,
        fill: readPaint(raw.avnacFill, raw.fill, {
          type: "solid",
          color: "transparent",
        }),
        stroke: readOptionalPaint(raw.avnacStroke, raw.stroke),
        strokeWidth: readNumber(raw.strokeWidth, 0),
      };
      return { node, issue: unsupportedIssue(sourceId, normalizedType) };
    }
    case "polygon": {
      const points = normalizePolygonPoints(raw.points);
      if (!points) {
        return {
          node: null,
          issue: {
            reason: "missing-polygon-points",
            sourceType: "polygon",
            sourceId,
          },
        };
      }
      const bounds = polygonBounds(points);
      const node: SaraswatiPolygonNode = {
        id: sourceId,
        type: "polygon",
        parentId,
        visible: raw.visible !== false,
        x: readNumber(raw.left, 0),
        y: readNumber(raw.top, 0),
        rotation: readNumber(raw.angle, 0),
        scaleX: readNumber(raw.scaleX, 1),
        scaleY: readNumber(raw.scaleY, 1),
        opacity: clampOpacity(readNumber(raw.opacity, 1)),
        originX: normalizeOriginX(raw.originX),
        originY: normalizeOriginY(raw.originY),
        width: bounds.width,
        height: bounds.height,
        points,
        fill: readPaint(raw.avnacFill, raw.fill, {
          type: "solid",
          color: "transparent",
        }),
        stroke: readOptionalPaint(raw.avnacStroke, raw.stroke),
        strokeWidth: readNumber(raw.strokeWidth, 0),
      };
      return {
        node,
        issue: unsupportedIssue(sourceId, shapeKind === "star" ? "star" : "polygon"),
      };
    }
    case "textbox":
    case "i-text":
    case "text": {
      if (typeof raw.text !== "string") {
        return {
          node: null,
          issue: {
            reason: "missing-text",
            sourceType: readSourceType(raw),
            sourceId,
          },
        };
      }
      const node: SaraswatiTextNode = {
        id: sourceId,
        type: "text",
        parentId,
        visible: raw.visible !== false,
        x: readNumber(raw.left, 0),
        y: readNumber(raw.top, 0),
        rotation: readNumber(raw.angle, 0),
        scaleX: readNumber(raw.scaleX, 1),
        scaleY: readNumber(raw.scaleY, 1),
        opacity: clampOpacity(readNumber(raw.opacity, 1)),
        originX: normalizeOriginX(raw.originX),
        originY: normalizeOriginY(raw.originY),
        text: raw.text,
        width: readNumber(raw.width, 1),
        fontSize: readNumber(raw.fontSize, 16),
        fontFamily:
          typeof raw.fontFamily === "string" ? raw.fontFamily : "Inter",
        fontWeight: String(raw.fontWeight ?? "400"),
        fontStyle: raw.fontStyle === "italic" ? "italic" : "normal",
        textAlign: normalizeTextAlign(raw.textAlign),
        lineHeight: readNumber(raw.lineHeight, 1.16),
        underline: raw.underline === true,
        color: readPaint(raw.avnacFill, raw.fill, {
          type: "solid",
          color: "#262626",
        }),
        stroke: readOptionalPaint(raw.avnacStroke, raw.stroke),
        strokeWidth: readNumber(raw.strokeWidth, 0),
      };
      return { node, issue: unsupportedIssue(sourceId, readSourceType(raw)) };
    }
    case "image": {
      if (
        !isPositiveNumber(raw.width) ||
        !isPositiveNumber(raw.height) ||
        typeof raw.src !== "string" ||
        raw.src.length === 0
      ) {
        return {
          node: null,
          issue: {
            reason: "missing-image-data",
            sourceType: "image",
            sourceId,
          },
        };
      }
      const node: SaraswatiImageNode = {
        id: sourceId,
        type: "image",
        parentId,
        visible: raw.visible !== false,
        x: readNumber(raw.left, 0),
        y: readNumber(raw.top, 0),
        rotation: readNumber(raw.angle, 0),
        scaleX: readNumber(raw.scaleX, 1),
        scaleY: readNumber(raw.scaleY, 1),
        opacity: clampOpacity(readNumber(raw.opacity, 1)),
        originX: normalizeOriginX(raw.originX),
        originY: normalizeOriginY(raw.originY),
        width: raw.width,
        height: raw.height,
        src: raw.src,
        cropX: readNumber(raw.cropX, 0),
        cropY: readNumber(raw.cropY, 0),
      };
      return { node, issue: unsupportedIssue(sourceId, "image") };
    }
    default:
      return {
        node: null,
        issue: {
          reason: "unsupported-type",
          sourceType: normalizedType,
          sourceId,
        },
      };
  }
}

function readFabricObjects(fabric: Record<string, unknown>): RawFabricObject[] {
  const objects = (fabric as { objects?: unknown[] }).objects;
  if (!Array.isArray(objects)) return [];
  return objects.filter(
    (object): object is RawFabricObject =>
      !!object && typeof object === "object",
  );
}

function readPaint(
  stored: BgValue | undefined,
  raw: unknown,
  fallback: BgValue,
): BgValue {
  if (stored) return cloneBgValue(stored);
  if (typeof raw === "string" && raw.length > 0) {
    return { type: "solid", color: raw };
  }
  return fallback;
}

function readOptionalPaint(
  stored: BgValue | undefined,
  raw: unknown,
): BgValue | null {
  if (stored) return cloneBgValue(stored);
  if (typeof raw === "string" && raw.length > 0) {
    return { type: "solid", color: raw };
  }
  return null;
}

function cloneBgValue(bg: BgValue): BgValue {
  if (bg.type === "solid") return { ...bg };
  return {
    type: "gradient",
    angle: bg.angle,
    css: bg.css,
    stops: bg.stops.map((stop) => ({ ...stop })),
  };
}

function readCanvasBgValue(backgroundColor: unknown): BgValue {
  if (typeof backgroundColor === "string" && backgroundColor.length > 0) {
    return { type: "solid", color: backgroundColor };
  }
  return { type: "solid", color: "#ffffff" };
}

function normalizeOriginX(value: unknown): SaraswatiNodeOriginX {
  return value === "center" || value === "right" ? value : "left";
}

function normalizeOriginY(value: unknown): SaraswatiNodeOriginY {
  return value === "center" || value === "bottom" ? value : "top";
}

function normalizeTextAlign(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clampOpacity(value: number) {
  return Math.max(0, Math.min(1, value));
}

function readSourceType(raw: RawFabricObject): string {
  return typeof raw.type === "string" ? raw.type : "unknown";
}

function normalizeFabricObjectType(
  rawType: unknown,
): NormalizedFabricObjectType {
  if (typeof rawType !== "string") return "unknown";
  const value = rawType.trim().toLowerCase();
  if (value === "circle" || value === "ellipse") return "ellipse";
  if (
    value === "rect" ||
    value === "polygon" ||
    value === "image" ||
    value === "text" ||
    value === "textbox" ||
    value === "i-text"
  ) {
    return value;
  }
  return "unknown";
}

function readShapeKind(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = (raw as { kind?: unknown }).kind;
  return typeof kind === "string" ? kind : null;
}

function normalizePolygonPoints(
  rawPoints: RawFabricPoint[] | undefined,
): Array<{ x: number; y: number }> | null {
  if (!Array.isArray(rawPoints) || rawPoints.length < 3) return null;
  const points = rawPoints.filter(
    (point) =>
      point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
  );
  if (points.length < 3) return null;
  const bounds = polygonBounds(points);
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  return points.map((point) => ({
    x: point.x - centerX,
    y: point.y - centerY,
  }));
}

function polygonBounds(points: Array<{ x: number; y: number }>) {
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
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function unsupportedIssue(
  sourceId: string,
  sourceType: string,
): SaraswatiAdapterIssue {
  return {
    reason: "supported",
    sourceType,
    sourceId,
  };
}
