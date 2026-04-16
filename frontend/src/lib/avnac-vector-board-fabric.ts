import type { Canvas, FabricObject, Group, Path } from 'fabric'
import { penAnchorsToFabricCommands } from './avnac-vector-pen-bezier'
import {
  flattenVisibleStrokes,
  type VectorBoardDocument,
  type VectorBoardStroke,
} from './avnac-vector-board-document'

const FABRIC_PATH_SCALE = 1000

type FabricMod = typeof import('fabric')

type WithVectorBoardId = FabricObject & { avnacVectorBoardId?: string }

export function detachAvnacVectorBoardLink(
  obj: FabricObject,
  mod: FabricMod,
): void {
  const w = obj as WithVectorBoardId
  if (typeof w.avnacVectorBoardId === 'string') {
    w.set({ avnacVectorBoardId: undefined } as Partial<FabricObject>)
  }
  if (mod.Group && obj instanceof mod.Group) {
    for (const c of obj.getObjects()) detachAvnacVectorBoardLink(c, mod)
  }
}

function strokeToPathCommands(
  stroke: VectorBoardStroke,
): Parameters<Path['_setPath']>[0] | null {
  const S = FABRIC_PATH_SCALE

  if (stroke.kind === 'pen') {
    if (stroke.penAnchors && stroke.penAnchors.length >= 2) {
      const cmds = penAnchorsToFabricCommands(stroke.penAnchors, S)
      if (!cmds) return null
      return cmds as unknown as Parameters<Path['_setPath']>[0]
    }
    if (stroke.points.length < 2) return null
    const [x0, y0] = stroke.points[0]!
    const cmds: [string, ...number[]][] = [['M', x0 * S, y0 * S]]
    for (let i = 1; i < stroke.points.length; i++) {
      const [x, y] = stroke.points[i]!
      cmds.push(['L', x * S, y * S])
    }
    return cmds as unknown as Parameters<Path['_setPath']>[0]
  }

  if (stroke.kind === 'polygon') {
    if (stroke.points.length < 2) return null
    const [x0, y0] = stroke.points[0]!
    const cmds: [string, ...number[]][] = [['M', x0 * S, y0 * S]]
    for (let i = 1; i < stroke.points.length; i++) {
      const [x, y] = stroke.points[i]!
      cmds.push(['L', x * S, y * S])
    }
    if (stroke.points.length >= 3) {
      cmds.push(['Z'])
    }
    return cmds as unknown as Parameters<Path['_setPath']>[0]
  }

  if (
    stroke.kind === 'line' ||
    stroke.kind === 'rect' ||
    stroke.kind === 'ellipse' ||
    stroke.kind === 'arrow'
  ) {
    if (stroke.points.length < 2) return null
    const [ax, ay] = stroke.points[0]!
    const [bx, by] = stroke.points[1]!

    if (stroke.kind === 'line') {
      return [
        ['M', ax * S, ay * S],
        ['L', bx * S, by * S],
      ] as unknown as Parameters<Path['_setPath']>[0]
    }

    if (stroke.kind === 'rect') {
      const minX = Math.min(ax, bx) * S
      const maxX = Math.max(ax, bx) * S
      const minY = Math.min(ay, by) * S
      const maxY = Math.max(ay, by) * S
      return [
        ['M', minX, minY],
        ['L', maxX, minY],
        ['L', maxX, maxY],
        ['L', minX, maxY],
        ['Z'],
      ] as unknown as Parameters<Path['_setPath']>[0]
    }

    if (stroke.kind === 'ellipse') {
      const minX = Math.min(ax, bx)
      const maxX = Math.max(ax, bx)
      const minY = Math.min(ay, by)
      const maxY = Math.max(ay, by)
      const cx = ((minX + maxX) / 2) * S
      const cy = ((minY + maxY) / 2) * S
      const rx = ((maxX - minX) / 2) * S
      const ry = ((maxY - minY) / 2) * S
      if (rx < 0.5 || ry < 0.5) return null
      const segs = 48
      const cmds: [string, ...number[]][] = []
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * Math.PI * 2
        const x = cx + rx * Math.cos(t)
        const y = cy + ry * Math.sin(t)
        cmds.push(i === 0 ? ['M', x, y] : ['L', x, y])
      }
      cmds.push(['Z'])
      return cmds as unknown as Parameters<Path['_setPath']>[0]
    }

    if (stroke.kind === 'arrow') {
      const x0 = ax * S
      const y0 = ay * S
      const x1 = bx * S
      const y1 = by * S
      let dx = x1 - x0
      let dy = y1 - y0
      const len = Math.hypot(dx, dy)
      if (len < 1) return null
      dx /= len
      dy /= len
      const sw = stroke.strokeWidthN * FABRIC_PATH_SCALE
      const head = Math.min(len * 0.35, Math.max(12, sw * 4))
      const wing = head * 0.45
      const bx0 = x1 - dx * head
      const by0 = y1 - dy * head
      const px = -dy
      const py = dx
      const l1x = bx0 + px * wing
      const l1y = by0 + py * wing
      const l2x = bx0 - px * wing
      const l2y = by0 - py * wing
      return [
        ['M', x0, y0],
        ['L', bx0, by0],
        ['M', x1, y1],
        ['L', l1x, l1y],
        ['M', x1, y1],
        ['L', l2x, l2y],
      ] as unknown as Parameters<Path['_setPath']>[0]
    }
  }

  return null
}

