import {
  ReadPages,
  WritePages,
  DeletePages,
  DuplicatePages,
} from "../../wailsjs/go/avnacio/IOManager";
import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import {
  buildMultiPageDocument,
  clonePages,
  parseMultiPageDocument,
  type AvnacMultiPageDocumentV1,
} from "@/lib/avnac-multi-page-document";

async function readStorage(
  persistId: string,
): Promise<AvnacMultiPageDocumentV1 | null> {
  try {
    const raw = await ReadPages(persistId);
    if (!raw) return null;
    return parseMultiPageDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadStoredPages(
  persistId: string,
  currentDoc: AvnacDocumentV1,
): Promise<AvnacMultiPageDocumentV1> {
  const stored = await readStorage(persistId);
  if (!stored) {
    return buildMultiPageDocument([currentDoc], 0);
  }

  const pages = clonePages(stored.pages);
  const index = Math.min(stored.currentPage, pages.length - 1);
  pages[index] = currentDoc;
  return buildMultiPageDocument(pages, index);
}

export async function saveStoredPages(
  persistId: string,
  pages: readonly AvnacDocumentV1[],
  currentPage: number,
): Promise<void> {
  try {
    await WritePages(
      persistId,
      JSON.stringify(buildMultiPageDocument(pages, currentPage)),
    );
  } catch (err) {
    console.error("[avnac] saveStoredPages failed", err);
  }
}

export async function clearStoredPages(persistId: string): Promise<void> {
  try {
    await DeletePages(persistId);
  } catch (err) {
    console.error("[avnac] clearStoredPages failed", err);
  }
}

export async function duplicateStoredPages(
  sourceId: string,
  targetId: string,
): Promise<void> {
  try {
    await DuplicatePages(sourceId, targetId);
  } catch (err) {
    console.error("[avnac] duplicateStoredPages failed", err);
  }
}

export async function readStoredPagesForExport(
  persistId: string,
  currentDoc: AvnacDocumentV1,
): Promise<AvnacMultiPageDocumentV1> {
  return loadStoredPages(persistId, currentDoc);
}
