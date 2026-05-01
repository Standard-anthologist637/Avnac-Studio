import type { SaraswatiColor, SaraswatiShadow } from "../types";
import {
  cloneSaraswatiScene,
  isSaraswatiRenderableNode,
  type SaraswatiNode,
  type SaraswatiScene,
} from "../scene";
import type {
  SaraswatiClipPath,
  SaraswatiNodeOriginX,
  SaraswatiNodeOriginY,
} from "../types";
import type { SaraswatiCommand } from "./types";

export function applyCommand(
  scene: SaraswatiScene,
  command: SaraswatiCommand,
): SaraswatiScene {
  switch (command.type) {
    case "MOVE_NODE":
      return moveNode(scene, command.id, command.dx, command.dy);
    case "ROTATE_NODE":
      return rotateNode(scene, command.id, command.rotation);
    case "RESIZE_NODE":
      return resizeNode(
        scene,
        command.id,
        command.x,
        command.y,
        command.width,
        command.height,
      );
    case "ADD_NODE":
      return addNode(scene, command.node);
    case "DELETE_NODE":
      return deleteNode(scene, command.id);
    case "REPLACE_NODE":
      return replaceNode(scene, command.node);
    case "SET_GROUP_CHILDREN":
      return setGroupChildren(scene, command.id, command.children);
    case "GROUP_NODES":
      return groupNodes(scene, command.id, command.parentId, command.children);
    case "UNGROUP_NODE":
      return ungroupNode(scene, command.id);
    case "SET_NODE_VISIBLE":
      return setNodeVisible(scene, command.id, command.visible);
    case "SET_NODE_NAME":
      return setNodeName(scene, command.id, command.name);
    case "SET_NODE_CLIP_PATH":
      return setNodeClipPath(scene, command.id, command.clipPath);
    case "SET_NODE_CLIP_STACK":
      return setNodeClipStack(scene, command.id, command.clipPathStack);
    case "SET_ARTBOARD":
      return setArtboard(scene, command.width, command.height, command.bg);
    case "SET_NODE_FILL":
      return setNodeFill(scene, command.id, command.fill);
    case "SET_NODE_STROKE":
      return setNodeStroke(
        scene,
        command.id,
        command.stroke,
        command.strokeWidth,
      );
    case "SET_NODE_CORNER_RADIUS":
      return setNodeCornerRadius(
        scene,
        command.id,
        command.radiusX,
        command.radiusY,
      );
    case "SET_TEXT_FORMAT":
      return setTextFormat(scene, command.id, command);
    case "SET_NODE_OPACITY":
      return setNodeOpacity(scene, command.id, command.opacity);
    case "SET_NODE_SHADOW":
      return setNodeShadow(scene, command.id, command.shadow);
    case "SET_NODE_BLUR":
      return setNodeBlur(scene, command.id, command.blur);
    default:
      return scene;
  }
}

function moveNode(
  scene: SaraswatiScene,
  nodeId: string,
  dx: number,
  dy: number,
): SaraswatiScene {
  if ((dx === 0 && dy === 0) || nodeId === scene.root || !scene.nodes[nodeId]) {
    return scene;
  }
  const next = cloneSaraswatiScene(scene);
  moveNodeRecursive(next.nodes, nodeId, dx, dy);
  return next;
}

function rotateNode(
  scene: SaraswatiScene,
  nodeId: string,
  rotation: number,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || nodeId === scene.root) return scene;
  const next = cloneSaraswatiScene(scene);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  next.nodes[nodeId] = { ...(node as any), rotation } as SaraswatiNode;
  return next;
}

function addNode(scene: SaraswatiScene, node: SaraswatiNode): SaraswatiScene {
  if (scene.nodes[node.id]) return scene;
  const next = cloneSaraswatiScene(scene);
  const parentId = resolveParentId(next, node.parentId);
  const normalized =
    node.type === "group" ? { ...node, parentId } : { ...node, parentId };
  next.nodes[normalized.id] = normalized;
  const parent = next.nodes[parentId];
  if (!parent || parent.type !== "group") return scene;
  next.nodes[parentId] = {
    ...parent,
    children: [...parent.children, normalized.id],
  };
  return next;
}

function deleteNode(scene: SaraswatiScene, nodeId: string): SaraswatiScene {
  if (nodeId === scene.root || !scene.nodes[nodeId]) return scene;
  const next = cloneSaraswatiScene(scene);
  const idsToDelete = collectSubtreeIds(next.nodes, nodeId);
  const parentId = next.nodes[nodeId]?.parentId ?? null;
  if (parentId) {
    const parent = next.nodes[parentId];
    if (parent && parent.type === "group") {
      next.nodes[parentId] = {
        ...parent,
        children: parent.children.filter((childId) => childId !== nodeId),
      };
    }
  }
  for (const id of idsToDelete) {
    delete next.nodes[id];
  }
  return next;
}

