import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon } from "@hugeicons/core-free-icons";

type Props = {
  unsplashPanelOpen: boolean;
  unsplashKey: string;
  unsplashLoading: boolean;
  unsplashSaving: boolean;
  unsplashNotice: string | null;
  unsplashError: string | null;
  onToggleUnsplashPanel: () => void;
  onUnsplashKeyChange: (value: string) => void;
  onSaveUnsplashKey: () => void;
  onClearUnsplashKey: () => void;
};

export default function FilesSettingsSection({
  unsplashPanelOpen,
  unsplashKey,
  unsplashLoading,
  unsplashSaving,
  unsplashNotice,
  unsplashError,
  onToggleUnsplashPanel,
  onUnsplashKeyChange,
  onSaveUnsplashKey,
  onClearUnsplashKey,
}: Props) {
  return (
    <section className="mt-12" aria-label="Settings">
      <div className="mb-10 overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/75 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
              <HugeiconsIcon
                icon={Image01Icon}
                size={14}
                strokeWidth={1.9}
                className="shrink-0"
              />
              Settings
            </div>
            <h2 className="m-0 text-base font-semibold text-[var(--text)] sm:text-lg">
              Unsplash API key
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              Used for image search inside the app.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/[0.12] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text)] transition hover:border-black/[0.2] hover:bg-white/90"
            onClick={onToggleUnsplashPanel}
          >
            {unsplashPanelOpen ? "Hide settings" : "Manage key"}
          </button>
        </div>

        {unsplashPanelOpen ? (
          <div className="border-t border-black/[0.06] px-5 py-5 sm:px-6">
            <label
              htmlFor="avnac-unsplash-key"
              className="mb-2 block text-sm font-medium text-[var(--text)]"
            >
              Access key
            </label>
            <input
              id="avnac-unsplash-key"
              type="password"
              value={unsplashKey}
              onChange={(event) => onUnsplashKeyChange(event.target.value)}
              placeholder="Paste your Unsplash access key"
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full rounded-2xl border border-black/[0.1] bg-white px-4 text-[15px] text-[var(--text)] outline-none transition focus:border-black/[0.2] focus:ring-2 focus:ring-black/[0.08]"
              disabled={unsplashLoading || unsplashSaving}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--text)] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onSaveUnsplashKey}
                disabled={unsplashLoading || unsplashSaving}
              >
                {unsplashSaving ? "Saving…" : "Update key"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-black/[0.12] bg-white px-6 py-2.5 text-sm font-medium text-[var(--text)] transition hover:border-black/[0.2] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onClearUnsplashKey}
                disabled={unsplashLoading || unsplashSaving}
              >
                Clear field
              </button>
              {unsplashLoading ? (
                <span className="text-sm text-[var(--text-muted)]">
                  Loading saved key…
                </span>
              ) : null}
            </div>
            {unsplashNotice ? (
              <p className="mt-3 text-sm text-emerald-700">{unsplashNotice}</p>
            ) : null}
            {unsplashError ? (
              <p className="mt-3 text-sm text-red-600">{unsplashError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
