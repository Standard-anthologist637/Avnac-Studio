import {
  cloneSaraswatiScene,
  type SaraswatiNode,
  type SaraswatiScene,
} from "../scene";
import type { SaraswatiCommand } from "./types";

export function applyCommand(
  scene: SaraswatiScene,
  command: SaraswatiCommand,
): SaraswatiScene {
  switch (command.type) {
    case "MOVE_NODE":
      return moveNode(scene, command.id, command.dx, command.dy);
    case "ADD_NODE":
      return addNode(scene, command.node);
    case "DELETE_NODE":
      return deleteNode(scene, command.id);
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
