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
import type { SaraswatiClipPath } from "@/lib/saraswati/types";
import { idbGetEditorRecord, idbPutDocument } from "@/lib/avnac-editor-idb";
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

function saraswatiClipPathToFabricClipPath(clipPath: SaraswatiClipPath | null) {
  if (!clipPath) return null;
  if (clipPath.type === "ellipse") {
    return {
      type: "ellipse",
      left: clipPath.x,
      top: clipPath.y,
      originX: "center",
      originY: "center",
      rx: clipPath.width / 2,
      ry: clipPath.height / 2,
      width: clipPath.width,
      height: clipPath.height,
    } as Record<string, unknown>;
  }
  return {
    type: "rect",
    left: clipPath.x,
    top: clipPath.y,
    originX: "center",
    originY: "center",
    width: clipPath.width,
    height: clipPath.height,
    rx: clipPath.radiusX,
    ry: clipPath.radiusY,
  } as Record<string, unknown>;
}

function patchClipPathOnFabricObjects(
  objects: unknown[],
  updates: Map<string, Record<string, unknown> | null>,
): unknown[] {
  return objects.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const obj = entry as Record<string, unknown>;
    const next: Record<string, unknown> = { ...obj };
    const layerId =
      typeof obj.avnacLayerId === "string" ? obj.avnacLayerId : null;
    if (layerId && updates.has(layerId)) {
      const clipPath = updates.get(layerId) ?? null;
      if (clipPath) {
        next.clipPath = clipPath;
      } else {
        delete next.clipPath;
      }
    }
    if (Array.isArray(obj.objects)) {
      next.objects = patchClipPathOnFabricObjects(obj.objects, updates);
    }
    return next;
  });
}

function applyClipPathCommandsToDocument(
  doc: AvnacDocumentV1,
  commands: SaraswatiCommand[],
): AvnacDocumentV1 {
  const updates = new Map<string, Record<string, unknown> | null>();
  for (const command of commands) {
    if (command.type === "SET_NODE_CLIP_PATH") {
      updates.set(
        command.id,
        saraswatiClipPathToFabricClipPath(command.clipPath),
      );
      continue;
    }
    if (command.type === "SET_NODE_CLIP_STACK") {
      const topMost =
        command.clipPathStack[command.clipPathStack.length - 1] ?? null;
      updates.set(command.id, saraswatiClipPathToFabricClipPath(topMost));
    }
  }
  if (updates.size === 0) return doc;
  const fabric = doc.fabric as Record<string, unknown>;
  const rawObjects = fabric.objects;
  if (!Array.isArray(rawObjects)) return doc;
  const nextObjects = patchClipPathOnFabricObjects(rawObjects, updates);
  return {
    ...doc,
    fabric: {
      ...fabric,
      objects: nextObjects,
    },
  } as AvnacDocumentV1;
}

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
      detachSceneEngineSubscription = sceneEngineStore.subscribe(
        (nextState) => {
          set({ scene: nextState.scene });
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
    set({
      hasPendingChanges: true,
      scene: sceneEngineStore.getState().scene,
      baseDocument: nextBaseDocument,
    });
  },

  setSelectedIds: (selectedIds: string[]) => set({ selectedIds }),

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
