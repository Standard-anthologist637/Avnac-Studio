/**
 * Full-page scene editor — rendered at /scene?id=...
 * Standalone; does not depend on FabricEditor.  All state flows through
 * the global useSceneEditorStore — no prop drilling.
 */
import { Link } from "@tanstack/react-router";
import SceneEditorCanvas from "./scene-editor-canvas";
import { useSceneEditorStore } from "./store";

type Props = {
  documentId: string | null;
};

export default function SceneEditorPage({ documentId }: Props) {
  const documentName = useSceneEditorStore((s) => s.documentName);
  const adapterIssueCount = useSceneEditorStore((s) => s.adapterIssueCount);
  const hasPendingChanges = useSceneEditorStore((s) => s.hasPendingChanges);
  const isLoading = useSceneEditorStore((s) => s.isLoading);
  const loadError = useSceneEditorStore((s) => s.loadError);
  const scene = useSceneEditorStore((s) => s.scene);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-black/[0.07] bg-white/95 px-4 py-2.5 backdrop-blur">
        <Link
          to="/create"
          search={{ id: documentId ?? undefined }}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="shrink-0"
          >
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Fabric editor
        </Link>

        <div className="h-4 w-px bg-black/10" />

        <span className="text-sm font-semibold text-neutral-900">
          {documentName}
        </span>

        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-sky-700">
          Scene workspace
        </span>

        <div className="ml-auto flex items-center gap-3">
          {adapterIssueCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              {adapterIssueCount} legacy item
              {adapterIssueCount === 1 ? "" : "s"} not ported
            </span>
          )}
          <span className="text-[11px] text-neutral-400">
            {hasPendingChanges ? "Unsaved changes" : "In sync with Fabric"}
          </span>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
          Loading document…
        </div>
      )}

      {loadError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-red-600">Failed to load</p>
          <p className="max-w-sm text-center text-xs text-neutral-500">
            {loadError}
          </p>
          <Link
            to="/files"
            className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Back to files
          </Link>
        </div>
      )}

      {!isLoading && !loadError && scene && <SceneEditorCanvas />}

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      {scene && (
        <footer className="flex shrink-0 items-center gap-3 border-t border-black/[0.06] bg-white/90 px-4 py-1.5 text-[11px] text-neutral-500 backdrop-blur">
          <span>
            {scene.artboard.width} × {scene.artboard.height}px
          </span>
          <span className="text-neutral-300">·</span>
          <span>
            {Object.keys(scene.nodes).length - 1} node
            {Object.keys(scene.nodes).length - 1 === 1 ? "" : "s"}
          </span>
          <span className="text-neutral-300">·</span>
          <span>Saraswati engine</span>
          <span className="ml-auto text-neutral-400">
            Autosave: pending serializer (task.md)
          </span>
        </footer>
      )}
    </div>
  );
}
