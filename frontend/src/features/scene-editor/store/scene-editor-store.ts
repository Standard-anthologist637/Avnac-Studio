/**
 * Global Zustand store for the dedicated /scene editor page.
 * Components read from this store via useSceneEditorStore(selector) — no prop
 * drilling needed.  The store is module-level (not per-instance) because only
 * one scene editor page is open at a time.
 */
import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import {
  createSaraswatiEditorStore,
  type SaraswatiColor,
  type SaraswatiCommand,
  type SaraswatiEditorStore,
  type SaraswatiScene,
} from "@/lib/saraswati";
import { fromAvnacDocument } from "@/lib/saraswati/compat/from-fabric";
import { idbGetEditorRecord, idbPutDocument } from "@/lib/avnac-editor-idb";
import { create } from "zustand";
import {
  addClipToSelection,
  insertArrow,
  insertEllipse,
  insertImage,
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
import { applyClipPathCommandsToDocument } from "./persistence-store";

type SceneEditorState = {
  documentId: string | null;
  documentName: string;
  /** Original document as loaded from IDB — never mutated after load. */
  baseDocument: AvnacDocumentV1 | null;
  /** Live scene — updated by every applied command. */
  scene: SaraswatiScene | null;
  /** Issues from the Fabric→Saraswati adapter at load time. */
  adapterIssueCount: number;
  /** Currently selected node IDs in the scene. */
  selectedIds: string[];
  isLoading: boolean;
  loadError: string | null;
  /** True after at least one command has been applied since the last save. */
  hasPendingChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  focusMode: boolean;
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
  setSelectedIds: (ids: string[]) => void;
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
  insertImage: () => void;
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
  toggleFocusMode: () => void;
  /**
   * Persist the current document back to IDB.
   * NOTE: full Saraswati→AvnacDocument serialisation is not yet implemented.
   * This currently writes the original baseDocument back (updating updatedAt)
   * so the file stays visible in the recent list.  Scene-mutation persistence
   * is tracked in task.md under "Connect scene workspace commands back to
   * document persistence/history".
   */
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
  selectedIds: [],
  isLoading: false,
  loadError: null,
  hasPendingChanges: false,
  canUndo: false,
  canRedo: false,
  focusMode: false,
  renderStats: {
    ms: 0,
    commands: 0,
    duplicateCommands: 0,
  },
};

let sceneEngineStore: SaraswatiEditorStore | null = null;
let detachSceneEngineSubscription: (() => void) | null = null;

function resetSceneEngineBinding() {
  detachSceneEngineSubscription?.();
  detachSceneEngineSubscription = null;
  sceneEngineStore = null;
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
      const { scene, issues } = fromAvnacDocument(record.document);
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
    const current = get();
    const nextBaseDocument = current.baseDocument
      ? applyClipPathCommandsToDocument(current.baseDocument, commands)
      : current.baseDocument;
    const engineState = sceneEngineStore.getState();
    set({
      hasPendingChanges: true,
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      baseDocument: nextBaseDocument,
    });
  },

  setSelectedIds: (selectedIds: string[]) => set({ selectedIds }),

  setRenderStats: (renderStats) => set({ renderStats }),

  insertRect: () => insertRect(asInsertContext(get())),
  insertEllipse: () => insertEllipse(asInsertContext(get())),
  insertPolygon: () => insertPolygon(asInsertContext(get())),
  insertStar: () => insertStar(asInsertContext(get())),
  insertLine: () => insertLine(asInsertContext(get())),
  insertArrow: () => insertArrow(asInsertContext(get())),
  insertText: () => insertText(asInsertContext(get())),
  insertImage: () => insertImage(asInsertContext(get())),
  insertVectorBoard: () => insertVectorBoard(asInsertContext(get())),
  addClipToSelection: () => addClipToSelection(asInsertContext(get())),
  removeClipFromSelection: () =>
    removeClipFromSelection(asInsertContext(get())),
  resetClipOnSelection: () => resetClipOnSelection(asInsertContext(get())),

  undo: () => {
    if (!sceneEngineStore) return;
    sceneEngineStore.undo();
    const engineState = sceneEngineStore.getState();
    set({
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      hasPendingChanges: true,
    });
  },

  redo: () => {
    if (!sceneEngineStore) return;
    sceneEngineStore.redo();
    const engineState = sceneEngineStore.getState();
    set({
      scene: engineState.scene,
      canUndo: engineState.canUndo,
      canRedo: engineState.canRedo,
      hasPendingChanges: true,
    });
  },

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

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

  save: async () => {
    const { documentId, baseDocument } = get();
    if (!documentId || !baseDocument) return;
    // Writes latest document snapshot, including scene-authored clip-path edits.
    await idbPutDocument(documentId, baseDocument);
    set({ hasPendingChanges: false });
  },

  reset: () => {
    resetSceneEngineBinding();
    set(INITIAL);
  },
}));
