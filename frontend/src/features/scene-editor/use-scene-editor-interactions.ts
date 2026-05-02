/**
 * Wires Saraswati pointer-interaction primitives to the global SceneEditor
 * Zustand store. Returns stable callbacks and editor overlay state.
 */
import {
  createIdlePointerState,
  findTopHitNodeId,
  getNodeBounds,
  isSaraswatiRenderableNode,
  pointerMove,
  pointerUp,
  resizeHandlePointerDown,
  rotateHandlePointerDown,
  type SaraswatiPointerState,
  type SaraswatiResizeHandle,
} from "@/lib/saraswati";
import {
  boundsToClipPath,
  resizeBoundsFromHandle,
} from "@/lib/editor/clip-edit";
import {
  getRenderableNodeBounds,
  measurementFromBounds,
  snapMoveBounds,
  snapResizeBounds,
  type SaraswatiGuideLine,
  type SaraswatiMeasurement,
} from "@/lib/editor/overlays";
import type { SaraswatiBounds } from "@/lib/saraswati/spatial";
import type { SaraswatiClipPath } from "@/lib/saraswati/types";
import { useCallback, useRef, useState } from "react";
import { useSceneEditorStore } from "./store";

type ClipResizeState = {
  pointerId: number;
  nodeId: string;
  handle: SaraswatiResizeHandle;
  startBounds: SaraswatiBounds;
  startClipPath: SaraswatiClipPath;
  startX: number;
  startY: number;
};

type MarqueeState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  baseSelectedIds: string[];
};

type CurveAdjustState = {
  pointerId: number;
  nodeId: string;
  startBulge: number;
  startT: number;
  startX: number;
  startY: number;
  length: number;
};

function commandNodeIdFromCommand(command: {
  type: string;
  id?: string;
  node?: { id: string };
}) {
  if (command.type === "REPLACE_NODE" || command.type === "ADD_NODE") {
    return command.node?.id ?? null;
  }
  return command.id ?? null;
}

