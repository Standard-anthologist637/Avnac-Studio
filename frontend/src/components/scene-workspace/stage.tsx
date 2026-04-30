import type { RendererBackend } from "@/lib/renderer";
import { canvas2DRendererBackend } from "@/lib/renderer";
import { buildRenderCommands, type SaraswatiScene } from "@/lib/saraswati";
import { useEffect, useRef } from "react";

type Props = {
  scene: SaraswatiScene;
  backend?: RendererBackend<CanvasRenderingContext2D>;
  className?: string;
};

export default function SceneWorkspaceStage({
  scene,
  backend = canvas2DRendererBackend,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return (
    <div
      className={[
        "inline-flex overflow-hidden rounded-[1.25rem] border border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
