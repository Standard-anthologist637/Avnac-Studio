import type { AvnacDocumentV1 } from "../../avnac-document";
import type { BgValue } from "../../editor-paint";
import {
  createEmptySaraswatiScene,
  type SaraswatiAdapterIssue,
  type SaraswatiAdapterResult,
  type SaraswatiEllipseNode,
  type SaraswatiGroupNode,
  type SaraswatiImageNode,
  type SaraswatiClipPath,
  type SaraswatiLineNode,
  type SaraswatiLinePathType,
  type SaraswatiLineStyle,
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
  objects?: unknown[];
};

type RawFabricClipPath = Record<string, unknown> & {
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  originX?: "left" | "center" | "right";
  originY?: "top" | "center" | "bottom";
  rx?: number;
  ry?: number;
  r?: number;
};

type NormalizedFabricObjectType =
  | "rect"
  | "ellipse"
  | "polygon"
  | "text"
  | "textbox"
  | "i-text"
  | "image"
  | "group"
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

  const adaptedChildren = adaptRawFabricObjects({
    rawObjects: objects,
    parentId: scene.root,
    indexPrefix: "",
    nodes,
    issues,
  });
  children.push(...adaptedChildren);

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

function adaptRawFabricObjects(input: {
  rawObjects: RawFabricObject[];
  parentId: string;
  indexPrefix: string;
  nodes: Record<string, SaraswatiNode>;
  issues: SaraswatiAdapterIssue[];
  offsetX?: number;
  offsetY?: number;
}): string[] {
  const {
    rawObjects,
    parentId,
    indexPrefix,
    nodes,
    issues,
    offsetX = 0,
    offsetY = 0,
  } = input;
  const children: string[] = [];

  rawObjects.forEach((raw, index) => {
    const indexKey = indexPrefix ? `${indexPrefix}-${index}` : `${index}`;
    const groupChildren = readRawGroupObjects(raw);
    const normalizedType = normalizeFabricObjectType(raw.type);
    const shapeKind = readShapeKind(raw.avnacShape);
    const isStructuralGroup =
      normalizedType === "group" &&
      shapeKind !== "line" &&
      shapeKind !== "arrow" &&
      groupChildren.length > 0;

    if (isStructuralGroup) {
      const groupId = readSourceId(raw, indexKey);
      const groupNode: SaraswatiGroupNode = {
        id: groupId,
        type: "group",
        parentId,
        visible: raw.visible !== false,
        opacity: clampOpacity(readNumber(raw.opacity, 1)),
        children: [],
      };
      nodes[groupId] = groupNode;

      const { cx, cy } = resolveGroupCenter(raw);
      const nestedChildren = adaptRawFabricObjects({
        rawObjects: groupChildren,
        parentId: groupId,
        indexPrefix: indexKey,
        nodes,
        issues,
        offsetX: offsetX + cx,
        offsetY: offsetY + cy,
      });

      nodes[groupId] = {
        ...groupNode,
        children: nestedChildren,
      };
      children.push(groupId);
      return;
    }

    const adapted = adaptRawFabricObject(raw, parentId, indexKey, {
      offsetX,
      offsetY,
    });
    if (!adapted.node) {
      issues.push(adapted.issue);
      return;
    }
    nodes[adapted.node.id] = adapted.node;
    children.push(adapted.node.id);
  });

  return children;
}

