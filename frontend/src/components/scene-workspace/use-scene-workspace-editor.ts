import {
  createIdlePointerState,
  createSaraswatiEditorStore,
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
};

export function useSceneWorkspaceEditor({
  enabled,
  scene,
  store: sharedStore,
  onCommandsApplied,
}: UseSceneWorkspaceEditorInput) {
  const storeRef = useRef<SaraswatiEditorStore | null>(null);
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
  });

  useEffect(() => {
    if (!enabled) {
      storeRef.current = null;
      pointerStateRef.current = createIdlePointerState();
      setEditorState({ scene, selectedIds: [] });
      sharedStoreRef.current?.getState().setSelectedIds([]);
      return;
    }

    const saraswatiStore = createSaraswatiEditorStore(scene);
    storeRef.current = saraswatiStore;
    pointerStateRef.current = createIdlePointerState();
    setEditorState(saraswatiStore.getState());

    return saraswatiStore.subscribe((nextState) => {
      setEditorState(nextState);
      sharedStoreRef.current?.getState().setSelectedIds(nextState.selectedIds);
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
      saraswatiStore.setSelectedIds(result.selectedIds);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (pointerId: number, x: number, y: number) => {
      if (!enabled) return;
      const saraswatiStore = storeRef.current;
      if (!saraswatiStore) return;
      const result = pointerMove(pointerStateRef.current, pointerId, x, y);
      pointerStateRef.current = result.state;
      if (!result.command) return;
      saraswatiStore.dispatch(result.command);
      onCommandsAppliedRef.current?.({
        commands: [result.command],
        scene: saraswatiStore.getState().scene,
      });
    },
    [enabled],
  );

  const onPointerUp = useCallback(
    (pointerId: number) => {
      if (!enabled) return;
      pointerStateRef.current = pointerUp(pointerStateRef.current, pointerId);
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
    },
    [enabled],
  );

  return {
    scene: editorState.scene,
    selectedIds: editorState.selectedIds,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onHandlePointerDown,
  };
}
