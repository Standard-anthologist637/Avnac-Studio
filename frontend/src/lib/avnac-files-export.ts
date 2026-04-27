import { idbGetEditorRecord } from "./avnac-editor-idb";
import { readStoredPagesForExport } from "../extensions/editor-pages/multi-page-storage";
import { exportJsonFile } from "./avnac-native-export";

export function safeAvnacFileBaseName(name: string): string {
  const t = name.trim() || "untitled";
  const s = t
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return s || "untitled";
}

export async function downloadAvnacJsonForId(id: string): Promise<boolean> {
  const record = await idbGetEditorRecord(id);
  if (!record) return false;
  const exportDoc = readStoredPagesForExport(id, record.document);
  const payload = exportDoc.pages.length > 1 ? exportDoc : record.document;
  const suffix =
    exportDoc.pages.length > 1 ? ".workspace.avnac" : ".page.avnac";
  await exportJsonFile(
    `${safeAvnacFileBaseName(record.name ?? "Untitled")}${suffix}`,
    payload,
  );
  return true;
}
