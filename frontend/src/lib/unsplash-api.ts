import { Photos, Search, Download } from '../../wailsjs/go/avnacserver/UnsplashService'

/** Max width or height when placing a photo on the canvas (keeps inserts view-sized). */
export const UNSPLASH_PLACE_MAX_EDGE_PX = 800

export function scaleUnsplashToPlaceBox(
  width: number,
  height: number,
  maxEdge = UNSPLASH_PLACE_MAX_EDGE_PX,
) {
  const s = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.round(width * s),
    height: Math.round(height * s),
  }
}

export type UnsplashPhoto = {
  id: string
  width: number
  height: number
  description: string | null
  alt_description: string | null
  urls: {
    small: string
    regular: string
    full: string
  }
  links: {
    download_location: string
    html: string
  }
  user: {
    name: string
    links: { html: string }
  }
}

export async function fetchUnsplashPopular(
  page: number,
  perPage = 20,
): Promise<{ photos: UnsplashPhoto[]; hasMore: boolean; error?: string }> {
  try {
    const result = await Photos(page, perPage)
    return { photos: result.photos as UnsplashPhoto[], hasMore: result.hasMore }
  } catch (err) {
    return { photos: [], hasMore: false, error: String(err) }
  }
}

export async function fetchUnsplashSearch(
  query: string,
  page: number,
  perPage = 20,
): Promise<{ photos: UnsplashPhoto[]; hasMore: boolean; error?: string }> {
  const q = query.trim()
  if (!q) return { photos: [], hasMore: false }
  try {
    const result = await Search(q, page, perPage)
    return { photos: result.photos as UnsplashPhoto[], hasMore: result.hasMore }
  } catch (err) {
    return { photos: [], hasMore: false, error: String(err) }
  }
}

export async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  await Download(downloadLocation)
}
