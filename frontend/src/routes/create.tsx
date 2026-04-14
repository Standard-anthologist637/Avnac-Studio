import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon, Download01Icon } from '@hugeicons/core-free-icons'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import FabricEditor, { type FabricEditorHandle } from '../components/fabric-editor'

export const Route = createFileRoute('/create')({
  component: CreatePage,
})

function CreatePage() {
  const editorRef = useRef<FabricEditorHandle>(null)
  const [editorReady, setEditorReady] = useState(false)

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-[var(--surface-subtle)]">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 sm:px-4 sm:py-2">
        <Link
          to="/"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] no-underline transition hover:bg-[var(--hover)]"
          aria-label="Back to home"
          title="Back to home"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={18} strokeWidth={1.6} />
        </Link>
        <h1 className="m-0 text-sm font-semibold leading-tight text-[var(--text)] sm:text-base">
          Editor
        </h1>
        <button
          type="button"
          disabled={!editorReady}
          onClick={() => editorRef.current?.exportPng()}
          className="ml-auto inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--hover)] disabled:pointer-events-none disabled:opacity-40"
          aria-label="Download PNG"
          title="Download PNG"
        >
          <HugeiconsIcon icon={Download01Icon} size={18} strokeWidth={1.6} />
          <span className="hidden sm:inline">Download</span>
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
        <FabricEditor ref={editorRef} onReadyChange={setEditorReady} />
      </div>
    </div>
  )
}
