const SNAP_INTENSITY_KEY = "avnac:scene:snap-intensity";
const SNAP_INTENSITY_EVENT = "avnac:scene-preferences";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export function getSceneSnapIntensity(): number {
  if (typeof localStorage === "undefined") return 1;
  try {
    const raw = localStorage.getItem(SNAP_INTENSITY_KEY);
    if (raw == null) return 1;
    return clamp01(Number(raw));
  } catch {
    return 1;
  }
}

export function setSceneSnapIntensity(value: number): void {
  const next = clamp01(value);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SNAP_INTENSITY_KEY, String(next));
    } catch {
      // Ignore localStorage failures.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<number>(SNAP_INTENSITY_EVENT, { detail: next }),
    );
  }
}

export function onSceneSnapIntensityChange(
  listener: (value: number) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const onLocalEvent = (event: Event) => {
    const custom = event as CustomEvent<number>;
    listener(clamp01(Number(custom.detail)));
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== SNAP_INTENSITY_KEY) return;
    listener(clamp01(Number(event.newValue ?? 1)));
  };

  window.addEventListener(SNAP_INTENSITY_EVENT, onLocalEvent as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(
      SNAP_INTENSITY_EVENT,
      onLocalEvent as EventListener,
    );
    window.removeEventListener("storage", onStorage);
  };
}