export function useSceneEditorInteractions() {
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const beginHistoryBatch = useSceneEditorStore((s) => s.beginHistoryBatch);
  const endHistoryBatch = useSceneEditorStore((s) => s.endHistoryBatch);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);

  const pointerStateRef = useRef<SaraswatiPointerState>(
    createIdlePointerState(),
  );
  const clipResizeRef = useRef<ClipResizeState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const curveAdjustRef = useRef<CurveAdjustState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [guides, setGuides] = useState<SaraswatiGuideLine[]>([]);
  const [measurement, setMeasurement] = useState<SaraswatiMeasurement | null>(
    null,
  );
  const [marqueeBounds, setMarqueeBounds] = useState<SaraswatiBounds | null>(
    null,
  );
  const [activeCursor, setActiveCursor] = useState<string | null>(null);

  const onPointerDown = useCallback(
    (
      pointerId: number,
      x: number,
      y: number,
      options?: { additive?: boolean },
    ) => {
      const { scene, selectedIds } = useSceneEditorStore.getState();
      if (!scene) return;
      const additive = Boolean(options?.additive);
      const hitId = findTopHitNodeId(scene, { x, y });
      marqueeRef.current = null;
      setMarqueeBounds(null);
      curveAdjustRef.current = null;

      if (!hitId) {
        if (!additive) {
          setSelectedIds([]);
        }
        marqueeRef.current = {
          pointerId,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          additive,
          baseSelectedIds: additive ? [...selectedIds] : [],
        };
        pointerStateRef.current = createIdlePointerState();
        setHoveredId(null);
        setGuides([]);
        setMeasurement(null);
        setActiveCursor(null);
        return;
      }

      if (additive) {
        const next = new Set(selectedIds);
        if (next.has(hitId)) next.delete(hitId);
        else next.add(hitId);
        setSelectedIds([...next]);
        pointerStateRef.current = createIdlePointerState();
        clipResizeRef.current = null;
        curveAdjustRef.current = null;
        setHoveredId(null);
        setGuides([]);
        setMeasurement(null);
        setActiveCursor(null);
        return;
      }

      const result = hitId
        ? {
            state: {
              activeNodeId: hitId,
              pointerId,
              lastX: x,
              lastY: y,
              resize: null,
              rotate: null,
            },
            selectedIds: [hitId],
          }
        : { state: createIdlePointerState(), selectedIds: [] };
      pointerStateRef.current = result.state;
      beginHistoryBatch();
      clipResizeRef.current = null;
      curveAdjustRef.current = null;
      marqueeRef.current = null;
      setSelectedIds(result.selectedIds);
      setHoveredId(null);
      setGuides([]);
      setMeasurement(null);
      setActiveCursor(null);
    },
    [beginHistoryBatch, setSelectedIds],
  );

  const onPointerMove = useCallback(
    (pointerId: number, x: number, y: number) => {
      const store = useSceneEditorStore.getState();
      const scene = store.scene;
      if (!scene) return;

      const marquee = marqueeRef.current;
      if (marquee && marquee.pointerId === pointerId) {
        marquee.currentX = x;
        marquee.currentY = y;
        const bounds = normalizeBounds(
          marquee.startX,
          marquee.startY,
          marquee.currentX,
          marquee.currentY,
        );
        setMarqueeBounds(bounds);
        const hits: string[] = [];
        for (const [nodeId, node] of Object.entries(scene.nodes)) {
          if (!isSaraswatiRenderableNode(node)) continue;
          const nodeBounds = getNodeBounds(node);
          if (boundsIntersect(bounds, nodeBounds)) {
            hits.push(nodeId);
          }
        }
        const nextSelected = marquee.additive
          ? Array.from(new Set([...marquee.baseSelectedIds, ...hits]))
          : hits;
        setSelectedIds(nextSelected);
        setHoveredId(null);
        setGuides([]);
        setMeasurement(null);
        return;
      }

      const clipResize = clipResizeRef.current;
      if (clipResize && clipResize.pointerId === pointerId) {
        const dx = x - clipResize.startX;
        const dy = y - clipResize.startY;
        let bounds = resizeBoundsFromHandle(
          clipResize.startBounds,
          clipResize.handle,
          dx,
          dy,
        );
        const snapped = snapResizeBounds(
          scene,
          bounds,
          clipResize.handle,
          store.selectedIds,
        );
        bounds = snapped.bounds;
        const command = {
          type: "SET_NODE_CLIP_PATH" as const,
          id: clipResize.nodeId,
          clipPath: boundsToClipPath(clipResize.startClipPath, bounds),
        };
        applyCommands([command]);
        setHoveredId(null);
        setGuides(snapped.guides);
        setMeasurement(measurementFromBounds(bounds));
        return;
      }

      const curveAdjust = curveAdjustRef.current;
      if (curveAdjust && curveAdjust.pointerId === pointerId) {
        const dx = x - curveAdjust.startX;
        const dy = y - curveAdjust.startY;
        const nextT =
          curveAdjust.startT + dx / Math.max(24, curveAdjust.length * 0.45);
        const nextBulge = curveAdjust.startBulge - dy;
        applyCommands([
          {
            type: "REPLACE_NODE",
            node: {
              ...(scene.nodes[curveAdjust.nodeId] as Extract<
                (typeof scene.nodes)[string],
                { type: "line" }
              >),
              pathType: "curved",
              curveBulge: nextBulge,
              curveT: nextT,
            },
          },
        ]);
        const nextScene = useSceneEditorStore.getState().scene;
        const bounds =
          nextScene && curveAdjust.nodeId
            ? getRenderableNodeBounds(nextScene, curveAdjust.nodeId)
            : null;
        setHoveredId(null);
        setGuides([]);
        setMeasurement(bounds ? measurementFromBounds(bounds) : null);
        return;
      }

      if (pointerStateRef.current.pointerId === null) {
        setHoveredId(findTopHitNodeId(scene, { x, y }));
        setGuides([]);
        setMeasurement(null);
        return;
      }

      if (
        pointerStateRef.current.activeNodeId &&
        store.lockedIds.includes(pointerStateRef.current.activeNodeId) &&
        !pointerStateRef.current.resize &&
        !pointerStateRef.current.rotate
      ) {
        setHoveredId(null);
        setGuides([]);
        setMeasurement(null);
        return;
      }

      const result = pointerMove(pointerStateRef.current, pointerId, x, y);
      pointerStateRef.current = result.state;
      if (!result.command) return;

      let command = result.command;
      let nextGuides: SaraswatiGuideLine[] = [];
      let nextMeasurement: SaraswatiMeasurement | null = null;
      const snapFactor = Math.max(0, Math.min(1, store.snapIntensity ?? 1));
      const snapThreshold = 6 * snapFactor;

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
            store.selectedIds,
            snapThreshold,
          );
          command = {
            ...command,
            dx: snapped.bounds.x - startBounds.x,
            dy: snapped.bounds.y - startBounds.y,
          };
          nextGuides = snapped.guides;
          nextMeasurement = measurementFromBounds(snapped.bounds);
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
            store.selectedIds,
            snapThreshold,
          );
          command = {
            ...command,
            x: snapped.bounds.x,
            y: snapped.bounds.y,
            width: snapped.bounds.width,
            height: snapped.bounds.height,
          };
          nextGuides = snapped.guides;
          nextMeasurement = measurementFromBounds(snapped.bounds);
        }
      }

      if (command.type === "MOVE_NODE") {
        const moveIds =
          store.selectedIds.length > 1 && store.selectedIds.includes(command.id)
            ? store.selectedIds.filter((id) => {
                const node = scene.nodes[id];
                return Boolean(node && isSaraswatiRenderableNode(node));
              })
            : [command.id];
        applyCommands(
          moveIds.map((id) => ({
            type: "MOVE_NODE" as const,
            id,
            dx: command.dx,
            dy: command.dy,
          })),
        );
      } else {
        applyCommands([command]);
      }
      const nextScene = useSceneEditorStore.getState().scene;
      const commandNodeId = commandNodeIdFromCommand(command);

      setHoveredId(null);
      setGuides(nextGuides);
      // Rotation has no measurement overlay — the spinning AABB would create a distracting flash
      if (command.type === "ROTATE_NODE") {
        setMeasurement(null);
      } else {
        const bounds =
          nextScene && commandNodeId
            ? getRenderableNodeBounds(nextScene, commandNodeId)
            : null;
        setMeasurement(
          nextMeasurement ?? (bounds ? measurementFromBounds(bounds) : null),
        );
      }
    },
    [applyCommands],
  );

  const onPointerUp = useCallback(
    (pointerId: number) => {
      let shouldEndHistoryBatch = false;
      if (marqueeRef.current && marqueeRef.current.pointerId === pointerId) {
        marqueeRef.current = null;
        setMarqueeBounds(null);
      }
      if (
        clipResizeRef.current &&
        clipResizeRef.current.pointerId === pointerId
      ) {
        clipResizeRef.current = null;
        shouldEndHistoryBatch = true;
      }
      if (
        curveAdjustRef.current &&
        curveAdjustRef.current.pointerId === pointerId
      ) {
        curveAdjustRef.current = null;
        shouldEndHistoryBatch = true;
      }
      if (pointerStateRef.current.pointerId === pointerId) {
        if (
          pointerStateRef.current.activeNodeId &&
          (pointerStateRef.current.resize !== null ||
            pointerStateRef.current.rotate !== null ||
            pointerStateRef.current.pointerId !== null)
        ) {
          shouldEndHistoryBatch = true;
        }
      }
      pointerStateRef.current = pointerUp(pointerStateRef.current, pointerId);
      if (shouldEndHistoryBatch) {
        endHistoryBatch();
      }
      setGuides([]);
      setMeasurement(null);
      setActiveCursor(null);
    },
    [endHistoryBatch],
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
      pointerStateRef.current = resizeHandlePointerDown(
        nodeId,
        handle,
        startBounds,
        pointerId,
        x,
        y,
      );
      beginHistoryBatch();
      const cursorByHandle: Record<SaraswatiResizeHandle, string> = {
        n: "ns-resize",
        s: "ns-resize",
        e: "ew-resize",
        w: "ew-resize",
        ne: "nesw-resize",
        sw: "nesw-resize",
        nw: "nwse-resize",
        se: "nwse-resize",
      };
      setActiveCursor(cursorByHandle[handle]);
      setHoveredId(null);
      setMeasurement(measurementFromBounds(startBounds));
    },
    [beginHistoryBatch],
  );

  const onRotateHandlePointerDown = useCallback(
    (
      pointerId: number,
      nodeId: string,
      bounds: SaraswatiBounds,
      x: number,
      y: number,
    ) => {
      const scene = useSceneEditorStore.getState().scene;
      const node = scene?.nodes[nodeId];
      const startRotation =
        node && node.type === "line"
          ? (Math.atan2(node.y2 - node.y1, node.x2 - node.x1) * 180) / Math.PI
          : node && "rotation" in node
            ? (node.rotation as number)
            : 0;
      const adjustedBounds =
        node && node.type === "line"
          ? {
              ...bounds,
              x: (node.x1 + node.x2) / 2 - bounds.width / 2,
              y: (node.y1 + node.y2) / 2 - bounds.height / 2,
            }
          : bounds;
      pointerStateRef.current = rotateHandlePointerDown(
        nodeId,
        adjustedBounds,
        startRotation,
        pointerId,
        x,
        y,
      );
      beginHistoryBatch();
      setActiveCursor("grabbing");
      setHoveredId(null);
      setMeasurement(null);
    },
    [beginHistoryBatch],
  );

  const onClipHandlePointerDown = useCallback(
    (
      pointerId: number,
      nodeId: string,
      handle: SaraswatiResizeHandle,
      startBounds: SaraswatiBounds,
      x: number,
      y: number,
    ) => {
      const scene = useSceneEditorStore.getState().scene;
      if (!scene) return;
      const node = scene.nodes[nodeId];
      if (!node || !isSaraswatiRenderableNode(node) || node.type === "line") {
        return;
      }
      if (!node.clipPath) return;
      clipResizeRef.current = {
        pointerId,
        nodeId,
        handle,
        startBounds,
        startClipPath: node.clipPath,
        startX: x,
        startY: y,
      };
      beginHistoryBatch();
      setActiveCursor("crosshair");
      setHoveredId(null);
      setMeasurement(measurementFromBounds(startBounds));
    },
    [beginHistoryBatch],
  );

  const onCreateClipPath = useCallback(
    (nodeId: string, bounds: SaraswatiBounds) => {
      applyCommands([
        {
          type: "SET_NODE_CLIP_PATH",
          id: nodeId,
          clipPath: boundsToClipPath(
            {
              type: "rect",
              x: bounds.x + bounds.width / 2,
              y: bounds.y + bounds.height / 2,
              width: bounds.width,
              height: bounds.height,
              radiusX: 0,
              radiusY: 0,
            },
            bounds,
          ),
        },
      ]);
      setSelectedIds([nodeId]);
      setHoveredId(null);
      setGuides([]);
      setMeasurement(measurementFromBounds(bounds));
    },
    [applyCommands, setSelectedIds],
  );

  const onPointerLeave = useCallback(() => {
    if (
      pointerStateRef.current.pointerId !== null ||
      clipResizeRef.current !== null ||
      marqueeRef.current !== null
    ) {
      return;
    }
    setHoveredId(null);
    setGuides([]);
    setMeasurement(null);
    setActiveCursor(null);
  }, []);

  const onCurveHandlePointerDown = useCallback(
    (
      pointerId: number,
      nodeId: string,
      startBulge: number,
      startT: number,
      length: number,
      x: number,
      y: number,
    ) => {
      const scene = useSceneEditorStore.getState().scene;
      const node = scene?.nodes[nodeId];
      if (!node || node.type !== "line") return;
      curveAdjustRef.current = {
        pointerId,
        nodeId,
        startBulge,
        startT,
        startX: x,
        startY: y,
        length,
      };
      beginHistoryBatch();
      pointerStateRef.current = createIdlePointerState();
      setActiveCursor("move");
      setHoveredId(null);
      setGuides([]);
      setMeasurement(null);
    },
    [beginHistoryBatch],
  );

  return {
    hoveredId,
    guides,
    measurement,
    marqueeBounds,
    activeCursor,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onHandlePointerDown,
    onRotateHandlePointerDown,
    onClipHandlePointerDown,
    onCreateClipPath,
    onCurveHandlePointerDown,
    onPointerLeave,
  };
}

function normalizeBounds(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SaraswatiBounds {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function boundsIntersect(a: SaraswatiBounds, b: SaraswatiBounds): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}
