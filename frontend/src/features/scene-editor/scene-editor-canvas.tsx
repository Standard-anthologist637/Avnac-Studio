/**
 * Dedicated canvas area for the /scene editor page.
 * Reads scene + selectedIds directly from the global SceneEditorStore — no
 * props needed.  Pointer interactions are handled by useSceneEditorInteractions.
 */
import CanvasSelectionToolbar from "@/components/editor/canvas/canvas-selection-toolbar";
import SceneWorkspaceStage from "@/components/scene-workspace/stage";
import { isSaraswatiRenderableNode } from "@/lib/saraswati";
import { getNodeBounds } from "@/lib/saraswati/spatial";
import { useEffect, useMemo, useRef } from "react";
import { useSceneEditorStore } from "./store";
import { useSceneEditorInteractions } from "./use-scene-editor-interactions";

const EMPTY_ALIGN: Record<string, boolean> = {};

export default function SceneEditorCanvas() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const setRenderStats = useSceneEditorStore((s) => s.setRenderStats);
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);
  const zoomPercent = useSceneEditorStore((s) => s.zoomPercent);
  const setZoomPercent = useSceneEditorStore((s) => s.setZoomPercent);
  const interactions = useSceneEditorInteractions();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Intercept Ctrl+wheel so the browser doesn't zoom the whole page ──────
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 16;
      else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE)
        dy *= el.clientHeight * 0.85;
      const current = useSceneEditorStore.getState().zoomPercent;
      const deltaPct = -dy * 0.12;
      setZoomPercent(current + deltaPct);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoomPercent]);

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

  const scale = zoomPercent / 100;
  const PAD = 64;
  // The scroll anchor has the scaled artboard size so the scrollbar range is correct.
  const anchorW = Math.round(scene.artboard.width * scale + PAD * 2);
  const anchorH = Math.round(scene.artboard.height * scale + PAD * 2);

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
      className="flex flex-1 overflow-auto bg-neutral-100/80"
    >
      {/* Size anchor — gives the scroll container the correct range for the scaled artboard */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: anchorW,
          height: anchorH,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        {/* Artboard at natural size, visually scaled via CSS transform */}
        <div
          className="relative shrink-0"
          style={{
            width: scene.artboard.width,
            height: scene.artboard.height,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
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
    </div>
  );
}
