/**
 * Full-page scene editor — rendered at /scene?id=...
 * Standalone; does not depend on FabricEditor.  All state flows through
 * the global useSceneEditorStore — no prop drilling.
 */
import { Link } from "@tanstack/react-router";
import { Layers02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import EditorLayersPanel from "@/components/editor/sidebar/editor-layers-panel";
import { editorSidebarTopValue } from "@/lib/editor-sidebar-panel-layout";
import { useState } from "react";
import SceneEditorCanvas from "./scene-editor-canvas";
import BottomFloatingToolbar from "./tools/bottom-floating-toolbar";
import SceneSelectionBar from "./tools/scene-selection-bar";
import { useLayerPanelTools } from "./tools/use-layer-panel-tools";
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
  const renderStats = useSceneEditorStore((s) => s.renderStats);
  const focusMode = useSceneEditorStore((s) => s.focusMode);
  const [layersOpen, setLayersOpen] = useState(false);
  const layerTools = useLayerPanelTools();
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

        <div className="ml-auto flex items-center gap-2">
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

      {!isLoading && !loadError && scene && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <SceneSelectionBar />
          <div className="relative flex min-h-0 flex-1">
            <SceneEditorCanvas />
            <BottomFloatingToolbar />
            <nav
              data-avnac-chrome
              aria-label="Scene tools"
              className={[
                "pointer-events-auto fixed left-3 z-[95] flex flex-col gap-1 rounded-[1.75rem] border border-black/[0.08] bg-white/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-xl transition-opacity duration-150",
                focusMode ? "pointer-events-none opacity-0" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ top: editorSidebarTopValue }}
            >
              <button
                type="button"
                aria-pressed={layersOpen}
                title="Layers (L)"
                aria-label="Layers"
                onClick={() => setLayersOpen((v) => !v)}
                className={[
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl transition-[background,color,box-shadow]",
                  layersOpen
                    ? "bg-neutral-900 text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
                    : "text-neutral-500 hover:bg-black/[0.06] hover:text-neutral-800",
                ].join(" ")}
              >
                <HugeiconsIcon
                  icon={Layers02Icon}
                  size={20}
                  strokeWidth={1.75}
                />
              </button>
            </nav>
            <EditorLayersPanel
              open={layersOpen}
              onClose={() => setLayersOpen(false)}
              rows={layerTools.rows}
              onSelectLayer={layerTools.onSelectLayer}
              onToggleVisible={layerTools.onToggleVisible}
              onBringForward={layerTools.onBringForward}
              onSendBackward={layerTools.onSendBackward}
              onReorder={layerTools.onReorder}
              onRenameLayer={layerTools.onRenameLayer}
            />
          </div>
        </div>
      )}

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
          <span className="text-neutral-300">·</span>
          <span>
            Render {renderStats.ms.toFixed(1)}ms · Cmds {renderStats.commands} ·
            Dup {renderStats.duplicateCommands}
          </span>
          <span className="ml-auto text-neutral-400">
            Autosave: clip-path persistence active, full serializer pending
          </span>
        </footer>
      )}
    </div>
  );
}
