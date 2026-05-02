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

/**
 * Given a resize bounds and the handle being dragged, constrain the shorter
 * dimension so the result matches `ar` (width/height).
 *
 * The anchor corner opposite to the dragged handle is kept fixed, and only
 * the side(s) driven by the handle are adjusted.
 */
function constrainResizeBoundsToAr(
  bounds: SaraswatiBounds,
  handle: SaraswatiResizeHandle,
  ar: number,
): SaraswatiBounds {
  if (ar <= 0 || !Number.isFinite(ar)) return bounds;
  const { x, y, width, height } = bounds;

  // Determine whether width or height is the "primary" axis for this handle.
  const hPrimary =
    handle === "e" ||
    handle === "w" ||
    handle === "ne" ||
    handle === "nw" ||
    handle === "se" ||
    handle === "sw";
  const vPrimary =
    handle === "n" ||
    handle === "s" ||
    handle === "ne" ||
    handle === "nw" ||
    handle === "se" ||
    handle === "sw";

  let newW = width;
  let newH = height;

  if (hPrimary && vPrimary) {
    // Corner handle: use the dominant axis (larger delta from AR-neutral size).
    const hFromH = height * ar; // width that would match height
    const vFromW = width / ar;  // height that would match width
    // Pick whichever gives the larger overall area (i.e. honour the bigger drag).
    if (hFromH >= vFromW) {
      newW = hFromH;
    } else {
      newH = vFromW;
    }
  } else if (hPrimary) {
    // Only width changes — derive height.
    newH = width / ar;
  } else {
    // Only height changes — derive width.
    newW = height * ar;
  }

  newW = Math.max(1, newW);
  newH = Math.max(1, newH);

  // Adjust position to keep the anchor corner fixed.
  let newX = x;
  let newY = y;

  if (handle === "nw" || handle === "n" || handle === "ne") {
    // Top edge moves — anchor is bottom.
    newY = y + height - newH;
  }
  if (handle === "nw" || handle === "w" || handle === "sw") {
    // Left edge moves — anchor is right.
    newX = x + width - newW;
  }

  return { x: newX, y: newY, width: newW, height: newH };
}

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

/**
 * Walk up the parent chain from hitId until we find a node that is a direct
 * child of the scene root (or is the root itself).  This makes clicking inside
 * a group select the group instead of the individual child, which is the
 * standard behaviour in design tools like Figma.
 *
 * A depth cap of 64 prevents infinite loops from corrupt scene graphs.
 */
function resolveSelectableId(
  scene: { root: string; nodes: Record<string, { parentId?: string | null }> },
  hitId: string,
): string {
  let id = hitId;
  for (let depth = 0; depth < 64; depth++) {
    const node = scene.nodes[id];
    if (!node) return hitId;
    // A node whose parentId is the scene root is a top-level selectable.
    if (node.parentId === scene.root || node.parentId == null) return id;
    id = node.parentId;
  }
  return hitId;
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
  /** Aspect ratio (W/H) captured when a handle-resize drag begins. */
  const resizeStartArRef = useRef<number>(1);
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
      const rawHitId = findTopHitNodeId(scene, { x, y });
      // Resolve up to the nearest group that is a direct child of the root so
      // that clicking inside a group selects the group as a whole.
      const hitId = rawHitId ? resolveSelectableId(scene, rawHitId) : null;
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
    (pointerId: number, x: number, y: number, options?: { shiftKey?: boolean }) => {
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
        const hitsSet = new Set<string>();
        for (const [nodeId, node] of Object.entries(scene.nodes)) {
          if (!isSaraswatiRenderableNode(node)) continue;
          const nodeBounds = getNodeBounds(node);
          if (boundsIntersect(bounds, nodeBounds)) {
            // Resolve each renderable hit up to its selectable ancestor so that
            // marquee-selecting across a group adds the group, not its children.
            hitsSet.add(resolveSelectableId(scene, nodeId));
          }
        }
        const hits = Array.from(hitsSet);
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
        const currentLine = scene.nodes[curveAdjust.nodeId];
        if (!currentLine || currentLine.type !== "line") return;

        const targetT =
          curveAdjust.startT + dx / Math.max(80, curveAdjust.length * 1.25);
        const clampedT = Math.max(0.02, Math.min(0.98, targetT));
        const maxBulge = Math.max(24, curveAdjust.length * 1.4);
        const targetBulge = curveAdjust.startBulge - dy * 0.55;
        const clampedBulge = Math.max(
          -maxBulge,
          Math.min(maxBulge, targetBulge),
        );

        const liveT = Number.isFinite(currentLine.curveT)
          ? currentLine.curveT
          : curveAdjust.startT;
        const liveBulge = Number.isFinite(currentLine.curveBulge)
          ? currentLine.curveBulge
          : curveAdjust.startBulge;
        const nextT = liveT + (clampedT - liveT) * 0.4;
        const nextBulge = liveBulge + (clampedBulge - liveBulge) * 0.4;

        applyCommands([
          {
            type: "REPLACE_NODE",
            node: {
              ...currentLine,
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
        const rawHover = findTopHitNodeId(scene, { x, y });
        setHoveredId(rawHover ? resolveSelectableId(scene, rawHover) : null);
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
        // getRenderableNodeBounds handles both renderable leaf nodes and group
        // nodes (union bounding box of all children).
        const startBounds = getRenderableNodeBounds(scene, command.id);
        if (startBounds) {
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
          let constrainedBounds = snapped.bounds;

          // Constrain AR when:
          //  1. shift is held (ad-hoc AR from drag start), or
          //  2. the inspector AR lock is active (persistent lock from store).
          const { arLocked, arLockedRatio } = store as {
            arLocked: boolean;
            arLockedRatio: number;
          };
          if (options?.shiftKey) {
            constrainedBounds = constrainResizeBoundsToAr(
              constrainedBounds,
              resizeState.handle,
              resizeStartArRef.current,
            );
          } else if (arLocked && arLockedRatio > 0) {
            constrainedBounds = constrainResizeBoundsToAr(
              constrainedBounds,
              resizeState.handle,
              arLockedRatio,
            );
          }

          command = {
            ...command,
            x: constrainedBounds.x,
            y: constrainedBounds.y,
            width: constrainedBounds.width,
            height: constrainedBounds.height,
          };
          nextGuides = snapped.guides;
          nextMeasurement = measurementFromBounds(constrainedBounds);
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
      // Capture the initial aspect ratio so shift-resize can constrain to it.
      resizeStartArRef.current =
        startBounds.height > 0 ? startBounds.width / startBounds.height : 1;
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
