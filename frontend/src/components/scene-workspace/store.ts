import type { EditorSidebarPanelId } from "@/components/editor/sidebar/editor-floating-sidebar";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type SceneWorkspacePreviewMode = "off" | "split" | "full";

export type SceneWorkspaceState = {
  previewMode: SceneWorkspacePreviewMode;
  sidebarPanel: EditorSidebarPanelId | null;
  focusMode: boolean;
  shortcutsOpen: boolean;
  setPreviewMode: (mode: SceneWorkspacePreviewMode) => void;
  cyclePreviewMode: () => void;
  setSidebarPanel: (panel: EditorSidebarPanelId | null) => void;
  toggleSidebarPanel: (panel: EditorSidebarPanelId) => void;
  setFocusMode: (value: boolean) => void;
  toggleFocusMode: () => void;
  setShortcutsOpen: (value: boolean) => void;
  resetChrome: () => void;
};

export type SceneWorkspaceStore = ReturnType<typeof createSceneWorkspaceStore>;

const PREVIEW_MODE_ORDER: SceneWorkspacePreviewMode[] = [
  "off",
  "split",
  "full",
];

export function createSceneWorkspaceStore(initial?: {
  previewMode?: SceneWorkspacePreviewMode;
  sidebarPanel?: EditorSidebarPanelId | null;
}) {
  return createStore<SceneWorkspaceState>()((set, get) => ({
    previewMode: initial?.previewMode ?? "off",
    sidebarPanel: initial?.sidebarPanel ?? null,
    focusMode: false,
    shortcutsOpen: false,
    setPreviewMode: (previewMode) => set({ previewMode }),
    cyclePreviewMode: () => {
      const current = get().previewMode;
      const index = PREVIEW_MODE_ORDER.indexOf(current);
      const next = PREVIEW_MODE_ORDER[(index + 1) % PREVIEW_MODE_ORDER.length]!;
      set({ previewMode: next });
    },
    setSidebarPanel: (sidebarPanel) => set({ sidebarPanel }),
    toggleSidebarPanel: (sidebarPanel) =>
      set((state) => ({
        sidebarPanel: state.sidebarPanel === sidebarPanel ? null : sidebarPanel,
      })),
    setFocusMode: (focusMode) => set({ focusMode }),
    toggleFocusMode: () =>
      set((state) => ({
        focusMode: !state.focusMode,
      })),
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
    resetChrome: () =>
      set({
        sidebarPanel: null,
        shortcutsOpen: false,
      }),
  }));
}

export function useSceneWorkspaceStore<T>(
  store: SceneWorkspaceStore,
  selector: (state: SceneWorkspaceState) => T,
) {
  return useStore(store, selector);
}
