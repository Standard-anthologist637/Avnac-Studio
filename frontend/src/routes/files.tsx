import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, FileImportIcon } from "@hugeicons/core-free-icons";
import { usePostHog } from "posthog-js/react";
import { avnacconfig } from "../../wailsjs/go/models";
import DeleteConfirmDialog from "../components/delete-confirm-dialog";
import FileGridCard from "../components/file-grid-card";
import FilesSettingsSection from "../components/files-settings-section";
import FilesMultiselectBar from "../components/files-multiselect-bar";
import NewCanvasDialog from "../components/new-canvas-dialog";
import { avnacDocumentPreviewEvictPersistId } from "../lib/avnac-document-preview";
import {
  idbDeleteDocument,
  idbListDocuments,
  idbPutDocument,
  type AvnacEditorIdbListItem,
} from "../lib/avnac-editor-idb";
import { downloadAvnacJsonForId } from "../lib/avnac-files-export";
import {
  clampPageIndex,
  parseAvnacImport,
} from "../extensions/editor-pages/multi-page-document";
import { saveStoredPages } from "../extensions/editor-pages/multi-page-storage";

export const Route = createFileRoute("/files")({
  component: FilesPage,
});

function formatUpdatedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

type WailsBridge = {
  avnacconfig?: {
    ConfigManager?: {
      Get?: () => Promise<avnacconfig.AppConfig>;
      Save?: (cfg: avnacconfig.AppConfig) => Promise<void>;
    };
  };
  avnacserver?: {
    UnsplashService?: {
      UpdateConfig?: (cfg: avnacconfig.AppConfig) => Promise<void>;
    };
  };
};

function getWailsBridge(): WailsBridge | null {
  if (typeof window === "undefined") return null;
  return ((window as Window & { go?: WailsBridge }).go ??
    null) as WailsBridge | null;
}

function isMissingConfigBridgeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /ConfigManager|Get|Save|undefined|not a function|unknown method/i.test(
    message,
  );
}

function formatConfigBridgeError(
  error: unknown,
  action: "load" | "save",
): string {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  if (!message) {
    return action === "load"
      ? "Could not load Unsplash settings from the desktop app."
      : "Could not save the Unsplash API key.";
  }
  if (isMissingConfigBridgeError(error)) {
    return "The desktop runtime does not expose the latest Unsplash config bridge yet. Restart the Wails app and try again.";
  }
  if (
    /window\.go|Cannot read properties of undefined|undefined is not an object/i.test(
      message,
    )
  ) {
    return "Unsplash settings are only available in the desktop Wails app.";
  }
  return action === "load"
    ? `Could not load Unsplash settings: ${message}`
    : `Could not save the Unsplash API key: ${message}`;
}

