import type { CanvasAlignKind } from "@/components/editor/canvas/canvas-selection-toolbar";
import {
  ARTBOARD_ALIGN_ALREADY_EPS,
  ARTBOARD_ALIGN_PAD,
} from "@/components/fabric-editor/constants";

export function artboardAlignAlreadySatisfied(
  br: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
  boardW: number,
  boardH: number,
): Record<CanvasAlignKind, boolean> {
  const pad = ARTBOARD_ALIGN_PAD;
  const eps = ARTBOARD_ALIGN_ALREADY_EPS;
  return {
    left: Math.abs(br.left - pad) <= eps,
    centerH: Math.abs(br.left + br.width / 2 - boardW / 2) <= eps,
    right: Math.abs(br.left + br.width - (boardW - pad)) <= eps,
    top: Math.abs(br.top - pad) <= eps,
    centerV: Math.abs(br.top + br.height / 2 - boardH / 2) <= eps,
    bottom: Math.abs(br.top + br.height - (boardH - pad)) <= eps,
  };
}
