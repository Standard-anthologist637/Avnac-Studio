/**
 * Dedicated canvas area for the /scene editor page.
 * Reads scene + selectedIds directly from the global SceneEditorStore — no
 * props needed.  Pointer interactions are handled by useSceneEditorInteractions.
 */
import CanvasSelectionToolbar from "@/components/editor/canvas/canvas-selection-toolbar";
import SceneWorkspaceStage from "@/components/scene-workspace/stage";
import { isSaraswatiRenderableNode } from "@/lib/saraswati";
import { getNodeBounds } from "@/lib/saraswati/spatial";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ w: rect.width, h: rect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  // Fit-to-viewport: scale the artboard so it fills the available space with padding
  const PAD = 64;
  const scale =
    containerSize.w > 0 && containerSize.h > 0
      ? Math.min(
          1,
          (containerSize.w - PAD) / scene.artboard.width,
          (containerSize.h - PAD) / scene.artboard.height,
        )
      : 1;
  const scaledWidth = Math.round(scene.artboard.width * scale);
  const scaledHeight = Math.round(scene.artboard.height * scale);

  // Rotation handle sits 24px above the selection top edge (connector) + 8px half-handle radius.
  // The toolbar "above" placement must clear that so the two don't overlap.
  const ROTATE_HANDLE_CLEARANCE = 36; // px in scaled space

  const toolbarPlacement: "above" | "below" =
    selectionBounds && selectionBounds.y * scale < 50 + ROTATE_HANDLE_CLEARANCE
      ? "below"
      : "above";
  // toolbar is positioned in scaled space (outside the CSS-transformed stage)
  const toolbarStyle = selectionBounds
    ? {
        left: (selectionBounds.x + selectionBounds.width / 2) * scale,
        top:
          toolbarPlacement === "above"
            ? selectionBounds.y * scale - ROTATE_HANDLE_CLEARANCE
            : (selectionBounds.y + selectionBounds.height) * scale,
      }
    : undefined;

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-1 items-center justify-center overflow-auto bg-neutral-100/80 p-8"
    >
      {/* Outer wrapper sized to the SCALED artboard — keeps centering correct */}
      <div
        className="relative"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Inner wrapper at natural artboard size, CSS-scaled to fit viewport */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: scene.artboard.width,
            height: scene.artboard.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
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
            onRotateHandlePointerDown={interactions.onRotateHandlePointerDown}
            onClipHandlePointerDown={interactions.onClipHandlePointerDown}
            onCreateClipPath={interactions.onCreateClipPath}
            onRenderStats={setRenderStats}
          />
        </div>

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
