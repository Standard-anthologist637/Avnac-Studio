import { idbPutDocument } from "@/lib/avnac-editor-idb";
import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import type { SaraswatiCommand } from "@/lib/saraswati";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { SceneWorkspacePreviewMode } from "./store";

type UseSceneWorkspaceControllerInput = {
  ready: boolean;
  mode: SceneWorkspacePreviewMode;
  captureDocument: () => AvnacDocumentV1;
  persistId?: string;
  persistDisplayName?: string;
};

export function useSceneWorkspaceController({
  ready,
  mode,
  captureDocument,
  persistId,
  persistDisplayName,
}: UseSceneWorkspaceControllerInput) {
  const [previewDocumentRevision, bumpPreviewDocumentRevision] = useReducer(
    (value: number) => value + 1,
    0,
  );
  const [previewCommands, setPreviewCommands] = useState<
    readonly SaraswatiCommand[]
  >([]);

  const persistIdRef = useRef<string | undefined>(persistId);
  persistIdRef.current = persistId;
  const persistDisplayNameRef = useRef(
    persistDisplayName?.trim() ? persistDisplayName.trim() : "Untitled",
  );
  persistDisplayNameRef.current = persistDisplayName?.trim()
    ? persistDisplayName.trim()
    : "Untitled";

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistedDocumentRef = useRef<AvnacDocumentV1 | null>(null);
  const captureDocumentRef = useRef(captureDocument);
  captureDocumentRef.current = captureDocument;

  const previewDocument = useMemo(() => {
    if (!ready || mode === "off") return null;
    return captureDocument();
  }, [captureDocument, mode, previewDocumentRevision, ready]);

  useEffect(() => {
    setPreviewCommands([]);
  }, [previewDocument]);

  const setPendingPersistedDocument = useCallback(
    (document: AvnacDocumentV1 | null) => {
      pendingPersistedDocumentRef.current = document;
    },
    [],
  );

  const stagePreviewCommands = useCallback(
    (commands: readonly SaraswatiCommand[]) => {
      if (commands.length === 0) return;
      setPreviewCommands((current) => [...current, ...commands]);
    },
    [],
  );

  const clearPreviewCommands = useCallback(() => {
    setPreviewCommands([]);
  }, []);

  const flushAutosave = useCallback(() => {
    const nextPersistId = persistIdRef.current;
    const nextDocument = pendingPersistedDocumentRef.current;
    if (!nextPersistId || !nextDocument) return;
    pendingPersistedDocumentRef.current = null;
    void idbPutDocument(nextPersistId, nextDocument, {
      name: persistDisplayNameRef.current,
    }).catch((error) => {
      console.error("SceneWorkspace: workspace autosave failed", error);
    });
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (!persistIdRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      if (!pendingPersistedDocumentRef.current) {
        pendingPersistedDocumentRef.current = captureDocumentRef.current();
      }
      flushAutosave();
    }, 1500);
  }, [flushAutosave]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      flushAutosave();
    };
  }, [flushAutosave]);

  return {
    previewDocument,
    previewDocumentRevision,
    bumpPreviewDocumentRevision,
    previewCommands,
    stagePreviewCommands,
    clearPreviewCommands,
    pendingPersistedDocumentRef,
    setPendingPersistedDocument,
    scheduleAutosave,
    flushAutosave,
  };
}
