import type { Canvas, FabricObject, Group } from 'fabric'

const PATCH_KEY = '__avnacObjectCanvasBlurInstalled__'

/** Same scale previously used for FabricImage `filters.Blur` (0–1 → UI %). */
const LEGACY_IMAGE_BLUR_UI_MAX = 0.35

/** At 100% slider, CSS blur() radius in px (canvas filter). */
const MAX_CSS_BLUR_PX = 500

function blurPxFromObject(
  obj: FabricObject & { avnacBlur?: number },
  forClipping: boolean | undefined,
): number {
  if (forClipping) return 0
  const pct = obj.avnacBlur
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0) return 0
  return (Math.min(100, Math.max(0, pct)) / 100) * MAX_CSS_BLUR_PX
}

function objectOrDescendantHasBlur(
  o: FabricObject,
  mod: typeof import('fabric'),
): boolean {
  if (blurPxFromObject(o as FabricObject & { avnacBlur?: number }, false) > 0) {
    return true
  }
  if (mod.Group && o instanceof mod.Group) {
    for (const child of o.getObjects()) {
      if (objectOrDescendantHasBlur(child, mod)) return true
    }
  }
  return false
}

/**
 * CSS filter blur draws outside object bounds; Fabric's bitmap cache clips it to a box.
 * Skip caching for blurred objects (and groups that contain blurred descendants) so we
 * paint on the real canvas context instead.
 */
function patchFabricObjectShouldCache(mod: typeof import('fabric')): void {
  const proto = mod.FabricObject.prototype as FabricObject & {
    shouldCache: () => boolean
  }
  const orig = proto.shouldCache
  proto.shouldCache = function (this: FabricObject & { avnacBlur?: number }) {
    if (blurPxFromObject(this, false) > 0) {
      this.ownCaching = false
      return false
    }
    return orig.call(this)
  }
}

function patchGroupShouldCache(mod: typeof import('fabric')): void {
  const proto = mod.Group.prototype as Group & { shouldCache: () => boolean }
  const orig = proto.shouldCache
  proto.shouldCache = function (this: Group) {
    const ownCache = mod.FabricObject.prototype.shouldCache.call(this)
    if (ownCache) {
      for (const child of this.getObjects()) {
        if (objectOrDescendantHasBlur(child, mod)) {
          this.ownCaching = false
          return false
        }
      }
    }
    return orig.call(this)
  }
}

function patchDrawObject(
  proto: { drawObject: FabricObject['drawObject'] },
): void {
  const orig = proto.drawObject
  proto.drawObject = function (
    this: FabricObject & { avnacBlur?: number },
    ctx: CanvasRenderingContext2D,
    forClipping: boolean | undefined,
    context: Parameters<FabricObject['drawObject']>[2],
  ) {
    const px = blurPxFromObject(this, forClipping)
    if (px <= 0) {
      return orig.call(this, ctx, forClipping, context)
    }
    const prev = ctx.filter
    ctx.filter = `blur(${px}px)`
    try {
      return orig.call(this, ctx, forClipping, context)
    } finally {
      ctx.filter = prev
    }
  }
}

export function installAvnacObjectCanvasBlur(
  mod: typeof import('fabric'),
): void {
  try {
    const bag = mod as typeof mod & { [PATCH_KEY]?: boolean }
    if (bag[PATCH_KEY]) return

    const FO = mod.FabricObject
    const cacheProps = FO?.cacheProperties
    if (Array.isArray(cacheProps) && !cacheProps.includes('avnacBlur')) {
      // Fabric 6 can expose this as a readonly static; mutate defensively.
      try {
        cacheProps.push('avnacBlur')
      } catch {
        /* best-effort */
      }
    }

    patchFabricObjectShouldCache(mod)
    if (mod.Group && typeof mod.Group.prototype?.shouldCache === 'function') {
      patchGroupShouldCache(mod)
    }

    if (typeof FO?.prototype?.drawObject === 'function') {
      patchDrawObject(FO.prototype)
    }
    if (
      mod.Group &&
      typeof mod.Group.prototype?.drawObject === 'function'
    ) {
      patchDrawObject(mod.Group.prototype)
    }

    bag[PATCH_KEY] = true
  } catch (err) {
    console.error('[avnac] installAvnacObjectCanvasBlur failed', err)
  }
}

export function readBlurPctFromFabricObject(obj: FabricObject): number {
  const v = (obj as FabricObject & { avnacBlur?: number }).avnacBlur
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.round(Math.max(0, Math.min(100, v)))
    : 0
}

function walkObjects(
  objs: FabricObject[],
  mod: typeof import('fabric'),
  visit: (o: FabricObject) => void,
): void {
  for (const o of objs) {
    visit(o)
    if (mod.Group && o instanceof mod.Group) {
      walkObjects(o.getObjects(), mod, visit)
    }
  }
}

/** Moves old FabricImage `filters.Blur` into `avnacBlur` and removes the filter. */
export function migrateLegacyImageBlurFilters(
  canvas: Canvas,
  mod: typeof import('fabric'),
): void {
  const BlurClass = mod.filters?.Blur
  if (!BlurClass) return
  walkObjects(canvas.getObjects(), mod, (o) => {
    if (!(mod.FabricImage && o instanceof mod.FabricImage)) return
    const img = o
    const filters = img.filters || []
    const idx = filters.findIndex(
      (f) =>
        f != null &&
        (f instanceof BlurClass ||
          (typeof f === 'object' &&
            'type' in f &&
            (f as { type: string }).type === 'Blur')),
    )
    if (idx < 0) return
    const f = filters[idx]!
    const raw =
      f instanceof BlurClass
        ? f.blur
        : Math.max(0, Math.min(1, (f as { blur?: number }).blur ?? 0))
    const pct = Math.round(
      Math.max(0, Math.min(100, (raw / LEGACY_IMAGE_BLUR_UI_MAX) * 100)),
    )
    const next = [...filters]
    next.splice(idx, 1)
    img.filters = next
    img.applyFilters()
    img.set({ avnacBlur: pct })
    img.set('dirty', true)
  })
}
