import type { AvnacDocumentV1 } from "./avnac-document";
import { renderAvnacDocumentFastPreviewDataUrl } from "./renderer/preview";

const previewCache = new Map<string, string>();
const PREVIEW_CACHE_MAX = 48;

function trimPreviewCache() {
  while (previewCache.size > PREVIEW_CACHE_MAX) {
    const first = previewCache.keys().next().value as string | undefined;
    if (first === undefined) break;
    previewCache.delete(first);
  }
}

export function avnacDocumentPreviewCacheKey(
  persistId: string,
  updatedAt: number,
): string {
  return `${persistId}:${updatedAt}`;
}

export function avnacDocumentPreviewEvictPersistId(persistId: string) {
  for (const k of [...previewCache.keys()]) {
    if (k.startsWith(`${persistId}:`)) previewCache.delete(k);
  }
}

export async function renderAvnacDocumentPreviewDataUrl(
  doc: AvnacDocumentV1,
  _persistId: string,
  options?: { maxCssPx?: number; cacheKey?: string },
): Promise<string | null> {
  const cacheKey = options?.cacheKey;
  if (cacheKey) {
    const hit = previewCache.get(cacheKey);
    if (hit) return hit;
  }

  try {
    const fastUrl = await renderAvnacDocumentFastPreviewDataUrl(doc, options);
    if (!fastUrl) return null;
    if (cacheKey) {
      previewCache.set(cacheKey, fastUrl);
      trimPreviewCache();
    }
    return fastUrl;
  } catch (err) {
    console.error("[avnac] document preview failed", err);
    return null;
  }
}
