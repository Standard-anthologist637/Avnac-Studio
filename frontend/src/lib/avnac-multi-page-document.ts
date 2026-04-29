import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import { AVNAC_DOC_VERSION, parseAvnacDocument } from "@/lib/avnac-document";

export const AVNAC_MULTI_PAGE_DOC_KIND = "avnac-multi-page-document" as const;
export const AVNAC_MULTI_PAGE_DOC_VERSION = 1 as const;

export type AvnacMultiPageDocumentV1 = {
  kind: typeof AVNAC_MULTI_PAGE_DOC_KIND;
  v: typeof AVNAC_MULTI_PAGE_DOC_VERSION;
  currentPage: number;
  pages: AvnacDocumentV1[];
};

export type ParsedAvnacImport =
  | { kind: "single"; document: AvnacDocumentV1 }
  | { kind: "multi"; document: AvnacMultiPageDocumentV1 };

function cloneDoc(doc: AvnacDocumentV1): AvnacDocumentV1 {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as AvnacDocumentV1;
}

export function clampPageIndex(pageCount: number, index: number): number {
  if (pageCount <= 1) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(pageCount - 1, Math.max(0, Math.trunc(index)));
}

export function buildMultiPageDocument(
  pages: readonly AvnacDocumentV1[],
  currentPage: number,
): AvnacMultiPageDocumentV1 {
  const safePages =
    pages.length > 0 ? pages.map(cloneDoc) : [cloneDoc(createEmptyPage())];
  return {
    kind: AVNAC_MULTI_PAGE_DOC_KIND,
    v: AVNAC_MULTI_PAGE_DOC_VERSION,
    currentPage: clampPageIndex(safePages.length, currentPage),
    pages: safePages,
  };
}

export function parseMultiPageDocument(
  raw: unknown,
): AvnacMultiPageDocumentV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<AvnacMultiPageDocumentV1>;
  if (
    candidate.kind !== AVNAC_MULTI_PAGE_DOC_KIND ||
    candidate.v !== AVNAC_MULTI_PAGE_DOC_VERSION ||
    !Array.isArray(candidate.pages)
  ) {
    return null;
  }

  const pages = candidate.pages
    .map((page) => parseAvnacDocument(page))
    .filter((page): page is AvnacDocumentV1 => Boolean(page));
  if (pages.length === 0) return null;

  return {
    kind: AVNAC_MULTI_PAGE_DOC_KIND,
    v: AVNAC_MULTI_PAGE_DOC_VERSION,
    currentPage: clampPageIndex(
      pages.length,
      Number(candidate.currentPage ?? 0),
    ),
    pages,
  };
}

export function parseAvnacImport(raw: unknown): ParsedAvnacImport | null {
  const single = parseAvnacDocument(raw);
  if (single) return { kind: "single", document: single };

  const multi = parseMultiPageDocument(raw);
  if (multi) return { kind: "multi", document: multi };

  return null;
}

export function createEmptyPage(from?: AvnacDocumentV1): AvnacDocumentV1 {
  const base = from
    ? cloneDoc(from)
    : {
        v: AVNAC_DOC_VERSION,
        artboard: { width: 4000, height: 4000 },
        bg: { type: "solid", color: "#ffffff" } as AvnacDocumentV1["bg"],
        fabric: { objects: [] },
      };

  return {
    ...base,
    fabric: { objects: [] },
  };
}

export function clonePages(
  pages: readonly AvnacDocumentV1[],
): AvnacDocumentV1[] {
  return pages.map(cloneDoc);
}
