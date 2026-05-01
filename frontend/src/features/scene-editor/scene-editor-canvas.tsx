/**
 * Dedicated canvas area for the /scene editor page.
 * Reads scene + selectedIds directly from the global SceneEditorStore — no
 * props needed. Pointer interactions are handled by useSceneEditorInteractions.
 */
import CanvasSelectionToolbar from "@/components/editor/canvas/canvas-selection-toolbar";
import SceneWorkspaceStage from "@/components/scene-workspace/stage";
import { AVNAC_VECTOR_BOARD_DRAG_MIME } from "@/lib/avnac-vector-board-document";
import { findTopHitNodeId } from "@/lib/saraswati";
import { readSceneWorkspaceDropIntent } from "@/scene/workspace";
import { useCallback, useEffect, useRef, useState } from "react";
import SceneInlineTextEditor from "./scene-inline-text-editor";
import { reorderChildrenForSelection } from "./scene-editor-input-utils";
import {
  computeFitZoomPercent,
  toClampedScenePoint,
} from "./scene-editor-viewport-utils";
import { useSceneEditorStore } from "./store";
import SceneCanvasContextMenu from "./tools/scene-canvas-context-menu";
import SceneShortcutsModal from "./tools/scene-shortcuts-modal";
import { useSceneEditorContextMenu } from "./use-scene-editor-context-menu";
import { useSceneEditorDropActions } from "./use-scene-editor-drop-actions";
import { useSceneEditorInteractions } from "./use-scene-editor-interactions";
import { useSceneEditorShortcuts } from "./use-scene-editor-shortcuts";
import { useSceneSelectionActions } from "./use-scene-selection-actions";

type InlineTextEditState = {
  nodeId: string;
  value: string;
};

type Props = {
  shortcutsOpen: boolean;
  onCloseShortcuts: () => void;
  onOpenShortcuts: () => void;
};

