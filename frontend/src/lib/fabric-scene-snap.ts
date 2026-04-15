import type { Canvas, FabricObject } from 'fabric'
import { Point } from 'fabric'

export type SceneSnapGuide = { axis: 'v' | 'h'; pos: number }

type Options = {
  width: number
  height: number
  threshold?: number
  fabricMod: typeof import('fabric')
  onGuidesChange?: (guides: SceneSnapGuide[]) => void
}

function collectTargets(
  canvas: Canvas,
  moving: FabricObject,
  fabricMod: typeof import('fabric'),
): FabricObject[] {
  return canvas.getObjects().filter((o) => {
    if (o === moving) return false
    if (
      fabricMod.ActiveSelection &&
      moving instanceof fabricMod.ActiveSelection
    ) {
      return !moving.getObjects().includes(o)
    }
    return true
  })
}

function snapMovingObject(
  moving: FabricObject,
  canvas: Canvas,
  fabricMod: typeof import('fabric'),
  width: number,
  height: number,
  threshold: number,
): SceneSnapGuide[] {
  const guides: SceneSnapGuide[] = []
  const midX = width / 2
  const midY = height / 2
  const c = moving.getCenterPoint()
  const br = moving.getBoundingRect()
  const left = br.left
  const right = br.left + br.width
  const top = br.top
  const bottom = br.top + br.height
  const cx = left + br.width / 2
  const cy = top + br.height / 2

  const targets = collectTargets(canvas, moving, fabricMod)

  let bestDx = 0
  let bestXScore = threshold + 1
  let guideX: number | undefined

  const tryX = (myX: number, theirX: number, gLine: number) => {
    const d = theirX - myX
    const ad = Math.abs(d)
    if (ad <= threshold && ad < bestXScore) {
      bestXScore = ad
      bestDx = d
      guideX = gLine
    }
  }

  for (const o of targets) {
    const b = o.getBoundingRect()
    const ox = b.left
    const oc = b.left + b.width / 2
    const or = b.left + b.width
    for (const mx of [left, cx, right]) {
      for (const tx of [ox, oc, or]) {
        tryX(mx, tx, tx)
      }
    }
  }

  if (Math.abs(cx - midX) <= threshold && Math.abs(cx - midX) < bestXScore) {
    bestDx = midX - cx
    bestXScore = Math.abs(bestDx)
    guideX = midX
  }

  let bestDy = 0
  let bestYScore = threshold + 1
  let guideY: number | undefined

  const tryY = (myY: number, theirY: number, gLine: number) => {
    const d = theirY - myY
    const ad = Math.abs(d)
    if (ad <= threshold && ad < bestYScore) {
      bestYScore = ad
      bestDy = d
      guideY = gLine
    }
  }

  for (const o of targets) {
    const b = o.getBoundingRect()
    const oy = b.top
    const oc = b.top + b.height / 2
    const ob = b.top + b.height
    for (const my of [top, cy, bottom]) {
      for (const ty of [oy, oc, ob]) {
        tryY(my, ty, ty)
      }
    }
  }

  if (Math.abs(cy - midY) <= threshold && Math.abs(cy - midY) < bestYScore) {
    bestDy = midY - cy
    bestYScore = Math.abs(bestDy)
    guideY = midY
  }

  if (bestXScore <= threshold) {
    moving.setPositionByOrigin(
      new Point(c.x + bestDx, c.y),
      'center',
      'center',
    )
    if (guideX !== undefined) guides.push({ axis: 'v', pos: guideX })
  }

  if (bestYScore <= threshold) {
    const c2 = moving.getCenterPoint()
    moving.setPositionByOrigin(
      new Point(c2.x, c2.y + bestDy),
      'center',
      'center',
    )
    if (guideY !== undefined) guides.push({ axis: 'h', pos: guideY })
  }

  return guides
}

export function installSceneSnap(
  canvas: Canvas,
  { width, height, threshold: thOpt, fabricMod, onGuidesChange }: Options,
) {
  const threshold =
    thOpt ?? Math.max(20, Math.round(Math.min(width, height) * 0.006))

  let lastGuides: SceneSnapGuide[] = []

  const setGuides = (g: SceneSnapGuide[]) => {
    const same =
      g.length === lastGuides.length &&
      g.every(
        (x, i) =>
          x.axis === lastGuides[i]?.axis && x.pos === lastGuides[i]?.pos,
      )
    if (same) return
    lastGuides = g
    onGuidesChange?.(g)
  }

  const onMoving = (opt: { target: FabricObject }) => {
    const g = snapMovingObject(
      opt.target,
      canvas,
      fabricMod,
      width,
      height,
      threshold,
    )
    setGuides(g)
    canvas.requestRenderAll()
  }

  const clearGuides = () => {
    setGuides([])
    canvas.requestRenderAll()
  }

  canvas.on('object:moving', onMoving)
  canvas.on('object:modified', clearGuides)
  canvas.on('selection:cleared', clearGuides)

  return () => {
    canvas.off('object:moving', onMoving)
    canvas.off('object:modified', clearGuides)
    canvas.off('selection:cleared', clearGuides)
    if (lastGuides.length) {
      lastGuides = []
      onGuidesChange?.([])
    }
  }
}
