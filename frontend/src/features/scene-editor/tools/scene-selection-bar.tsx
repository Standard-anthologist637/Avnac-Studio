/**
 * Context-sensitive toolbar row above the scene canvas.
 *
 * State machine:
 *   canvas-body (nothing selected) → artboard resize + background color
 *   text node                       → TextFormatToolbar + opacity/stroke effects
 *   rect / ellipse / polygon / star → fill swatch + (rect: corner radius) + opacity/stroke effects
 *   line                            → stroke color + opacity effects
 *   image                           → type badge + opacity + delete
 *   group                           → type badge + opacity + ungroup + delete
 *   multi-select                    → count + delete
 *
 * All mutations go through Saraswati commands — no direct state ownership.
 */
import { useRef } from "react";
import { Delete02Icon, UngroupItemsIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FloatingToolbarShell,
  FloatingToolbarDivider,
  floatingToolbarIconButton,
} from "@/components/editor/shared/floating-toolbar-shell";
import ArtboardResizeToolbarControl from "@/components/editor/canvas/artboard-resize-toolbar-control";
import PaintPopoverControl from "@/components/editor/color/paint-popover-control";
import TransparencyToolbarPopover from "@/components/editor/color/transparency-toolbar-popover";
import StrokeToolbarPopover from "@/components/editor/color/stroke-toolbar-popover";
import ShadowToolbarPopover from "@/components/editor/color/shadow-toolbar-popover";
import BlurToolbarControl from "@/components/editor/color/blur-toolbar-control";
import { DEFAULT_FABRIC_SHADOW_UI } from "@/lib/avnac-fabric-shadow";
import CornerRadiusToolbarControl from "@/components/editor/shape/corner-radius-toolbar-control";
import TextFormatToolbar, {
  type TextFormatToolbarValues,
} from "@/components/editor/text/text-format-toolbar";
import type { BgValue } from "@/lib/editor-paint";
import type {
  SaraswatiColor,
  SaraswatiRectNode,
  SaraswatiTextNode,
  SaraswatiLineNode,
  SaraswatiPaintNodeBase,
  SaraswatiShadow,
} from "@/lib/saraswati";
import { useSceneEditorStore } from "../store";

// ---------------------------------------------------------------------------
// Helpers: SaraswatiColor <-> BgValue boundary casts (same runtime shape)
// ---------------------------------------------------------------------------
function toColor(b: BgValue): SaraswatiColor {
  return b as unknown as SaraswatiColor;
}
function toPaint(c: SaraswatiColor): BgValue {
  return c as unknown as BgValue;
}
// SaraswatiShadow and FabricShadowUi are structurally identical — cast at boundary.
type FabricShadowUiShape = {
  blur: number;
  offsetX: number;
  offsetY: number;
  colorHex: string;
  opacityPct: number;
};
function toFabricShadow(s: SaraswatiShadow): FabricShadowUiShape {
  return s as FabricShadowUiShape;
}
function fromFabricShadow(s: FabricShadowUiShape): SaraswatiShadow {
  return s as SaraswatiShadow;
}

