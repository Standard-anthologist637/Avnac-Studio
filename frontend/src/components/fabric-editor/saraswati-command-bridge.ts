import { bgValuesShallowEqual } from "@/lib/avnac-fill-paint";
import type {
  SaraswatiCommand,
  SaraswatiNode,
  SaraswatiScene,
} from "@/lib/saraswati";

function sameNumber(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

function sameNodeCommon(a: SaraswatiNode, b: SaraswatiNode) {
  if (a.type !== b.type) return false;
  if (a.parentId !== b.parentId) return false;
  if (a.visible !== b.visible) return false;
  if (a.type === "group" && b.type === "group") {
    return sameNumber(a.opacity, b.opacity);
  }
  if (a.type === "group" || b.type === "group") return false;
  return (
    sameNumber(a.x, b.x) &&
    sameNumber(a.y, b.y) &&
    sameNumber(a.rotation, b.rotation) &&
    sameNumber(a.scaleX, b.scaleX) &&
    sameNumber(a.scaleY, b.scaleY) &&
    sameNumber(a.opacity, b.opacity) &&
    a.originX === b.originX &&
    a.originY === b.originY
  );
}

function samePoints(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>,
) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!sameNumber(a[i]!.x, b[i]!.x) || !sameNumber(a[i]!.y, b[i]!.y)) {
      return false;
    }
  }
  return true;
}

function sameImageClipPath(a: SaraswatiNode, b: SaraswatiNode) {
  if (a.type !== "image" || b.type !== "image") return false;
  if (!a.clipPath && !b.clipPath) return true;
  if (!a.clipPath || !b.clipPath || a.clipPath.type !== b.clipPath.type) {
    return false;
  }
  if (
    !sameNumber(a.clipPath.x, b.clipPath.x) ||
    !sameNumber(a.clipPath.y, b.clipPath.y) ||
    !sameNumber(a.clipPath.width, b.clipPath.width) ||
    !sameNumber(a.clipPath.height, b.clipPath.height)
  ) {
    return false;
  }
  if (a.clipPath.type === "rect" && b.clipPath.type === "rect") {
    return (
      sameNumber(a.clipPath.radiusX, b.clipPath.radiusX) &&
      sameNumber(a.clipPath.radiusY, b.clipPath.radiusY)
    );
  }
  return true;
}

function sameNode(a: SaraswatiNode, b: SaraswatiNode) {
  if (!sameNodeCommon(a, b)) return false;
  if (a.type === "group" && b.type === "group") return true;
  if (a.type === "rect" && b.type === "rect") {
    return (
      sameNumber(a.width, b.width) &&
      sameNumber(a.height, b.height) &&
      sameNumber(a.radiusX, b.radiusX) &&
      sameNumber(a.radiusY, b.radiusY) &&
      bgValuesShallowEqual(a.fill, b.fill) &&
      ((a.stroke === null && b.stroke === null) ||
        (a.stroke !== null &&
          b.stroke !== null &&
          bgValuesShallowEqual(a.stroke, b.stroke))) &&
      sameNumber(a.strokeWidth, b.strokeWidth)
    );
  }
  if (a.type === "ellipse" && b.type === "ellipse") {
    return (
      sameNumber(a.width, b.width) &&
      sameNumber(a.height, b.height) &&
      bgValuesShallowEqual(a.fill, b.fill) &&
      ((a.stroke === null && b.stroke === null) ||
        (a.stroke !== null &&
          b.stroke !== null &&
          bgValuesShallowEqual(a.stroke, b.stroke))) &&
      sameNumber(a.strokeWidth, b.strokeWidth)
    );
  }
  if (a.type === "polygon" && b.type === "polygon") {
    return (
      sameNumber(a.width, b.width) &&
      sameNumber(a.height, b.height) &&
      samePoints(a.points, b.points) &&
      bgValuesShallowEqual(a.fill, b.fill) &&
      ((a.stroke === null && b.stroke === null) ||
        (a.stroke !== null &&
          b.stroke !== null &&
          bgValuesShallowEqual(a.stroke, b.stroke))) &&
      sameNumber(a.strokeWidth, b.strokeWidth)
    );
  }
  if (a.type === "line" && b.type === "line") {
    return (
      sameNumber(a.x1, b.x1) &&
      sameNumber(a.y1, b.y1) &&
      sameNumber(a.x2, b.x2) &&
      sameNumber(a.y2, b.y2) &&
      bgValuesShallowEqual(a.stroke, b.stroke) &&
      sameNumber(a.strokeWidth, b.strokeWidth) &&
      a.arrowStart === b.arrowStart &&
      a.arrowEnd === b.arrowEnd &&
      a.lineStyle === b.lineStyle &&
      a.pathType === b.pathType &&
      sameNumber(a.curveBulge, b.curveBulge) &&
      sameNumber(a.curveT, b.curveT)
    );
  }
  if (a.type === "text" && b.type === "text") {
    return (
      a.text === b.text &&
      sameNumber(a.width, b.width) &&
      sameNumber(a.fontSize, b.fontSize) &&
      a.fontFamily === b.fontFamily &&
      a.fontWeight === b.fontWeight &&
      a.fontStyle === b.fontStyle &&
      a.textAlign === b.textAlign &&
      sameNumber(a.lineHeight, b.lineHeight) &&
      a.underline === b.underline &&
      bgValuesShallowEqual(a.color, b.color) &&
      ((a.stroke === null && b.stroke === null) ||
        (a.stroke !== null &&
          b.stroke !== null &&
          bgValuesShallowEqual(a.stroke, b.stroke))) &&
      sameNumber(a.strokeWidth, b.strokeWidth)
    );
  }
  if (a.type === "image" && b.type === "image") {
    return (
      sameNumber(a.width, b.width) &&
      sameNumber(a.height, b.height) &&
      a.src === b.src &&
      sameNumber(a.cropX, b.cropX) &&
      sameNumber(a.cropY, b.cropY) &&
      sameImageClipPath(a, b)
    );
  }
  return false;
}

