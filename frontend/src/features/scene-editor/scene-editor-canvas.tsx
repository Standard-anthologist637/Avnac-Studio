/**
 * Dedicated canvas area for the /scene editor page.
 * Reads scene + selectedIds directly from the global SceneEditorStore — no
 * props needed.  Pointer interactions are handled by useSceneEditorInteractions.
 */
import CanvasSelectionToolbar from "@/components/editor/canvas/canvas-selection-toolbar";
import SceneWorkspaceStage from "@/components/scene-workspace/stage";
import { isSaraswatiRenderableNode } from "@/lib/saraswati";
import { getNodeBounds } from "@/lib/saraswati/spatial";
import { useMemo, useRef } from "react";
import { useSceneEditorStore } from "./store";
import { useSceneEditorInteractions } from "./use-scene-editor-interactions";

const EMPTY_ALIGN: Record<string, boolean> = {};

export default function SceneEditorCanvas() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const setRenderStats = useSceneEditorStore((s) => s.setRenderStats);
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);
  const interactions = useSceneEditorInteractions();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /** Union bounds of all selected renderable nodes in artboard coordinates. */
  const selectionBounds = useMemo(() => {
    if (!scene || selectedIds.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const id of selectedIds) {
      const node = scene.nodes[id];
      if (!node || !isSaraswatiRenderableNode(node)) continue;
      const b = getNodeBounds(node);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [scene, selectedIds]);

  const canGroup = selectedIds.length >= 2;
  const canUngroup =
    selectedIds.length === 1 &&
    !!scene?.nodes[selectedIds[0]!] &&
    scene.nodes[selectedIds[0]!]!.type === "group";

  if (!scene) return null;

  const toolbarPlacement: "above" | "below" =
    selectionBounds && selectionBounds.y < 50 ? "below" : "above";
  const toolbarStyle = selectionBounds
    ? {
        left: selectionBounds.x + selectionBounds.width / 2,
        top:
          toolbarPlacement === "above"
            ? selectionBounds.y
            : selectionBounds.y + selectionBounds.height,
      }
    : undefined;

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-1 items-center justify-center overflow-auto bg-neutral-100/80 p-8"
    >
      {/* Artboard-sized relative wrapper so CanvasSelectionToolbar can be
          absolutely positioned in artboard coordinate space */}
      <div
        className="relative"
        style={{ width: scene.artboard.width, height: scene.artboard.height }}
      >
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
          onClipHandlePointerDown={interactions.onClipHandlePointerDown}
          onCreateClipPath={interactions.onCreateClipPath}
          onRenderStats={setRenderStats}
        />

        {selectionBounds && toolbarStyle && (
          <CanvasSelectionToolbar
            style={toolbarStyle}
            placement={toolbarPlacement}
            viewportRef={scrollContainerRef}
            locked={false}
            onDuplicate={() => {}}
            onToggleLock={() => {}}
            onDelete={() => {
              applyCommands(
                selectedIds.map((id) => ({ type: "DELETE_NODE" as const, id })),
              );
              setSelectedIds([]);
            }}
            onCopy={() => {}}
            onPaste={() => {}}
            onAlign={() => {}}
            alignAlreadySatisfied={EMPTY_ALIGN as never}
            canGroup={canGroup}
            canAlignElements={false}
            canUngroup={canUngroup}
            onGroup={() => {}}
            onAlignElements={() => {}}
            onUngroup={() => {
              if (selectedIds.length !== 1) return;
              applyCommands([{ type: "UNGROUP_NODE", id: selectedIds[0]! }]);
              setSelectedIds([]);
            }}
            onFlipH={() => {}}
            onFlipV={() => {}}
          />
        )}
      </div>
    </div>
  );
}
