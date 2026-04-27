import { AVNAC_STORAGE_KEY } from "./avnac-document";

const LEGACY_DB_NAME = "avnac-editor";
const LEGACY_CLEANUP_MARKER = "avnac-legacy-browser-storage-cleared-v1";
const LEGACY_VECTOR_PREFIXES = [
  "avnac-vector-boards:",
  "avnac-vector-board-docs:",
];

export function clearLegacyBrowserWorkspaceStorage(): void {
  if (typeof window === "undefined") return;

  try {
    if (window.localStorage.getItem(LEGACY_CLEANUP_MARKER) === "1") return;
  } catch {
    /* ignore browser storage cleanup failures */
  }

  try {
    window.localStorage.removeItem(AVNAC_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (LEGACY_VECTOR_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore browser storage cleanup failures */
  }

  try {
    if (!("indexedDB" in window)) return;
    const request = window.indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onerror = () => {
      console.warn("[avnac] failed to delete legacy IndexedDB store");
    };
    request.onblocked = () => {
      console.warn(
        "[avnac] legacy IndexedDB deletion is blocked by another window",
      );
    };
  } catch {
    /* ignore browser storage cleanup failures */
  }

  try {
    window.localStorage.setItem(LEGACY_CLEANUP_MARKER, "1");
  } catch {
    /* ignore browser storage cleanup failures */
  }
}
