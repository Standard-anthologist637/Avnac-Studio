import {
  listSaraswatiNodesInRenderOrder,
  type SaraswatiRenderableNode,
  type SaraswatiScene,
} from "../scene";

export type SaraswatiPoint = { x: number; y: number };
export type SaraswatiBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function buildSpatialIndex(
  scene: SaraswatiScene,
  cellSize = 128,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const node of listSaraswatiNodesInRenderOrder(scene)) {
    const bounds = getNodeBounds(node);
    const x1 = Math.floor(bounds.x / cellSize);
    const y1 = Math.floor(bounds.y / cellSize);
    const x2 = Math.floor((bounds.x + bounds.width) / cellSize);
    const y2 = Math.floor((bounds.y + bounds.height) / cellSize);
    for (let gx = x1; gx <= x2; gx += 1) {
      for (let gy = y1; gy <= y2; gy += 1) {
        const key = `${gx}:${gy}`;
        const bucket = index.get(key);
        if (bucket) bucket.push(node.id);
        else index.set(key, [node.id]);
      }
    }
  }
  return index;
}

export function findTopHitNodeId(
  scene: SaraswatiScene,
  point: SaraswatiPoint,
): string | null {
  const ordered = listSaraswatiNodesInRenderOrder(scene);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const node = ordered[index]!;
    if (pointInBounds(point, getNodeBounds(node))) return node.id;
  }
  return null;
}

export function snapDeltaToGrid(
  dx: number,
  dy: number,
  gridSize = 1,
): { dx: number; dy: number } {
  if (gridSize <= 1) return { dx, dy };
  return {
    dx: Math.round(dx / gridSize) * gridSize,
    dy: Math.round(dy / gridSize) * gridSize,
  };
}

export function getNodeBounds(node: SaraswatiRenderableNode): SaraswatiBounds {
  if (node.type === "line") {
    const x = Math.min(node.x1, node.x2);
    const y = Math.min(node.y1, node.y2);
    return {
      x,
      y,
      width: Math.max(1, Math.abs(node.x2 - node.x1)),
      height: Math.max(1, Math.abs(node.y2 - node.y1)),
    };
  }
  const width = node.type === "text" ? Math.max(1, node.width) : node.width;
  const height =
    node.type === "text"
      ? Math.max(1, node.fontSize * Math.max(1, node.lineHeight))
      : node.height;
  const scaledWidth = Math.abs(width * node.scaleX);
  const scaledHeight = Math.abs(height * node.scaleY);
  return {
    x: anchorToStart(node.x, node.originX, scaledWidth),
    y: anchorToStart(node.y, node.originY, scaledHeight),
    width: scaledWidth,
    height: scaledHeight,
  };
}

function pointInBounds(
  point: SaraswatiPoint,
  bounds: SaraswatiBounds,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function anchorToStart(
  anchor: number,
  origin: "left" | "center" | "right" | "top" | "bottom",
  size: number,
) {
  if (origin === "center") return anchor - size / 2;
  if (origin === "right" || origin === "bottom") return anchor - size;
  return anchor;
}
