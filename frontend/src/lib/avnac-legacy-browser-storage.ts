const LEGACY_DB_NAME = 'avnac-editor'


export function clearLegacyBrowserWorkspaceStorage(): void {
  if (typeof window === 'undefined') return


  try {
    if (!('indexedDB' in window)) return
    const request = window.indexedDB.deleteDatabase(LEGACY_DB_NAME)
    request.onerror = () => {
      console.warn('[avnac] failed to delete legacy IndexedDB store')
    }
    request.onblocked = () => {
      console.warn('[avnac] legacy IndexedDB deletion is blocked by another window')
    }
  } catch {
    /* ignore browser storage cleanup failures */
  }
}