function buildStrokePaths(mod: FabricMod, doc: VectorBoardDocument): Path[] {
  const out: Path[] = []
  for (const s of flattenVisibleStrokes(doc)) {
    const cmds = strokeToPathCommands(s)
    if (!cmds) continue
    const hasStroke = Boolean(s.stroke) && s.stroke !== 'transparent'
    const sw = hasStroke
      ? Math.max(0.75, s.strokeWidthN * FABRIC_PATH_SCALE)
      : 0
    const fill =
      s.fill && s.fill.length > 0 && s.fill !== 'transparent'
        ? s.fill
        : ''
    const p = new mod.Path(cmds, {
      fill,
      stroke: hasStroke ? s.stroke : undefined,
      strokeWidth: sw,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    })
    out.push(p)
  }
  return out
}

export function createVectorBoardFabricGroup(
  mod: FabricMod,
  doc: VectorBoardDocument,
  boardId: string,
): Group {
  const paths = buildStrokePaths(mod, doc)
  const g = new mod.Group(paths, {
    subTargetCheck: false,
    interactive: true,
  })
  ;(g as WithVectorBoardId).set({ avnacVectorBoardId: boardId } as object)
  return g
}

export function updateVectorBoardFabricGroup(
  group: Group,
  mod: FabricMod,
  doc: VectorBoardDocument,
): void {
  const paths = buildStrokePaths(mod, doc)
  const prev = group.getObjects()
  if (prev.length) group.remove(...prev)
  if (paths.length) group.add(...paths)
  group.set('dirty', true)
  group.setCoords()
}

export function syncVectorBoardInstancesToDoc(
  canvas: Canvas,
  mod: FabricMod,
  boardId: string,
  doc: VectorBoardDocument,
): void {
  for (const o of canvas.getObjects()) {
    if (!(o instanceof mod.Group)) continue
    const id = (o as WithVectorBoardId).avnacVectorBoardId
    if (id !== boardId) continue
    updateVectorBoardFabricGroup(o, mod, doc)
    o.setCoords()
  }
}

export function refreshAllVectorBoardInstances(
  canvas: Canvas,
  mod: FabricMod,
  docs: Record<string, VectorBoardDocument>,
): void {
  for (const o of canvas.getObjects()) {
    if (!(o instanceof mod.Group)) continue
    const id = (o as WithVectorBoardId).avnacVectorBoardId
    if (!id || typeof id !== 'string') continue
    const doc = docs[id]
    if (!doc) continue
    updateVectorBoardFabricGroup(o, mod, doc)
    o.setCoords()
  }
  canvas.requestRenderAll()
}
