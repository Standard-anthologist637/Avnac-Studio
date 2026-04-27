import { ExportFile } from "../../wailsjs/go/avnacio/IOManager";

function downloadJsonViaBrowser(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportJsonFile(
  filename: string,
  payload: unknown,
): Promise<void> {
  const text = JSON.stringify(payload, null, 2);
  const hasNativeBridge =
    typeof window !== "undefined" &&
    typeof (window as unknown as { go?: unknown }).go !== "undefined";

  if (!hasNativeBridge) {
    downloadJsonViaBrowser(filename, payload);
    return;
  }

  try {
    const bytes = Array.from(new TextEncoder().encode(text));
    await ExportFile(filename, bytes);
  } catch (error) {
    console.error("[avnac] native export failed, falling back to browser", error);
    downloadJsonViaBrowser(filename, payload);
  }
}