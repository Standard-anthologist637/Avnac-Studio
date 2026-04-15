import type { FabricImage, FabricObject } from 'fabric'

export function sceneCornerRadiusFromRect(obj: FabricObject): number {
  const r = (obj as FabricObject & { rx?: number }).rx || 0
  const s = Math.min(Math.abs(obj.scaleX || 1), Math.abs(obj.scaleY || 1))
  return r * s
}

export function sceneCornerRadiusMaxForObject(obj: FabricObject): number {
  return Math.min(obj.getScaledWidth(), obj.getScaledHeight()) / 2
}

export function setSceneCornerRadiusOnRect(
  rect: FabricObject,
  sceneR: number,
): void {
  const max = sceneCornerRadiusMaxForObject(rect)
  const R = Math.max(0, Math.min(sceneR, max))
  const s = Math.min(Math.abs(rect.scaleX || 1), Math.abs(rect.scaleY || 1))
  const r = s > 0 ? R / s : 0
  rect.set({ rx: r, ry: r } as Partial<FabricObject>)
  rect.setCoords()
}

export function sceneCornerRadiusFromImage(
  img: FabricImage,
  RectClass: typeof import('fabric').Rect,
): number {
  const cp = img.clipPath
  if (!cp || !(cp instanceof RectClass)) return 0
  const s = Math.min(Math.abs(img.scaleX || 1), Math.abs(img.scaleY || 1))
  return ((cp as FabricObject & { rx?: number }).rx || 0) * s
}

export function setSceneCornerRadiusOnImage(
  img: FabricImage,
  sceneR: number,
  mod: typeof import('fabric'),
): void {
  const max = sceneCornerRadiusMaxForObject(img)
  const R = Math.max(0, Math.min(sceneR, max))
  const w = img.width || 0
  const h = img.height || 0
  if (w <= 0 || h <= 0) return

  if (R <= 0.5) {
    img.set({ clipPath: undefined })
  } else {
    const s = Math.min(Math.abs(img.scaleX || 1), Math.abs(img.scaleY || 1))
    const localR = s > 0 ? R / s : 0
    const cap = Math.min(w, h) / 2
    const rx = Math.min(localR, cap)
    const clip = new mod.Rect({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      width: w,
      height: h,
      rx,
      ry: rx,
      absolutePositioned: false,
    })
    img.set({ clipPath: clip })
  }
  img.setCoords()
}
