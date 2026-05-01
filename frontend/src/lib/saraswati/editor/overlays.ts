import { isSaraswatiRenderableNode, type SaraswatiScene } from "../scene";
import type { SaraswatiResizeHandle } from "../commands/types";
import { getNodeBounds, type SaraswatiBounds } from "../spatial";

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
  const xResult = snapAxis(
    [
      targetBounds.x,
      targetBounds.x + targetBounds.width / 2,
      targetBounds.x + targetBounds.width,
    ],
    candidates.x,
    threshold,
    "x",
  );
  const yResult = snapAxis(
    [
      targetBounds.y,
      targetBounds.y + targetBounds.height / 2,
      targetBounds.y + targetBounds.height,
    ],
    candidates.y,
    threshold,
    "y",
  );
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
  const node = scene.nodes[nodeId];
  if (!node || !isSaraswatiRenderableNode(node)) return null;
  return getNodeBounds(node);
}

function collectSnapCandidates(
  scene: SaraswatiScene,
  excludeIds: Set<string>,
): { x: number[]; y: number[] } {
  const x = [0, scene.artboard.width / 2, scene.artboard.width];
  const y = [0, scene.artboard.height / 2, scene.artboard.height];

  for (const [nodeId, node] of Object.entries(scene.nodes)) {
    if (excludeIds.has(nodeId) || !isSaraswatiRenderableNode(node)) continue;
    const bounds = getNodeBounds(node);
    x.push(bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width);
    y.push(bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height);
  }

  return {
    x: dedupeNumbers(x),
    y: dedupeNumbers(y),
  };
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
