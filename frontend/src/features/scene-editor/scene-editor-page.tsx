/**
 * Full-page scene editor — rendered at /scene?id=...
 * Standalone; does not depend on FabricEditor.  All state flows through
 * the global useSceneEditorStore — no prop drilling.
 */
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EditorAiPanel from "@/components/editor/sidebar/editor-ai-panel";
import EditorAppsPanel from "@/components/editor/sidebar/editor-apps-panel";
import EditorFloatingSidebar from "@/components/editor/sidebar/editor-floating-sidebar";
import EditorImagesPanel from "@/components/editor/sidebar/editor-images-panel";
import EditorLayersPanel from "@/components/editor/sidebar/editor-layers-panel";
import EditorUploadsPanel from "@/components/editor/sidebar/editor-uploads-panel";
import EditorVectorBoardPanel from "@/components/editor/vector-boards/editor-vector-board-panel";
import VectorBoardWorkspace from "@/components/editor/vector-boards/vector-board-workspace";
import {
  emptyVectorBoardDocument,
  type VectorBoardDocument,
} from "@/lib/avnac-vector-board-document";
import {
  loadVectorBoardDocs,
  loadVectorBoards,
  mergeVectorBoardDocsForMeta,
  saveVectorBoardDocs,
  saveVectorBoards,
  type AvnacVectorBoardMeta,
} from "@/lib/avnac-vector-boards-storage";
import SceneEditorCanvas from "./scene-editor-canvas";
import BottomFloatingToolbar from "./tools/bottom-floating-toolbar";
import SceneSelectionBar from "./tools/scene-selection-bar";
import { useLayerPanelTools } from "./tools/use-layer-panel-tools";
import { useSceneEditorAiController } from "./use-scene-editor-ai-controller";
import { useSceneEditorStore } from "./store";

type Props = {
  documentId: string | null;
};