function replaceNode(
  scene: SaraswatiScene,
  node: SaraswatiNode,
): SaraswatiScene {
  const existing = scene.nodes[node.id];
  if (!existing) return scene;
  const next = cloneSaraswatiScene(scene);
  if (existing.type === "group" && node.type === "group") {
    next.nodes[node.id] = {
      ...node,
      children: [...existing.children],
    };
    return next;
  }
  next.nodes[node.id] = {
    ...node,
    parentId: existing.parentId,
  };
  return next;
}

function setGroupChildren(
  scene: SaraswatiScene,
  groupId: string,
  children: string[],
): SaraswatiScene {
  const group = scene.nodes[groupId];
  if (!group || group.type !== "group") return scene;
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const childId of children) {
    if (seen.has(childId) || !scene.nodes[childId] || childId === scene.root)
      continue;
    seen.add(childId);
    deduped.push(childId);
  }
  if (
    deduped.length === group.children.length &&
    deduped.every((childId, index) => childId === group.children[index])
  ) {
    return scene;
  }
  const next = cloneSaraswatiScene(scene);
  next.nodes[groupId] = {
    ...group,
    children: deduped,
  };
  for (const childId of deduped) {
    const child = next.nodes[childId];
    if (!child || child.parentId === groupId) continue;
    next.nodes[childId] = { ...child, parentId: groupId };
  }
  return next;
}

function groupNodes(
  scene: SaraswatiScene,
  groupId: string,
  parentId: string,
  children: string[],
): SaraswatiScene {
  if (scene.nodes[groupId]) return scene;
  const parent = scene.nodes[parentId];
  if (!parent || parent.type !== "group") return scene;

  const selected = new Set<string>();
  const orderedChildren: string[] = [];
  for (const childId of parent.children) {
    if (!children.includes(childId) || selected.has(childId)) continue;
    const child = scene.nodes[childId];
    if (!child || child.parentId !== parentId) continue;
    selected.add(childId);
    orderedChildren.push(childId);
  }
  if (orderedChildren.length < 2) return scene;

  const firstIndex = parent.children.findIndex((childId) =>
    selected.has(childId),
  );
  if (firstIndex < 0) return scene;

  const next = cloneSaraswatiScene(scene);
  next.nodes[groupId] = {
    id: groupId,
    type: "group",
    parentId,
    visible: true,
    opacity: 1,
    children: orderedChildren,
  };

  next.nodes[parentId] = {
    ...parent,
    children: [
      ...parent.children
        .slice(0, firstIndex)
        .filter((childId) => !selected.has(childId)),
      groupId,
      ...parent.children
        .slice(firstIndex)
        .filter((childId) => !selected.has(childId)),
    ],
  };

  for (const childId of orderedChildren) {
    const child = next.nodes[childId];
    if (!child) continue;
    next.nodes[childId] = { ...child, parentId: groupId };
  }

  return next;
}

function ungroupNode(scene: SaraswatiScene, groupId: string): SaraswatiScene {
  const group = scene.nodes[groupId];
  if (!group || group.type !== "group" || groupId === scene.root) return scene;
  const parentId = group.parentId;
  if (!parentId) return scene;
  const parent = scene.nodes[parentId];
  if (!parent || parent.type !== "group") return scene;

  const groupIndex = parent.children.indexOf(groupId);
  if (groupIndex < 0) return scene;

  const next = cloneSaraswatiScene(scene);
  next.nodes[parentId] = {
    ...parent,
    children: [
      ...parent.children.slice(0, groupIndex),
      ...group.children,
      ...parent.children.slice(groupIndex + 1),
    ],
  };

  for (const childId of group.children) {
    const child = next.nodes[childId];
    if (!child) continue;
    next.nodes[childId] = { ...child, parentId };
  }

  delete next.nodes[groupId];
  return next;
}

