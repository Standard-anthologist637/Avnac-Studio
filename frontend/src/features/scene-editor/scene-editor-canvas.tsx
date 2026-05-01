/**
 * Dedicated canvas area for the /scene editor page.
 * Reads scene + selectedIds directly from the global SceneEditorStore — no
 * props needed.  Pointer interactions are handled by useSceneEditorInteractions.
 */
import SceneWorkspaceStage from "@/components/scene-workspace/stage";
import { useSceneEditorInteractions } from "./use-scene-editor-interactions";
import { useSceneEditorStore } from "./store";

export default function SceneEditorCanvas() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const interactions = useSceneEditorInteractions();

  if (!scene) return null;

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-100/80 p-8">
      <SceneWorkspaceStage
        scene={scene}
        interactive
        selectedIds={selectedIds}
        hoveredId={interactions.hoveredId}
        guides={interactions.guides}
        measurement={interactions.measurement}
        onScenePointerDown={interactions.onPointerDown}
        onScenePointerMove={interactions.onPointerMove}
        onScenePointerUp={interactions.onPointerUp}
        onScenePointerLeave={interactions.onPointerLeave}
        onHandlePointerDown={interactions.onHandlePointerDown}
      />
    </div>
  );
}
