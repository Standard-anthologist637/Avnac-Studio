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
    case "REPLACE_NODE":
      return replaceNode(scene, command.node);
    case "SET_GROUP_CHILDREN":
      return setGroupChildren(scene, command.id, command.children);
    case "GROUP_NODES":
      return groupNodes(scene, command.id, command.parentId, command.children);
    case "UNGROUP_NODE":
      return ungroupNode(scene, command.id);
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
