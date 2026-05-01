/**
 * Global Zustand store for the dedicated /scene editor page.
 * Components read from this store via useSceneEditorStore(selector) — no prop
 * drilling needed.  The store is module-level (not per-instance) because only
 * one scene editor page is open at a time.
 */
import type { AvnacDocumentV1 } from "@/lib/avnac-document";
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
import { idbGetEditorRecord, idbPutDocument } from "@/lib/avnac-editor-idb";
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
};

type SceneEditorActions = {
  /** Load a document by persisted ID. Replaces any existing state. */
  load: (id: string) => Promise<void>;
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
};

let sceneEngineStore: SaraswatiEditorStore | null = null;
let detachSceneEngineSubscription: (() => void) | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

const AUTOSAVE_DELAY_MS = 1500;

function scheduleAutosave(
  documentId: string,
  scene: SaraswatiScene,
): void {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    const doc = toAvnacDocument(scene);
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

  load: async (id: string) => {
    set({ ...INITIAL, isLoading: true, documentId: id });
    resetSceneEngineBinding();
    try {
      const record = await idbGetEditorRecord(id);
      if (!record) {
        set({ isLoading: false, loadError: "Document not found." });
        return;
      }
      const { result: adapted, diagnostics } = fromAvnacDocumentWithDiagnostics(
        record.document,
      );
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
      set({
        isLoading: false,
        documentName: record.name ?? "Untitled",
        baseDocument: record.document,
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
    if (documentId) scheduleAutosave(documentId, engineState.scene);
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
    if (documentId) scheduleAutosave(documentId, engineState.scene);
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
    if (!sceneEngineStore) return;
    sceneEngineStore.undo();
    const engineState = sceneEngineStore.getState();
    const { documentId } = get();
    set({
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      baseDocument: toAvnacDocument(engineState.scene),
      hasPendingChanges: true,
    });
    if (documentId) scheduleAutosave(documentId, engineState.scene);
  },

  redo: () => {
    if (!sceneEngineStore) return;
    sceneEngineStore.redo();
    const engineState = sceneEngineStore.getState();
    const { documentId } = get();
    set({
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      baseDocument: toAvnacDocument(engineState.scene),
      hasPendingChanges: true,
    });
    if (documentId) scheduleAutosave(documentId, engineState.scene);
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
    const { documentId, scene, baseDocument } = get();
    if (!documentId) return;
    const documentToSave = scene ? toAvnacDocument(scene) : baseDocument;
    if (!documentToSave) return;
    await idbPutDocument(documentId, documentToSave);
    set({ baseDocument: documentToSave, hasPendingChanges: false });
  },

  reset: () => {
    resetSceneEngineBinding();
    set(INITIAL);
  },
}));
