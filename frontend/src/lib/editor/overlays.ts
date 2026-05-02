import {
  isSaraswatiRenderableNode,
  type SaraswatiScene,
} from "../saraswati/scene";
import type { SaraswatiResizeHandle } from "../saraswati/commands/types";
import { getNodeBounds, type SaraswatiBounds } from "../saraswati/spatial";

export type SaraswatiGuideLine = {
  axis: "x" | "y";
  position: number;
};

export type SaraswatiMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type SnapAxisResult = {
  delta: number;
  guide: SaraswatiGuideLine | null;
};

type SnapResult = {
  bounds: SaraswatiBounds;
  guides: SaraswatiGuideLine[];
};

export function measurementFromBounds(
  bounds: SaraswatiBounds,
): SaraswatiMeasurement {
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
    centerX: Math.round(bounds.x + bounds.width / 2),
    centerY: Math.round(bounds.y + bounds.height / 2),
  };
}

export function snapMoveBounds(
  scene: SaraswatiScene,
  targetBounds: SaraswatiBounds,
  selectedIds: readonly string[],
  threshold = 6,
): SnapResult {
  const candidates = collectSnapCandidates(scene, new Set(selectedIds));
  let xResult = snapAxis(
    [
      targetBounds.x,
      targetBounds.x + targetBounds.width / 2,
      targetBounds.x + targetBounds.width,
    ],
    candidates.x,
    threshold,
    "x",
  );
  let yResult = snapAxis(
    [
      targetBounds.y,
      targetBounds.y + targetBounds.height / 2,
      targetBounds.y + targetBounds.height,
    ],
    candidates.y,
    threshold,
    "y",
  );

  // Soft-sticky snap when vector-like selections approach square-like shapes.
  if (isVectorLikeSelection(scene, selectedIds) && threshold > 0) {
    const stickyThreshold = Math.max(threshold, threshold * 1.8);
    const stickyX = snapAxis(
      [
        targetBounds.x,
        targetBounds.x + targetBounds.width / 2,
        targetBounds.x + targetBounds.width,
      ],
      candidates.squareX,
      stickyThreshold,
      "x",
    );
    const stickyY = snapAxis(
      [
        targetBounds.y,
        targetBounds.y + targetBounds.height / 2,
        targetBounds.y + targetBounds.height,
      ],
      candidates.squareY,
      stickyThreshold,
      "y",
    );
    xResult = pickPreferredSnapAxisResult(xResult, stickyX);
    yResult = pickPreferredSnapAxisResult(yResult, stickyY);
  }

  return {
    bounds: {
      x: targetBounds.x + xResult.delta,
      y: targetBounds.y + yResult.delta,
      width: targetBounds.width,
      height: targetBounds.height,
    },
    guides: [xResult.guide, yResult.guide].filter(
      (guide): guide is SaraswatiGuideLine => !!guide,
    ),
  };
}

export function snapResizeBounds(
  scene: SaraswatiScene,
  targetBounds: SaraswatiBounds,
  handle: SaraswatiResizeHandle,
  selectedIds: readonly string[],
  threshold = 6,
): SnapResult {
  const candidates = collectSnapCandidates(scene, new Set(selectedIds));
  const bounds = { ...targetBounds };
  const guides: SaraswatiGuideLine[] = [];

  if (handle.includes("w")) {
    const result = snapAxis([bounds.x], candidates.x, threshold, "x");
    if (result.delta !== 0) {
      bounds.x += result.delta;
      bounds.width -= result.delta;
    }
    if (result.guide) guides.push(result.guide);
  } else if (handle.includes("e")) {
    const right = bounds.x + bounds.width;
    const result = snapAxis([right], candidates.x, threshold, "x");
    if (result.delta !== 0) {
      bounds.width += result.delta;
    }
    if (result.guide) guides.push(result.guide);
  }

  if (handle.includes("n")) {
    const result = snapAxis([bounds.y], candidates.y, threshold, "y");
    if (result.delta !== 0) {
      bounds.y += result.delta;
      bounds.height -= result.delta;
    }
    if (result.guide) guides.push(result.guide);
  } else if (handle.includes("s")) {
    const bottom = bounds.y + bounds.height;
    const result = snapAxis([bottom], candidates.y, threshold, "y");
    if (result.delta !== 0) {
      bounds.height += result.delta;
    }
    if (result.guide) guides.push(result.guide);
  }

  bounds.width = Math.max(1, bounds.width);
  bounds.height = Math.max(1, bounds.height);

  return { bounds, guides };
}

