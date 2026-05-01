/**
 * Global Zustand store for the dedicated /scene editor page.
 * Components read from this store via useSceneEditorStore(selector) — no prop
 * drilling needed.  The store is module-level (not per-instance) because only
 * one scene editor page is open at a time.
 */
import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import {
  createSaraswatiEditorStore,
  type SaraswatiCommand,
  type SaraswatiEditorStore,
  type SaraswatiScene,
} from "@/lib/saraswati";
import { fromAvnacDocument } from "@/lib/saraswati/compat/from-fabric";
import {
  idbGetEditorRecord,
  idbPutDocument,
} from "@/lib/avnac-editor-idb";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

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
};

type SceneEditorActions = {
  /** Load a document by persisted ID. Replaces any existing state. */
  load: (id: string) => Promise<void>;
  /** Apply one or more Saraswati commands to the live scene. */
  applyCommands: (commands: SaraswatiCommand[]) => void;
  setSelectedIds: (ids: string[]) => void;
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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

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
};

let sceneEngineStore: SaraswatiEditorStore | null = null;
let detachSceneEngineSubscription: (() => void) | null = null;

function resetSceneEngineBinding() {
  detachSceneEngineSubscription?.();
  detachSceneEngineSubscription = null;
  sceneEngineStore = null;
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
      detachSceneEngineSubscription = sceneEngineStore.subscribe((nextState) => {
        set({ scene: nextState.scene });
      });
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
    set({
      hasPendingChanges: true,
      scene: sceneEngineStore.getState().scene,
    });
  },

  setSelectedIds: (selectedIds: string[]) => set({ selectedIds }),

  save: async () => {
    const { documentId, baseDocument } = get();
    if (!documentId || !baseDocument) return;
    // TODO: replace with Saraswati→AvnacDocument serializer once implemented.
    await idbPutDocument(documentId, baseDocument);
    set({ hasPendingChanges: false });
  },

  reset: () => {
    resetSceneEngineBinding();
    set(INITIAL);
  },
}));
