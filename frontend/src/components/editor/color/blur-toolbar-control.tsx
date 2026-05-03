import { HugeiconsIcon } from "@hugeicons/react";
import { BlurIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useViewportAwarePopoverPlacement } from "@/hooks/use-viewport-aware-popover";
import EditorRangeSlider from "@/components/editor/shared/editor-range-slider";
import {
  floatingToolbarIconButton,
  floatingToolbarPopoverClass,
} from "@/components/editor/shared/floating-toolbar-shell";

const PANEL_ESTIMATE_H = 120;

type Props = {
  blurPct: number;
  onChange: (blurPct: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export default function BlurToolbarControl({
  blurPct,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pickPanel = useCallback(() => panelRef.current, []);
  const rounded = Math.max(0, Math.min(100, Math.round(blurPct)));

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
        aria-label={`Blur, ${rounded}%`}
        title="Blur"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <HugeiconsIcon icon={BlurIcon} size={18} strokeWidth={1.75} />
        <span className="min-w-[2.25rem] text-left text-xs font-medium tabular-nums text-neutral-700">
          {rounded}%
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          className={[
            "absolute left-1/2 z-[70] min-w-[13.5rem] p-3",
            openUpward ? "bottom-full mb-2" : "top-full mt-2",
            floatingToolbarPopoverClass,
          ].join(" ")}
          style={{
            transform: `translateX(calc(-50% + ${shiftX}px))`,
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-neutral-800">
              Blur
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[13px] tabular-nums text-neutral-600">
                {rounded}%
              </span>
              {rounded > 0 ? (
                <button
                  type="button"
                  onClick={() => onChange(0)}
                  aria-label="Reset blur"
                  title="Reset blur"
                  className="flex size-5 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/[0.06] hover:text-neutral-700"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>
          <EditorRangeSlider
            min={0}
            max={100}
            value={rounded}
            onChange={onChange}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
            aria-label="Blur"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rounded}
            trackClassName="w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
