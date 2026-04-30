import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import type { RendererBackend } from "@/lib/renderer";
import { fromAvnacDocument } from "@/lib/saraswati";
import { useMemo } from "react";
import SceneWorkspaceStage from "./stage";
import type { SceneWorkspacePreviewMode } from "./store";

type Props = {
  mode: SceneWorkspacePreviewMode;
  document: AvnacDocumentV1 | null;
  backend?: RendererBackend<CanvasRenderingContext2D>;
};

export default function SceneWorkspace({ mode, document, backend }: Props) {
  const adapterResult = useMemo(() => {
    if (!document || mode === "off") return null;
    return fromAvnacDocument(document);
  }, [document, mode]);

  if (mode === "off" || !adapterResult) return null;

  const { scene, issues } = adapterResult;
  const maxPreviewEdge = mode === "split" ? 300 : 560;
  const maxSceneEdge = Math.max(scene.artboard.width, scene.artboard.height, 1);
  const scale = Math.min(1, maxPreviewEdge / maxSceneEdge);
  const scaledWidth = Math.max(1, Math.round(scene.artboard.width * scale));
  const scaledHeight = Math.max(1, Math.round(scene.artboard.height * scale));

  return (
    <div
      className={
        mode === "split"
          ? "pointer-events-none absolute right-4 top-4 z-[35] w-[min(24rem,calc(100%-2rem))]"
          : "pointer-events-none absolute inset-4 z-[35] flex items-center justify-center"
      }
    >
      <div className="max-w-full overflow-hidden rounded-[1.4rem] border border-black/[0.08] bg-white/92 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Saraswati
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              {mode === "split" ? "Split preview" : "Renderer preview"}
            </div>
          </div>
          <span className="rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-neutral-700">
            Read-only
          </span>
        </div>

        <div className="overflow-auto rounded-[1.1rem] bg-neutral-100/70 p-2">
          <div style={{ width: scaledWidth, height: scaledHeight }}>
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <SceneWorkspaceStage scene={scene} backend={backend} />
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs text-neutral-600">
          {issues.length > 0
            ? `Partial render: ${issues.length} legacy Fabric item${issues.length === 1 ? "" : "s"} still need porting.`
            : "RenderCommands are being interpreted by the selected renderer backend instead of Fabric."}
        </p>
      </div>
    </div>
  );
}
