import type {
  SaraswatiCommand,
  SaraswatiGroupNode,
  SaraswatiScene,
} from "@/lib/saraswati";

function getGroup(
  scene: SaraswatiScene,
  groupId: string,
): SaraswatiGroupNode | null {
  const node = scene.nodes[groupId];
  return node && node.type === "group" ? node : null;
}

export function buildLayerReorderCommands(
  scene: SaraswatiScene,
  orderedTopFirstIds: readonly string[],
): SaraswatiCommand[] {
  const root = getGroup(scene, scene.root);
  if (!root || orderedTopFirstIds.length !== root.children.length) return [];
  const nextChildren = [...orderedTopFirstIds].reverse();
  const same =
    nextChildren.length === root.children.length &&
    nextChildren.every((id, index) => id === root.children[index]);
  return same
    ? []
    : [{ type: "SET_GROUP_CHILDREN", id: scene.root, children: nextChildren }];
}

export function buildLayerStepCommand(
  scene: SaraswatiScene,
  nodeId: string,
  direction: "forward" | "backward",
): SaraswatiCommand[] {
  const root = getGroup(scene, scene.root);
  if (!root) return [];
  const currentIndex = root.children.indexOf(nodeId);
  if (currentIndex < 0) return [];
  const targetIndex =
    direction === "forward"
      ? Math.min(root.children.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
  if (targetIndex === currentIndex) return [];
  const nextChildren = [...root.children];
  nextChildren.splice(currentIndex, 1);
  nextChildren.splice(targetIndex, 0, nodeId);
  return [
    { type: "SET_GROUP_CHILDREN", id: scene.root, children: nextChildren },
  ];
}

export function buildGroupSelectionCommands(
  scene: SaraswatiScene,
  selectedIds: readonly string[],
  groupId: string,
): SaraswatiCommand[] {
  if (selectedIds.length < 2) return [];
  const nodes = selectedIds.map((id) => scene.nodes[id]).filter(Boolean);
  if (nodes.length !== selectedIds.length) return [];
  const parentId = nodes[0]?.parentId;
  if (!parentId || nodes.some((node) => node?.parentId !== parentId)) return [];
  return [
    {
      type: "GROUP_NODES",
      id: groupId,
      parentId,
      children: [...selectedIds],
    },
  ];
}

export function buildUngroupSelectionCommands(
  scene: SaraswatiScene,
  groupId: string,
): SaraswatiCommand[] {
  const node = scene.nodes[groupId];
  if (!node || node.type !== "group" || groupId === scene.root) return [];
  return [{ type: "UNGROUP_NODE", id: groupId }];
}
