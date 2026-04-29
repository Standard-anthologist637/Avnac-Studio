export type PngExportCrop = "none" | "selection" | "content";

export type ExportPngOptions = {
  multiplier: number;
  transparent: boolean;
  crop?: PngExportCrop;
};