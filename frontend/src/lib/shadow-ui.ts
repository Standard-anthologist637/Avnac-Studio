export type ShadowUi = {
  blur: number;
  offsetX: number;
  offsetY: number;
  colorHex: string;
  opacityPct: number;
};

export const DEFAULT_SHADOW_UI: ShadowUi = {
  blur: 14,
  offsetX: 6,
  offsetY: 6,
  colorHex: "#000000",
  opacityPct: 35,
};
