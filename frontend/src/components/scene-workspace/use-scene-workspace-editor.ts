import {
  createIdlePointerState,
  createSaraswatiEditorStore,
  findTopHitNodeId,
  getNodeBounds,
  isSaraswatiRenderableNode,
  pointerDown,
  pointerMove,
  pointerUp,
  resizeHandlePointerDown,
  type SaraswatiCommand,
  type SaraswatiPointerState,
  type SaraswatiResizeHandle,
  type SaraswatiScene,
  type SaraswatiEditorStore,
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
import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneWorkspaceStore } from "./store";

type UseSceneWorkspaceEditorInput = {
  enabled: boolean;
  scene: SaraswatiScene;
  /** When provided, selection changes are written to this shared store. */
  store?: SceneWorkspaceStore;
  onCommandsApplied?: (result: {
    commands: readonly SaraswatiCommand[];
    scene: SaraswatiScene;
  }) => void;
};

type SceneWorkspaceEditorState = {
  scene: SaraswatiScene;
  selectedIds: string[];
  hoveredId: string | null;
  guides: SaraswatiGuideLine[];
  measurement: SaraswatiMeasurement | null;
};

export function useSceneWorkspaceEditor({
  enabled,
  scene,
  store: sharedStore,
  onCommandsApplied,
}: UseSceneWorkspaceEditorInput) {
  const storeRef = useRef<SaraswatiEditorStore | null>(null);
  const selectedIdsRef = useRef<string[]>([]);
  const pointerStateRef = useRef<SaraswatiPointerState>(
    createIdlePointerState(),
  );
  const onCommandsAppliedRef = useRef(onCommandsApplied);
  onCommandsAppliedRef.current = onCommandsApplied;
  const sharedStoreRef = useRef(sharedStore);
  sharedStoreRef.current = sharedStore;

  const [editorState, setEditorState] = useState<SceneWorkspaceEditorState>({
    scene,
    selectedIds: [],
    hoveredId: null,
    guides: [],
    measurement: null,
  });

  useEffect(() => {
    if (!enabled) {
      storeRef.current = null;
      pointerStateRef.current = createIdlePointerState();
      setEditorState({
        scene,
        selectedIds: [],
        hoveredId: null,
        guides: [],
        measurement: null,
      });
      selectedIdsRef.current = [];
      sharedStoreRef.current?.getState().setSelectedIds([]);
      return;
    }

    const saraswatiStore = createSaraswatiEditorStore(scene);
    storeRef.current = saraswatiStore;
    pointerStateRef.current = createIdlePointerState();
    setEditorState({
      scene: saraswatiStore.getState().scene,
      selectedIds: [],
      hoveredId: null,
      guides: [],
      measurement: null,
    });
    selectedIdsRef.current = [];

    return saraswatiStore.subscribe((nextState) => {
      setEditorState((prev) => ({
        ...prev,
        scene: nextState.scene,
      }));
    });
  }, [enabled, scene]);

  const onPointerDown = useCallback(
    (pointerId: number, x: number, y: number) => {
      if (!enabled) return;
      const saraswatiStore = storeRef.current;
      if (!saraswatiStore) return;
      const result = pointerDown(
        saraswatiStore.getState().scene,
        pointerId,
        x,
        y,
      );
      pointerStateRef.current = result.state;
      selectedIdsRef.current = result.selectedIds;
      sharedStoreRef.current?.getState().setSelectedIds(result.selectedIds);
      setEditorState((prev) => ({
        ...prev,
        selectedIds: result.selectedIds,
      }));
      setEditorState((prev) => ({
        ...prev,
        hoveredId: null,
        guides: [],
        measurement: null,
      }));
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (pointerId: number, x: number, y: number) => {
      if (!enabled) return;
      const saraswatiStore = storeRef.current;
      if (!saraswatiStore) return;
      const scene = saraswatiStore.getState().scene;
      const activePointer = pointerStateRef.current.pointerId;
      if (activePointer === null) {
        const hoveredId = findTopHitNodeId(scene, { x, y });
        setEditorState((prev) => ({
          ...prev,
          hoveredId,
          guides: [],
          measurement: null,
        }));
        return;
      }

      const result = pointerMove(pointerStateRef.current, pointerId, x, y);
      pointerStateRef.current = result.state;
      if (!result.command) return;

      let command = result.command;
      let guides: SaraswatiGuideLine[] = [];
      let measurement: SaraswatiMeasurement | null = null;

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
            selectedIdsRef.current,
          );
          command = {
            ...command,
            dx: snapped.bounds.x - startBounds.x,
            dy: snapped.bounds.y - startBounds.y,
          };
          guides = snapped.guides;
          measurement = measurementFromBounds(snapped.bounds);
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
            selectedIdsRef.current,
          );
          command = {
            ...command,
            x: snapped.bounds.x,
            y: snapped.bounds.y,
            width: snapped.bounds.width,
            height: snapped.bounds.height,
          };
          guides = snapped.guides;
          measurement = measurementFromBounds(snapped.bounds);
        }
      }

      saraswatiStore.dispatch(command);
      const commandNodeId =
        command.type === "MOVE_NODE" ||
        command.type === "RESIZE_NODE" ||
        command.type === "DELETE_NODE" ||
        command.type === "SET_NODE_VISIBLE" ||
        command.type === "SET_NODE_NAME" ||
        command.type === "UNGROUP_NODE" ||
        command.type === "SET_GROUP_CHILDREN"
          ? command.id
          : command.type === "REPLACE_NODE"
            ? command.node.id
            : command.type === "ADD_NODE"
              ? command.node.id
              : null;
      const resolvedBounds =
        measurement ??
        (commandNodeId
          ? measurementFromBounds(
              getRenderableNodeBounds(
                saraswatiStore.getState().scene,
                commandNodeId,
              ) ?? {
                x: 0,
                y: 0,
                width: 1,
                height: 1,
              },
            )
          : null);
      setEditorState((prev) => ({
        ...prev,
        hoveredId: null,
        guides,
        measurement: resolvedBounds ?? null,
      }));
      onCommandsAppliedRef.current?.({
        commands: [command],
        scene: saraswatiStore.getState().scene,
      });
    },
    [enabled],
  );

  const onPointerUp = useCallback(
    (pointerId: number) => {
      if (!enabled) return;
      pointerStateRef.current = pointerUp(pointerStateRef.current, pointerId);
      setEditorState((prev) => ({
        ...prev,
        guides: [],
        measurement: null,
      }));
    },
    [enabled],
  );

  const onHandlePointerDown = useCallback(
    (
      pointerId: number,
      nodeId: string,
      handle: SaraswatiResizeHandle,
      startBounds: SaraswatiBounds,
      x: number,
      y: number,
    ) => {
      if (!enabled) return;
      pointerStateRef.current = resizeHandlePointerDown(
        nodeId,
        handle,
        startBounds,
        pointerId,
        x,
        y,
      );
      setEditorState((prev) => ({
        ...prev,
        hoveredId: null,
        measurement: measurementFromBounds(startBounds),
      }));
    },
    [enabled],
  );

  const onPointerLeave = useCallback(() => {
    if (!enabled) return;
    if (pointerStateRef.current.pointerId !== null) return;
    setEditorState((prev) => ({
      ...prev,
      hoveredId: null,
      guides: [],
      measurement: null,
    }));
  }, [enabled]);

  return {
    scene: editorState.scene,
    selectedIds: editorState.selectedIds,
    hoveredId: editorState.hoveredId,
    guides: editorState.guides,
    measurement: editorState.measurement,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onHandlePointerDown,
    onPointerLeave,
  };
}
