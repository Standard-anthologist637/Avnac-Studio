import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  ArrowUpRight01Icon,
  CircleIcon,
  GeometricShapes02Icon,
  LinerIcon,
  PolygonIcon,
  RectangularIcon,
  StarIcon,
} from '@hugeicons/core-free-icons'

export type PopoverShapeKind =
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'arrow'

export type ShapesQuickAddKind = PopoverShapeKind | 'generic'

export const SHAPE_KIND_ICONS: Record<PopoverShapeKind, IconSvgElement> = {
  rect: RectangularIcon,
  ellipse: CircleIcon,
  polygon: PolygonIcon,
  star: StarIcon,
  line: LinerIcon,
  arrow: ArrowUpRight01Icon,
}

export function iconForShapesQuickAdd(kind: ShapesQuickAddKind): IconSvgElement {
  return kind === 'generic' ? GeometricShapes02Icon : SHAPE_KIND_ICONS[kind]
}

type Item = { kind: PopoverShapeKind; label: string; icon: IconSvgElement }

const ITEMS: Item[] = [
  { kind: 'rect', label: 'Rectangle', icon: SHAPE_KIND_ICONS.rect },
  { kind: 'ellipse', label: 'Ellipse', icon: SHAPE_KIND_ICONS.ellipse },
  { kind: 'polygon', label: 'Polygon', icon: SHAPE_KIND_ICONS.polygon },
  { kind: 'star', label: 'Star', icon: SHAPE_KIND_ICONS.star },
  { kind: 'line', label: 'Line', icon: SHAPE_KIND_ICONS.line },
  { kind: 'arrow', label: 'Arrow', icon: SHAPE_KIND_ICONS.arrow },
]

type Props = {
  open: boolean
  disabled?: boolean
  onClose: () => void
  onPick: (kind: PopoverShapeKind) => void
}

export default function ShapesPopover({
  open,
  disabled,
  onClose,
  onPick,
}: Props) {
  if (!open || disabled) return null

  return (
    <div
      role="menu"
      className="absolute bottom-full left-0 z-[60] mb-2 min-w-[11rem] overflow-hidden rounded-xl border border-black/[0.08] bg-white py-1 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
    >
      {ITEMS.map(({ kind, label, icon }) => (
        <button
          key={kind}
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-800 outline-none hover:bg-black/[0.05]"
          onClick={() => {
            onPick(kind)
            onClose()
          }}
        >
          <HugeiconsIcon icon={icon} size={18} strokeWidth={1.75} />
          <span>{label}</span>
          {kind === 'rect' ? (
            <span className="ml-auto text-[10px] text-neutral-400">default</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
