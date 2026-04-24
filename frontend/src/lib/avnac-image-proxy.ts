import type { FabricImage } from 'fabric'
import { getPublicApiBase } from './public-api-base'

type CanvasLike = {
  getObjects: () => unknown[]
  requestRenderAll: () => void
}

function parseImageUrl(raw: string): URL | null {
  if (typeof window === 'undefined') return null
  try {
    return new URL(raw, window.location.href)
  } catch {
    return null
  }
}

function isProxyUrl(raw: string): boolean {
  const parsed = parseImageUrl(raw)
  if (!parsed) return false
  return parsed.pathname.endsWith('/media/proxy') && parsed.searchParams.has('url')
}

export function getExportSafeImageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const parsed = parseImageUrl(trimmed)
  if (!parsed) return trimmed
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return trimmed
  if (parsed.origin === window.location.origin || isProxyUrl(trimmed)) {
    return trimmed
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return trimmed
  return `${getPublicApiBase()}/media/proxy?url=${encodeURIComponent(parsed.toString())}`
}

export function getFabricImageLoadOptions(url: string): {
  crossOrigin?: 'anonymous'
} {
  const parsed = parseImageUrl(url)
  if (!parsed) return {}
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return {}
  return { crossOrigin: 'anonymous' }
}

export async function loadExportSafeFabricImage(
  mod: typeof import('fabric'),
  rawUrl: string,
): Promise<FabricImage> {
  const safeUrl = getExportSafeImageUrl(rawUrl)
  return mod.FabricImage.fromURL(safeUrl, getFabricImageLoadOptions(safeUrl))
}

export async function normalizeFabricImageForExport(
  img: FabricImage,
): Promise<boolean> {
  const rawUrl = img.getSrc()
  if (!rawUrl) return false
  const safeUrl = getExportSafeImageUrl(rawUrl)
  if (!safeUrl || safeUrl === rawUrl) return false
  await img.setSrc(safeUrl, getFabricImageLoadOptions(safeUrl))
  img.set('dirty', true)
  img.setCoords()
  return true
}

export async function normalizeCanvasImagesForExport(
  canvas: CanvasLike,
  mod: typeof import('fabric'),
): Promise<boolean> {
  if (!mod.FabricImage) return false
  const tasks: Array<Promise<boolean>> = []
  for (const obj of canvas.getObjects()) {
    if (!(obj instanceof mod.FabricImage)) continue
    tasks.push(normalizeFabricImageForExport(obj))
  }
  const changed = (await Promise.all(tasks)).some(Boolean)
  if (changed) canvas.requestRenderAll()
  return changed
}
