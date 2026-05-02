/**
 * Global Zustand store for the dedicated /scene editor page.
 * Components read from this store via useSceneEditorStore(selector) — no prop
 * drilling needed.  The store is module-level (not per-instance) because only
 * one scene editor page is open at a time.
 */
import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import {
  buildMultiPageDocument,
  clampPageIndex,
  createEmptyPage,
  parseAvnacImport,
} from "@/lib/avnac-multi-page-document";
import type { EditorSidebarPanelId } from "@/components/editor/sidebar/editor-floating-sidebar";
import {
  createSaraswatiEditorStore,
  type SaraswatiColor,
  type SaraswatiCommand,
  type SaraswatiEditorStore,
  type SaraswatiScene,
  type SaraswatiShadow,
} from "@/lib/saraswati";
import {
  fromAvnacDocumentWithDiagnostics,
  type AvnacAdapterPipeline,
} from "@/lib/saraswati/compat/from-avnac";
import { toAvnacDocument } from "@/lib/saraswati/compat/to-avnac";
import {
  idbGetEditorRecord,
  idbPutDocument,
  idbSetDocumentName,
} from "@/lib/avnac-editor-idb";
import {
  mergeStoredPages,
  readRawStoredPages,
  saveStoredPages,
} from "@/lib/avnac-multi-page-storage";
import { safeAvnacFileBaseName } from "@/lib/avnac-files-export";
import { exportJsonFile } from "@/lib/avnac-native-export";
import { ConfirmDialog } from "../../../../wailsjs/go/avnacio/IOManager";
import {
  createPageHistory,
  getPageRedoState,
  getPageUndoState,
  movePageHistoryIndex,
  pushPageHistory,
  type PageHistory,
} from "@/features/scene-editor/store/paging/page-history";
import { clonePageDoc } from "@/features/scene-editor/store/paging/page-state";
import {
  buildAddPageResult,
  buildDeletePageResult,
  buildInsertImportedPageResult,
} from "@/features/scene-editor/store/paging/page-recipes";
import { create } from "zustand";
import {
  addClipToSelection,
  insertArrow,
  insertEllipse,
  insertLine,
  insertPolygon,
  insertRect,
  removeClipFromSelection,
  resetClipOnSelection,
  insertStar,
  insertText,
  insertVectorBoard,
  type SceneEditorInsertContext,
} from "./insert-store";

type SceneEditorState = {
  documentId: string | null;
  documentName: string;
  /** Latest serializer snapshot corresponding to scene state. */
  baseDocument: AvnacDocumentV1 | null;
  /** Live scene — updated by every applied command. */
  scene: SaraswatiScene | null;
  /** Issues emitted by the active Avnac adapter at load time. */
  adapterIssueCount: number;
  /** Adapter pipeline used for the current loaded document. */
  adapterPipeline: AvnacAdapterPipeline;
  /** Avnac schema version observed at adapter boundary. */
  adapterSchemaVersion: number | null;
  /** Currently selected node IDs in the scene. */
  selectedIds: string[];
  /** Editor-only lock state. Locked nodes cannot be transformed. */
  lockedIds: string[];
  isLoading: boolean;
  loadError: string | null;
  /** True after at least one command has been applied since the last save. */
  hasPendingChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  focusMode: boolean;
  sidebarPanel: EditorSidebarPanelId | null;
  zoomPercent: number;
  canvasViewport: {
    width: number;
    height: number;
  };
  canvasPan: {
    x: number;
    y: number;
  };
  renderStats: {
    ms: number;
    commands: number;
    duplicateCommands: number;
  };
  /** All pages in the document (Avnac-serialized, one per slot). */
  pages: AvnacDocumentV1[];
  /** Index of the currently active page. */
  currentPage: number;
};

