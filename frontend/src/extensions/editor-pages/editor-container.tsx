import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Download01Icon,
  FileExportIcon,
  FileImportIcon,
  Home05Icon,
} from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import FabricEditor, {
  type FabricEditorHandle,
} from "../../components/fabric-editor";
import EditorExportMenu from "../../components/editor-export-menu";
import { idbGetDocument } from "../../lib/avnac-editor-idb";
import type { AvnacDocumentV1 } from "../../lib/avnac-document";
import { safeAvnacFileBaseName } from "../../lib/avnac-files-export";
import { exportJsonFile } from "../../lib/avnac-native-export";
import { ConfirmDialog } from "../../../wailsjs/go/avnacio/IOManager";
import {
  buildMultiPageDocument,
  clampPageIndex,
  createEmptyPage,
  parseMultiPageDocument,
  parseAvnacImport,
} from "./multi-page-document";
import { loadStoredPages, saveStoredPages } from "./multi-page-storage";

type Props = {
  persistId: string;
  persistDisplayName: string;
  documentTitle: string;
  onDocumentTitleChange: (title: string) => void;
  onDocumentTitleCommit: () => void;
  initialArtboardWidth?: number;
  initialArtboardHeight?: number;
  onReadyChange?: (ready: boolean) => void;
};

type PageState = {
  currentPage: number;
  pages: AvnacDocumentV1[];
};

function cloneDoc(doc: AvnacDocumentV1): AvnacDocumentV1 {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as AvnacDocumentV1;
}

const pageIconButtonClass = [
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/8 bg-(--surface) text-(--text-muted) transition-colors",
  "hover:bg-(--hover) hover:text-(--text) disabled:pointer-events-none disabled:opacity-40",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-subtle)",
].join(" ");

const pageActionButtonClass = [
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-black/8 px-4 text-sm font-medium",
  "bg-(--surface) text-(--text) transition-colors hover:bg-(--hover)",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-subtle)",
  "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, [contenteditable="true"], [data-avnac-chrome]',
    ),
  );
}

