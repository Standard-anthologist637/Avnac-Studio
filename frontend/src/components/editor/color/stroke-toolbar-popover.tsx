import { HugeiconsIcon } from "@hugeicons/react";
import { BorderFullIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import EditorRangeSlider from "@/components/editor/shared/editor-range-slider";
import PaintPopoverControl from "@/components/editor/color/paint-popover-control";
import { useViewportAwarePopoverPlacement } from "@/hooks/use-viewport-aware-popover";
import {
  floatingToolbarIconButton,
  floatingToolbarPopoverMenuClass,
} from "@/components/editor/shared/floating-toolbar-shell";
import type { BgValue } from "@/lib/editor-paint";

const PANEL_ESTIMATE_H = 340;
const STROKE_WIDTH_MAX = 40;

type Props = {
  strokeWidthPx: number;
  strokePaint: BgValue;
  onStrokeWidthChange: (px: number) => void;
  onStrokePaintChange: (v: BgValue) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  strokeWidthMin?: number;
  strokeWidthMax?: number;
};

export default function StrokeToolbarPopover({
  strokeWidthPx,
  strokePaint,
  onStrokeWidthChange,
  onStrokePaintChange,
  onInteractionStart,
  onInteractionEnd,
  strokeWidthMin = 0,
  strokeWidthMax = STROKE_WIDTH_MAX,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pickPanel = useCallback(() => panelRef.current, []);
  const w = Math.max(
    strokeWidthMin,
    Math.min(strokeWidthMax, Math.round(strokeWidthPx)),
  );

  const { openUpward, shiftX } = useViewportAwarePopoverPlacement(
    open,
    rootRef,
    PANEL_ESTIMATE_H,
    pickPanel,
    "center",
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={[
          floatingToolbarIconButton(open, { wide: true }),
          "gap-1 px-2",
        ].join(" ")}
        aria-label={`Outline stroke, ${w}px`}
        title="Stroke"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <HugeiconsIcon icon={BorderFullIcon} size={18} strokeWidth={1.75} />
        <span className="min-w-[2.25rem] text-left text-xs font-medium tabular-nums text-neutral-700">
          {w}px
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          className={[
            "absolute left-1/2 z-[70] min-w-[15rem] p-3",
            openUpward ? "bottom-full mb-2" : "top-full mt-2",
            floatingToolbarPopoverMenuClass,
          ].join(" ")}
          style={{
            transform: `translateX(calc(-50% + ${shiftX}px))`,
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-neutral-800">
              Stroke width
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[13px] tabular-nums text-neutral-600">
                {w}px
              </span>
              {w > strokeWidthMin ? (
                <button
                  type="button"
                  onClick={() => onStrokeWidthChange(strokeWidthMin)}
                  aria-label="Reset stroke"
                  title="Reset stroke"
                  className="flex size-5 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/[0.06] hover:text-neutral-700"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>
          <EditorRangeSlider
            min={strokeWidthMin}
            max={strokeWidthMax}
            value={w}
            onChange={onStrokeWidthChange}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
            aria-label="Stroke width"
            aria-valuemin={strokeWidthMin}
            aria-valuemax={strokeWidthMax}
            aria-valuenow={w}
            trackClassName="mb-4 w-full"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-neutral-800">
              Stroke color
            </span>
            <PaintPopoverControl
              compact
              value={strokePaint}
              onChange={onStrokePaintChange}
              ariaLabel="Stroke color and gradient"
              title="Stroke color"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