function FilesPage() {
  const [items, setItems] = useState<AvnacEditorIdbListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newCanvasOpen, setNewCanvasOpen] = useState(false);
  const [unsplashPanelOpen, setUnsplashPanelOpen] = useState(false);
  const [unsplashKey, setUnsplashKey] = useState("");
  const [unsplashLoading, setUnsplashLoading] = useState(true);
  const [unsplashSaving, setUnsplashSaving] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);
  const [unsplashNotice, setUnsplashNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    ids: string[];
    title: string;
    message: string;
  } | null>(null);
  const posthog = usePostHog();
  const importInputRef = useRef<HTMLInputElement>(null);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const refreshList = useCallback(() => {
    void idbListDocuments()
      .then((list) => {
        setItems(list);
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Could not load files.");
        setItems([]);
      });
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bridge = getWailsBridge()?.avnacconfig?.ConfigManager;
        if (!bridge?.Get) {
          throw new Error("ConfigManager.Get bridge unavailable");
        }
        const cfg = await bridge.Get();
        if (cancelled) return;
        setUnsplashKey((cfg?.unsplash_access_key ?? "").trim());
        setUnsplashError(null);
      } catch (err) {
        if (cancelled) return;
        setUnsplashError(formatConfigBridgeError(err, "load"));
        posthog.captureException(err);
      } finally {
        if (!cancelled) setUnsplashLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [posthog]);

  useEffect(() => {
    if (!items) return;
    if (items.length === 0) {
      setSelectedIds((prev) => (prev.length ? [] : prev));
      return;
    }
    const valid = new Set(items.map((i) => i.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deleteDialog) {
        e.preventDefault();
        setDeleteDialog(null);
        return;
      }
      if (selectedIds.length > 0) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteDialog, selectedIds.length, clearSelection]);

  const bulkDownload = useCallback(() => {
    const ids = [...selectedIds];
    posthog.capture("files_bulk_downloaded", { file_count: ids.length });
    void (async () => {
      try {
        for (const id of ids) {
          await downloadAvnacJsonForId(id);
          await new Promise((r) => setTimeout(r, 140));
        }
      } catch (err) {
        posthog.captureException(err);
        console.error("[avnac] bulk download failed", err);
      }
    })();
  }, [selectedIds, posthog]);

  const bulkTrash = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const n = ids.length;
    setDeleteDialog({
      ids,
      title: n === 1 ? "Remove this file?" : "Remove these files?",
      message:
        n === 1
          ? "This will permanently remove the file from this browser. This cannot be undone."
          : `This will permanently remove ${n} files from this browser. This cannot be undone.`,
    });
  }, [selectedIds]);

  const confirmDelete = useCallback(() => {
    if (!deleteDialog) return;
    const ids = [...deleteDialog.ids];
    setDeleteDialog(null);
    posthog.capture("file_deleted", { file_count: ids.length, file_ids: ids });
    void (async () => {
      try {
        for (const id of ids) {
          await idbDeleteDocument(id);
          avnacDocumentPreviewEvictPersistId(id);
        }
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
        refreshList();
      } catch (err) {
        posthog.captureException(err);
        console.error("[avnac] delete failed", err);
      }
    })();
  }, [deleteDialog, refreshList, posthog]);

  const requestDeleteFile = useCallback((id: string) => {
    setDeleteDialog({
      ids: [id],
      title: "Remove this file?",
      message:
        "This will permanently remove the file from this browser. This cannot be undone.",
    });
  }, []);

  const importWorkspace = useCallback(() => {
    const input = importInputRef.current;
    if (!input) return;
    input.click();
  }, []);

  const saveUnsplashKey = useCallback(() => {
    const nextKey = unsplashKey.trim();
    const nextConfig = new avnacconfig.AppConfig({
      unsplash_access_key: nextKey || undefined,
    });
    setUnsplashSaving(true);
    setUnsplashError(null);
    setUnsplashNotice(null);

    void (async () => {
      try {
        const bridge = getWailsBridge();
        const configBridge = bridge?.avnacconfig?.ConfigManager;
        if (!configBridge?.Save) {
          const unsplashBridge = bridge?.avnacserver?.UnsplashService;
          if (unsplashBridge?.UpdateConfig) {
            await unsplashBridge.UpdateConfig(nextConfig);
            setUnsplashKey(nextKey);
            setUnsplashNotice(
              "Unsplash API key updated for this session. Restart the Wails app to enable persistent saving.",
            );
            posthog.capture("unsplash_config_updated", {
              has_key: nextKey.length > 0,
              persisted: false,
            });
            return;
          }
          throw new Error("ConfigManager.Save bridge unavailable");
        }

        await configBridge.Save(nextConfig);
        setUnsplashKey(nextKey);
        setUnsplashNotice(
          nextKey
            ? "Unsplash API key updated for the desktop app."
            : "Unsplash API key cleared from the desktop app.",
        );
        posthog.capture("unsplash_config_updated", {
          has_key: nextKey.length > 0,
          persisted: true,
        });
      } catch (err) {
        setUnsplashError(formatConfigBridgeError(err, "save"));
        posthog.captureException(err);
        console.error("[avnac] save unsplash config failed", err);
      } finally {
        setUnsplashSaving(false);
      }
    })();
  }, [posthog, unsplashKey]);

  const onImportWorkspaceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;

      void (async () => {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as unknown;
          const imported = parseAvnacImport(parsed);
          if (!imported) return;

          const id = crypto.randomUUID();
          const baseName =
            file.name
              .replace(/\.(workspace|page)\.avnac$/i, "")
              .replace(/\.avnac\.json$/i, "")
              .replace(/\.(json|avnac)$/i, "")
              .trim() || "Imported";

          if (imported.kind === "single") {
            await idbPutDocument(id, imported.document, { name: baseName });
          } else {
            const index = clampPageIndex(
              imported.document.pages.length,
              imported.document.currentPage,
            );
            const currentDoc = imported.document.pages[index]!;
            await idbPutDocument(id, currentDoc, { name: baseName });
            saveStoredPages(id, imported.document.pages, index);
          }

          posthog.capture("workspace_imported_from_files", {
            file_name: file.name,
            imported_as: baseName,
          });
          refreshList();
        } catch (err) {
          posthog.captureException(err);
          console.error("[avnac] workspace import failed", err);
        }
      })();
    },
    [posthog, refreshList],
  );

  const selectionCount = selectedIds.length;

  return (
    <main className="hero-page relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div className="hero-bg-orb hero-bg-orb-a" aria-hidden="true" />
      <div className="hero-bg-orb hero-bg-orb-b" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] pt-4 sm:pt-5">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-5 sm:px-8 pointer-events-auto">
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/[0.12] bg-white/85 px-6 py-2.5 text-[15px] font-medium text-[var(--text)] transition hover:border-black/[0.2] hover:bg-white sm:min-h-12 sm:px-8 sm:py-3 sm:text-[1.0625rem]"
              onClick={importWorkspace}
            >
              <HugeiconsIcon
                icon={FileImportIcon}
                size={18}
                strokeWidth={1.75}
                className="shrink-0"
              />
              Import workspace
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-[var(--text)] px-6 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#262626] sm:min-h-12 sm:px-8 sm:py-3 sm:text-[1.0625rem]"
              onClick={() => setNewCanvasOpen(true)}
            >
              <HugeiconsIcon
                icon={Add01Icon}
                size={18}
                strokeWidth={1.75}
                className="shrink-0"
              />
              New file
            </button>
          </div>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept=".workspace.avnac,.page.avnac,.avnac,.json,.avnac.json,application/json"
          className="hidden"
          onChange={onImportWorkspaceChange}
        />

        <div className="shrink-0 pt-4 sm:pt-5" aria-hidden>
          <div className="mx-auto flex h-11 w-full max-w-6xl justify-end px-5 sm:h-12 sm:px-8" />
        </div>

        <div
          className={`mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16 lg:py-20 ${selectionCount > 0 ? "pb-28 sm:pb-32" : ""}`}
        >
          <div className="rise-in">
            <h1 className="display-title mb-4 text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--text)]">
              Files
            </h1>
            <p className="mb-12 max-w-xl text-lg leading-[1.6] text-[var(--text-muted)] sm:text-xl sm:leading-[1.55]">
              Designs saved in this browser. Open one to keep editing.
            </p>

            {loadError ? (
              <p className="text-base leading-relaxed text-red-600">
                {loadError}
              </p>
            ) : null}

            {items === null ? (
              <p className="text-lg text-[var(--text-muted)]">Loading…</p>
            ) : items.length === 0 ? (
              <div className="max-w-xl">
                <p className="m-0 text-lg leading-[1.6] text-[var(--text-muted)]">
                  Nothing here yet. Start a canvas — it autosaves as you work.
                </p>
                <button
                  type="button"
                  className="mt-8 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--text)] px-10 py-3.5 text-base font-medium text-white hover:bg-[#262626] sm:min-h-14 sm:px-12 sm:py-4 sm:text-[1.0625rem]"
                  onClick={() => setNewCanvasOpen(true)}
                >
                  Open editor
                </button>
              </div>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-7">
                {items.map((row) => (
                  <FileGridCard
                    key={row.id}
                    row={row}
                    formatUpdatedAt={formatUpdatedAt}
                    onListChange={refreshList}
                    selected={selectedIds.includes(row.id)}
                    onToggleSelect={toggleSelect}
                    onRequestDelete={requestDeleteFile}
                  />
                ))}
              </ul>
            )}

            <FilesSettingsSection
              unsplashPanelOpen={unsplashPanelOpen}
              unsplashKey={unsplashKey}
              unsplashLoading={unsplashLoading}
              unsplashSaving={unsplashSaving}
              unsplashNotice={unsplashNotice}
              unsplashError={unsplashError}
              onToggleUnsplashPanel={() =>
                setUnsplashPanelOpen((open) => !open)
              }
              onUnsplashKeyChange={(value) => {
                setUnsplashKey(value);
                setUnsplashNotice(null);
                setUnsplashError(null);
              }}
              onSaveUnsplashKey={saveUnsplashKey}
              onClearUnsplashKey={() => {
                setUnsplashKey("");
                setUnsplashNotice(null);
                setUnsplashError(null);
              }}
            />
          </div>
        </div>
      </div>
      <NewCanvasDialog
        open={newCanvasOpen}
        onClose={() => setNewCanvasOpen(false)}
      />
      <FilesMultiselectBar
        count={selectionCount}
        onClear={clearSelection}
        onDownload={bulkDownload}
        onTrash={bulkTrash}
      />
      <DeleteConfirmDialog
        open={deleteDialog !== null}
        title={deleteDialog?.title ?? ""}
        message={deleteDialog?.message ?? ""}
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDelete}
      />
    </main>
  );
}