export default function SceneEditorCanvas({
  shortcutsOpen,
  onCloseShortcuts,
  onOpenShortcuts,
}: Props) {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);
  const lockedIds = useSceneEditorStore((s) => s.lockedIds);
  const setTextContent = useSceneEditorStore((s) => s.setTextContent);
  const zoomPercent = useSceneEditorStore((s) => s.zoomPercent);
  const setZoomPercent = useSceneEditorStore((s) => s.setZoomPercent);
  const canUndo = useSceneEditorStore((s) => s.canUndo);
  const canRedo = useSceneEditorStore((s) => s.canRedo);
  const undo = useSceneEditorStore((s) => s.undo);
  const redo = useSceneEditorStore((s) => s.redo);
  const toggleLockedSelection = useSceneEditorStore(
    (s) => s.toggleLockedSelection,
  );
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const setCanvasViewport = useSceneEditorStore((s) => s.setCanvasViewport);
  const setCanvasPan = useSceneEditorStore((s) => s.setCanvasPan);
  const setRenderStats = useSceneEditorStore((s) => s.setRenderStats);
  const dropActions = useSceneEditorDropActions();
  const interactions = useSceneEditorInteractions();
  const actions = useSceneSelectionActions();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [inlineTextEdit, setInlineTextEdit] =
    useState<InlineTextEditState | null>(null);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setContainerSize({ w: rect.width, h: rect.height });
        setCanvasViewport(rect.width, rect.height);
      }
    });
    observer.observe(element);

    const onScroll = () => {
      setCanvasPan(element.scrollLeft, element.scrollTop);
    };
    element.addEventListener("scroll", onScroll);

    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", onScroll);
      setCanvasViewport(0, 0);
      setCanvasPan(0, 0);
    };
  }, [setCanvasPan, setCanvasViewport]);

  // Prevent browser/page zoom on ctrl/cmd + wheel; zoom the canvas instead.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 16;
      else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        dy *= el.clientHeight * 0.85;
      }
      const current = useSceneEditorStore.getState().zoomPercent;
      setZoomPercent(current + -dy * 0.12);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoomPercent]);

  const artboardWidth = scene?.artboard.width ?? 1;
  const artboardHeight = scene?.artboard.height ?? 1;
  const pad = 64;
  const fitScale =
    containerSize.w > 0 && containerSize.h > 0
      ? Math.min(
          1,
          (containerSize.w - pad) / artboardWidth,
          (containerSize.h - pad) / artboardHeight,
        )
      : 1;
  const scale = fitScale * (zoomPercent / 100);
  const scaledWidth = Math.round(artboardWidth * scale);
  const scaledHeight = Math.round(artboardHeight * scale);

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

  useEffect(() => {
    if (!scene || !inlineTextEdit) return;
    const node = scene.nodes[inlineTextEdit.nodeId];
    if (!node || node.type !== "text") {
      setInlineTextEdit(null);
    }
  }, [inlineTextEdit, scene]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const intent = readSceneWorkspaceDropIntent(
      event.dataTransfer,
      AVNAC_VECTOR_BOARD_DRAG_MIME,
    );
    if (!intent) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    if (!scene) return;
    const intent = readSceneWorkspaceDropIntent(
      event.dataTransfer,
      AVNAC_VECTOR_BOARD_DRAG_MIME,
    );
    if (!intent) return;
    event.preventDefault();
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = toClampedScenePoint({
      clientX: event.clientX,
      clientY: event.clientY,
      rect,
      scale,
      artboardWidth: scene.artboard.width,
      artboardHeight: scene.artboard.height,
    });
    if (!point) return;
    await dropActions.handleDropIntent(intent, point);
  };

  const onSceneDoubleClick = (x: number, y: number) => {
    if (!scene) return;
    const hitId = findTopHitNodeId(scene, { x, y });
    if (!hitId) return;
    const hitNode = scene.nodes[hitId];
    if (!hitNode || hitNode.type !== "text") return;
    setSelectedIds([hitId]);
    setInlineTextEdit({ nodeId: hitId, value: hitNode.text });
  };

  const commitInlineText = () => {
    if (!inlineTextEdit) return;
    setTextContent(inlineTextEdit.nodeId, inlineTextEdit.value);
    setInlineTextEdit(null);
  };

  const fitToViewport = useCallback(() => {
    if (!scene) return;
    setZoomPercent(
      computeFitZoomPercent({
        artboardWidth: scene.artboard.width,
        artboardHeight: scene.artboard.height,
        viewportWidth: containerSize.w,
        viewportHeight: containerSize.h,
      }),
    );
  }, [containerSize.h, containerSize.w, scene, setZoomPercent]);

  const reorderPrimarySelection = useCallback(
    (mode: "forward" | "backward" | "front" | "back") => {
      if (!scene || selectedIds.length === 0) return;
      const root = scene.nodes[scene.root];
      if (!root || root.type !== "group") return;
      const id = selectedIds[0]!;
      const nextChildren = reorderChildrenForSelection({
        children: root.children,
        selectedId: id,
        mode,
      });
      if (!nextChildren) return;
      applyCommands([
        {
          type: "SET_GROUP_CHILDREN",
          id: scene.root,
          children: nextChildren,
        },
      ]);
    },
    [applyCommands, scene, selectedIds],
  );

  useSceneEditorShortcuts({
    scene,
    inlineTextEditing: Boolean(inlineTextEdit),
    lockedIds,
    zoomPercent,
    canUndo,
    canRedo,
    undo,
    redo,
    setZoomPercent,
    setSelectedIds,
    toggleLockedSelection,
    fitToViewport,
    reorderPrimarySelection,
    onCopy: actions.onCopy,
    onPaste: actions.onPaste,
    onDelete: actions.onDelete,
    onDuplicate: actions.onDuplicate,
    onImageFilesPaste: (files) => {
      if (!scene) return;
      void dropActions.handleDropIntent(
        { kind: "image-files", files },
        {
          x: scene.artboard.width / 2,
          y: scene.artboard.height / 2,
        },
      );
    },
    onShowShortcuts: onOpenShortcuts,
  });

  const { contextMenu, setContextMenu, onCanvasContextMenu } =
    useSceneEditorContextMenu({
      scene,
      scale,
      hasSelection: selectedIds.length > 0,
      locked: actions.isLocked,
      isInlineTextEditing: Boolean(inlineTextEdit),
      surfaceRef,
    });

  if (!scene) return null;

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-1 items-center justify-center overflow-auto bg-neutral-100/80 p-8"
      onDragOver={onDragOver}
      onContextMenu={onCanvasContextMenu}
      onDrop={(event) => {
        void onDrop(event);
      }}
    >
      <div
        ref={surfaceRef}
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
            viewScale={scale}
            interactive={!inlineTextEdit}
            selectedIds={selectedIds}
            hiddenNodeIds={inlineTextEdit ? [inlineTextEdit.nodeId] : undefined}
            lockedIds={lockedIds}
            hoveredId={interactions.hoveredId}
            guides={interactions.guides}
            measurement={interactions.measurement}
            interactionCursor={interactions.activeCursor}
            onScenePointerDown={interactions.onPointerDown}
            onScenePointerMove={interactions.onPointerMove}
            onScenePointerUp={interactions.onPointerUp}
            onScenePointerLeave={interactions.onPointerLeave}
            onHandlePointerDown={interactions.onHandlePointerDown}
            onRotateHandlePointerDown={interactions.onRotateHandlePointerDown}
            onClipHandlePointerDown={interactions.onClipHandlePointerDown}
            onCurveHandlePointerDown={interactions.onCurveHandlePointerDown}
            onCreateClipPath={interactions.onCreateClipPath}
            onSceneDoubleClick={onSceneDoubleClick}
            marqueeBounds={interactions.marqueeBounds}
            onRenderStats={setRenderStats}
          />
        </div>

        {inlineTextEdit ? (
          <SceneInlineTextEditor
            scene={scene}
            edit={inlineTextEdit}
            scale={scale}
            onChange={(value) =>
              setInlineTextEdit((current) =>
                current ? { ...current, value } : current,
              )
            }
            onCommit={commitInlineText}
            onCancel={() => setInlineTextEdit(null)}
          />
        ) : null}

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

      {contextMenu ? (
        <SceneCanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={contextMenu.hasSelection}
          locked={contextMenu.locked}
          onCopy={() => {
            actions.onCopy();
            setContextMenu(null);
          }}
          onDuplicate={() => {
            actions.onDuplicate();
            setContextMenu(null);
          }}
          onToggleLock={() => {
            actions.onToggleLock();
            setContextMenu(null);
          }}
          onPaste={() => {
            actions.onPasteAt({
              x: contextMenu.sceneX,
              y: contextMenu.sceneY,
            });
            setContextMenu(null);
          }}
          onDelete={() => {
            actions.onDelete();
            setContextMenu(null);
          }}
        />
      ) : null}

      <SceneShortcutsModal open={shortcutsOpen} onClose={onCloseShortcuts} />
    </div>
  );
}