type SceneEditorActions = {
  /** Load a document by persisted ID. Replaces any existing state.
   * When the document does not yet exist (new canvas), pass `opts.w`/`opts.h`
   * to set artboard dimensions; an empty document is created and saved. */
  load: (id: string, opts?: { w?: number; h?: number }) => Promise<void>;
  /** Apply one or more Saraswati commands to the live scene. */
  applyCommands: (commands: SaraswatiCommand[]) => void;
  beginHistoryBatch: () => void;
  endHistoryBatch: () => void;
  setSelectedIds: (ids: string[]) => void;
  toggleLockedSelection: () => void;
  setRenderStats: (stats: {
    ms: number;
    commands: number;
    duplicateCommands: number;
  }) => void;
  insertRect: () => void;
  insertEllipse: () => void;
  insertPolygon: () => void;
  insertStar: () => void;
  insertLine: () => void;
  insertArrow: () => void;
  insertText: () => void;
  insertVectorBoard: () => void;
  addClipToSelection: () => void;
  removeClipFromSelection: () => void;
  resetClipOnSelection: () => void;
  undo: () => void;
  redo: () => void;
  setArtboard: (width?: number, height?: number, bg?: SaraswatiColor) => void;
  setNodeFill: (id: string, fill: SaraswatiColor) => void;
  setNodeStroke: (
    id: string,
    stroke: SaraswatiColor | null,
    strokeWidth?: number,
  ) => void;
  setNodeCornerRadius: (id: string, radius: number) => void;
  setTextFormat: (
    id: string,
    patch: {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: "normal" | "italic";
      textAlign?: "left" | "center" | "right";
      underline?: boolean;
      color?: SaraswatiColor;
      lineHeight?: number;
    },
  ) => void;
  setTextContent: (id: string, text: string) => void;
  toggleFocusMode: () => void;
  setSidebarPanel: (panel: EditorSidebarPanelId | null) => void;
  toggleSidebarPanel: (panel: EditorSidebarPanelId) => void;
  setZoomPercent: (percent: number) => void;
  setCanvasViewport: (width: number, height: number) => void;
  setCanvasPan: (x: number, y: number) => void;
  setNodeOpacity: (id: string, opacity: number) => void;
  setNodeShadow: (id: string, shadow: SaraswatiShadow | null) => void;
  setNodeBlur: (id: string, blur: number) => void;
  setImageCrop: (
    id: string,
    crop: {
      cropX: number;
      cropY: number;
      cropWidth?: number;
      cropHeight?: number;
    },
  ) => void;
  setImageBorderRadius: (id: string, radius: number) => void;
  setPolygonSides: (id: string, sides: number, star?: boolean) => void;
  /** Navigate to a page by index. */
  goToPage: (index: number) => Promise<void>;
  /** Add a blank page after the current page. */
  addPage: () => Promise<void>;
  /** Delete the current page (no-op if only one page). */
  deletePage: () => Promise<void>;
  /** Import a page from a file and insert it after the current page. */
  importPage: (file: File) => Promise<void>;
  /** Replace all pages from a workspace file import. */
  importWorkspace: (file: File) => Promise<void>;
  /** Export all pages as a workspace JSON file. */
  exportWorkspace: () => Promise<void>;
  /** Export the current page as a single-page JSON file. */
  exportCurrentPage: () => Promise<void>;
  /** Optimistic document name update for the title input. */
  setDocumentName: (name: string) => void;
  /** Persist the current documentName to IDB. */
  commitDocumentName: () => Promise<void>;
  /** Persist the current scene snapshot back to IDB via serializer. */
  save: () => Promise<void>;
  reset: () => void;
};

export type SceneEditorStore = SceneEditorState & SceneEditorActions;

const INITIAL: SceneEditorState = {
  documentId: null,
  documentName: "Untitled",
  baseDocument: null,
  scene: null,
  adapterIssueCount: 0,
  adapterPipeline: "direct-avnac",
  adapterSchemaVersion: null,
  selectedIds: [],
  lockedIds: [],
  isLoading: false,
  loadError: null,
  hasPendingChanges: false,
  canUndo: false,
  canRedo: false,
  focusMode: false,
  sidebarPanel: null,
  zoomPercent: 100,
  canvasViewport: {
    width: 0,
    height: 0,
  },
  canvasPan: {
    x: 0,
    y: 0,
  },
  renderStats: {
    ms: 0,
    commands: 0,
    duplicateCommands: 0,
  },
  pages: [],
  currentPage: 0,
};

let sceneEngineStore: SaraswatiEditorStore | null = null;
let detachSceneEngineSubscription: (() => void) | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let pageHistoryRef: PageHistory<AvnacDocumentV1> | null = null;

const AUTOSAVE_DELAY_MS = 1500;
const PAGE_HISTORY_LIMIT = 20;

