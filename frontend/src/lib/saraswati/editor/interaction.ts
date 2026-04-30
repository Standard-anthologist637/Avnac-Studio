import type { SaraswatiCommand } from "../commands/types";
import type { SaraswatiScene } from "../scene";
import { findTopHitNodeId } from "../spatial";

export type SaraswatiPointerState = {
  activeNodeId: string | null;
  pointerId: number | null;
  lastX: number;
  lastY: number;
};

export function createIdlePointerState(): SaraswatiPointerState {
  return {
    activeNodeId: null,
    pointerId: null,
    lastX: 0,
    lastY: 0,
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
    },
    selectedIds: [hitId],
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
  const dx = x - state.lastX;
  const dy = y - state.lastY;
  if (dx === 0 && dy === 0) {
    return { state, command: null };
  }
  return {
    state: {
      ...state,
      lastX: x,
      lastY: y,
    },
    command: {
      type: "MOVE_NODE",
      id: state.activeNodeId,
      dx,
      dy,
    },
  };
}

export function pointerUp(
  state: SaraswatiPointerState,
  pointerId: number,
): SaraswatiPointerState {
  if (state.pointerId !== pointerId) return state;
  return createIdlePointerState();
}
