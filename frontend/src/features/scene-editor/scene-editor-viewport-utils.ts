type FitZoomInput = {
  artboardWidth: number;
  artboardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  minZoom?: number;
  maxZoom?: number;
  padding?: number;
  insetFactor?: number;
  fallbackZoom?: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeFitZoomPercent({
  artboardWidth,
  artboardHeight,
  viewportWidth,
  viewportHeight,
  minZoom = 5,
  maxZoom = 400,
  padding = 64,
  insetFactor = 0.98,
  fallbackZoom = 100,
}: FitZoomInput): number {
  if (
    artboardWidth <= 0 ||
    artboardHeight <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return fallbackZoom;
  }
  const raw =
    Math.min(
      1,
      (viewportWidth - padding) / artboardWidth,
      (viewportHeight - padding) / artboardHeight,
    ) * insetFactor;
  return clamp(Math.round(raw * 100), minZoom, maxZoom);
}

export function toClampedScenePoint(params: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  scale: number;
  artboardWidth: number;
  artboardHeight: number;
}) {
  const { clientX, clientY, rect, scale, artboardWidth, artboardHeight } =
    params;
  if (rect.width <= 0 || rect.height <= 0 || scale <= 0) return null;
  const sceneX = (clientX - rect.left) / scale;
  const sceneY = (clientY - rect.top) / scale;
  return {
    x: clamp(sceneX, 0, artboardWidth),
    y: clamp(sceneY, 0, artboardHeight),
  };
}
