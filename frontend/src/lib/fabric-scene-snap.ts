import type { Canvas, FabricObject } from 'fabric'
import { Point } from 'fabric'

type TMat2D = [number, number, number, number, number, number]

export type SceneSnapGuide = { axis: 'v' | 'h'; pos: number }

type Options = {
  width: number
  height: number
  threshold?: number
  fabricMod: typeof import('fabric')
  /** CSS color used to paint guide lines on the canvas overlay. */
  guideColor?: string
}

const DEFAULT_GUIDE_COLOR = 'rgba(255, 88, 0, 0.95)'

/**
 * Movements smaller than this (canvas units) after a snap-correction are skipped.
 * Without this, sub-pixel "corrections" applied every mousemove cause visible jitter
 * because Fabric resets the position from the original mouse delta on each frame.
 */
export const SNAP_DEADBAND_PX = 0.25

/** Once a guide is engaged, the new candidate must beat it by this many px to switch. */
const SNAP_SWITCH_HYSTERESIS_PX = 1.5

/**
 * Multiplier applied to the engage threshold to compute the "release" threshold.
 * Once snapped to a line we stay snapped until the user drags this much past it,
 * eliminating the threshold-edge oscillation that caused the snap to flicker on
 * and off as the cursor crossed the engage boundary.
 */
const SNAP_RELEASE_MULTIPLIER = 1.6

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

type SnapResult = {
  guides: SceneSnapGuide[]
  /** Position correction in canvas units, relative to current bounding rect. */
  dx: number
  dy: number
}

function computeSnap(
  moving: FabricObject,
  canvas: Canvas,
  fabricMod: typeof import('fabric'),
  width: number,
  height: number,
  threshold: number,
  prevGuideX: number | null,
  prevGuideY: number | null,
): SnapResult {
  const midX = width / 2
  const midY = height / 2

  const br = moving.getBoundingRect()
  const left = br.left
  const right = br.left + br.width
  const top = br.top
  const bottom = br.top + br.height
  const cx = left + br.width / 2
  const cy = top + br.height / 2

  const targets = collectTargets(canvas, moving, fabricMod)

  let bestDx = 0
  let bestXScore = Infinity
  let guideX: number | null = null
  const releaseThresholdX = threshold * SNAP_RELEASE_MULTIPLIER

  const tryX = (myX: number, theirX: number) => {
    const d = theirX - myX
    const ad = Math.abs(d)
    const sticky = prevGuideX !== null && Math.abs(theirX - prevGuideX) < 0.5
    const limit = sticky ? releaseThresholdX : threshold
    if (ad > limit) return
    const score = ad - (sticky ? SNAP_SWITCH_HYSTERESIS_PX : 0)
    if (score < bestXScore) {
      bestXScore = score
      bestDx = d
      guideX = theirX
    }
  }

  for (const o of targets) {
    const b = o.getBoundingRect()
    const ox = b.left
    const oc = b.left + b.width / 2
    const or = b.left + b.width
    for (const tx of [ox, oc, or]) {
      tryX(left, tx)
      tryX(cx, tx)
      tryX(right, tx)
    }
  }
  tryX(cx, midX)

  let bestDy = 0
  let bestYScore = Infinity
  let guideY: number | null = null
  const releaseThresholdY = threshold * SNAP_RELEASE_MULTIPLIER

  const tryY = (myY: number, theirY: number) => {
    const d = theirY - myY
    const ad = Math.abs(d)
    const sticky = prevGuideY !== null && Math.abs(theirY - prevGuideY) < 0.5
    const limit = sticky ? releaseThresholdY : threshold
    if (ad > limit) return
    const score = ad - (sticky ? SNAP_SWITCH_HYSTERESIS_PX : 0)
    if (score < bestYScore) {
      bestYScore = score
      bestDy = d
      guideY = theirY
    }
  }

  for (const o of targets) {
    const b = o.getBoundingRect()
    const oy = b.top
    const oc = b.top + b.height / 2
    const ob = b.top + b.height
    for (const ty of [oy, oc, ob]) {
      tryY(top, ty)
      tryY(cy, ty)
      tryY(bottom, ty)
    }
  }
  tryY(cy, midY)

  const guides: SceneSnapGuide[] = []
  if (guideX !== null) guides.push({ axis: 'v', pos: guideX })
  if (guideY !== null) guides.push({ axis: 'h', pos: guideY })

  return { guides, dx: bestDx, dy: bestDy }
}

