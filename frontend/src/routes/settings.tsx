import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Image01Icon, ArrowReloadHorizontalIcon, CheckmarkCircle01Icon, AlertDiamondIcon } from "@hugeicons/core-free-icons";
import { avnacconfig } from "../../wailsjs/go/models";
import { useUpdateCheck } from "../lib/use-update-check";

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
      ? "Could not load Unsplash settings."
      : "Could not save the Unsplash API key.";
  }
  if (isMissingConfigBridgeError(error)) {
    return "The latest Unsplash settings bridge is not available yet. Restart the app and try again.";
  }
  if (
    /window\.go|Cannot read properties of undefined|undefined is not an object/i.test(
      message,
    )
  ) {
    return "Unsplash settings are only available in the app.";
  }
  return action === "load"
    ? `Could not load Unsplash settings: ${message}`
    : `Could not save the Unsplash API key: ${message}`;
}

export const Route = createFileRoute("/settings")({
  component: function SettingsPage() {
  const [unsplashKey, setUnsplashKey] = useState("");
  const [unsplashLoading, setUnsplashLoading] = useState(true);
  const [unsplashSaving, setUnsplashSaving] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);
  const [unsplashNotice, setUnsplashNotice] = useState<string | null>(null);
  const { currentVersion, updateAvailable, isChecking, lastChecked, checkNow } = useUpdateCheck();

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
      } finally {
        if (!cancelled) setUnsplashLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
            return;
          }
          throw new Error("ConfigManager.Save bridge unavailable");
        }

        await configBridge.Save(nextConfig);
        setUnsplashKey(nextKey);
        setUnsplashNotice(
          nextKey
            ? "Unsplash API key updated."
            : "Unsplash API key cleared.",
        );
      } catch (err) {
        setUnsplashError(formatConfigBridgeError(err, "save"));
        console.error("[avnac] save unsplash config failed", err);
      } finally {
        setUnsplashSaving(false);
      }
    })();
  }, [unsplashKey]);

  return (
    <main className="hero-page relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div className="hero-bg-orb hero-bg-orb-a" aria-hidden="true" />
      <div className="hero-bg-orb hero-bg-orb-b" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] pt-4 sm:pt-5">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-start gap-3 px-5 sm:px-8 pointer-events-auto">
            <Link
              to="/files"
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/[0.12] bg-white/85 px-6 py-2.5 text-[15px] font-medium text-[var(--text)] transition hover:border-black/[0.2] hover:bg-white sm:min-h-12 sm:px-8 sm:py-3 sm:text-[1.0625rem]"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                size={18}
                strokeWidth={1.75}
                className="shrink-0"
              />
              Files
            </Link>
          </div>
        </div>

        <div className="shrink-0 pt-4 sm:pt-5" aria-hidden>
          <div className="mx-auto flex h-11 w-full max-w-6xl justify-end px-5 sm:h-12 sm:px-8" />
        </div>

        <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
          <div className="rise-in">
            <h1 className="display-title mb-4 text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--text)]">
              Settings
            </h1>
            <p className="mb-12 max-w-xl text-lg leading-[1.6] text-[var(--text-muted)] sm:text-xl sm:leading-[1.55]">
              Configure integrations and preferences.
            </p>

            <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/75 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-md">
              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                    <HugeiconsIcon
                      icon={Image01Icon}
                      size={14}
                      strokeWidth={1.9}
                      className="shrink-0"
                    />
                    Images
                  </div>
                  <h2 className="m-0 text-base font-semibold text-[var(--text)] sm:text-lg">
                    Unsplash API key
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    Used for image search inside the app.
                  </p>
                </div>
              </div>

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
                  name="unsplash-access-key"
                  value={unsplashKey}
                  onChange={(event) => {
                    setUnsplashKey(event.target.value);
                    setUnsplashNotice(null);
                    setUnsplashError(null);
                  }}
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
                    onClick={saveUnsplashKey}
                    disabled={unsplashLoading || unsplashSaving}
                  >
                    {unsplashSaving ? "Saving…" : "Update key"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-black/[0.12] bg-white px-6 py-2.5 text-sm font-medium text-[var(--text)] transition hover:border-black/[0.2] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      setUnsplashKey("");
                      setUnsplashNotice(null);
                      setUnsplashError(null);
                    }}
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
            </div>

            {/* Updates section */}
            <div className="mt-6 overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/75 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-md">
              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                    <HugeiconsIcon
                      icon={ArrowReloadHorizontalIcon}
                      size={14}
                      strokeWidth={1.9}
                      className="shrink-0"
                    />
                    App
                  </div>
                  <h2 className="m-0 text-base font-semibold text-[var(--text)] sm:text-lg">
                    Updates
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    Current version:{" "}
                    <span className="font-medium text-[var(--text)]">
                      {currentVersion ?? "…"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/[0.12] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text)] transition hover:border-black/[0.2] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={checkNow}
                  disabled={isChecking}
                >
                  <HugeiconsIcon
                    icon={ArrowReloadHorizontalIcon}
                    size={15}
                    strokeWidth={1.9}
                    className={isChecking ? "animate-spin" : ""}
                  />
                  {isChecking ? "Checking…" : "Check for updates"}
                </button>
              </div>

              <div className="border-t border-black/[0.06] px-5 py-4 sm:px-6">
                {updateAvailable ? (
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon
                      icon={AlertDiamondIcon}
                      size={18}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0 text-amber-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {updateAvailable.latestVersion} is available
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                        You're on {currentVersion}. Download the latest release to get new features and fixes.
                      </p>
                      <a
                        href={updateAvailable.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex h-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--text)] px-5 text-xs font-medium text-white transition hover:bg-[#262626]"
                      >
                        Download {updateAvailable.latestVersion}
                      </a>
                    </div>
                  </div>
                ) : lastChecked ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={16}
                      strokeWidth={1.75}
                      className="shrink-0 text-emerald-500"
                    />
                    You're up to date
                    <span className="text-xs">
                      · checked{" "}
                      {lastChecked.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    Checking for updates…
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
},
});
