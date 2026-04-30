import type { AvnacDocumentV1 } from "../../avnac-document";
import { canvas2DRendererBackend } from "../../renderer";
import { fromAvnacDocument } from "../compat/from-fabric";
import type { SaraswatiScene } from "../scene";
import { buildRenderCommands } from "../render/commands";

export async function renderAvnacDocumentFastPreviewDataUrl(
  doc: AvnacDocumentV1,
  options?: { maxCssPx?: number },
): Promise<string | null> {
  const result = fromAvnacDocument(doc);
  if (!result.fullySupported) return null;
  return renderSaraswatiScenePreviewDataUrl(result.scene, options);
}

export async function renderSaraswatiScenePreviewDataUrl(
  scene: SaraswatiScene,
  options?: { maxCssPx?: number },
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const aw = scene.artboard.width;
  const ah = scene.artboard.height;
  if (!Number.isFinite(aw) || !Number.isFinite(ah) || aw < 1 || ah < 1) {
    return null;
  }

  const maxCssPx = options?.maxCssPx ?? 400;
  const maxEdge = Math.max(aw, ah);
  const scale = maxEdge > 0 ? Math.min(1, maxCssPx / maxEdge) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(aw * scale));
  canvas.height = Math.max(1, Math.round(ah * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.save();
  ctx.scale(scale, scale);
  await canvas2DRendererBackend.render(ctx, buildRenderCommands(scene));
  ctx.restore();

  return canvas.toDataURL("image/png");
}
