import type { FabricObject, Shadow } from 'fabric'

export type FabricShadowUi = {
  blur: number
  offsetX: number
  offsetY: number
  colorHex: string
  opacityPct: number
}

export const DEFAULT_FABRIC_SHADOW_UI: FabricShadowUi = {
  blur: 14,
  offsetX: 6,
  offsetY: 6,
  colorHex: '#000000',
  opacityPct: 35,
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function fabricShadowColorString(ui: FabricShadowUi): string {
  const { r, g, b } = hexToRgb(ui.colorHex)
  const a = Math.max(0, Math.min(100, Math.round(ui.opacityPct))) / 100
  return `rgba(${r},${g},${b},${a})`
}

function parseShadowColor(color: string): { hex: string; opacityPct: number } {
  const t = color.trim()
  const rgba =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      t,
    )
  if (rgba) {
    const r = Math.min(255, Math.max(0, Math.round(Number(rgba[1]))))
    const g = Math.min(255, Math.max(0, Math.round(Number(rgba[2]))))
    const b = Math.min(255, Math.max(0, Math.round(Number(rgba[3]))))
    const a =
      rgba[4] !== undefined
        ? Math.max(0, Math.min(1, Number(rgba[4])))
        : 1
    const hex = `#${[r, g, b]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')}`
    return { hex, opacityPct: Math.round(a * 100) }
  }
  if (/^#[0-9a-f]{6}$/i.test(t)) {
    return { hex: t.startsWith('#') ? t : `#${t}`, opacityPct: 100 }
  }
  return { hex: '#000000', opacityPct: 100 }
}

export function readFabricShadowUi(obj: FabricObject): FabricShadowUi | null {
  const sh = obj.shadow as Shadow | null | undefined
  if (!sh) return null
  const { hex, opacityPct } = parseShadowColor(
    typeof sh.color === 'string' ? sh.color : 'rgba(0,0,0,0.35)',
  )
  return {
    blur: Math.round(Number(sh.blur) || 0),
    offsetX: Math.round(Number(sh.offsetX) || 0),
    offsetY: Math.round(Number(sh.offsetY) || 0),
    colorHex: hex,
    opacityPct,
  }
}

export function buildFabricShadow(
  mod: typeof import('fabric'),
  ui: FabricShadowUi,
): InstanceType<typeof mod.Shadow> | null {
  const blur = Math.max(0, Math.min(80, Math.round(ui.blur)))
  const ox = Math.max(-80, Math.min(80, Math.round(ui.offsetX)))
  const oy = Math.max(-80, Math.min(80, Math.round(ui.offsetY)))
  const op = Math.max(0, Math.min(100, Math.round(ui.opacityPct)))
  if (blur === 0 && ox === 0 && oy === 0 && op === 0) return null
  return new mod.Shadow({
    color: fabricShadowColorString({ ...ui, blur, offsetX: ox, offsetY: oy, opacityPct: op }),
    blur,
    offsetX: ox,
    offsetY: oy,
  })
}

export function averageFabricShadowUi(
  objs: FabricObject[],
): FabricShadowUi {
  const rows = objs.map((o) => readFabricShadowUi(o)).filter(Boolean) as FabricShadowUi[]
  if (rows.length === 0) return { ...DEFAULT_FABRIC_SHADOW_UI }
  const blur = Math.round(
    rows.reduce((s, r) => s + r.blur, 0) / rows.length,
  )
  const offsetX = Math.round(
    rows.reduce((s, r) => s + r.offsetX, 0) / rows.length,
  )
  const offsetY = Math.round(
    rows.reduce((s, r) => s + r.offsetY, 0) / rows.length,
  )
  const opacityPct = Math.round(
    rows.reduce((s, r) => s + r.opacityPct, 0) / rows.length,
  )
  const hex0 = rows[0].colorHex
  const sameHex = rows.every((r) => r.colorHex === hex0)
  return {
    blur,
    offsetX,
    offsetY,
    colorHex: sameHex ? hex0 : '#000000',
    opacityPct,
  }
}