function adaptRawFabricObject(
  raw: RawFabricObject,
  parentId: string,
  index: string,
  options?: { offsetX?: number; offsetY?: number },
): { node: SaraswatiNode | null; issue: SaraswatiAdapterIssue } {
  const sourceId = readSourceId(raw, index);
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;

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
    const eps = readArrowEndpoints(raw.avnacShape);
    if (!eps) {
      return {
        node: null,
        issue: {
          reason: "shape-meta",
          sourceType: readSourceType(raw),
          sourceId,
        },
      };
    }
    const node: SaraswatiLineNode = {
      id: sourceId,
      type: "line",
      parentId,
      visible: raw.visible !== false,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: clampOpacity(readNumber(raw.opacity, 1)),
      originX: "left",
      originY: "top",
      x1: eps.x1,
      y1: eps.y1,
      x2: eps.x2,
      y2: eps.y2,
      stroke: readPaint(
        raw.avnacStroke ?? raw.avnacFill,
        raw.stroke ?? raw.fill,
        { type: "solid", color: "#262626" },
      ),
      strokeWidth: readArrowStrokeWidth(raw.avnacShape),
      arrowStart: false,
      arrowEnd: shapeKind === "arrow",
      lineStyle: readArrowLineStyle(raw.avnacShape),
      pathType: readArrowPathType(raw.avnacShape),
      curveBulge: readArrowCurveBulge(raw.avnacShape),
      curveT: readArrowCurveT(raw.avnacShape),
    };
    return { node, issue: unsupportedIssue(sourceId, shapeKind) };
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
        x: readNumber(raw.left, 0) + offsetX,
        y: readNumber(raw.top, 0) + offsetY,
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
        clipPath: readClipPath(raw.clipPath),
      };
      return { node, issue: unsupportedIssue(sourceId, "rect") };
    }
    case "ellipse": {
      const radius = readNumber(raw.r, 0);
      const rx = readNumber(
        raw.rx,
        radius > 0 ? radius : readNumber(raw.width, 0) / 2,
      );
      const ry = readNumber(
        raw.ry,
        radius > 0 ? radius : readNumber(raw.height, 0) / 2,
      );
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
        x: readNumber(raw.left, 0) + offsetX,
        y: readNumber(raw.top, 0) + offsetY,
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
        clipPath: readClipPath(raw.clipPath),
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
        x: readNumber(raw.left, 0) + offsetX,
        y: readNumber(raw.top, 0) + offsetY,
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
        clipPath: readClipPath(raw.clipPath),
      };
      return {
        node,
        issue: unsupportedIssue(
          sourceId,
          shapeKind === "star" ? "star" : "polygon",
        ),
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
        x: readNumber(raw.left, 0) + offsetX,
        y: readNumber(raw.top, 0) + offsetY,
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
        clipPath: readClipPath(raw.clipPath),
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
        x: readNumber(raw.left, 0) + offsetX,
        y: readNumber(raw.top, 0) + offsetY,
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
        clipPath: readClipPath(raw.clipPath),
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

/**
 * Compute the canvas-space center of a Fabric group.
 *
 * In Fabric v6 all objects (including groups) default to originX="left"/originY="top",
 * meaning `left` and `top` refer to the top-left corner of the bounding box.
 * Children of a group are stored in group-local space where (0,0) = group center.
 * To convert a child's local position to canvas space we need the group center:
 *   centerX = left + width  * (0.5 - resolveOriginOffset)
 *           = left - width  * originOffset   (left=-0.5, center=0, right=0.5)
 */
function resolveGroupCenter(raw: RawFabricObject): { cx: number; cy: number } {
  const left = readNumber(raw.left, 0);
  const top = readNumber(raw.top, 0);
  const width = readNumber(raw.width, 0);
  const height = readNumber(raw.height, 0);
  // originOffset: left/top = -0.5, center = 0, right/bottom = 0.5
  // centerX = left - width * originOffset[originX]
  //         = left + width * (0.5)   for originX='left'  (default in Fabric v6)
  //         = left                   for originX='center'
  //         = left - width * (0.5)   for originX='right'
  const ox = raw.originX;
  const oy = raw.originY;
  const factorX = ox === "center" ? 0 : ox === "right" ? -0.5 : 0.5;
  const factorY = oy === "center" ? 0 : oy === "bottom" ? -0.5 : 0.5;
  return {
    cx: left + width * factorX,
    cy: top + height * factorY,
  };
}

function readFabricObjects(fabric: Record<string, unknown>): RawFabricObject[] {
  const objects = (fabric as { objects?: unknown[] }).objects;
  if (!Array.isArray(objects)) return [];
  return objects.filter(
    (object): object is RawFabricObject =>
      !!object && typeof object === "object",
  );
}

function readRawGroupObjects(raw: RawFabricObject): RawFabricObject[] {
  const objects = raw.objects;
  if (!Array.isArray(objects)) return [];
  return objects.filter(
    (object): object is RawFabricObject =>
      !!object && typeof object === "object",
  );
}

function readSourceId(raw: RawFabricObject, index: string): string {
  if (typeof raw.avnacLayerId === "string" && raw.avnacLayerId.length > 0) {
    return raw.avnacLayerId;
  }
  return `fabric-node-${index}`;
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
    value === "group" ||
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

function readArrowEndpoints(
  raw: unknown,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const ep = (raw as { arrowEndpoints?: unknown }).arrowEndpoints;
  if (!ep || typeof ep !== "object") return null;
  const { x1, y1, x2, y2 } = ep as Record<string, unknown>;
  if (
    typeof x1 !== "number" ||
    typeof y1 !== "number" ||
    typeof x2 !== "number" ||
    typeof y2 !== "number"
  )
    return null;
  return { x1, y1, x2, y2 };
}

function readArrowStrokeWidth(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 2;
  const w = (raw as { arrowStrokeWidth?: unknown }).arrowStrokeWidth;
  return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 2;
}

function readArrowLineStyle(raw: unknown): SaraswatiLineStyle {
  if (!raw || typeof raw !== "object") return "solid";
  const style = (raw as { arrowLineStyle?: unknown }).arrowLineStyle;
  if (style === "dashed" || style === "dotted") return style;
  return "solid";
}

function readArrowPathType(raw: unknown): SaraswatiLinePathType {
  if (!raw || typeof raw !== "object") return "straight";
  const pathType = (raw as { arrowPathType?: unknown }).arrowPathType;
  return pathType === "curved" ? "curved" : "straight";
}

function readArrowCurveBulge(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const v = (raw as { arrowCurveBulge?: unknown }).arrowCurveBulge;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readArrowCurveT(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0.5;
  const v = (raw as { arrowCurveT?: unknown }).arrowCurveT;
  return typeof v === "number" && Number.isFinite(v) ? v : 0.5;
}

function readClipPath(raw: unknown): SaraswatiClipPath | null {
  if (!raw || typeof raw !== "object") return null;
  const clip = raw as RawFabricClipPath;
  const rawType =
    typeof clip.type === "string" ? clip.type.trim().toLowerCase() : "";

  if (rawType !== "rect" && rawType !== "ellipse" && rawType !== "circle") {
    return null;
  }

  const circleR = readNumber(clip.r, 0);
  const rx = readNumber(
    clip.rx,
    circleR > 0 ? circleR : readNumber(clip.width, 0) / 2,
  );
  const ry = readNumber(
    clip.ry,
    circleR > 0 ? circleR : readNumber(clip.height, 0) / 2,
  );
  const width = rawType === "rect" ? readNumber(clip.width, 0) : rx * 2;
  const height = rawType === "rect" ? readNumber(clip.height, 0) : ry * 2;
  if (!isPositiveNumber(width) || !isPositiveNumber(height)) return null;

  const left = readNumber(clip.left, 0);
  const top = readNumber(clip.top, 0);
  const originX = normalizeOriginX(clip.originX);
  const originY = normalizeOriginY(clip.originY);
  const x = anchorToCenter(left, originX, width, true);
  const y = anchorToCenter(top, originY, height, false);

  if (rawType === "rect") {
    return {
      type: "rect",
      x,
      y,
      width,
      height,
      radiusX: Math.max(0, readNumber(clip.rx, 0)),
      radiusY: Math.max(0, readNumber(clip.ry, 0)),
    };
  }

  return {
    type: "ellipse",
    x,
    y,
    width,
    height,
  };
}

function anchorToCenter(
  anchor: number,
  origin: SaraswatiNodeOriginX | SaraswatiNodeOriginY,
  size: number,
  isX: boolean,
) {
  const axisOrigin = origin ?? (isX ? "left" : "top");
  const factor =
    axisOrigin === "center"
      ? 0.5
      : axisOrigin === "right" || axisOrigin === "bottom"
        ? 1
        : 0;
  return anchor + (0.5 - factor) * size;
}

function normalizePolygonPoints(
  rawPoints: RawFabricPoint[] | undefined,
): Array<{ x: number; y: number }> | null {
  if (!Array.isArray(rawPoints) || rawPoints.length < 3) return null;
  const points = rawPoints.filter(
    (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y),
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