function resizeNode(
  scene: SaraswatiScene,
  nodeId: string,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || node.type === "group") return scene;
  const clamped = { bx, by, bw: Math.max(1, bw), bh: Math.max(1, bh) };
  const next = cloneSaraswatiScene(scene);
  if (node.type === "line") {
    const dx = node.x2 - node.x1;
    const dy = node.y2 - node.y1;
    const length = Math.hypot(dx, dy);
    const ux = length > 0 ? dx / length : 1;
    const uy = length > 0 ? dy / length : 0;
    const oldCenterX = (node.x1 + node.x2) / 2;
    const oldCenterY = (node.y1 + node.y2) / 2;
    const requestedCenterX = clamped.bx + clamped.bw / 2;
    const requestedCenterY = clamped.by + clamped.bh / 2;
    const centerShiftAlongLine =
      (requestedCenterX - oldCenterX) * ux +
      (requestedCenterY - oldCenterY) * uy;
    const centerX = oldCenterX + centerShiftAlongLine * ux;
    const centerY = oldCenterY + centerShiftAlongLine * uy;
    const halfLength = Math.max(
      0.5,
      Math.abs(ux) * (clamped.bw / 2) + Math.abs(uy) * (clamped.bh / 2),
    );
    next.nodes[nodeId] = {
      ...node,
      x1: centerX - ux * halfLength,
      y1: centerY - uy * halfLength,
      x2: centerX + ux * halfLength,
      y2: centerY + uy * halfLength,
    };
    return next;
  }
  const nx = boundsToAnchorX(clamped.bx, node.originX, clamped.bw);
  const ny = boundsToAnchorY(clamped.by, node.originY, clamped.bh);
  if (node.type === "text") {
    next.nodes[nodeId] = {
      ...node,
      x: nx,
      y: ny,
      width: clamped.bw / node.scaleX,
    };
    return next;
  }
  next.nodes[nodeId] = {
    ...node,
    x: nx,
    y: ny,
    width: clamped.bw / node.scaleX,
    height: clamped.bh / node.scaleY,
  } as SaraswatiNode;
  return next;
}

function boundsToAnchorX(
  left: number,
  originX: SaraswatiNodeOriginX,
  width: number,
): number {
  if (originX === "center") return left + width / 2;
  if (originX === "right") return left + width;
  return left;
}

function boundsToAnchorY(
  top: number,
  originY: SaraswatiNodeOriginY,
  height: number,
): number {
  if (originY === "center") return top + height / 2;
  if (originY === "bottom") return top + height;
  return top;
}

function setNodeVisible(
  scene: SaraswatiScene,
  nodeId: string,
  visible: boolean,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || node.visible === visible) return scene;
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = { ...node, visible };
  return next;
}

function setNodeName(
  scene: SaraswatiScene,
  nodeId: string,
  name: string,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node) return scene;
  const next = cloneSaraswatiScene(scene);
  // Store name as a generic meta property; nodes that have a `name` field get it set directly.
  // All node types share SaraswatiNodeBase which doesn't define `name`, so we widen with a cast.
  next.nodes[nodeId] = { ...node, name };
  return next;
}

function setNodeClipPath(
  scene: SaraswatiScene,
  nodeId: string,
  clipPath: SaraswatiClipPath | null,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || !isSaraswatiRenderableNode(node) || node.type === "line") {
    return scene;
  }
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = { ...node, clipPath };
  return next;
}

function setNodeClipStack(
  scene: SaraswatiScene,
  nodeId: string,
  clipPathStack: SaraswatiClipPath[],
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || !isSaraswatiRenderableNode(node) || node.type === "line") {
    return scene;
  }
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = {
    ...node,
    clipPathStack: clipPathStack.map((clipPath) => ({ ...clipPath })),
  };
  return next;
}

function setArtboard(
  scene: SaraswatiScene,
  width?: number,
  height?: number,
  bg?: SaraswatiColor,
): SaraswatiScene {
  const nextW = width != null && width > 0 ? width : scene.artboard.width;
  const nextH = height != null && height > 0 ? height : scene.artboard.height;
  const nextBg = bg ?? scene.artboard.bg;
  if (
    nextW === scene.artboard.width &&
    nextH === scene.artboard.height &&
    nextBg === scene.artboard.bg
  ) {
    return scene;
  }
  return {
    ...scene,
    artboard: { ...scene.artboard, width: nextW, height: nextH, bg: nextBg },
  };
}

function moveNodeRecursive(
  nodes: Record<string, SaraswatiNode>,
  nodeId: string,
  dx: number,
  dy: number,
) {
  const node = nodes[nodeId];
  if (!node) return;
  if (node.type === "group") {
    nodes[nodeId] = { ...node };
    for (const childId of node.children) {
      moveNodeRecursive(nodes, childId, dx, dy);
    }
    return;
  }
  if (node.type === "line") {
    nodes[nodeId] = {
      ...node,
      x: node.x + dx,
      y: node.y + dy,
      x1: node.x1 + dx,
      y1: node.y1 + dy,
      x2: node.x2 + dx,
      y2: node.y2 + dy,
    };
    return;
  }
  nodes[nodeId] = {
    ...node,
    x: node.x + dx,
    y: node.y + dy,
  };
}

