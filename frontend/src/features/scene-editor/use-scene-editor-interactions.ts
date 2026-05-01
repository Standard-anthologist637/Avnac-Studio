/**
 * Wires Saraswati pointer-interaction primitives to the global SceneEditor
 * Zustand store. Returns stable callbacks and editor overlay state.
 */
import {
  createIdlePointerState,
  findTopHitNodeId,
  getNodeBounds,
  isSaraswatiRenderableNode,
  pointerDown,
  pointerMove,
  pointerUp,
  resizeHandlePointerDown,
  type SaraswatiPointerState,
  type SaraswatiResizeHandle,
} from "@/lib/saraswati";
import {
  getRenderableNodeBounds,
  measurementFromBounds,
  snapMoveBounds,
  snapResizeBounds,
  type SaraswatiGuideLine,
  type SaraswatiMeasurement,
} from "@/lib/editor/overlays";
import type { SaraswatiBounds } from "@/lib/saraswati/spatial";
import { useCallback, useRef, useState } from "react";
import { useSceneEditorStore } from "./store";

function commandNodeIdFromCommand(command: {
  type: string;
  id?: string;
  node?: { id: string };
}) {
  if (command.type === "REPLACE_NODE" || command.type === "ADD_NODE") {
    return command.node?.id ?? null;
  }
  return command.id ?? null;
}

export function useSceneEditorInteractions() {
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);

  const pointerStateRef = useRef<SaraswatiPointerState>(
    createIdlePointerState(),
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [guides, setGuides] = useState<SaraswatiGuideLine[]>([]);
  const [measurement, setMeasurement] = useState<SaraswatiMeasurement | null>(
    null,
  );

  const onPointerDown = useCallback(
    (pointerId: number, x: number, y: number) => {
      const scene = useSceneEditorStore.getState().scene;
      if (!scene) return;
      const result = pointerDown(scene, pointerId, x, y);
      pointerStateRef.current = result.state;
      setSelectedIds(result.selectedIds);
      setHoveredId(null);
      setGuides([]);
      setMeasurement(null);
    },
    [setSelectedIds],
  );

  const onPointerMove = useCallback(
    (pointerId: number, x: number, y: number) => {
      const store = useSceneEditorStore.getState();
      const scene = store.scene;
      if (!scene) return;

      if (pointerStateRef.current.pointerId === null) {
        setHoveredId(findTopHitNodeId(scene, { x, y }));
        setGuides([]);
        setMeasurement(null);
        return;
      }

      const result = pointerMove(pointerStateRef.current, pointerId, x, y);
      pointerStateRef.current = result.state;
      if (!result.command) return;

      let command = result.command;
      let nextGuides: SaraswatiGuideLine[] = [];
      let nextMeasurement: SaraswatiMeasurement | null = null;

      if (command.type === "MOVE_NODE") {
        const node = scene.nodes[command.id];
        if (node && isSaraswatiRenderableNode(node)) {
          const startBounds = getNodeBounds(node);
          const snapped = snapMoveBounds(
            scene,
            {
              x: startBounds.x + command.dx,
              y: startBounds.y + command.dy,
              width: startBounds.width,
              height: startBounds.height,
            },
            store.selectedIds,
          );
          command = {
            ...command,
            dx: snapped.bounds.x - startBounds.x,
            dy: snapped.bounds.y - startBounds.y,
          };
          nextGuides = snapped.guides;
          nextMeasurement = measurementFromBounds(snapped.bounds);
        }
      } else if (command.type === "RESIZE_NODE") {
        const resizeState = pointerStateRef.current.resize;
        if (resizeState) {
          const snapped = snapResizeBounds(
            scene,
            {
              x: command.x,
              y: command.y,
              width: command.width,
              height: command.height,
            },
            resizeState.handle,
            store.selectedIds,
          );
          command = {
            ...command,
            x: snapped.bounds.x,
            y: snapped.bounds.y,
            width: snapped.bounds.width,
            height: snapped.bounds.height,
          };
          nextGuides = snapped.guides;
          nextMeasurement = measurementFromBounds(snapped.bounds);
        }
      }

      applyCommands([command]);
      const nextScene = useSceneEditorStore.getState().scene;
      const commandNodeId = commandNodeIdFromCommand(command);
      const bounds =
        nextScene && commandNodeId
          ? getRenderableNodeBounds(nextScene, commandNodeId)
          : null;

      setHoveredId(null);
      setGuides(nextGuides);
      setMeasurement(
        nextMeasurement ?? (bounds ? measurementFromBounds(bounds) : null),
      );
    },
    [applyCommands],
  );

  const onPointerUp = useCallback((pointerId: number) => {
    pointerStateRef.current = pointerUp(pointerStateRef.current, pointerId);
    setGuides([]);
    setMeasurement(null);
  }, []);

  const onHandlePointerDown = useCallback(
    (
      pointerId: number,
      nodeId: string,
      handle: SaraswatiResizeHandle,
      startBounds: SaraswatiBounds,
      x: number,
      y: number,
    ) => {
      pointerStateRef.current = resizeHandlePointerDown(
        nodeId,
        handle,
        startBounds,
        pointerId,
        x,
        y,
      );
      setHoveredId(null);
      setMeasurement(measurementFromBounds(startBounds));
    },
    [],
  );

  const onPointerLeave = useCallback(() => {
    if (pointerStateRef.current.pointerId !== null) return;
    setHoveredId(null);
    setGuides([]);
    setMeasurement(null);
  }, []);

  return {
    hoveredId,
    guides,
    measurement,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onHandlePointerDown,
    onPointerLeave,
  };
}
