import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useLayoutEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { useEditorUnsupportedOnThisDevice } from "@/hooks/use-editor-device-support";
import { idbGetEditorRecord, idbSetDocumentName } from "@/lib/avnac-editor-idb";

const MultiPageEditorShell = lazy(
  () => import("@/features/multi-page-editor/multi-page-editor-shell"),
);

type CreateSearch = {
  id?: string;
  w?: number;
  h?: number;
};

function parseSearchDimension(v: unknown): number | undefined {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(16000, Math.max(100, Math.round(n)));
}

export const Route = createFileRoute("/create")({
  validateSearch: (raw: Record<string, unknown>): CreateSearch => {
    const id = raw.id;
    return {
      id: typeof id === "string" && id.length > 0 ? id : undefined,
      w: parseSearchDimension(raw.w),
      h: parseSearchDimension(raw.h),
    };
  },
  component: CreatePage,
});

function CreatePage() {
  const [documentTitle, setDocumentTitle] = useState("Untitled");
  const search = Route.useSearch();
  const id = search.id;
  const initialW = search.w;
  const initialH = search.h;
  const navigate = Route.useNavigate();
  const posthog = usePostHog();
  const editorUnsupported = useEditorUnsupportedOnThisDevice();

  useLayoutEffect(() => {
    if (editorUnsupported) return;
    if (id) return;
    void navigate({
      to: "/create",
      search: {
        id: crypto.randomUUID(),
        w: initialW,
        h: initialH,
      },
      replace: true,
    });
  }, [editorUnsupported, id, initialW, initialH, navigate]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void idbGetEditorRecord(id).then((row) => {
      if (cancelled) return;
      setDocumentTitle(row?.name?.trim() || "Untitled");
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const commitDocumentTitle = () => {
    const t = documentTitle.trim() || "Untitled";
    setDocumentTitle(t);
    if (id) {
      void idbSetDocumentName(id, t);
      posthog.capture("document_renamed", { file_id: id, new_name: t });
    }
  };

  if (editorUnsupported) {
    return (
      <main className="hero-page relative flex min-h-dvh flex-col overflow-hidden px-5 py-12 sm:px-8 sm:py-16">
        <div className="hero-bg-orb hero-bg-orb-a" aria-hidden="true" />
        <div className="hero-bg-orb hero-bg-orb-b" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />

        <div className="relative z-1 mx-auto flex w-full max-w-2xl flex-1 items-center justify-center">
          <div className="w-full rounded-4xl border border-(--line) bg-white/82 p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-md sm:p-10">
            <div className="landing-kicker mb-3">Desktop Only</div>
            <h1 className="display-title text-[clamp(2rem,8vw,3rem)] font-medium leading-[1.04] tracking-[-0.03em] text-(--text)">
              The editor is not available on mobile.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-(--text-muted) sm:text-lg">
              Open Avnac on a desktop or laptop to create and edit files. You
              can still return to your files from here.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/files"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-0 bg-(--text) px-8 py-3 text-base font-medium text-white no-underline hover:bg-[#262626]"
              >
                Go to files
              </Link>
              <Link
                to="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/[0.14] bg-white/70 px-8 py-3 text-base font-medium text-(--text) no-underline hover:border-black/22 hover:bg-white"
              >
                Back home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!id) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-(--surface-subtle) px-5 py-12 text-(--text-muted)">
          Loading editor...
        </main>
      }
    >
      <MultiPageEditorShell
        key={id}
        persistId={id}
        persistDisplayName={documentTitle}
        documentTitle={documentTitle}
        onDocumentTitleChange={setDocumentTitle}
        onDocumentTitleCommit={commitDocumentTitle}
        initialArtboardWidth={initialW}
        initialArtboardHeight={initialH}
      />
    </Suspense>
  );
}