// ---------------------------------------------------------------------------
// Node type display labels
// ---------------------------------------------------------------------------
const NODE_TYPE_LABEL: Record<string, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  polygon: "Polygon",
  star: "Star",
  line: "Line",
  image: "Image",
  text: "Text",
  group: "Group",
  vector: "Vector",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SceneSelectionBar() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const focusMode = useSceneEditorStore((s) => s.focusMode);
  const applyCommands = useSceneEditorStore((s) => s.applyCommands);
  const setSelectedIds = useSceneEditorStore((s) => s.setSelectedIds);
  const setArtboard = useSceneEditorStore((s) => s.setArtboard);
  const setNodeFill = useSceneEditorStore((s) => s.setNodeFill);
  const setNodeStroke = useSceneEditorStore((s) => s.setNodeStroke);
  const setNodeCornerRadius = useSceneEditorStore((s) => s.setNodeCornerRadius);
  const setTextFormat = useSceneEditorStore((s) => s.setTextFormat);
  const setNodeOpacity = useSceneEditorStore((s) => s.setNodeOpacity);
  const setNodeShadow = useSceneEditorStore((s) => s.setNodeShadow);
  const setNodeBlur = useSceneEditorStore((s) => s.setNodeBlur);
  const barRef = useRef<HTMLDivElement>(null);

  if (!scene) return null;

  const hasSelection = selectedIds.length > 0;

  const handleDelete = () => {
    applyCommands(
      selectedIds.map((id) => ({ type: "DELETE_NODE" as const, id })),
    );
    setSelectedIds([]);
  };

  // Single-node toolbar
  if (hasSelection && selectedIds.length === 1) {
    const nodeId = selectedIds[0]!;
    const node = scene.nodes[nodeId];
    if (!node) return null;

    // TEXT
    if (node.type === "text") {
      const textNode = node as SaraswatiTextNode;
      const opacityPct = Math.round((textNode.opacity ?? 1) * 100);
      const values: TextFormatToolbarValues = {
        fontFamily: textNode.fontFamily,
        fontSize: textNode.fontSize,
        fillStyle: toPaint(textNode.color),
        textAlign:
          textNode.textAlign === "right"
            ? "right"
            : textNode.textAlign === "center"
              ? "center"
              : "left",
        bold:
          textNode.fontWeight === "700" || textNode.fontWeight === "bold",
        italic: textNode.fontStyle === "italic",
        underline: textNode.underline,
      };
      return (
        <BarShell barRef={barRef} focusMode={focusMode}>
          <TextFormatToolbar
            values={values}
            onChange={(patch) => {
              const colorPatch =
                patch.fillStyle ? { color: toColor(patch.fillStyle) } : {};
              setTextFormat(nodeId, {
                fontFamily: patch.fontFamily,
                fontSize: patch.fontSize,
                fontWeight:
                  patch.bold !== undefined
                    ? patch.bold
                      ? "700"
                      : "400"
                    : undefined,
                fontStyle:
                  patch.italic !== undefined
                    ? patch.italic
                      ? "italic"
                      : "normal"
                    : undefined,
                textAlign:
                  patch.textAlign === "justify" ? "left" : patch.textAlign,
                underline: patch.underline,
                ...colorPatch,
              });
            }}
            footerSlot={
              <>
                <FloatingToolbarDivider />
                <BlurToolbarControl
                  blurPct={textNode.blur ?? 0}
                  onChange={(b) => setNodeBlur(nodeId, b)}
                />
                <FloatingToolbarDivider />
                <TransparencyToolbarPopover
                  opacityPct={opacityPct}
                  onChange={(pct) => setNodeOpacity(nodeId, pct / 100)}
                />
                <FloatingToolbarDivider />
                <StrokeToolbarPopover
                  strokeWidthPx={textNode.strokeWidth ?? 0}
                  strokePaint={toPaint(
                    textNode.stroke ?? { type: "solid", color: "#000000" },
                  )}
                  onStrokeWidthChange={(w) =>
                    setNodeStroke(nodeId, textNode.stroke, w)
                  }
                  onStrokePaintChange={(v) =>
                    setNodeStroke(nodeId, toColor(v), textNode.strokeWidth)
                  }
                />
                <FloatingToolbarDivider />
                <ShadowToolbarPopover
                  value={toFabricShadow(textNode.shadow ?? DEFAULT_FABRIC_SHADOW_UI as SaraswatiShadow)}
                  shadowActive={Boolean(textNode.shadow)}
                  onChange={(s) => setNodeShadow(nodeId, fromFabricShadow(s))}
                />
              </>
            }
          />
        </BarShell>
      );
    }

    // RECT
    if (node.type === "rect") {
      const rectNode = node as SaraswatiRectNode;
      const radiusMax = Math.min(rectNode.width, rectNode.height) / 2;
      const opacityPct = Math.round((rectNode.opacity ?? 1) * 100);
      return (
        <BarShell barRef={barRef} focusMode={focusMode}>
          <FloatingToolbarShell role="toolbar" aria-label="Rectangle options">
            <div className="flex items-center py-1 pl-2 pr-1">
              <PaintPopoverControl
                compact
                value={toPaint(rectNode.fill)}
                onChange={(v) => setNodeFill(nodeId, toColor(v))}
                title="Fill color and gradient"
                ariaLabel="Fill color and gradient"
              />
              {radiusMax > 0 && (
                <>
                  <FloatingToolbarDivider />
                  <CornerRadiusToolbarControl
                    value={rectNode.radiusX}
                    max={radiusMax}
                    onChange={(r) => setNodeCornerRadius(nodeId, r)}
                  />
                </>
              )}
              <FloatingToolbarDivider />
              <BlurToolbarControl
                blurPct={rectNode.blur ?? 0}
                onChange={(b) => setNodeBlur(nodeId, b)}
              />
              <FloatingToolbarDivider />
              <TransparencyToolbarPopover
                opacityPct={opacityPct}
                onChange={(pct) => setNodeOpacity(nodeId, pct / 100)}
              />
              <FloatingToolbarDivider />
              <StrokeToolbarPopover
                strokeWidthPx={rectNode.strokeWidth}
                strokePaint={toPaint(
                  rectNode.stroke ?? { type: "solid", color: "#000000" },
                )}
                onStrokeWidthChange={(w) =>
                  setNodeStroke(nodeId, rectNode.stroke, w)
                }
                onStrokePaintChange={(v) =>
                  setNodeStroke(nodeId, toColor(v), rectNode.strokeWidth)
                }
              />
              <FloatingToolbarDivider />
              <ShadowToolbarPopover
                value={toFabricShadow(rectNode.shadow ?? DEFAULT_FABRIC_SHADOW_UI as SaraswatiShadow)}
                shadowActive={Boolean(rectNode.shadow)}
                onChange={(s) => setNodeShadow(nodeId, fromFabricShadow(s))}
              />
              <FloatingToolbarDivider />
              <DeleteBtn onClick={handleDelete} />
            </div>
          </FloatingToolbarShell>
        </BarShell>
      );
    }

    // ELLIPSE / POLYGON
    if (node.type === "ellipse" || node.type === "polygon") {
      const paintNode = node as unknown as SaraswatiPaintNodeBase;
      const opacityPct = Math.round((paintNode.opacity ?? 1) * 100);
      return (
        <BarShell barRef={barRef} focusMode={focusMode}>
          <FloatingToolbarShell
            role="toolbar"
            aria-label={`${NODE_TYPE_LABEL[node.type] ?? node.type} options`}
          >
            <div className="flex items-center py-1 pl-2 pr-1">
              <PaintPopoverControl
                compact
                value={toPaint(paintNode.fill)}
                onChange={(v) => setNodeFill(nodeId, toColor(v))}
                title="Fill color and gradient"
                ariaLabel="Fill color and gradient"
              />
              <FloatingToolbarDivider />
              <BlurToolbarControl
                blurPct={(node as unknown as { blur?: number }).blur ?? 0}
                onChange={(b) => setNodeBlur(nodeId, b)}
              />
              <FloatingToolbarDivider />
              <TransparencyToolbarPopover
                opacityPct={opacityPct}
                onChange={(pct) => setNodeOpacity(nodeId, pct / 100)}
              />
              <FloatingToolbarDivider />
              <StrokeToolbarPopover
                strokeWidthPx={paintNode.strokeWidth}
                strokePaint={toPaint(
                  paintNode.stroke ?? { type: "solid", color: "#000000" },
                )}
                onStrokeWidthChange={(w) =>
                  setNodeStroke(nodeId, paintNode.stroke, w)
                }
                onStrokePaintChange={(v) =>
                  setNodeStroke(nodeId, toColor(v), paintNode.strokeWidth)
                }
              />
              <FloatingToolbarDivider />
              <ShadowToolbarPopover
                value={toFabricShadow((node as unknown as { shadow?: SaraswatiShadow }).shadow ?? DEFAULT_FABRIC_SHADOW_UI as SaraswatiShadow)}
                shadowActive={Boolean((node as unknown as { shadow?: SaraswatiShadow }).shadow)}
                onChange={(s) => setNodeShadow(nodeId, fromFabricShadow(s))}
              />
              <FloatingToolbarDivider />
              <DeleteBtn onClick={handleDelete} />
            </div>
          </FloatingToolbarShell>
        </BarShell>
      );
    }

    // LINE
    if (node.type === "line") {
      const lineNode = node as SaraswatiLineNode;
      const opacityPct = Math.round((lineNode.opacity ?? 1) * 100);
      return (
        <BarShell barRef={barRef} focusMode={focusMode}>
          <FloatingToolbarShell role="toolbar" aria-label="Line options">
            <div className="flex items-center py-1 pl-2 pr-1">
              <PaintPopoverControl
                compact
                value={toPaint(lineNode.stroke)}
                onChange={(v) =>
                  setNodeStroke(nodeId, toColor(v), lineNode.strokeWidth)
                }
                title="Stroke color and gradient"
                ariaLabel="Stroke color and gradient"
              />
              <FloatingToolbarDivider />
              <BlurToolbarControl
                blurPct={lineNode.blur ?? 0}
                onChange={(b) => setNodeBlur(nodeId, b)}
              />
              <FloatingToolbarDivider />
              <TransparencyToolbarPopover
                opacityPct={opacityPct}
                onChange={(pct) => setNodeOpacity(nodeId, pct / 100)}
              />
              <FloatingToolbarDivider />
              <ShadowToolbarPopover
                value={toFabricShadow(lineNode.shadow ?? DEFAULT_FABRIC_SHADOW_UI as SaraswatiShadow)}
                shadowActive={Boolean(lineNode.shadow)}
                onChange={(s) => setNodeShadow(nodeId, fromFabricShadow(s))}
              />
              <FloatingToolbarDivider />
              <DeleteBtn onClick={handleDelete} />
            </div>
          </FloatingToolbarShell>
        </BarShell>
      );
    }

    // GROUP
    if (node.type === "group") {
      const opacityPct = Math.round((node.opacity ?? 1) * 100);
      return (
        <BarShell barRef={barRef} focusMode={focusMode}>
          <FloatingToolbarShell role="toolbar" aria-label="Selection">
            <div className="flex items-center py-1 pl-2 pr-1">
              <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {node.name ?? "Group"}
              </span>
              <FloatingToolbarDivider />
              <BlurToolbarControl
                blurPct={node.blur ?? 0}
                onChange={(b) => setNodeBlur(nodeId, b)}
              />
              <FloatingToolbarDivider />
              <TransparencyToolbarPopover
                opacityPct={opacityPct}
                onChange={(pct) => setNodeOpacity(nodeId, pct / 100)}
              />
              <FloatingToolbarDivider />
              <ShadowToolbarPopover
                value={toFabricShadow(node.shadow ?? DEFAULT_FABRIC_SHADOW_UI as SaraswatiShadow)}
                shadowActive={Boolean(node.shadow)}
                onChange={(s) => setNodeShadow(nodeId, fromFabricShadow(s))}
              />
              <FloatingToolbarDivider />
              <button
                type="button"
                onClick={() => {
                  applyCommands([{ type: "UNGROUP_NODE", id: nodeId }]);
                  setSelectedIds([]);
                }}
                title="Ungroup (Cmd/Ctrl+Shift+G)"
                aria-label="Ungroup"
                className={[
                  floatingToolbarIconButton(false, { wide: true }),
                  "gap-1 px-2",
                ].join(" ")}
              >
                <HugeiconsIcon
                  icon={UngroupItemsIcon}
                  size={16}
                  strokeWidth={1.75}
                />
                <span className="text-[13px] font-medium">Ungroup</span>
              </button>
              <FloatingToolbarDivider />
              <DeleteBtn onClick={handleDelete} />
            </div>
          </FloatingToolbarShell>
        </BarShell>
      );
    }

    // IMAGE / unknown
    const label = NODE_TYPE_LABEL[node.type] ?? node.type;
    const opacityPct = Math.round(((node as { opacity?: number }).opacity ?? 1) * 100);
    const nodeWithEffects = node as { blur?: number; shadow?: SaraswatiShadow };
    return (
      <BarShell barRef={barRef} focusMode={focusMode}>
        <FloatingToolbarShell role="toolbar" aria-label="Selection">
          <div className="flex items-center py-1 pl-2 pr-1">
            <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {label}
            </span>
            <FloatingToolbarDivider />
            <BlurToolbarControl
              blurPct={nodeWithEffects.blur ?? 0}
              onChange={(b) => setNodeBlur(nodeId, b)}
            />
            <FloatingToolbarDivider />
            <TransparencyToolbarPopover
              opacityPct={opacityPct}
              onChange={(pct) => setNodeOpacity(nodeId, pct / 100)}
            />
            <FloatingToolbarDivider />
            <ShadowToolbarPopover
              value={toFabricShadow(nodeWithEffects.shadow ?? DEFAULT_FABRIC_SHADOW_UI as SaraswatiShadow)}
              shadowActive={Boolean(nodeWithEffects.shadow)}
              onChange={(s) => setNodeShadow(nodeId, fromFabricShadow(s))}
            />
            <FloatingToolbarDivider />
            <DeleteBtn onClick={handleDelete} />
          </div>
        </FloatingToolbarShell>
      </BarShell>
    );
  }

  // Multi-select
  if (hasSelection && selectedIds.length > 1) {
    return (
      <BarShell barRef={barRef} focusMode={focusMode}>
        <FloatingToolbarShell role="toolbar" aria-label="Selection">
          <div className="flex items-center py-1 pl-3 pr-1">
            <span className="text-[13px] font-medium text-neutral-600">
              {selectedIds.length} items
            </span>
            <FloatingToolbarDivider />
            <DeleteBtn onClick={handleDelete} />
          </div>
        </FloatingToolbarShell>
      </BarShell>
    );
  }

  // Nothing selected — artboard / background controls
  return (
    <BarShell barRef={barRef} focusMode={focusMode}>
      <FloatingToolbarShell role="toolbar" aria-label="Artboard">
        <div className="flex items-center py-1 pl-2 pr-1">
          <ArtboardResizeToolbarControl
            width={scene.artboard.width}
            height={scene.artboard.height}
            onResize={(w, h) => setArtboard(w, h)}
            viewportRef={barRef}
          />
          <FloatingToolbarDivider />
          <PaintPopoverControl
            value={toPaint(scene.artboard.bg)}
            onChange={(bg) => setArtboard(undefined, undefined, toColor(bg))}
            ariaLabel="Artboard background"
            title="Background"
            compact
          />
        </div>
      </FloatingToolbarShell>
    </BarShell>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
function BarShell({
  barRef,
  focusMode,
  children,
}: {
  barRef: React.RefObject<HTMLDivElement | null>;
  focusMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-avnac-chrome
      ref={barRef}
      className={[
        "pointer-events-auto relative z-[80] flex h-14 w-full shrink-0 items-center justify-center px-1 transition-opacity duration-150 sm:px-2",
        focusMode ? "pointer-events-none opacity-0" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Delete selected (Delete)"
      aria-label="Delete selected"
      className={floatingToolbarIconButton(false)}
    >
      <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.75} />
    </button>
  );
}