export default function SceneEditorPage({ documentId }: Props) {
  const documentName = useSceneEditorStore((s) => s.documentName);
  const adapterIssueCount = useSceneEditorStore((s) => s.adapterIssueCount);
  const adapterPipeline = useSceneEditorStore((s) => s.adapterPipeline);
  const adapterSchemaVersion = useSceneEditorStore(
    (s) => s.adapterSchemaVersion,
  );
  const hasPendingChanges = useSceneEditorStore((s) => s.hasPendingChanges);
  const isLoading = useSceneEditorStore((s) => s.isLoading);
  const loadError = useSceneEditorStore((s) => s.loadError);
  const scene = useSceneEditorStore((s) => s.scene);
  const renderStats = useSceneEditorStore((s) => s.renderStats);
  const zoomPercent = useSceneEditorStore((s) => s.zoomPercent);
  const canvasPan = useSceneEditorStore((s) => s.canvasPan);
  const selectedCount = useSceneEditorStore((s) => s.selectedIds.length);
  const focusMode = useSceneEditorStore((s) => s.focusMode);
  const sidebarPanel = useSceneEditorStore((s) => s.sidebarPanel);
  const toggleSidebarPanel = useSceneEditorStore((s) => s.toggleSidebarPanel);
  const setSidebarPanel = useSceneEditorStore((s) => s.setSidebarPanel);
  const insertVectorBoard = useSceneEditorStore((s) => s.insertVectorBoard);
  const layerTools = useLayerPanelTools();
  const aiController = useSceneEditorAiController();

  const [vectorBoards, setVectorBoards] = useState<AvnacVectorBoardMeta[]>([]);
  const [vectorBoardDocs, setVectorBoardDocs] = useState<
    Record<string, VectorBoardDocument>
  >({});
  const [vectorBoardListReady, setVectorBoardListReady] = useState(false);
  const [vectorWorkspaceId, setVectorWorkspaceId] = useState<string | null>(
    null,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const vectorBoardsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const vectorBoardDocsSaveTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const createVectorBoard = useCallback(() => {
    const id = crypto.randomUUID();
    setVectorBoards((prev) => {
      const n = prev.length + 1;
      return [
        ...prev,
        { id, name: `Vector board ${n}`, createdAt: Date.now() },
      ];
    });
    setVectorBoardDocs((prev) => ({
      ...prev,
      [id]: emptyVectorBoardDocument(),
    }));
    setVectorWorkspaceId(id);
  }, []);

  const openVectorBoardWorkspace = useCallback((id: string) => {
    setVectorWorkspaceId(id);
  }, []);

  const closeVectorWorkspace = useCallback(() => {
    setVectorWorkspaceId(null);
  }, []);

  const onVectorBoardDocumentChange = useCallback(
    (boardId: string, doc: VectorBoardDocument) => {
      setVectorBoardDocs((prev) => ({ ...prev, [boardId]: doc }));
    },
    [],
  );

  const deleteVectorBoard = useCallback((boardId: string) => {
    setVectorWorkspaceId((cur) => (cur === boardId ? null : cur));
    setVectorBoards((prev) => prev.filter((b) => b.id !== boardId));
    setVectorBoardDocs((prev) => {
      const next = { ...prev };
      delete next[boardId];
      return next;
    });
  }, []);

  const vectorWorkspaceName = useMemo(() => {
    if (!vectorWorkspaceId) return "";
    return (
      vectorBoards.find((b) => b.id === vectorWorkspaceId)?.name ??
      "Vector board"
    );
  }, [vectorBoards, vectorWorkspaceId]);

  useEffect(() => {
    setVectorWorkspaceId(null);
    setVectorBoardListReady(false);
    let cancelled = false;
    if (!documentId) {
      setVectorBoards([]);
      setVectorBoardDocs({});
      setVectorBoardListReady(true);
      return;
    }
    void (async () => {
      const [boards, docs] = await Promise.all([
        loadVectorBoards(documentId),
        loadVectorBoardDocs(documentId),
      ]);
      if (cancelled) return;
      const merged = mergeVectorBoardDocsForMeta(boards, docs);
      setVectorBoards(boards);
      setVectorBoardDocs(merged);
      setVectorBoardListReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !vectorBoardListReady) return;
    if (vectorBoardsSaveTimerRef.current) {
      clearTimeout(vectorBoardsSaveTimerRef.current);
    }
    vectorBoardsSaveTimerRef.current = setTimeout(() => {
      vectorBoardsSaveTimerRef.current = null;
      void saveVectorBoards(documentId, vectorBoards).catch((err) => {
        console.error("SceneEditor: vector board save failed", err);
      });
    }, 800);

    return () => {
      if (vectorBoardsSaveTimerRef.current) {
        clearTimeout(vectorBoardsSaveTimerRef.current);
        vectorBoardsSaveTimerRef.current = null;
      }
    };
  }, [documentId, vectorBoards, vectorBoardListReady]);

  useEffect(() => {
    if (!documentId || !vectorBoardListReady) return;
    if (vectorBoardDocsSaveTimerRef.current) {
      clearTimeout(vectorBoardDocsSaveTimerRef.current);
    }
    vectorBoardDocsSaveTimerRef.current = setTimeout(() => {
      vectorBoardDocsSaveTimerRef.current = null;
      void saveVectorBoardDocs(documentId, vectorBoardDocs).catch((err) => {
        console.error("SceneEditor: vector board document save failed", err);
      });
    }, 800);

    return () => {
      if (vectorBoardDocsSaveTimerRef.current) {
        clearTimeout(vectorBoardDocsSaveTimerRef.current);
        vectorBoardDocsSaveTimerRef.current = null;
      }
    };
  }, [documentId, vectorBoardDocs, vectorBoardListReady]);

  useEffect(() => {
    return () => {
      if (vectorBoardsSaveTimerRef.current) {
        clearTimeout(vectorBoardsSaveTimerRef.current);
        vectorBoardsSaveTimerRef.current = null;
      }
      if (vectorBoardDocsSaveTimerRef.current) {
        clearTimeout(vectorBoardDocsSaveTimerRef.current);
        vectorBoardDocsSaveTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-neutral-50"
      data-avnac-adapter-pipeline={adapterPipeline}
      data-avnac-adapter-schema={
        adapterSchemaVersion != null ? String(adapterSchemaVersion) : "unknown"
      }
    >
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
          Files
        </Link>

        <div className="h-4 w-px bg-black/10" />

        <span className="text-sm font-semibold text-neutral-900">
          {documentName}
        </span>

        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-sky-700">
          Scene workspace
        </span>

        <span
          className={
            adapterPipeline === "direct-avnac"
              ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-700"
              : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-700"
          }
          title="Active Avnac adapter pipeline"
        >
          Adapter {adapterPipeline}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {adapterIssueCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              {adapterIssueCount} legacy item
              {adapterIssueCount === 1 ? "" : "s"} not ported
            </span>
          )}
          <span className="text-[11px] text-neutral-400">
            {hasPendingChanges ? "Unsaved changes" : "Saved"}
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
            <SceneEditorCanvas
              shortcutsOpen={shortcutsOpen}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onCloseShortcuts={() => setShortcutsOpen(false)}
            />
            <BottomFloatingToolbar />
            <EditorFloatingSidebar
              activePanel={sidebarPanel}
              onSelectPanel={toggleSidebarPanel}
              hidden={focusMode}
            />
            <EditorLayersPanel
              open={sidebarPanel === "layers"}
              onClose={() => setSidebarPanel(null)}
              rows={layerTools.rows}
              onSelectLayer={layerTools.onSelectLayer}
              onToggleVisible={layerTools.onToggleVisible}
              onBringForward={layerTools.onBringForward}
              onSendBackward={layerTools.onSendBackward}
              onReorder={layerTools.onReorder}
              onRenameLayer={layerTools.onRenameLayer}
            />
            <EditorUploadsPanel
              open={sidebarPanel === "uploads"}
              onClose={() => setSidebarPanel(null)}
            />
            <EditorImagesPanel
              open={sidebarPanel === "images"}
              onClose={() => setSidebarPanel(null)}
              controller={aiController}
            />
            <EditorVectorBoardPanel
              open={sidebarPanel === "vector-board"}
              onClose={() => setSidebarPanel(null)}
              boards={vectorBoards}
              boardDocs={vectorBoardDocs}
              onCreateNew={createVectorBoard}
              onOpenBoard={openVectorBoardWorkspace}
              onDeleteBoard={deleteVectorBoard}
            />
            <EditorAppsPanel
              open={sidebarPanel === "apps"}
              onClose={() => setSidebarPanel(null)}
              controller={aiController}
            />
            <EditorAiPanel
              open={sidebarPanel === "ai"}
              onClose={() => setSidebarPanel(null)}
              controller={aiController}
            />
            <VectorBoardWorkspace
              open={vectorWorkspaceId != null}
              boardName={vectorWorkspaceName}
              document={
                vectorWorkspaceId
                  ? (vectorBoardDocs[vectorWorkspaceId] ??
                    emptyVectorBoardDocument())
                  : emptyVectorBoardDocument()
              }
              onDocumentChange={(doc) => {
                if (!vectorWorkspaceId) return;
                onVectorBoardDocumentChange(vectorWorkspaceId, doc);
              }}
              onSave={closeVectorWorkspace}
              onSaveAndPlace={() => {
                insertVectorBoard();
                closeVectorWorkspace();
              }}
              onClose={closeVectorWorkspace}
            />
          </div>
        </div>
      )}

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      {scene && (
        <footer className="flex shrink-0 items-center gap-3 border-t border-black/6 bg-white/90 px-4 py-1.5 text-[11px] text-neutral-500 backdrop-blur">
          <div className="flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap">
            <span>
              {scene.artboard.width} × {scene.artboard.height}px
            </span>
            <span className="text-neutral-300">·</span>
            <span>Sel {selectedCount}</span>
            <span className="text-neutral-300">·</span>
            <span>Zoom {Math.round(zoomPercent)}%</span>
            <span className="text-neutral-300">·</span>
            <span className="hidden sm:inline">
              Pan {canvasPan.x}, {canvasPan.y}
            </span>
            <span className="hidden md:inline text-neutral-300">·</span>
            <span
              className="hidden md:inline"
              title="Latest frame render duration."
            >
              Render {renderStats.ms.toFixed(1)}ms
            </span>
            <span className="hidden md:inline text-neutral-300">·</span>
            <span
              className="hidden md:inline"
              title="Total draw commands this frame."
            >
              Cmd {renderStats.commands}
            </span>
            <span className="hidden md:inline text-neutral-300">·</span>
            <span
              className="hidden md:inline"
              title="Adapter pipeline and Avnac schema version."
            >
              {adapterPipeline} · schema v
              {adapterSchemaVersion != null ? adapterSchemaVersion : "?"}
            </span>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="ml-auto rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100"
              title="Show keyboard shortcuts"
            >
              Shortcuts ?
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
