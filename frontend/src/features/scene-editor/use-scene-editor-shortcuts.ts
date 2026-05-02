import { useEffect } from "react";
import type { SaraswatiScene } from "@/lib/saraswati";
import {
  collectSelectableNodeIds,
  extractClipboardImageFiles,
  readNavigatorClipboardImageFiles,
  shouldIgnoreEditorHotkeys,
} from "./scene-editor-input-utils";

type Params = {
  scene: SaraswatiScene | null;
  inlineTextEditing: boolean;
  lockedIds: string[];
  zoomPercent: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  setZoomPercent: (value: number) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleLockedSelection: () => void;
  fitToViewport: () => void;
  reorderPrimarySelection: (
    mode: "forward" | "backward" | "front" | "back",
  ) => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onImageFilesPaste: (files: File[]) => void;
  onShowShortcuts: () => void;
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
};

export function useSceneEditorShortcuts({
  scene,
  inlineTextEditing,
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
  onCopy,
  onPaste,
  onDelete,
  onDuplicate,
  onImageFilesPaste,
  onShowShortcuts,
  canGroup,
  canUngroup,
  onGroup,
  onUngroup,
}: Params) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!scene) return;
      if (shouldIgnoreEditorHotkeys(event.target, inlineTextEditing)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod) {
        if (event.key === "z" || event.key === "Z") {
          event.preventDefault();
          if (event.shiftKey) {
            if (canRedo) redo();
          } else if (canUndo) {
            undo();
          }
          return;
        }
        if (event.key === "y" || event.key === "Y") {
          event.preventDefault();
          if (canRedo) redo();
          return;
        }
        if (event.key === "d" || event.key === "D") {
          event.preventDefault();
          onDuplicate();
          return;
        }
        if (event.key === "l" || event.key === "L") {
          event.preventDefault();
          toggleLockedSelection();
          return;
        }
        if (event.key === "a" || event.key === "A") {
          event.preventDefault();
          setSelectedIds(collectSelectableNodeIds(scene, lockedIds));
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          setZoomPercent(100);
          return;
        }
        if (event.key === "1") {
          event.preventDefault();
          fitToViewport();
          return;
        }
        if (event.key === "=" || event.key === "+") {
          event.preventDefault();
          setZoomPercent(zoomPercent * 1.1);
          return;
        }
        if (event.key === "-") {
          event.preventDefault();
          setZoomPercent(zoomPercent / 1.1);
          return;
        }
        if (event.key === "c" || event.key === "C") {
          event.preventDefault();
          onCopy();
          return;
        }
        if (event.key === "g" || event.key === "G") {
          event.preventDefault();
          if (event.shiftKey) {
            if (canUngroup) onUngroup();
          } else {
            if (canGroup) onGroup();
          }
          return;
        }
        if (event.key === "[") {
          event.preventDefault();
          reorderPrimarySelection(event.shiftKey ? "back" : "backward");
          return;
        }
        if (event.key === "]") {
          event.preventDefault();
          reorderPrimarySelection(event.shiftKey ? "front" : "forward");
          return;
        }
      }

      if (event.key === "?") {
        event.preventDefault();
        onShowShortcuts();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onDelete();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canRedo,
    canUndo,
    fitToViewport,
    inlineTextEditing,
    lockedIds,
    canGroup,
    canUngroup,
    onCopy,
    onDelete,
    onDuplicate,
    onGroup,
    onShowShortcuts,
    onUngroup,
    redo,
    reorderPrimarySelection,
    scene,
    setSelectedIds,
    setZoomPercent,
    toggleLockedSelection,
    undo,
    zoomPercent,
  ]);

  useEffect(() => {
    const onPasteEvent = (event: ClipboardEvent) => {
      if (!scene) return;
      if (shouldIgnoreEditorHotkeys(event.target, inlineTextEditing)) return;

      const files = extractClipboardImageFiles(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        onImageFilesPaste(files);
        return;
      }

      const hasFileItems =
        event.clipboardData !== null &&
        Array.from(event.clipboardData.items).some(
          (item) => item.kind === "file",
        );

      if (event.clipboardData === null || hasFileItems) {
        event.preventDefault();
        void (async () => {
          const fallbackImages = await readNavigatorClipboardImageFiles();
          if (fallbackImages.length > 0) {
            onImageFilesPaste(fallbackImages);
            return;
          }
          onPaste();
        })();
        return;
      }

      event.preventDefault();
      onPaste();
    };

    window.addEventListener("paste", onPasteEvent);
    return () => window.removeEventListener("paste", onPasteEvent);
  }, [inlineTextEditing, onImageFilesPaste, onPaste, scene]);
}
