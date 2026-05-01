/**
 * Dedicated canvas area for the /scene editor page.
 * Reads scene + selectedIds directly from the global SceneEditorStore — no
 * props needed. Pointer interactions are handled by useSceneEditorInteractions.
 */
import CanvasSelectionToolbar from "@/components/editor/canvas/canvas-selection-toolbar";
import SceneWorkspaceStage from "@/components/scene-workspace/stage";
import { useEffect, useRef, useState } from "react";
import { useSceneEditorStore } from "./store";
import { useSceneEditorInteractions } from "./use-scene-editor-interactions";
import { useSceneSelectionActions } from "./use-scene-selection-actions";

export default function SceneEditorCanvas() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const lockedIds = useSceneEditorStore((s) => s.lockedIds);
  const setRenderStats = useSceneEditorStore((s) => s.setRenderStats);
  const interactions = useSceneEditorInteractions();
  const actions = useSceneSelectionActions();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ w: rect.width, h: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!scene) return null;

  const pad = 64;
  const scale =
    containerSize.w > 0 && containerSize.h > 0
      ? Math.min(
          1,
          (containerSize.w - pad) / scene.artboard.width,
          (containerSize.h - pad) / scene.artboard.height,
        )
      : 1;
  const scaledWidth = Math.round(scene.artboard.width * scale);
  const scaledHeight = Math.round(scene.artboard.height * scale);

  const rotateHandleClearance = 36;
  const toolbarPlacement: "above" | "below" =
    actions.selectionBounds &&
    actions.selectionBounds.y * scale < 50 + rotateHandleClearance
      ? "below"
      : "above";
  const toolbarStyle = actions.selectionBounds
    ? {
        left:
          (actions.selectionBounds.x + actions.selectionBounds.width / 2) *
          scale,
        top:
          toolbarPlacement === "above"
            ? actions.selectionBounds.y * scale - rotateHandleClearance
            : (actions.selectionBounds.y + actions.selectionBounds.height) *
              scale,
      }
    : undefined;

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-1 items-center justify-center overflow-auto bg-neutral-100/80 p-8"
    >
      <div
        className="relative"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
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
            lockedIds={lockedIds}
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

        {actions.selectionBounds && toolbarStyle && (
          <CanvasSelectionToolbar
            style={toolbarStyle}
            placement={toolbarPlacement}
            viewportRef={scrollContainerRef}
            locked={actions.isLocked}
            onDuplicate={actions.onDuplicate}
            onToggleLock={actions.onToggleLock}
            onDelete={actions.onDelete}
            onCopy={actions.onCopy}
            onPaste={actions.onPaste}
            onAlign={actions.onAlign}
            alignAlreadySatisfied={actions.alignAlreadySatisfied}
            canGroup={actions.canGroup}
            canAlignElements={actions.canAlignElements}
            canUngroup={actions.canUngroup}
            onGroup={actions.onGroup}
            onAlignElements={actions.onAlignElements}
            onUngroup={actions.onUngroup}
            onFlipH={actions.onFlipH}
            onFlipV={actions.onFlipV}
          />
        )}
      </div>
    </div>
  );
}
