import type { BgValue } from "@/components/editor/color/types";

export type TextFormatToolbarValues = {
  fontFamily: string;
  fontSize: number;
  fillStyle: BgValue;
  textAlign: "left" | "center" | "right" | "justify";
  bold: boolean;
  italic: boolean;
  underline: boolean;
};
