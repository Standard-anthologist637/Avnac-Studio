import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import type { EditorSidebarPanelId } from "@/components/editor/sidebar/editor-floating-sidebar";
import type { ExportPngOptions } from "@/lib/png-export";

export type FabricEditorHandle = {
  exportPng: (opts?: ExportPngOptions) => void;
  saveDocument: () => void;
  loadDocument: (file: File) => Promise<void>;
  captureDocument: () => AvnacDocumentV1;
  applyDocument: (doc: AvnacDocumentV1) => Promise<void>;
  hasSelection: () => boolean;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
};

export type FabricEditorProps = {
  onReadyChange?: (ready: boolean) => void;
  /** When set, document is restored from and autosaved to the native workspace store under this id. */
  persistId?: string;
  /** Stored with each native workspace save (file name in the editor header). */
  persistDisplayName?: string;
  /** When there is no saved document yet, seed artboard size (e.g. from /create?w=&h=). */
  initialArtboardWidth?: number;
  initialArtboardHeight?: number;
  /** Optional controlled UI state for workspace-level sidebar orchestration. */
  activeSidebarPanel?: EditorSidebarPanelId | null;
  onActiveSidebarPanelChange?: (panel: EditorSidebarPanelId | null) => void;
};

export type EditorContextMenuState = {
  x: number;
  y: number;
  sceneX: number;
  sceneY: number;
  hasSelection: boolean;
  locked: boolean;
};
