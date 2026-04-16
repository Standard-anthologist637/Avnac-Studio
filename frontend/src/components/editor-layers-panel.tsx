import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  DragDropVerticalIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons'
import { Reorder, useDragControls } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback } from 'react'

export type EditorLayerRow = {
  id: string
  index: number
  label: string
  visible: boolean
  selected: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  rows: EditorLayerRow[]
  onSelectLayer: (stackIndex: number) => void
  onToggleVisible: (stackIndex: number) => void
  onBringForward: (stackIndex: number) => void
  onSendBackward: (stackIndex: number) => void
  onReorder?: (orderedLayerIds: string[]) => void
}

function layerRowClass(selected: boolean) {
  return [
    'flex items-center gap-0.5 rounded-lg py-0.5',
    selected ? 'bg-[#8B3DFF]/12' : 'hover:bg-black/[0.04]',
  ].join(' ')
}

function LayerReorderRow({
  row,
  value,
  onSelectLayer,
  onToggleVisible,
  onBringForward,
  onSendBackward,
}: {
  row: EditorLayerRow
  value: string
  onSelectLayer: (stackIndex: number) => void
  onToggleVisible: (stackIndex: number) => void
  onBringForward: (stackIndex: number) => void
  onSendBackward: (stackIndex: number) => void
}) {
  const dragControls = useDragControls()

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragControls.start(e)
    },
    [dragControls],
  )

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={dragControls}
      className={layerRowClass(row.selected)}
      style={{ listStyle: 'none' }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Reorder ${row.label}`}
        title="Drag to reorder"
        className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-neutral-400 hover:bg-black/[0.06] hover:text-neutral-600 active:cursor-grabbing"
        onPointerDown={onHandlePointerDown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
        }}
      >
        <HugeiconsIcon
          icon={DragDropVerticalIcon}
          size={16}
          strokeWidth={1.75}
        />
      </div>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left text-sm text-neutral-800"
        onClick={() => onSelectLayer(row.index)}
      >
        <span className="truncate">{row.label}</span>
      </button>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-black/[0.06]"
        title={row.visible ? 'Hide' : 'Show'}
        aria-label={row.visible ? 'Hide layer' : 'Show layer'}
        onClick={() => onToggleVisible(row.index)}
      >
        <HugeiconsIcon
          icon={row.visible ? ViewIcon : ViewOffSlashIcon}
          size={18}
          strokeWidth={1.75}
        />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-black/[0.06]"
        title="Forward"
        aria-label="Bring forward"
        onClick={() => onBringForward(row.index)}
      >
        <HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-black/[0.06]"
        title="Backward"
        aria-label="Send backward"
        onClick={() => onSendBackward(row.index)}
      >
        <HugeiconsIcon icon={ArrowDown01Icon} size={18} strokeWidth={1.75} />
      </button>
    </Reorder.Item>
  )
}

function StaticLayerRow({
  row,
  onSelectLayer,
  onToggleVisible,
  onBringForward,
  onSendBackward,
}: {
  row: EditorLayerRow
  onSelectLayer: (stackIndex: number) => void
  onToggleVisible: (stackIndex: number) => void
  onBringForward: (stackIndex: number) => void
  onSendBackward: (stackIndex: number) => void
}) {
  return (
    <li className={layerRowClass(row.selected)}>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left text-sm text-neutral-800"
        onClick={() => onSelectLayer(row.index)}
      >
        <span className="truncate">{row.label}</span>
      </button>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-black/[0.06]"
        title={row.visible ? 'Hide' : 'Show'}
        aria-label={row.visible ? 'Hide layer' : 'Show layer'}
        onClick={() => onToggleVisible(row.index)}
      >
        <HugeiconsIcon
          icon={row.visible ? ViewIcon : ViewOffSlashIcon}
          size={18}
          strokeWidth={1.75}
        />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-black/[0.06]"
        title="Forward"
        aria-label="Bring forward"
        onClick={() => onBringForward(row.index)}
      >
        <HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-black/[0.06]"
        title="Backward"
        aria-label="Send backward"
        onClick={() => onSendBackward(row.index)}
      >
        <HugeiconsIcon icon={ArrowDown01Icon} size={18} strokeWidth={1.75} />
      </button>
    </li>
  )
}

export default function EditorLayersPanel({
  open,
  onClose,
  rows,
  onSelectLayer,
  onToggleVisible,
  onBringForward,
  onSendBackward,
  onReorder,
}: Props) {
  if (!open) return null

  const listClass = 'max-h-[min(60vh,360px)] overflow-auto p-1'

  return (
    <div
      data-avnac-chrome
      className="pointer-events-auto fixed left-[5.75rem] top-16 z-40 flex w-[min(100vw-1.5rem,280px)] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 backdrop-blur-md"
      role="dialog"
      aria-label="Layers"
    >
      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2">
        <span className="text-sm font-semibold text-neutral-800">Layers</span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-black/[0.06]"
          onClick={onClose}
          aria-label="Close layers"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.75} />
        </button>
      </div>
      {rows.length === 0 ? (
        <ul className={listClass}>
          <li className="px-3 py-6 text-center text-sm text-neutral-500">
            No objects yet
          </li>
        </ul>
      ) : onReorder ? (
        <Reorder.Group
          as="ul"
          axis="y"
          className={listClass}
          values={rows.map((r) => r.id)}
          onReorder={onReorder}
        >
          {rows.map((row) => (
            <LayerReorderRow
              key={row.id}
              value={row.id}
              row={row}
              onSelectLayer={onSelectLayer}
              onToggleVisible={onToggleVisible}
              onBringForward={onBringForward}
              onSendBackward={onSendBackward}
            />
          ))}
        </Reorder.Group>
      ) : (
        <ul className={listClass}>
          {rows.map((row) => (
            <StaticLayerRow
              key={row.id}
              row={row}
              onSelectLayer={onSelectLayer}
              onToggleVisible={onToggleVisible}
              onBringForward={onBringForward}
              onSendBackward={onSendBackward}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
