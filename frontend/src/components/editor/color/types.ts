export type GradientStop = { color: string; offset: number };

export type BgValue =
  | { type: "solid"; color: string }
  | { type: "gradient"; css: string; stops: GradientStop[]; angle: number };
