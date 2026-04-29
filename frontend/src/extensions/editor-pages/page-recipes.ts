import type { AvnacDocumentV1 } from "../../../lib/avnac-document";
import { clampPageIndex, createEmptyPage } from "./multi-page-document";
import { clonePageDoc } from "./page-state";

type PageState = {
  currentPage: number;
  pages: AvnacDocumentV1[];
};

type PageUpdateResult = {
  nextState: PageState;
  nextDoc: AvnacDocumentV1;
};

export function buildGoToPageResult(
  prev: PageState,
  targetIndex: number,
): PageUpdateResult {
  const nextIndex = clampPageIndex(prev.pages.length, targetIndex);
  return {
    nextState: {
      currentPage: nextIndex,
      pages: prev.pages,
    },
    nextDoc: prev.pages[nextIndex]!,
  };
}

export function buildAddPageResult(
  prev: PageState,
  currentDoc: AvnacDocumentV1,
): PageUpdateResult {
  const nextPage = createEmptyPage(currentDoc);
  const nextIndex = prev.currentPage + 1;
  const pages = [...prev.pages];
  pages.splice(nextIndex, 0, nextPage);
  return {
    nextState: {
      currentPage: nextIndex,
      pages,
    },
    nextDoc: nextPage,
  };
}

export function buildDeletePageResult(prev: PageState): PageUpdateResult {
  if (prev.pages.length <= 1) {
    return {
      nextState: prev,
      nextDoc: prev.pages[prev.currentPage]!,
    };
  }
  const pages = prev.pages.filter((_, index) => index !== prev.currentPage);
  const nextIndex = Math.min(prev.currentPage, pages.length - 1);
  return {
    nextState: {
      currentPage: nextIndex,
      pages,
    },
    nextDoc: pages[nextIndex]!,
  };
}

export function buildInsertImportedPageResult(
  prev: PageState,
  importedDoc: AvnacDocumentV1,
): PageUpdateResult {
  const insertIndex = prev.currentPage + 1;
  const pages = [...prev.pages];
  pages.splice(insertIndex, 0, clonePageDoc(importedDoc));
  return {
    nextState: {
      currentPage: insertIndex,
      pages,
    },
    nextDoc: pages[insertIndex]!,
  };
}
