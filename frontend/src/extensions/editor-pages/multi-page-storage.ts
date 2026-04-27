import type { AvnacDocumentV1 } from "../../lib/avnac-document";
import {
  buildMultiPageDocument,
  clonePages,
  parseMultiPageDocument,
  type AvnacMultiPageDocumentV1,
} from "./multi-page-document";

const STORAGE_KEY_PREFIX = "avnac:editor-pages:";

function storageKey(persistId: string): string {
  return `${STORAGE_KEY_PREFIX}${persistId}`;
}

function readStorage(persistId: string): AvnacMultiPageDocumentV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(persistId));
    if (!raw) return null;
    return parseMultiPageDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadStoredPages(
  persistId: string,
  currentDoc: AvnacDocumentV1,
): AvnacMultiPageDocumentV1 {
  const stored = readStorage(persistId);
  if (!stored) {
    return buildMultiPageDocument([currentDoc], 0);
  }

  const pages = clonePages(stored.pages);
  const index = Math.min(stored.currentPage, pages.length - 1);
  pages[index] = currentDoc;
  return buildMultiPageDocument(pages, index);
}

export function saveStoredPages(
  persistId: string,
  pages: readonly AvnacDocumentV1[],
  currentPage: number,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(persistId),
      JSON.stringify(buildMultiPageDocument(pages, currentPage)),
    );
  } catch (err) {
    console.error("[avnac] saveStoredPages failed", err);
  }
}

export function clearStoredPages(persistId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(persistId));
  } catch (err) {
    console.error("[avnac] clearStoredPages failed", err);
  }
}

export function duplicateStoredPages(sourceId: string, targetId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(storageKey(sourceId));
    if (!raw) return;
    window.localStorage.setItem(storageKey(targetId), raw);
  } catch (err) {
    console.error("[avnac] duplicateStoredPages failed", err);
  }
}

export function readStoredPagesForExport(
  persistId: string,
  currentDoc: AvnacDocumentV1,
): AvnacMultiPageDocumentV1 {
  return loadStoredPages(persistId, currentDoc);
}