export default function EditorContainer({
  persistId,
  persistDisplayName,
  documentTitle,
  onDocumentTitleChange,
  onDocumentTitleCommit,
  initialArtboardHeight,
  initialArtboardWidth,
  onReadyChange,
}: Props) {
  const editorRef = useRef<FabricEditorHandle>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [pageState, setPageState] = useState<PageState | null>(null);
  const pageStateRef = useRef<PageState | null>(null);
  pageStateRef.current = pageState;
  const posthog = usePostHog();

  const persistPages = useCallback(
    (nextState: PageState): Promise<void> => {
      return saveStoredPages(persistId, nextState.pages, nextState.currentPage);
    },
    [persistId],
  );

  const syncCurrentPageToEditor = useCallback(
    async (nextDoc: AvnacDocumentV1) => {
      await editorRef.current?.applyDocument(nextDoc);
    },
    [],
  );

  const captureCurrentPage = useCallback((): AvnacDocumentV1 | null => {
    return editorRef.current?.captureDocument() ?? null;
  }, []);

  const updatePages = useCallback(
    async (
      recipe: (
        prev: PageState,
        currentDoc: AvnacDocumentV1,
      ) => {
        nextState: PageState;
        nextDoc: AvnacDocumentV1;
      },
    ) => {
      const prev = pageStateRef.current;
      const currentDoc = captureCurrentPage();
      if (!prev || !currentDoc) return;

      const withCurrent: PageState = {
        currentPage: prev.currentPage,
        pages: prev.pages.map((page, index) =>
          index === prev.currentPage ? currentDoc : cloneDoc(page),
        ),
      };

      const { nextState, nextDoc } = recipe(withCurrent, currentDoc);
      void persistPages(nextState);
      setPageState(nextState);
      await syncCurrentPageToEditor(nextDoc);
    },
    [captureCurrentPage, persistPages, syncCurrentPageToEditor],
  );

  const goToPage = useCallback(
    async (targetIndex: number) => {
      await updatePages((prev) => {
        const nextIndex = clampPageIndex(prev.pages.length, targetIndex);
        return {
          nextState: {
            currentPage: nextIndex,
            pages: prev.pages,
          },
          nextDoc: prev.pages[nextIndex]!,
        };
      });
    },
    [updatePages],
  );

  const addPage = useCallback(async () => {
    await updatePages((prev, currentDoc) => {
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
    });
    posthog.capture("editor_page_added", { file_id: persistId });
  }, [persistId, posthog, updatePages]);

  const deletePage = useCallback(async () => {
    const confirmed = await ConfirmDialog(
      "Delete page",
      "Delete this page? This cannot be undone.",
    ).catch(() => false);
    if (!confirmed) return;
    await updatePages((prev) => {
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
    });
    posthog.capture("editor_page_deleted", { file_id: persistId });
  }, [persistId, posthog, updatePages]);

  const exportWorkspace = useCallback(async () => {
    const currentDoc = captureCurrentPage();
    const state = pageStateRef.current;
    if (!currentDoc || !state) return;
    const pages = state.pages.map((page, index) =>
      index === state.currentPage ? currentDoc : page,
    );
    const payload = buildMultiPageDocument(pages, state.currentPage);
    await exportJsonFile(
      `${safeAvnacFileBaseName(persistDisplayName || "Untitled")}.workspace.avnac`,
      payload,
    );
    posthog.capture("editor_workspace_exported", {
      file_id: persistId,
      page_count: payload.pages.length,
    });
  }, [captureCurrentPage, persistDisplayName, persistId, posthog]);

  const exportCurrentPage = useCallback(async () => {
    const currentDoc = captureCurrentPage();
    const state = pageStateRef.current;
    if (!currentDoc || !state) return;
    await exportJsonFile(
      `${safeAvnacFileBaseName(persistDisplayName || "Untitled")}-page-${state.currentPage + 1}.page.avnac`,
      currentDoc,
    );
    posthog.capture("editor_page_exported", {
      file_id: persistId,
      page_index: state.currentPage,
    });
  }, [captureCurrentPage, persistDisplayName, persistId, posthog]);

  const importWorkspace = useCallback(
    async (file: File) => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }

      const imported = parseMultiPageDocument(parsed);
      if (!imported) return;

      const nextState: PageState = {
        currentPage: imported.currentPage,
        pages: imported.pages,
      };

      void persistPages(nextState);
      setPageState(nextState);
      await syncCurrentPageToEditor(nextState.pages[nextState.currentPage]!);
      posthog.capture("editor_workspace_imported", {
        file_id: persistId,
        page_count: nextState.pages.length,
      });
    },
    [persistId, persistPages, posthog, syncCurrentPageToEditor],
  );

  const importPage = useCallback(
    async (file: File) => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }

      const imported = parseAvnacImport(parsed);
      if (!imported) return;

      const importedDoc =
        imported.kind === "single"
          ? imported.document
          : imported.document.pages[
              clampPageIndex(
                imported.document.pages.length,
                imported.document.currentPage,
              )
            ];
      if (!importedDoc) return;

      await updatePages((prev) => {
        const insertIndex = prev.currentPage + 1;
        const pages = [...prev.pages];
        pages.splice(insertIndex, 0, cloneDoc(importedDoc));
        return {
          nextState: {
            currentPage: insertIndex,
            pages,
          },
          nextDoc: pages[insertIndex]!,
        };
      });

      posthog.capture("editor_page_imported", {
        file_id: persistId,
      });
    },
    [persistId, posthog, updatePages],
  );

  useEffect(() => {
    onReadyChange?.(editorReady);
  }, [editorReady, onReadyChange]);

  useEffect(() => {
    setPageState(null);
  }, [persistId]);

  useEffect(() => {
    if (!editorReady || pageState) return;
    let cancelled = false;

    void (async () => {
      const persisted = await idbGetDocument(persistId);
      if (cancelled) return;
      const currentDoc =
        persisted ??
        (() => {
          const doc = createEmptyPage();
          if (
            typeof initialArtboardWidth === "number" &&
            Number.isFinite(initialArtboardWidth)
          ) {
            doc.artboard.width = Math.min(
              16000,
              Math.max(100, Math.round(initialArtboardWidth)),
            );
          }
          if (
            typeof initialArtboardHeight === "number" &&
            Number.isFinite(initialArtboardHeight)
          ) {
            doc.artboard.height = Math.min(
              16000,
              Math.max(100, Math.round(initialArtboardHeight)),
            );
          }
          return doc;
        })();
      const stored = await loadStoredPages(persistId, currentDoc);
      setPageState({
        currentPage: stored.currentPage,
        pages: stored.pages,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editorReady,
    initialArtboardHeight,
    initialArtboardWidth,
    pageState,
    persistId,
  ]);

  useEffect(() => {
    if (!editorReady) return;

    const flushCurrentPage = () => {
      const state = pageStateRef.current;
      const currentDoc = captureCurrentPage();
      if (!state || !currentDoc) return;
      const nextState = {
        currentPage: state.currentPage,
        pages: state.pages.map((page, index) =>
          index === state.currentPage ? currentDoc : page,
        ),
      };
      void persistPages(nextState);
    };

    const onBeforeUnload = () => flushCurrentPage();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushCurrentPage();
    };
  }, [captureCurrentPage, editorReady, persistPages]);

  useEffect(() => {
    if (!editorReady) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void addPage();
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        if (editorRef.current?.hasSelection()) return;
        event.preventDefault();
        void deletePage();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      if (editorRef.current?.hasSelection()) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void goToPage((pageStateRef.current?.currentPage ?? 0) - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        void goToPage((pageStateRef.current?.currentPage ?? 0) + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addPage, deletePage, editorReady, goToPage]);

  const currentPage = pageState?.currentPage ?? 0;
  const pageCount = pageState?.pages.length ?? 1;
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < pageCount - 1;
  const canDelete = pageCount > 1;

  const pageLabel = useMemo(
    () => `Page ${currentPage + 1} of ${pageCount}`,
    [currentPage, pageCount],
  );

  const pageTabs = useMemo(
    () =>
      Array.from({ length: pageCount }, (_, index) => ({
        index,
        label: `Page ${index + 1}`,
        active: index === currentPage,
      })),
    [currentPage, pageCount],
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-(--surface-subtle)">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 [--avnac-editor-top-offset:calc(0.75rem+3.5rem+0.75rem+3rem+1.1rem)] sm:[--avnac-editor-top-offset:calc(1rem+3.5rem+0.75rem+3rem+1.5rem)]">
        <div className="flex min-h-14 flex-wrap items-center gap-3 rounded-2xl border border-(--line) bg-(--surface) px-3 py-2.5 sm:px-4">
          <Link
            to="/files"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-(--text-muted) no-underline transition-colors hover:bg-(--hover) hover:text-(--text)"
            aria-label="All files"
            title="All files"
          >
            <HugeiconsIcon
              icon={Home05Icon}
              size={18}
              strokeWidth={1.65}
              className="shrink-0"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <label htmlFor="avnac-doc-title" className="sr-only">
              Document name
            </label>
            <input
              id="avnac-doc-title"
              type="text"
              value={documentTitle}
              onChange={(event) => onDocumentTitleChange(event.target.value)}
              onBlur={onDocumentTitleCommit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  (event.target as HTMLInputElement).blur();
                }
              }}
              className="m-0 w-full min-w-0 truncate border-0 bg-transparent text-sm font-medium leading-snug text-(--text) outline-none focus:ring-0"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={pageActionButtonClass}
              onClick={() => workspaceInputRef.current?.click()}
              disabled={!editorReady}
              title="Import workspace"
            >
              <HugeiconsIcon
                icon={FileImportIcon}
                size={17}
                strokeWidth={1.75}
              />
              <span className="hidden sm:inline">Import workspace</span>
            </button>
            <button
              type="button"
              className={pageActionButtonClass}
              onClick={() => void exportWorkspace()}
              disabled={!editorReady}
              title="Export workspace"
            >
              <HugeiconsIcon
                icon={FileExportIcon}
                size={17}
                strokeWidth={1.75}
              />
              <span className="hidden sm:inline">Export workspace</span>
            </button>
            <button
              type="button"
              className={pageActionButtonClass}
              onClick={() => pageInputRef.current?.click()}
              disabled={!editorReady}
              title="Import page"
            >
              <HugeiconsIcon
                icon={FileImportIcon}
                size={17}
                strokeWidth={1.75}
              />
              <span className="hidden sm:inline">Import page</span>
            </button>
            <button
              type="button"
              className={pageActionButtonClass}
              onClick={() => void exportCurrentPage()}
              disabled={!editorReady}
              title="Export current page"
            >
              <HugeiconsIcon
                icon={Download01Icon}
                size={17}
                strokeWidth={1.75}
              />
              <span className="hidden sm:inline">Export page</span>
            </button>
            <EditorExportMenu
              disabled={!editorReady}
              label="Download canvas"
              onExport={(opts) => editorRef.current?.exportPng(opts)}
            />
          </div>
        </div>

        <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-(--line) bg-(--surface) px-2 py-2 sm:px-3">
          <button
            type="button"
            className={pageIconButtonClass}
            onClick={() => void goToPage(currentPage - 1)}
            disabled={!editorReady || !canGoPrev}
            aria-label="Previous page"
            title="Previous page (ArrowLeft)"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.8} />
          </button>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 pr-2">
              {pageTabs.map((tab) => (
                <button
                  key={tab.index}
                  type="button"
                  className={[
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                    tab.active
                      ? "border-(--line) bg-(--surface-subtle) text-(--text)"
                      : "border-transparent bg-transparent text-(--text-muted) hover:border-(--line) hover:bg-(--hover) hover:text-(--text)",
                  ].join(" ")}
                  onClick={() => void goToPage(tab.index)}
                  disabled={!editorReady}
                  aria-current={tab.active ? "page" : undefined}
                  title={tab.label}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={pageIconButtonClass}
            onClick={() => void goToPage(currentPage + 1)}
            disabled={!editorReady || !canGoNext}
            aria-label="Next page"
            title="Next page (ArrowRight)"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={18}
              strokeWidth={1.8}
            />
          </button>

          <button
            type="button"
            className={pageActionButtonClass}
            onClick={() => void addPage()}
            disabled={!editorReady}
            title="New page (Cmd/Ctrl+N)"
          >
            <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={1.75} />
            <span className="hidden sm:inline">New page</span>
          </button>
          <button
            type="button"
            className={pageActionButtonClass}
            onClick={() => void deletePage()}
            disabled={!editorReady || !canDelete}
            title="Delete page (Cmd/Ctrl+Delete)"
          >
            <HugeiconsIcon icon={Delete02Icon} size={17} strokeWidth={1.75} />
            <span className="hidden sm:inline">Delete page</span>
          </button>
          <div className="min-w-28 rounded-full border border-(--line) bg-(--surface-subtle) px-3 py-1.5 text-center text-sm font-medium text-(--text)">
            {pageLabel}
          </div>
        </div>

        <input
          ref={workspaceInputRef}
          type="file"
          accept=".workspace.avnac,.avnac,.json,.avnac.json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importWorkspace(file);
            event.currentTarget.value = "";
          }}
        />

        <input
          ref={pageInputRef}
          type="file"
          accept=".page.avnac,.avnac,.json,.avnac.json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importPage(file);
            event.currentTarget.value = "";
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col pt-1.5 sm:pt-2">
          <FabricEditor
            ref={editorRef}
            persistId={persistId}
            persistDisplayName={persistDisplayName}
            onReadyChange={setEditorReady}
            initialArtboardWidth={initialArtboardWidth}
            initialArtboardHeight={initialArtboardHeight}
          />
        </div>
      </div>
    </div>
  );
}
