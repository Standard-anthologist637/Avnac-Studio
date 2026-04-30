import type { BgValue } from "@/lib/editor-paint";
import type { ShapesQuickAddKind } from "@/components/editor/shape/shapes-popover";

export const DEFAULT_ARTBOARD_W = 4000;
export const DEFAULT_ARTBOARD_H = 4000;
export const ARTBOARD_ALIGN_PAD = 32;
export const ARTBOARD_ALIGN_ALREADY_EPS = 2;
export const CLIPBOARD_PASTE_OFFSET = 32;
export const ZOOM_MIN_PCT = 5;
export const ZOOM_MAX_PCT = 100;
export const HISTORY_LIMIT = 20;

export const OBJECT_SERIAL_KEYS = [
  "avnacShape",
  "avnacLocked",
  "avnacBlur",
  "avnacFill",
  "avnacStroke",
  "avnacLayerId",
  "avnacLayerName",
  "avnacVectorBoardId",
] as const;

export const DEFAULT_PAINT: BgValue = { type: "solid", color: "#262626" };

export const FIT_PADDING = 32;

export const QUICK_SHAPE_TITLE: Record<ShapesQuickAddKind, string> = {
  generic: "Add square",
  rect: "Add square",
  ellipse: "Add ellipse",
  polygon: "Add polygon",
  star: "Add star",
  line: "Add line",
  arrow: "Add arrow",
};
