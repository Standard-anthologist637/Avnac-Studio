/** Matches the chrome stacked above the editor canvas in `EditorContainer`. */
export const editorSidebarTopValue =
  "var(--avnac-editor-sidebar-top,var(--avnac-editor-top-offset,calc(0.75rem+2.5rem+0.75rem+1px+0.75rem)))";

export const editorSidebarPanelTopClass =
  "top-[var(--avnac-editor-sidebar-top,var(--avnac-editor-top-offset,calc(0.75rem+2.5rem+0.75rem+1px+0.75rem)))]";

/** Past the icon-only tools rail (left-3 + p-1.5 + size-10 + p-1.5 ≈ 4rem) plus gap. */
export const editorSidebarPanelLeftClass = "left-[4.5rem]";
