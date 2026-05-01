import type {
  SaraswatiResizeHandle,
  SaraswatiCommand,
} from "../commands/types";
import type { SaraswatiScene } from "../scene";
import type { SaraswatiBounds } from "../spatial";
import { findTopHitNodeId } from "../spatial";

export type { SaraswatiResizeHandle };

type ResizeDragState = {
  handle: SaraswatiResizeHandle;
  nodeId: string;
  startBounds: SaraswatiBounds;
  startX: number;
  startY: number;
};

export type SaraswatiPointerState = {
  activeNodeId: string | null;
  pointerId: number | null;
  lastX: number;
  lastY: number;
  resize: ResizeDragState | null;
};

export function createIdlePointerState(): SaraswatiPointerState {
  return {
    activeNodeId: null,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    resize: null,
  };
}

export function pointerDown(
  scene: SaraswatiScene,
  pointerId: number,
  x: number,
  y: number,
): { state: SaraswatiPointerState; selectedIds: string[] } {
  const hitId = findTopHitNodeId(scene, { x, y });
  if (!hitId) {
    return {
      state: createIdlePointerState(),
      selectedIds: [],
    };
  }
  return {
    state: {
      activeNodeId: hitId,
      pointerId,
      lastX: x,
      lastY: y,
      resize: null,
    },
    selectedIds: [hitId],
  };
}

export function resizeHandlePointerDown(
  nodeId: string,
  handle: SaraswatiResizeHandle,
  startBounds: SaraswatiBounds,
  pointerId: number,
  x: number,
  y: number,
): SaraswatiPointerState {
  return {
    activeNodeId: nodeId,
    pointerId,
    lastX: x,
    lastY: y,
    resize: { handle, nodeId, startBounds, startX: x, startY: y },
  };
}

export function pointerMove(
  state: SaraswatiPointerState,
  pointerId: number,
  x: number,
  y: number,
): { state: SaraswatiPointerState; command: SaraswatiCommand | null } {
  if (state.pointerId !== pointerId || !state.activeNodeId) {
    return { state, command: null };
  }
  const newState = { ...state, lastX: x, lastY: y };

  if (state.resize) {
    const { handle, nodeId, startBounds, startX, startY } = state.resize;
    const dx = x - startX;
    const dy = y - startY;
    const b = computeResizeBounds(startBounds, handle, dx, dy);
    return {
      state: newState,
      command: { type: "RESIZE_NODE", id: nodeId, ...b },
    };
  }

  const dx = x - state.lastX;
  const dy = y - state.lastY;
  if (dx === 0 && dy === 0) return { state, command: null };
  return {
    state: newState,
    command: {
      type: "MOVE_NODE",
      id: state.activeNodeId,
      dx,
      dy,
    },
  };
}

function computeResizeBounds(
  s: SaraswatiBounds,
  handle: SaraswatiResizeHandle,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  const minSize = 1;
  let x = s.x,
    y = s.y,
    w = s.width,
    h = s.height;
  // horizontal
  if (handle === "nw" || handle === "sw" || handle === "w") {
    const newW = Math.max(minSize, s.width - dx);
    x = s.x + s.width - newW;
    w = newW;
  } else if (handle === "ne" || handle === "se" || handle === "e") {
    w = Math.max(minSize, s.width + dx);
  }
  // vertical
  if (handle === "nw" || handle === "ne" || handle === "n") {
    const newH = Math.max(minSize, s.height - dy);
    y = s.y + s.height - newH;
    h = newH;
  } else if (handle === "sw" || handle === "se" || handle === "s") {
    h = Math.max(minSize, s.height + dy);
  }
  return { x, y, width: w, height: h };
}

export function pointerUp(
  state: SaraswatiPointerState,
  pointerId: number,
): SaraswatiPointerState {
  if (state.pointerId !== pointerId) return state;
  return createIdlePointerState();
}
