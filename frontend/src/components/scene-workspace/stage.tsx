import type { RendererBackend } from "@/lib/renderer";
import { canvas2DRendererBackend } from "@/lib/renderer";
import {
  buildRenderCommands,
  isSaraswatiRenderableNode,
  type SaraswatiScene,
} from "@/lib/saraswati";
import type { SaraswatiResizeHandle } from "@/lib/saraswati/commands/types";
import type { SaraswatiBounds } from "@/lib/saraswati/spatial";
import { getNodeBounds } from "@/lib/saraswati/spatial";
import { useEffect, useMemo, useRef } from "react";

type Props = {
  scene: SaraswatiScene;
  backend?: RendererBackend<CanvasRenderingContext2D>;
  className?: string;
  interactive?: boolean;
  selectedIds?: readonly string[];
  onScenePointerDown?: (pointerId: number, x: number, y: number) => void;
  onScenePointerMove?: (pointerId: number, x: number, y: number) => void;
  onScenePointerUp?: (pointerId: number) => void;
  onHandlePointerDown?: (
    pointerId: number,
    nodeId: string,
    handle: SaraswatiResizeHandle,
    startBounds: SaraswatiBounds,
    x: number,
    y: number,
  ) => void;
};

// Handle positions: {id, cx, cy} as fractions of the bounding box (0=left/top, 1=right/bottom)
const HANDLES: {
  id: SaraswatiResizeHandle;
  cx: number;
  cy: number;
  cursor: string;
}[] = [
  { id: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
  { id: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
  { id: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
  { id: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
  { id: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
  { id: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
  { id: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
  { id: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
];

export default function SceneWorkspaceStage({
  scene,
  backend = canvas2DRendererBackend,
  className,
  interactive = false,
  selectedIds = [],
  onScenePointerDown,
  onScenePointerMove,
  onScenePointerUp,
  onHandlePointerDown,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedBounds = useMemo(() => {
    const result: { id: string; bounds: SaraswatiBounds }[] = [];
    for (const id of selectedIds) {
      const node = scene.nodes[id];
      if (!node || !isSaraswatiRenderableNode(node)) continue;
      result.push({ id, bounds: getNodeBounds(node) });
    }
    return result;
  }, [scene, selectedIds]);

  const toScenePoint = useMemo(() => {
    return (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * scene.artboard.width,
        y: ((clientY - rect.top) / rect.height) * scene.artboard.height,
      };
    };
  }, [scene.artboard.height, scene.artboard.width]);

  useEffect(() => {
    let cancelled = false;

    async function paint() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(scene.artboard.width * dpr));
      canvas.height = Math.max(1, Math.round(scene.artboard.height * dpr));
      canvas.style.width = `${scene.artboard.width}px`;
      canvas.style.height = `${scene.artboard.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, scene.artboard.width, scene.artboard.height);
      await backend.render(ctx, buildRenderCommands(scene));

      if (cancelled) return;
    }

    void paint();

    return () => {
      cancelled = true;
    };
  }, [backend, scene]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const point = toScenePoint(event.clientX, event.clientY);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onScenePointerDown?.(event.pointerId, point.x, point.y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const point = toScenePoint(event.clientX, event.clientY);
    if (!point) return;
    onScenePointerMove?.(event.pointerId, point.x, point.y);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onScenePointerUp?.(event.pointerId);
  };

  return (
    <div
      className={[
        "relative inline-flex overflow-hidden rounded-[1.25rem] border border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerUp : undefined}
        onPointerCancel={interactive ? handlePointerUp : undefined}
        className={
          interactive ? "cursor-grab active:cursor-grabbing" : undefined
        }
      />
      {selectedBounds.map(({ id: nodeId, bounds }) => (
        <div
          key={nodeId}
          className="pointer-events-none absolute rounded-md border-2 border-sky-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
          style={{
            left: `${bounds.x}px`,
            top: `${bounds.y}px`,
            width: `${Math.max(1, bounds.width)}px`,
            height: `${Math.max(1, bounds.height)}px`,
          }}
        >
          {interactive &&
            HANDLES.map(({ id: handle, cx, cy, cursor }) => (
              <div
                key={handle}
                className="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-sky-600 bg-white shadow-sm active:bg-sky-100"
                style={{
                  left: `${cx * 100}%`,
                  top: `${cy * 100}%`,
                  cursor,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const point = toScenePoint(e.clientX, e.clientY);
                  if (!point) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onHandlePointerDown?.(
                    e.pointerId,
                    nodeId,
                    handle,
                    bounds,
                    point.x,
                    point.y,
                  );
                }}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
