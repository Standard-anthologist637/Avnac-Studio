import type { Canvas, FabricObject, IText } from "fabric";
import { bgValueFromFabricFill } from "@/lib/avnac-fill-paint";
import { getAvnacShapeMeta, type AvnacShapeKind } from "@/lib/avnac-shape-meta";
import { getAvnacLayerName } from "@/lib/ensure-avnac-layer-id";
import type { CanvasAlignKind } from "@/components/editor/canvas/types";
import type { TextFormatToolbarValues } from "@/components/editor/text/types";
import { ARTBOARD_ALIGN_ALREADY_EPS, ARTBOARD_ALIGN_PAD } from "./constants";

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

export function toolbarIconBtn(disabled?: boolean): string {
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 outline-none transition-colors hover:bg-black/[0.06]";
  if (disabled) {
    return `${base} pointer-events-none cursor-not-allowed opacity-35`;
  }
  return base;
}

export function backgroundTopBtn(disabled?: boolean): string {
  const base =
    "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 outline-none transition-colors hover:bg-black/[0.06]";
  if (disabled) {
    return `${base} pointer-events-none cursor-not-allowed opacity-35`;
  }
  return base;
}

export function isEventOnFabricCanvas(
  canvas: Canvas,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Node)) return false;
  const lower = canvas.getElement();
  const upper = canvas.upperCanvasEl;
  return lower.contains(target) || upper.contains(target);
}

export function pointerIsTouch(e: Event): boolean {
  return "pointerType" in e && (e as PointerEvent).pointerType === "touch";
}

/** Local outer radius for centered polygon/star points after scaling is baked into geometry. */
export function outerRadiusFromScaledPolygon(obj: FabricObject): number {
  return Math.max(
    24,
    Math.min(obj.getScaledWidth(), obj.getScaledHeight()) / 2,
  );
}

export function primaryFontFamily(css: string): string {
  const first = css.split(",")[0]?.trim() ?? "Inter";
  return first.replace(/^["']|["']$/g, "");
}

export function readTextFormat(
  obj: IText,
  fontSize: number,
): TextFormatToolbarValues {
  const fillStyle = bgValueFromFabricFill(obj);
  const ta = obj.textAlign ?? "left";
  const textAlign =
    ta === "center" || ta === "right" || ta === "justify" ? ta : "left";
  const w = obj.fontWeight;
  const bold =
    w === "bold" ||
    w === "700" ||
    w === 700 ||
    (typeof w === "number" && w >= 600);
  return {
    fontFamily: primaryFontFamily(String(obj.fontFamily ?? "Inter")),
    fontSize: obj.fontSize ?? fontSize,
    fillStyle,
    textAlign,
    bold,
    italic: obj.fontStyle === "italic",
    underline: !!obj.underline,
  };
}

export function avnacShapeKindLayerLabel(kind: AvnacShapeKind): string {
  const labels: Record<AvnacShapeKind, string> = {
    rect: "Square",
    ellipse: "Ellipse",
    polygon: "Polygon",
    star: "Star",
    line: "Line",
    arrow: "Arrow",
  };
  return labels[kind];
}

export function fabricObjectLabel(
  o: FabricObject,
  mod: typeof import("fabric"),
): string {
  const custom = getAvnacLayerName(o);
  if (custom) return custom;
  if (mod.FabricImage && o instanceof mod.FabricImage) return "Image";
  if (mod.IText && o instanceof mod.IText) {
    return o.text?.trim() || "Text";
  }
  const m = getAvnacShapeMeta(o);
  if (m) return avnacShapeKindLayerLabel(m.kind);
  return o.type ?? "Object";
}