function resolveParentId(
  scene: SaraswatiScene,
  parentId: string | null,
): string {
  if (!parentId) return scene.root;
  const parent = scene.nodes[parentId];
  return parent && parent.type === "group" ? parentId : scene.root;
}

function collectSubtreeIds(
  nodes: Record<string, SaraswatiNode>,
  nodeId: string,
): string[] {
  const node = nodes[nodeId];
  if (!node) return [];
  if (node.type !== "group") return [nodeId];
  return [
    nodeId,
    ...node.children.flatMap((childId) => collectSubtreeIds(nodes, childId)),
  ];
}

function setNodeFill(
  scene: SaraswatiScene,
  nodeId: string,
  fill: SaraswatiColor,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node) return scene;
  if (node.type === "image" || node.type === "group" || node.type === "line") {
    return scene;
  }
  const next = cloneSaraswatiScene(scene);
  // Safe: we've already excluded image, group, and line above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  next.nodes[nodeId] = { ...(node as any), fill } as SaraswatiNode;
  return next;
}

function setNodeStroke(
  scene: SaraswatiScene,
  nodeId: string,
  stroke: SaraswatiColor | null,
  strokeWidth?: number,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || node.type === "image" || node.type === "group") return scene;
  const next = cloneSaraswatiScene(scene);
  if (node.type === "line") {
    const nextStroke = stroke ?? node.stroke;
    next.nodes[nodeId] = {
      ...node,
      stroke: nextStroke,
      strokeWidth: strokeWidth ?? node.strokeWidth,
    };
  } else {
    next.nodes[nodeId] = {
      ...node,
      stroke: stroke,
      strokeWidth: strokeWidth ?? node.strokeWidth,
    };
  }
  return next;
}

function setNodeCornerRadius(
  scene: SaraswatiScene,
  nodeId: string,
  radiusX: number,
  radiusY: number,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || node.type !== "rect") return scene;
  const clampedX = Math.max(0, radiusX);
  const clampedY = Math.max(0, radiusY);
  if (node.radiusX === clampedX && node.radiusY === clampedY) return scene;
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = { ...node, radiusX: clampedX, radiusY: clampedY };
  return next;
}

function setTextFormat(
  scene: SaraswatiScene,
  nodeId: string,
  patch: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: "normal" | "italic";
    textAlign?: "left" | "center" | "right";
    underline?: boolean;
    color?: SaraswatiColor;
    lineHeight?: number;
  },
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node || node.type !== "text") return scene;
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = {
    ...node,
    ...(patch.fontFamily !== undefined && { fontFamily: patch.fontFamily }),
    ...(patch.fontSize !== undefined && { fontSize: patch.fontSize }),
    ...(patch.fontWeight !== undefined && { fontWeight: patch.fontWeight }),
    ...(patch.fontStyle !== undefined && { fontStyle: patch.fontStyle }),
    ...(patch.textAlign !== undefined && { textAlign: patch.textAlign }),
    ...(patch.underline !== undefined && { underline: patch.underline }),
    ...(patch.color !== undefined && { color: patch.color }),
    ...(patch.lineHeight !== undefined && { lineHeight: patch.lineHeight }),
  };
  return next;
}

function setNodeOpacity(
  scene: SaraswatiScene,
  nodeId: string,
  opacity: number,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node) return scene;
  const clamped = Math.max(0, Math.min(1, opacity));
  if (node.opacity === clamped) return scene;
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = { ...node, opacity: clamped };
  return next;
}

function setNodeShadow(
  scene: SaraswatiScene,
  nodeId: string,
  shadow: SaraswatiShadow | null,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node) return scene;
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = { ...node, shadow: shadow ?? null } as SaraswatiNode;
  return next;
}

function setNodeBlur(
  scene: SaraswatiScene,
  nodeId: string,
  blur: number,
): SaraswatiScene {
  const node = scene.nodes[nodeId];
  if (!node) return scene;
  const clamped = Math.max(0, Math.min(100, blur));
  const existing = (node as { blur?: number }).blur ?? 0;
  if (existing === clamped) return scene;
  const next = cloneSaraswatiScene(scene);
  next.nodes[nodeId] = { ...node, blur: clamped } as SaraswatiNode;
  return next;
}
