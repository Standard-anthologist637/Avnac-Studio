import { useMemo } from "react";
import type { EditorLayerRow } from "@/components/editor/sidebar/editor-layers-panel";
import { useSceneEditorStore } from "../store";

function nodeLabel(node: { type: string; name?: string }) {
  if (node.name && node.name.trim().length > 0) return node.name;
  if (node.type === "rect") return "Rectangle";
  if (node.type === "ellipse") return "Ellipse";
  if (node.type === "polygon") return "Polygon";
  if (node.type === "line") return "Line";
  if (node.type === "text") return "Text";
  if (node.type === "image") return "Image";
  if (node.type === "group") return "Group";
  return "Layer";
}

function moveIndex(ids: string[], fromIndex: number, toIndex: number) {
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return ids;
  next.splice(toIndex, 0, item);
  return next;
}

export function useLayerPanelTools() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);

  const rootChildren = useMemo(() => {
    if (!scene) return [] as string[];
    const root = scene.nodes[scene.root];
    if (!root || root.type !== "group") return [] as string[];
    return root.children.filter((id) => Boolean(scene.nodes[id]));
  }, [scene]);

  const rows = useMemo<EditorLayerRow[]>(() => {
    if (!scene || rootChildren.length === 0) return [];
    const stack = [...rootChildren];
    return [...stack].reverse().map((id, uiIndex) => {
      const stackIndex = stack.length - 1 - uiIndex;
      const node = scene.nodes[id]!;
      return {
        id,
        index: stackIndex,
        label: nodeLabel(node),
        visible: node.visible !== false,
        selected: selectedIds.includes(id),
      };
    });
  }, [rootChildren, scene, selectedIds]);

  const onSelectLayer = (stackIndex: number) => {
    if (!scene) return;
    const id = rootChildren[stackIndex];
    if (!id) return;
    setSelectedIds([id]);
  };

  const onToggleVisible = (stackIndex: number) => {
    if (!scene) return;
    const id = rootChildren[stackIndex];
    const node = id ? scene.nodes[id] : null;
    if (!id || !node) return;
    applyCommands([
      {
        type: "SET_NODE_VISIBLE",
        id,
        visible: !(node.visible !== false),
      },
    ]);
  };

  const onBringForward = (stackIndex: number) => {
    if (!scene) return;
    if (stackIndex < 0 || stackIndex >= rootChildren.length - 1) return;
    const children = moveIndex(rootChildren, stackIndex, stackIndex + 1);
    applyCommands([
      {
        type: "SET_GROUP_CHILDREN",
        id: scene.root,
        children,
      },
    ]);
  };

  const onSendBackward = (stackIndex: number) => {
    if (!scene) return;
    if (stackIndex <= 0 || stackIndex >= rootChildren.length) return;
    const children = moveIndex(rootChildren, stackIndex, stackIndex - 1);
    applyCommands([
      {
        type: "SET_GROUP_CHILDREN",
        id: scene.root,
        children,
      },
    ]);
  };

  const onReorder = (orderedLayerIds: string[]) => {
    if (!scene) return;
    if (orderedLayerIds.length !== rootChildren.length) return;
    const nextChildren = [...orderedLayerIds].reverse();
    applyCommands([
      {
        type: "SET_GROUP_CHILDREN",
        id: scene.root,
        children: nextChildren,
      },
    ]);
  };

  const onRenameLayer = (stackIndex: number, name: string) => {
    if (!scene) return;
    const id = rootChildren[stackIndex];
    if (!id) return;
    const nextName = name.trim();
    if (!nextName) return;
    applyCommands([
      {
        type: "SET_NODE_NAME",
        id,
        name: nextName,
      },
    ]);
  };

  return {
    rows,
    onSelectLayer,
    onToggleVisible,
    onBringForward,
    onSendBackward,
    onReorder,
    onRenameLayer,
  };
}
