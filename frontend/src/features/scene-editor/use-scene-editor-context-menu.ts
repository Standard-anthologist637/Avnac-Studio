import type React from "react";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import type { SaraswatiScene } from "@/lib/saraswati";
import { isChromeTarget, isTextEntryTarget } from "./scene-editor-input-utils";
import { toClampedScenePoint } from "./scene-editor-viewport-utils";

export type SceneContextMenuState = {
  x: number;
  y: number;
  sceneX: number;
  sceneY: number;
  hasSelection: boolean;
  locked: boolean;
};

type Params = {
  scene: SaraswatiScene | null;
  scale: number;
  hasSelection: boolean;
  locked: boolean;
  isInlineTextEditing: boolean;
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
};

export function useSceneEditorContextMenu({
  scene,
  scale,
  hasSelection,
  locked,
  isInlineTextEditing,
  surfaceRef,
}: Params) {
  const [contextMenu, setContextMenu] = useState<SceneContextMenuState | null>(
    null,
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-scene-context-menu]")) return;
      closeContextMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, [closeContextMenu, contextMenu]);

  const onCanvasContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!scene || isInlineTextEditing) return;
      if (isTextEntryTarget(event.target) || isChromeTarget(event.target)) {
        return;
      }
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

      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        sceneX: point.x,
        sceneY: point.y,
        hasSelection,
        locked,
      });
    },
    [hasSelection, isInlineTextEditing, locked, scale, scene, surfaceRef],
  );

  return {
    contextMenu,
    setContextMenu,
    closeContextMenu,
    onCanvasContextMenu,
  };
}
