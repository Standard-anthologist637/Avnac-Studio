import type { AvnacShapeKind } from "@/lib/avnac-shape-meta";

export function avnacShapeKindLayerLabel(kind: AvnacShapeKind): string {
  const labels: Record<AvnacShapeKind, string> = {
    rect: "Square",
    ellipse: "Ellipse",
    polygon: "Polygon",
    star: "Star",
    line: "Line",
    arrow: "Arrow",
  };
  return labels[kind];
}