function isPureMove(prev: SaraswatiNode, next: SaraswatiNode) {
  if (prev.type === "group" || next.type === "group") return null;
  if (prev.type !== next.type) return null;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;

  if (prev.type === "line" && next.type === "line") {
    if (
      !sameNumber(next.x1 - prev.x1, dx) ||
      !sameNumber(next.y1 - prev.y1, dy) ||
      !sameNumber(next.x2 - prev.x2, dx) ||
      !sameNumber(next.y2 - prev.y2, dy)
    ) {
      return null;
    }
    const shapeSame =
      sameNumber(prev.strokeWidth, next.strokeWidth) &&
      bgValuesShallowEqual(prev.stroke, next.stroke) &&
      prev.arrowStart === next.arrowStart &&
      prev.arrowEnd === next.arrowEnd &&
      prev.lineStyle === next.lineStyle &&
      prev.pathType === next.pathType &&
      sameNumber(prev.curveBulge, next.curveBulge) &&
      sameNumber(prev.curveT, next.curveT) &&
      sameNumber(prev.rotation, next.rotation) &&
      sameNumber(prev.scaleX, next.scaleX) &&
      sameNumber(prev.scaleY, next.scaleY) &&
      sameNumber(prev.opacity, next.opacity) &&
      prev.originX === next.originX &&
      prev.originY === next.originY &&
      prev.parentId === next.parentId &&
      prev.visible === next.visible;
    return shapeSame ? { dx, dy } : null;
  }

  const neutralNext = { ...next, x: prev.x, y: prev.y } as SaraswatiNode;
  return sameNode(prev, neutralNext) ? { dx, dy } : null;
}

function collectSceneOrder(scene: SaraswatiScene): string[] {
  const ordered: string[] = [];
  const visit = (id: string) => {
    const node = scene.nodes[id];
    if (!node) return;
    ordered.push(id);
    if (node.type !== "group") return;
    for (const childId of node.children) visit(childId);
  };
  visit(scene.root);
  return ordered;
}

export function deriveSaraswatiCommands(
  prevScene: SaraswatiScene,
  nextScene: SaraswatiScene,
): SaraswatiCommand[] {
  const commands: SaraswatiCommand[] = [];

  const prevOrder = collectSceneOrder(prevScene);
  const nextOrder = collectSceneOrder(nextScene);

  // Delete leaf nodes first to keep parent-child invariants valid.
  for (let i = prevOrder.length - 1; i >= 0; i -= 1) {
    const id = prevOrder[i]!;
    if (id === prevScene.root) continue;
    if (!nextScene.nodes[id]) {
      commands.push({ type: "DELETE_NODE", id });
    }
  }

  // Add nodes parent-first.
  for (const id of nextOrder) {
    if (id === nextScene.root) continue;
    if (!prevScene.nodes[id]) {
      commands.push({ type: "ADD_NODE", node: nextScene.nodes[id]! });
    }
  }

  // Update existing nodes.
  for (const id of nextOrder) {
    if (id === nextScene.root) continue;
    const prev = prevScene.nodes[id];
    const next = nextScene.nodes[id];
    if (!prev || !next) continue;
    if (sameNode(prev, next)) continue;

    const move = isPureMove(prev, next);
    if (move && (!sameNumber(move.dx, 0) || !sameNumber(move.dy, 0))) {
      commands.push({ type: "MOVE_NODE", id, dx: move.dx, dy: move.dy });
      continue;
    }

    commands.push({ type: "REPLACE_NODE", node: next });
  }

  // Reorder group children after structural changes.
  const allGroupIds = new Set<string>();
  for (const [id, node] of Object.entries(nextScene.nodes)) {
    if (node.type === "group") allGroupIds.add(id);
  }
  for (const groupId of allGroupIds) {
    const prevGroup = prevScene.nodes[groupId];
    const nextGroup = nextScene.nodes[groupId];
    if (!nextGroup || nextGroup.type !== "group") continue;
    const prevChildren =
      prevGroup && prevGroup.type === "group" ? prevGroup.children : [];
    const nextChildren = nextGroup.children;
    if (
      prevChildren.length === nextChildren.length &&
      prevChildren.every((id, idx) => id === nextChildren[idx])
    ) {
      continue;
    }
    commands.push({
      type: "SET_GROUP_CHILDREN",
      id: groupId,
      children: [...nextChildren],
    });
  }

  return commands;
}