function scheduleAutosave(
  documentId: string,
  scene: SaraswatiScene,
  pages: AvnacDocumentV1[],
  currentPage: number,
): void {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    const doc = toAvnacDocument(scene);
    const updatedPages = pages.map((p, i) => (i === currentPage ? doc : p));
    void saveStoredPages(documentId, updatedPages, currentPage);
    idbPutDocument(documentId, doc).catch((err) => {
      console.warn("[avnac] autosave failed", err);
    });
  }, AUTOSAVE_DELAY_MS);
}

function resetSceneEngineBinding() {
  detachSceneEngineSubscription?.();
  detachSceneEngineSubscription = null;
  sceneEngineStore = null;
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

// ─── Page transition helper ──────────────────────────────────────────────────
// Shared by all page-switching operations. Loads the target page into the
// Saraswati engine, optionally records a page-history entry, persists via
// saveStoredPages, then updates Zustand state.
async function applyPageTransition(
  nextPages: AvnacDocumentV1[],
  nextCurrentPage: number,
  documentId: string,
  trackHistory: boolean,
  set: (partial: Partial<SceneEditorState>) => void,
): Promise<void> {
  const targetDoc = nextPages[nextCurrentPage];
  if (!targetDoc) return;

  const { result: adapted, diagnostics } =
    fromAvnacDocumentWithDiagnostics(targetDoc);
  const { scene, issues } = adapted;

  detachSceneEngineSubscription?.();
  detachSceneEngineSubscription = null;
  sceneEngineStore = createSaraswatiEditorStore(scene);
  detachSceneEngineSubscription = sceneEngineStore.subscribe(
    (nextEngineState) => {
      set({
        scene: nextEngineState.scene,
        canUndo: nextEngineState.canUndo,
        canRedo: nextEngineState.canRedo,
      });
    },
  );

  if (trackHistory) {
    pageHistoryRef = pushPageHistory(
      pageHistoryRef,
      { pages: nextPages, currentPage: nextCurrentPage },
      clonePageDoc,
      PAGE_HISTORY_LIMIT,
    );
  }

  void saveStoredPages(documentId, nextPages, nextCurrentPage);

  set({
    pages: nextPages,
    currentPage: nextCurrentPage,
    scene: sceneEngineStore.getState().scene,
    canUndo: sceneEngineStore.getState().canUndo,
    canRedo: sceneEngineStore.getState().canRedo,
    baseDocument: targetDoc,
    adapterIssueCount: issues.length,
    adapterPipeline: diagnostics.pipeline,
    adapterSchemaVersion: diagnostics.schemaVersion,
    hasPendingChanges: false,
    selectedIds: [],
    lockedIds: [],
  });
}

function asInsertContext(state: SceneEditorStore): SceneEditorInsertContext {
  return {
    scene: state.scene,
    selectedIds: state.selectedIds,
    applyCommands: state.applyCommands,
    setSelectedIds: state.setSelectedIds,
  };
}

export const useSceneEditorStore = create<SceneEditorStore>()((set, get) => ({
  ...INITIAL,

  load: async (id: string, opts?: { w?: number; h?: number }) => {
    set({ ...INITIAL, isLoading: true, documentId: id });
    resetSceneEngineBinding();
    pageHistoryRef = null;
    try {
      let doc: AvnacDocumentV1;
      let docName: string;

      // Fire both IPC reads in parallel — cuts load time from 2 sequential
      // round-trips down to 1 (they are completely independent).
      const [record, rawPages] = await Promise.all([
        idbGetEditorRecord(id),
        readRawStoredPages(id),
      ]);

      if (!record) {
        // New document — create empty canvas with optional artboard dimensions.
        const emptyDoc = createEmptyPage();
        if (opts?.w != null && Number.isFinite(opts.w)) {
          emptyDoc.artboard.width = Math.min(
            16000,
            Math.max(100, Math.round(opts.w)),
          );
        }
        if (opts?.h != null && Number.isFinite(opts.h)) {
          emptyDoc.artboard.height = Math.min(
            16000,
            Math.max(100, Math.round(opts.h)),
          );
        }
        await idbPutDocument(id, emptyDoc);
        doc = emptyDoc;
        docName = "Untitled";
      } else {
        doc = record.document;
        docName = record.name ?? "Untitled";
      }

      // Merge the two parallel results synchronously — no extra await.
      const stored = mergeStoredPages(rawPages, doc);
      const activePage = stored.pages[stored.currentPage] ?? doc;

      const { result: adapted, diagnostics } =
        fromAvnacDocumentWithDiagnostics(activePage);
      const { scene, issues } = adapted;
      sceneEngineStore = createSaraswatiEditorStore(scene);
      detachSceneEngineSubscription = sceneEngineStore.subscribe(
        (nextState) => {
          set({
            scene: nextState.scene,
            canUndo: nextState.canUndo,
            canRedo: nextState.canRedo,
          });
        },
      );
      pageHistoryRef = createPageHistory<AvnacDocumentV1>(
        { currentPage: stored.currentPage, pages: stored.pages },
        clonePageDoc,
      );
      set({
        isLoading: false,
        documentName: docName,
        baseDocument: activePage,
        pages: stored.pages,
        currentPage: stored.currentPage,
        scene: sceneEngineStore.getState().scene,
        adapterIssueCount: issues.length,
        adapterPipeline: diagnostics.pipeline,
        adapterSchemaVersion: diagnostics.schemaVersion,
        lockedIds: [],
      });
    } catch (err) {
      set({ isLoading: false, loadError: String(err) });
    }
  },

  applyCommands: (commands: SaraswatiCommand[]) => {
    if (!sceneEngineStore || commands.length === 0) return;
    for (const cmd of commands) {
      sceneEngineStore.dispatch(cmd);
    }
    const engineState = sceneEngineStore.getState();
    const nextBaseDocument = toAvnacDocument(engineState.scene);
    const { documentId } = get();
    set({
      hasPendingChanges: true,
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      baseDocument: nextBaseDocument,
    });
    if (documentId)
      scheduleAutosave(
        documentId,
        engineState.scene,
        get().pages,
        get().currentPage,
      );
  },

  beginHistoryBatch: () => {
    if (!sceneEngineStore) return;
    sceneEngineStore.beginBatch();
  },

  endHistoryBatch: () => {
    if (!sceneEngineStore) return;
    sceneEngineStore.endBatch();
    const engineState = sceneEngineStore.getState();
    const { documentId } = get();
    set({
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      baseDocument: toAvnacDocument(engineState.scene),
      hasPendingChanges: true,
    });
    if (documentId)
      scheduleAutosave(
        documentId,
        engineState.scene,
        get().pages,
        get().currentPage,
      );
  },

  setSelectedIds: (selectedIds: string[]) => set({ selectedIds }),

  toggleLockedSelection: () => {
    const { selectedIds, lockedIds } = get();
    if (selectedIds.length === 0) return;
    const locked = new Set(lockedIds);
    const anyUnlocked = selectedIds.some((id) => !locked.has(id));
    for (const id of selectedIds) {
      if (anyUnlocked) locked.add(id);
      else locked.delete(id);
    }
    set({ lockedIds: [...locked] });
  },

  setRenderStats: (renderStats) => set({ renderStats }),

  insertRect: () => insertRect(asInsertContext(get())),
  insertEllipse: () => insertEllipse(asInsertContext(get())),
  insertPolygon: () => insertPolygon(asInsertContext(get())),
  insertStar: () => insertStar(asInsertContext(get())),
  insertLine: () => insertLine(asInsertContext(get())),
  insertArrow: () => insertArrow(asInsertContext(get())),
  insertText: () => insertText(asInsertContext(get())),
  insertVectorBoard: () => insertVectorBoard(asInsertContext(get())),
  addClipToSelection: () => addClipToSelection(asInsertContext(get())),
  removeClipFromSelection: () =>
    removeClipFromSelection(asInsertContext(get())),
  resetClipOnSelection: () => resetClipOnSelection(asInsertContext(get())),

  undo: () => {
    const { canUndo: engineCanUndo, documentId, pages, currentPage } = get();
    if (sceneEngineStore && engineCanUndo) {
      sceneEngineStore.undo();
      const engineState = sceneEngineStore.getState();
      set({
        scene: engineState.scene,
        canUndo: engineState.canUndo,
        canRedo: engineState.canRedo,
        baseDocument: toAvnacDocument(engineState.scene),
        hasPendingChanges: true,
      });
      if (documentId)
        scheduleAutosave(documentId, engineState.scene, pages, currentPage);
      return;
    }
    // Page-level undo (add/delete/switch page operations)
    if (!documentId) return;
    const prevPageState = getPageUndoState(pageHistoryRef, clonePageDoc);
    if (!prevPageState) return;
    pageHistoryRef = movePageHistoryIndex(pageHistoryRef, -1);
    void applyPageTransition(
      prevPageState.pages,
      prevPageState.currentPage,
      documentId,
      false,
      set,
    );
  },

  redo: () => {
    const { canRedo: engineCanRedo, documentId, pages, currentPage } = get();
    if (sceneEngineStore && engineCanRedo) {
      sceneEngineStore.redo();
      const engineState = sceneEngineStore.getState();
      set({
        scene: engineState.scene,
        canUndo: engineState.canUndo,
        canRedo: engineState.canRedo,
        baseDocument: toAvnacDocument(engineState.scene),
        hasPendingChanges: true,
      });
      if (documentId)
        scheduleAutosave(documentId, engineState.scene, pages, currentPage);
      return;
    }
    // Page-level redo
    if (!documentId) return;
    const nextPageState = getPageRedoState(pageHistoryRef, clonePageDoc);
    if (!nextPageState) return;
    pageHistoryRef = movePageHistoryIndex(pageHistoryRef, 1);
    void applyPageTransition(
      nextPageState.pages,
      nextPageState.currentPage,
      documentId,
      false,
      set,
    );
  },

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  setSidebarPanel: (sidebarPanel) => set({ sidebarPanel }),

  toggleSidebarPanel: (panel) =>
    set((s) => ({ sidebarPanel: s.sidebarPanel === panel ? null : panel })),

  setZoomPercent: (zoomPercent) =>
    set({ zoomPercent: Math.max(5, Math.min(400, Math.round(zoomPercent))) }),

  setCanvasViewport: (width, height) =>
    set({
      canvasViewport: {
        width: Math.max(0, Math.round(width)),
        height: Math.max(0, Math.round(height)),
      },
    }),

  setCanvasPan: (x, y) =>
    set({
      canvasPan: {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
      },
    }),

  setNodeOpacity: (id, opacity) => {
    get().applyCommands([{ type: "SET_NODE_OPACITY", id, opacity }]);
  },

  setNodeShadow: (id, shadow) => {
    get().applyCommands([{ type: "SET_NODE_SHADOW", id, shadow }]);
  },

  setNodeBlur: (id, blur) => {
    get().applyCommands([{ type: "SET_NODE_BLUR", id, blur }]);
  },

  setArtboard: (width?: number, height?: number, bg?: SaraswatiColor) => {
    get().applyCommands([{ type: "SET_ARTBOARD", width, height, bg }]);
  },

  setNodeFill: (id: string, fill: SaraswatiColor) => {
    get().applyCommands([{ type: "SET_NODE_FILL", id, fill }]);
  },

  setNodeStroke: (
    id: string,
    stroke: SaraswatiColor | null,
    strokeWidth?: number,
  ) => {
    get().applyCommands([{ type: "SET_NODE_STROKE", id, stroke, strokeWidth }]);
  },

  setNodeCornerRadius: (id: string, radius: number) => {
    get().applyCommands([
      { type: "SET_NODE_CORNER_RADIUS", id, radiusX: radius, radiusY: radius },
    ]);
  },

  setTextFormat: (id, patch) => {
    get().applyCommands([{ type: "SET_TEXT_FORMAT", id, ...patch }]);
  },

  setTextContent: (id, text) => {
    get().applyCommands([{ type: "SET_TEXT_CONTENT", id, text }]);
  },

  setImageCrop: (id, crop) => {
    get().applyCommands([{ type: "SET_IMAGE_CROP", id, ...crop }]);
  },

  setImageBorderRadius: (id, radius) => {
    get().applyCommands([{ type: "SET_IMAGE_BORDER_RADIUS", id, radius }]);
  },

  setPolygonSides: (id, sides, star) => {
    get().applyCommands([{ type: "SET_POLYGON_SIDES", id, sides, star }]);
  },

  save: async () => {
    const { documentId, scene, baseDocument, pages, currentPage } = get();
    if (!documentId) return;
    const docToSave = scene ? toAvnacDocument(scene) : baseDocument;
    if (!docToSave) return;
    const updatedPages = pages.map((p, i) =>
      i === currentPage ? docToSave : p,
    );
    await Promise.all([
      idbPutDocument(documentId, docToSave),
      saveStoredPages(documentId, updatedPages, currentPage),
    ]);
    set({ baseDocument: docToSave, hasPendingChanges: false });
  },

  reset: () => {
    resetSceneEngineBinding();
    pageHistoryRef = null;
    set(INITIAL);
  },

  goToPage: async (index: number) => {
    const { pages, currentPage, documentId, scene } = get();
    if (!documentId || pages.length === 0) return;
    const targetIndex = clampPageIndex(pages.length, index);
    if (targetIndex === currentPage) return;
    const currentDoc = scene ? toAvnacDocument(scene) : pages[currentPage]!;
    const updatedPages = pages.map((p, i) =>
      i === currentPage ? currentDoc : p,
    );
    await applyPageTransition(updatedPages, targetIndex, documentId, true, set);
  },

  addPage: async () => {
    const { pages, currentPage, documentId, scene } = get();
    if (!documentId) return;
    const currentDoc = scene ? toAvnacDocument(scene) : pages[currentPage]!;
    const updatedPages = pages.map((p, i) =>
      i === currentPage ? currentDoc : p,
    );
    const { nextState } = buildAddPageResult(
      { currentPage, pages: updatedPages },
      currentDoc,
    );
    await applyPageTransition(
      nextState.pages,
      nextState.currentPage,
      documentId,
      true,
      set,
    );
  },

  deletePage: async () => {
    const { pages, currentPage, documentId } = get();
    if (!documentId || pages.length <= 1) return;
    const confirmed = await ConfirmDialog(
      "Delete page",
      "Delete this page? This cannot be undone.",
    ).catch(() => false);
    if (!confirmed) return;
    const { nextState } = buildDeletePageResult({ currentPage, pages });
    await applyPageTransition(
      nextState.pages,
      nextState.currentPage,
      documentId,
      true,
      set,
    );
  },

  importPage: async (file: File) => {
    const { pages, currentPage, documentId, scene } = get();
    if (!documentId) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return;
    }
    const imported = parseAvnacImport(raw);
    if (!imported) return;
    const importedDoc =
      imported.kind === "single"
        ? imported.document
        : imported.document.pages[
            clampPageIndex(
              imported.document.pages.length,
              imported.document.currentPage,
            )
          ];
    if (!importedDoc) return;
    const currentDoc = scene ? toAvnacDocument(scene) : pages[currentPage]!;
    const updatedPages = pages.map((p, i) =>
      i === currentPage ? currentDoc : p,
    );
    const { nextState } = buildInsertImportedPageResult(
      { currentPage, pages: updatedPages },
      importedDoc,
    );
    await applyPageTransition(
      nextState.pages,
      nextState.currentPage,
      documentId,
      true,
      set,
    );
  },

  importWorkspace: async (file: File) => {
    const { documentId } = get();
    if (!documentId) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return;
    }
    // Accept both workspace (multi-page) and single-page .avnac files.
    const imported = parseAvnacImport(raw);
    if (!imported) return;
    const newPages =
      imported.kind === "multi" ? imported.document.pages : [imported.document];
    const newCurrentPage =
      imported.kind === "multi" ? imported.document.currentPage : 0;
    // Full workspace replace — reset page history.
    pageHistoryRef = null;
    await applyPageTransition(newPages, newCurrentPage, documentId, false, set);
    pageHistoryRef = createPageHistory<AvnacDocumentV1>(
      { pages: newPages, currentPage: newCurrentPage },
      clonePageDoc,
    );
  },

  exportWorkspace: async () => {
    const { pages, currentPage, documentName, scene } = get();
    const currentDoc = scene ? toAvnacDocument(scene) : pages[currentPage];
    if (!currentDoc) return;
    const allPages = pages.map((p, i) => (i === currentPage ? currentDoc : p));
    await exportJsonFile(
      `${safeAvnacFileBaseName(documentName)}.workspace.avnac`,
      buildMultiPageDocument(allPages, currentPage),
    );
  },

  exportCurrentPage: async () => {
    const { pages, currentPage, documentName, scene } = get();
    const currentDoc = scene ? toAvnacDocument(scene) : pages[currentPage];
    if (!currentDoc) return;
    await exportJsonFile(
      `${safeAvnacFileBaseName(documentName)}-page-${currentPage + 1}.page.avnac`,
      currentDoc,
    );
  },

  setDocumentName: (name: string) => set({ documentName: name }),

  commitDocumentName: async () => {
    const { documentId, documentName } = get();
    if (!documentId) return;
    const name = documentName.trim() || "Untitled";
    set({ documentName: name });
    await idbSetDocumentName(documentId, name);
  },
}));
