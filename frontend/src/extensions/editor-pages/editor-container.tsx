import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
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
import EditorRangeSlider from "../../components/editor-range-slider";
import { floatingToolbarPopoverMenuClass } from "../../components/floating-toolbar-shell";
import type { ExportPngOptions } from "../../components/editor-export-menu";
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

const topBarShellClass = [
  "relative z-[70] flex min-h-14 items-center gap-2 overflow-visible rounded-[1.75rem] border border-black/[0.08] bg-white/92 px-2.5 py-2",
  "shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-xl",
].join(" ");

const topBarGroupClass = [
  "flex items-center gap-1 rounded-full border border-black/[0.06] bg-black/[0.02] p-1",
  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]",
].join(" ");

const pageIconButtonClass = [
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors",
  "hover:bg-black/[0.08] hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-subtle)",
].join(" ");

const pageActionButtonClass = [
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium",
  "text-neutral-800 transition-colors hover:bg-black/[0.08]",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

const destructiveIconButtonClass = [
  pageIconButtonClass,
  "text-neutral-500 hover:bg-red-500/[0.08] hover:text-red-600",
].join(" ");

const pageTabButtonClass = [
  "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-medium transition-[background,color,box-shadow]",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

const topBarDividerClass = "h-6 w-px shrink-0 bg-black/[0.06]";

const tabRailFadeClass =
  "pointer-events-none absolute inset-y-0 z-10 w-5 bg-gradient-to-r from-white via-white/90 to-transparent";

const titleFieldClass = [
  "min-w-0 rounded-full bg-white/85 px-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
  "transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_0_0_3px_rgba(24,119,242,0.08)]",
].join(" ");

const tabRailClass = [
  "flex min-w-max items-center gap-1 rounded-full bg-white/72 px-1 py-0.5",
  "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
].join(" ");

const actionMenuButtonClass = [
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-neutral-800",
  "hover:bg-black/[0.06] disabled:pointer-events-none disabled:opacity-40",
].join(" ");

const actionMenuSeparatorClass = "my-1 border-t border-black/[0.06]";

const pngCardClass =
  "mx-1 mb-1 rounded-xl bg-(--surface-subtle) px-3 pb-3 pt-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]";

function tabButtonStateClass(active: boolean) {
  return active
    ? "bg-white text-(--text) shadow-[0_4px_14px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.04)]"
    : "text-neutral-700 hover:bg-white/72 hover:text-neutral-900";
}

function actionChevronClass(open: boolean) {
  return open ? "rotate-180 transition-transform" : "transition-transform";
}

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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pngExpanded, setPngExpanded] = useState(false);
  const [pngMult, setPngMult] = useState(2);
  const [pngTransparent, setPngTransparent] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!actionsOpen) return;
    function onOutside(e: MouseEvent) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(e.target as Node)
      ) {
        setActionsOpen(false);
        setPngExpanded(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [actionsOpen]);

  const currentPage = pageState?.currentPage ?? 0;
  const pageCount = pageState?.pages.length ?? 1;
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < pageCount - 1;
  const canDelete = pageCount > 1;

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
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 [--avnac-editor-top-offset:calc(0.75rem+3.5rem+0.75rem+0.5rem)] sm:[--avnac-editor-top-offset:calc(1rem+3.5rem+1rem+0.5rem)]">
        {/* Single toolbar row */}
        <div className={topBarShellClass}>
          <div className={`${topBarGroupClass} shrink-0`}>
            <Link
              to="/files"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-700 no-underline transition-colors hover:bg-black/[0.08] hover:text-neutral-900"
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

            <span className={topBarDividerClass} aria-hidden />

            <div className={`${titleFieldClass} min-w-0 w-28 sm:w-44`}>
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
                className="m-0 h-9 w-full min-w-0 truncate border-0 bg-transparent text-sm font-medium leading-snug text-(--text) outline-none focus:ring-0"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className={`${topBarGroupClass} min-w-0 flex-1`}>
            <button
              type="button"
              className={pageIconButtonClass}
              onClick={() => void goToPage(currentPage - 1)}
              disabled={!editorReady || !canGoPrev}
              aria-label="Previous page"
              title="Previous page (ArrowLeft)"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                size={18}
                strokeWidth={1.8}
              />
            </button>

            <div className="relative min-w-0 flex-1">
              <div className={`${tabRailFadeClass} left-0 rounded-l-full`} />
              <div
                className={`${tabRailFadeClass} right-0 rotate-180 rounded-r-full`}
              />
              <div className="overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className={tabRailClass}>
                  {pageTabs.map((tab) => (
                    <button
                      key={tab.index}
                      type="button"
                      className={[
                        pageTabButtonClass,
                        tabButtonStateClass(tab.active),
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
              className={pageIconButtonClass}
              onClick={() => void addPage()}
              disabled={!editorReady}
              aria-label="New page"
              title="New page (Cmd/Ctrl+N)"
            >
              <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={1.75} />
            </button>
          </div>

          <div className={`${topBarGroupClass} shrink-0`}>
            <div
              ref={actionsRef}
              className="relative shrink-0"
              data-avnac-chrome
            >
              <button
                type="button"
                className={[
                  pageActionButtonClass,
                  actionsOpen ? "bg-black/[0.05]" : "",
                ].join(" ")}
                onClick={() => {
                  setActionsOpen((v) => !v);
                  if (actionsOpen) setPngExpanded(false);
                }}
                disabled={!editorReady}
                aria-label="File actions"
                title="File actions"
              >
                <HugeiconsIcon
                  icon={FileExportIcon}
                  size={17}
                  strokeWidth={1.75}
                />
                <span className="hidden sm:inline">File</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  strokeWidth={2}
                  className={actionChevronClass(actionsOpen)}
                />
              </button>

              {actionsOpen && (
                <div
                  className={[
                    floatingToolbarPopoverMenuClass,
                    "absolute right-0 top-full z-[140] mt-2 w-56 p-1.5",
                  ].join(" ")}
                >
                  {/* Export workspace */}
                  <button
                    type="button"
                    className={actionMenuButtonClass}
                    onClick={() => {
                      setActionsOpen(false);
                      void exportWorkspace();
                    }}
                    disabled={!editorReady}
                  >
                    <HugeiconsIcon
                      icon={FileExportIcon}
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0 text-neutral-700"
                    />
                    Export workspace
                  </button>

                  {/* Export current page */}
                  <button
                    type="button"
                    className={actionMenuButtonClass}
                    onClick={() => {
                      setActionsOpen(false);
                      void exportCurrentPage();
                    }}
                    disabled={!editorReady}
                  >
                    <HugeiconsIcon
                      icon={FileExportIcon}
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0 text-neutral-700"
                    />
                    Export page
                  </button>

                  <div className={actionMenuSeparatorClass} />

                  {/* Download canvas — expandable PNG export */}
                  <button
                    type="button"
                    className={actionMenuButtonClass}
                    onClick={() => setPngExpanded((v) => !v)}
                    disabled={!editorReady}
                  >
                    <HugeiconsIcon
                      icon={FileExportIcon}
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0 text-neutral-700"
                    />
                    <span className="flex-1 text-left">Download canvas</span>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={13}
                      strokeWidth={2}
                      className={actionChevronClass(pngExpanded)}
                    />
                  </button>

                  {pngExpanded && (
                    <div className={pngCardClass}>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                        Scale {pngMult}×
                      </p>
                      <EditorRangeSlider
                        min={1}
                        max={3}
                        step={1}
                        value={pngMult}
                        onChange={setPngMult}
                        aria-label="PNG export scale"
                        aria-valuemin={1}
                        aria-valuemax={3}
                        aria-valuenow={pngMult}
                        trackClassName="mb-3 w-full"
                      />
                      <label className="mb-3 flex cursor-pointer items-center gap-2 text-[12px] text-(--text)">
                        <input
                          type="checkbox"
                          checked={pngTransparent}
                          onChange={(e) => setPngTransparent(e.target.checked)}
                          className="size-3.5 shrink-0 rounded border border-black/20"
                          style={{ accentColor: "var(--accent)" }}
                        />
                        Transparent background
                      </label>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-neutral-900 py-2 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
                        onClick={() => {
                          const opts: ExportPngOptions = {
                            multiplier: pngMult,
                            transparent: pngTransparent,
                          };
                          editorRef.current?.exportPng(opts);
                          setActionsOpen(false);
                          setPngExpanded(false);
                        }}
                      >
                        Download PNG
                      </button>
                    </div>
                  )}

                  <div className={actionMenuSeparatorClass} />

                  {/* Import workspace */}
                  <button
                    type="button"
                    className={actionMenuButtonClass}
                    onClick={() => {
                      setActionsOpen(false);
                      workspaceInputRef.current?.click();
                    }}
                    disabled={!editorReady}
                  >
                    <HugeiconsIcon
                      icon={FileImportIcon}
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0 text-neutral-700"
                    />
                    Import workspace
                  </button>

                  {/* Import page */}
                  <button
                    type="button"
                    className={actionMenuButtonClass}
                    onClick={() => {
                      setActionsOpen(false);
                      pageInputRef.current?.click();
                    }}
                    disabled={!editorReady}
                  >
                    <HugeiconsIcon
                      icon={FileImportIcon}
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0 text-neutral-700"
                    />
                    Import page
                  </button>
                </div>
              )}
            </div>

            <span className={topBarDividerClass} aria-hidden />

            <button
              type="button"
              className={destructiveIconButtonClass}
              onClick={() => void deletePage()}
              disabled={!editorReady || !canDelete}
              aria-label="Delete page"
              title="Delete page (Cmd/Ctrl+Delete)"
            >
              <HugeiconsIcon icon={Delete02Icon} size={17} strokeWidth={1.75} />
            </button>
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
