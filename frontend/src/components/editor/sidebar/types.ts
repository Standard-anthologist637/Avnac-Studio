export type EditorSidebarPanelId =
  | "layers"
  | "uploads"
  | "images"
  | "vector-board"
  | "apps"
  | "ai";

export type EditorLayerRow = {
  id: string;
  index: number;
  label: string;
  visible: boolean;
  selected: boolean;
};