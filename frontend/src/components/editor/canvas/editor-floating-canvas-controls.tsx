import { Maximize01Icon, Minimize01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

type ToolbarOffset = {
  left: number;
  bottom: number;
};

type DragState = {
  startX: number;
  startY: number;
  left: number;
  bottom: number;
};

type Props = {
  ready: boolean;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  zoomRef: RefObject<HTMLDivElement | null>;
  toolbarRef: RefObject<HTMLDivElement | null>;
  zoomControl: ReactNode;
  children: ReactNode;
};

const floatingSurfaceClass =
  "rounded-full border border-black/[0.08] bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-xl";

const focusButtonClass = [
  "flex size-9 items-center justify-center rounded-full border border-black/[0.08]",
  "bg-white/90 text-neutral-700 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-xl",
  "transition-colors hover:bg-white hover:text-neutral-950",
].join(" ");

const DEFAULT_TOOLBAR_OFFSET: ToolbarOffset = {
  left: 12,
  bottom: 8,
};

const TOOLBAR_SNAP_THRESHOLD_PX = 52;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function EditorFloatingCanvasControls({
  ready,
  focusMode,
  onToggleFocusMode,
  zoomRef,
  toolbarRef,
  zoomControl,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const initializedPositionRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [toolbarOffset, setToolbarOffset] = useState<ToolbarOffset>(
    DEFAULT_TOOLBAR_OFFSET,
  );

  const clampToolbarOffset = useCallback(
    (next: ToolbarOffset): ToolbarOffset => {
      const root = rootRef.current;
      const toolbar = toolbarRef.current;
      if (!root || !toolbar) return next;
      const maxLeft = Math.max(
        DEFAULT_TOOLBAR_OFFSET.left,
        root.clientWidth - toolbar.offsetWidth - DEFAULT_TOOLBAR_OFFSET.left,
      );
      const maxBottom = Math.max(
        DEFAULT_TOOLBAR_OFFSET.bottom,
        root.clientHeight -
          toolbar.offsetHeight -
          DEFAULT_TOOLBAR_OFFSET.bottom,
      );
      return {
        left: clamp(next.left, DEFAULT_TOOLBAR_OFFSET.left, maxLeft),
        bottom: clamp(next.bottom, DEFAULT_TOOLBAR_OFFSET.bottom, maxBottom),
      };
    },
    [toolbarRef],
  );

  const snapToolbarOffset = useCallback(
    (next: ToolbarOffset): ToolbarOffset => {
      const root = rootRef.current;
      const toolbar = toolbarRef.current;
      const clamped = clampToolbarOffset(next);
      if (!root || !toolbar) return clamped;

      const horizontalSnapPoints = [
        DEFAULT_TOOLBAR_OFFSET.left,
        (root.clientWidth - toolbar.offsetWidth) / 2,
        root.clientWidth - toolbar.offsetWidth - DEFAULT_TOOLBAR_OFFSET.left,
      ].map((value) => Math.round(value));

      const nearestHorizontal = horizontalSnapPoints.reduce((closest, value) =>
        Math.abs(value - clamped.left) < Math.abs(closest - clamped.left)
          ? value
          : closest,
      );

      return {
        left:
          Math.abs(nearestHorizontal - clamped.left) <=
          TOOLBAR_SNAP_THRESHOLD_PX
            ? nearestHorizontal
            : clamped.left,
        bottom:
          Math.abs(DEFAULT_TOOLBAR_OFFSET.bottom - clamped.bottom) <=
          TOOLBAR_SNAP_THRESHOLD_PX
            ? DEFAULT_TOOLBAR_OFFSET.bottom
            : clamped.bottom,
      };
    },
    [clampToolbarOffset, toolbarRef],
  );

  const resolveCenteredToolbarOffset = useCallback((): ToolbarOffset | null => {
    const root = rootRef.current;
    const toolbar = toolbarRef.current;
    if (!root || !toolbar) return null;
    return clampToolbarOffset({
      left: Math.round((root.clientWidth - toolbar.offsetWidth) / 2),
      bottom: DEFAULT_TOOLBAR_OFFSET.bottom,
    });
  }, [clampToolbarOffset, toolbarRef]);

  useEffect(() => {
    const clampCurrentOffset = () => {
      if (!initializedPositionRef.current) {
        const centered = resolveCenteredToolbarOffset();
        if (centered) {
          initializedPositionRef.current = true;
          setToolbarOffset(centered);
          return;
        }
      }
      setToolbarOffset((current) => clampToolbarOffset(current));
    };
    clampCurrentOffset();
    window.addEventListener("resize", clampCurrentOffset);
    return () => window.removeEventListener("resize", clampCurrentOffset);
  }, [clampToolbarOffset, resolveCenteredToolbarOffset]);

  useEffect(() => {
    if (!dragging) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      setToolbarOffset(
        clampToolbarOffset({
          left: drag.left + dx,
          bottom: drag.bottom - dy,
        }),
      );
    };

    const stopDragging = () => {
      dragRef.current = null;
      setToolbarOffset((current) => snapToolbarOffset(current));
      setDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", stopDragging, true);
    window.addEventListener("pointercancel", stopDragging, true);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", stopDragging, true);
      window.removeEventListener("pointercancel", stopDragging, true);
    };
  }, [clampToolbarOffset, dragging, snapToolbarOffset]);

  const onDragHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        left: toolbarOffset.left,
        bottom: toolbarOffset.bottom,
      };
      setDragging(true);
    },
    [toolbarOffset.bottom, toolbarOffset.left],
  );

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[80]"
    >
      <div
        ref={zoomRef}
        className="pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] right-3 sm:right-4"
        data-avnac-chrome
      >
        <div className="flex flex-col items-end gap-2">
          {ready ? (
            <button
              type="button"
              className={[
                focusButtonClass,
                focusMode ? "bg-neutral-100 text-neutral-900" : "",
              ].join(" ")}
              onClick={onToggleFocusMode}
              title={
                focusMode
                  ? "Exit full-screen focus mode"
                  : "Enter full-screen focus mode"
              }
              aria-label={
                focusMode
                  ? "Exit full-screen focus mode"
                  : "Enter full-screen focus mode"
              }
              aria-pressed={focusMode}
            >
              <HugeiconsIcon
                icon={focusMode ? Minimize01Icon : Maximize01Icon}
                size={15}
                strokeWidth={1.9}
              />
            </button>
          ) : null}
          {zoomControl}
        </div>
      </div>

      <div
        ref={toolbarRef}
        className={[
          dragging
            ? "pointer-events-auto absolute transition-opacity duration-150"
            : "pointer-events-auto absolute transition-[left,bottom,opacity] duration-150",
          focusMode ? "pointer-events-none opacity-0" : "",
          floatingSurfaceClass,
        ].join(" ")}
        style={{
          left: toolbarOffset.left,
          bottom: toolbarOffset.bottom,
        }}
        data-avnac-chrome
      >
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            type="button"
            className={[
              "flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-full text-neutral-500 transition-colors",
              "hover:bg-black/[0.06] hover:text-neutral-800 active:cursor-grabbing",
              dragging ? "bg-black/[0.05] text-neutral-700" : "",
            ].join(" ")}
            title="Move toolbar"
            aria-label="Move toolbar"
            onPointerDown={onDragHandlePointerDown}
            style={{ touchAction: "none" }}
          >
            <span className="grid grid-cols-2 gap-0.5">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="h-1 w-1 rounded-full bg-current" />
              ))}
            </span>
          </button>
          <div className="h-6 w-px shrink-0 bg-black/[0.06]" aria-hidden />
          <div
            className="flex items-center gap-1"
            role="toolbar"
            aria-label="Editor tools"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