export function getRenderableNodeBounds(
  scene: SaraswatiScene,
  nodeId: string | null,
): SaraswatiBounds | null {
  if (!nodeId) return null;
  return getNodeBoundsRecursive(scene, nodeId, new Set<string>());
}

function getNodeBoundsRecursive(
  scene: SaraswatiScene,
  nodeId: string,
  visited: Set<string>,
): SaraswatiBounds | null {
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const node = scene.nodes[nodeId];
  if (!node || node.visible === false) return null;
  if (isSaraswatiRenderableNode(node)) {
    return getNodeBounds(node);
  }
  if (node.type !== "group") return null;

  let bounds: SaraswatiBounds | null = null;
  for (const childId of node.children) {
    const childBounds = getNodeBoundsRecursive(scene, childId, visited);
    if (!childBounds) continue;
    if (!bounds) {
      bounds = childBounds;
      continue;
    }
    const x1 = Math.min(bounds.x, childBounds.x);
    const y1 = Math.min(bounds.y, childBounds.y);
    const x2 = Math.max(
      bounds.x + bounds.width,
      childBounds.x + childBounds.width,
    );
    const y2 = Math.max(
      bounds.y + bounds.height,
      childBounds.y + childBounds.height,
    );
    bounds = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }
  return bounds;
}

function collectSnapCandidates(
  scene: SaraswatiScene,
  excludeIds: Set<string>,
): { x: number[]; y: number[]; squareX: number[]; squareY: number[] } {
  const x = [0, scene.artboard.width / 2, scene.artboard.width];
  const y = [0, scene.artboard.height / 2, scene.artboard.height];
  const squareX: number[] = [];
  const squareY: number[] = [];

  for (const [nodeId, node] of Object.entries(scene.nodes)) {
    if (excludeIds.has(nodeId) || !isSaraswatiRenderableNode(node)) continue;
    const bounds = getNodeBounds(node);
    x.push(bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width);
    y.push(bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height);
    if (isSquareLikeBounds(bounds)) {
      squareX.push(
        bounds.x,
        bounds.x + bounds.width / 2,
        bounds.x + bounds.width,
      );
      squareY.push(
        bounds.y,
        bounds.y + bounds.height / 2,
        bounds.y + bounds.height,
      );
    }
  }

  return {
    x: dedupeNumbers(x),
    y: dedupeNumbers(y),
    squareX: dedupeNumbers(squareX),
    squareY: dedupeNumbers(squareY),
  };
}

function isSquareLikeBounds(bounds: SaraswatiBounds): boolean {
  const maxSide = Math.max(bounds.width, bounds.height);
  if (maxSide <= 0) return false;
  const ratio = Math.abs(bounds.width - bounds.height) / maxSide;
  return ratio <= 0.12;
}

function isVectorLikeSelection(
  scene: SaraswatiScene,
  selectedIds: readonly string[],
): boolean {
  for (const id of selectedIds) {
    const node = scene.nodes[id];
    if (!node) continue;
    if (node.type === "group") {
      const name = (node.name ?? "").toLowerCase();
      if (name.includes("vector")) return true;
    }
  }
  return false;
}

function pickPreferredSnapAxisResult(
  base: SnapAxisResult,
  sticky: SnapAxisResult,
): SnapAxisResult {
  if (!sticky.guide) return base;
  if (!base.guide) return sticky;
  const baseDistance = Math.abs(base.delta);
  const stickyDistance = Math.abs(sticky.delta);
  return stickyDistance <= baseDistance + 0.5 ? sticky : base;
}

function dedupeNumbers(values: number[]) {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    const rounded = Math.round(value * 100) / 100;
    if (seen.has(rounded)) continue;
    seen.add(rounded);
    result.push(rounded);
  }
  return result;
}

function snapAxis(
  anchors: number[],
  candidates: number[],
  threshold: number,
  axis: "x" | "y",
): SnapAxisResult {
  let bestDelta = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestGuide: SaraswatiGuideLine | null = null;

  for (const anchor of anchors) {
    for (const candidate of candidates) {
      const delta = candidate - anchor;
      const distance = Math.abs(delta);
      if (distance > threshold || distance >= bestDistance) continue;
      bestDistance = distance;
      bestDelta = delta;
      bestGuide = { axis, position: candidate };
    }
  }

  return { delta: bestDelta, guide: bestGuide };
}
