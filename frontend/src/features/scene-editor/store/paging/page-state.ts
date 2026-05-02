import type { AvnacDocumentV1 } from "@/lib/avnac-document";

export function clonePageDoc(doc: AvnacDocumentV1): AvnacDocumentV1 {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as AvnacDocumentV1;
}

export function withCurrentDocInPages(
  currentPage: number,
  pages: AvnacDocumentV1[],
  currentDoc: AvnacDocumentV1,
): AvnacDocumentV1[] {
  return pages.map((page, index) =>
    index === currentPage ? currentDoc : clonePageDoc(page),
  );
}