function drawGuidesOnOverlay(
  canvas: Canvas,
  guides: SceneSnapGuide[],
  artboardW: number,
  artboardH: number,
  color: string,
) {
  if (guides.length === 0) return
  const ctx = canvas.getSelectionContext()
  const vpt = canvas.viewportTransform as TMat2D | undefined
  if (!ctx || !vpt) return
  const zoom = Math.max(Math.abs(vpt[0]), Math.abs(vpt[3]), 1e-6)
  const lineWidth = 1 / zoom

  ctx.save()
  ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = color
  ctx.beginPath()
  for (const g of guides) {
    if (g.axis === 'v') {
      ctx.moveTo(g.pos, 0)
      ctx.lineTo(g.pos, artboardH)
    } else {
      ctx.moveTo(0, g.pos)
      ctx.lineTo(artboardW, g.pos)
    }
  }
  ctx.stroke()
  ctx.restore()
}

export function installSceneSnap(
  canvas: Canvas,
  { width, height, threshold: thOpt, fabricMod, guideColor }: Options,
) {
  const threshold =
    thOpt ?? Math.max(8, Math.round(Math.min(width, height) * 0.0025))
  const color = guideColor ?? DEFAULT_GUIDE_COLOR

  let activeGuides: SceneSnapGuide[] = []
  let lastGuideX: number | null = null
  let lastGuideY: number | null = null

  const onMoving = (opt: { target: FabricObject }) => {
    const target = opt.target
    const { guides, dx, dy } = computeSnap(
      target,
      canvas,
      fabricMod,
      width,
      height,
      threshold,
      lastGuideX,
      lastGuideY,
    )

    const needsShift = dx !== 0 || dy !== 0
    if (needsShift) {
      const c = target.getCenterPoint()
      target.setPositionByOrigin(
        new Point(c.x + dx, c.y + dy),
        'center',
        'center',
      )
      target.setCoords()
    }

    activeGuides = guides
    lastGuideX = guides.find((g) => g.axis === 'v')?.pos ?? null
    lastGuideY = guides.find((g) => g.axis === 'h')?.pos ?? null
  }

  const clearGuides = () => {
    if (activeGuides.length === 0 && lastGuideX === null && lastGuideY === null) {
      return
    }
    activeGuides = []
    lastGuideX = null
    lastGuideY = null
    canvas.requestRenderAll()
  }

  const beforeRender = () => {
    // Ensure the overlay starts clean each render so stale guides never linger
    // when fabric does not otherwise re-paint the upper canvas (e.g. on release).
    const topCtx = canvas.contextTop
    if (!topCtx) return
    canvas.clearContext(topCtx)
  }

  const afterRender = () => {
    drawGuidesOnOverlay(canvas, activeGuides, width, height, color)
  }

  canvas.on('object:moving', onMoving)
  canvas.on('object:modified', clearGuides)
  canvas.on('selection:cleared', clearGuides)
  canvas.on('mouse:up', clearGuides)
  canvas.on('before:render', beforeRender)
  canvas.on('after:render', afterRender)

  return () => {
    canvas.off('object:moving', onMoving)
    canvas.off('object:modified', clearGuides)
    canvas.off('selection:cleared', clearGuides)
    canvas.off('mouse:up', clearGuides)
    canvas.off('before:render', beforeRender)
    canvas.off('after:render', afterRender)
    activeGuides = []
    lastGuideX = null
    lastGuideY = null
    canvas.requestRenderAll()
  }
}
