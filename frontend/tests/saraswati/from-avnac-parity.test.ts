import { describe, expect, it } from "vitest";
import {
  AVNAC_DOC_VERSION,
  type AvnacDocumentV1,
} from "../../src/lib/avnac-document";
import { fromAvnacDocument as fromDirectAvnac } from "../../src/lib/saraswati/compat/from-avnac";
import { fromAvnacDocument as fromLegacyFabricCompat } from "../../src/lib/saraswati/compat/legacy/from-fabric";

function makeBaseDocument(): AvnacDocumentV1 {
  return {
    v: AVNAC_DOC_VERSION,
    artboard: { width: 1200, height: 800 },
    bg: { type: "solid", color: "#ffffff" },
    fabric: { objects: [] },
  };
}

describe("from-avnac direct adapter parity", () => {
  it("matches legacy compat output for mixed node sets", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "rect",
          avnacLayerId: "rect-1",
          left: 120,
          top: 90,
          width: 180,
          height: 90,
          fill: "#f97316",
          stroke: "#111827",
          strokeWidth: 3,
          rx: 12,
          ry: 12,
        },
        {
          type: "Ellipse",
          avnacLayerId: "ellipse-1",
          left: 460,
          top: 220,
          rx: 70,
          ry: 44,
          fill: "#22c55e",
          strokeWidth: 0,
          originX: "center",
          originY: "center",
        },
        {
          type: "textbox",
          avnacLayerId: "text-1",
          left: 300,
          top: 420,
          width: 360,
          text: "Saraswati parity",
          fill: "#0f172a",
          fontSize: 42,
          fontWeight: 700,
        },
        {
          type: "image",
          avnacLayerId: "img-1",
          left: 760,
          top: 320,
          width: 220,
          height: 160,
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6sW7YAAAAASUVORK5CYII=",
          cropX: 0,
          cropY: 0,
        },
      ],
    };

    const direct = fromDirectAvnac(doc);
    const legacy = fromLegacyFabricCompat(doc);

    expect(direct).toEqual(legacy);
  });

  it("matches legacy compat output for nested groups and line metadata", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "group-outer",
          left: 400,
          top: 300,
          width: 200,
          height: 200,
          originX: "left",
          originY: "top",
          objects: [
            {
              type: "group",
              avnacLayerId: "group-inner",
              left: 40,
              top: 40,
              width: 100,
              height: 100,
              objects: [
                {
                  type: "polygon",
                  avnacLayerId: "poly-1",
                  left: 0,
                  top: 0,
                  points: [
                    { x: 0, y: -60 },
                    { x: 52, y: 30 },
                    { x: -52, y: 30 },
                  ],
                  fill: "#ef4444",
                },
              ],
            },
          ],
        },
        {
          type: "group",
          avnacLayerId: "arrow-1",
          avnacShape: {
            kind: "arrow",
            arrowEndpoints: { x1: 50, y1: 70, x2: 420, y2: 330 },
            arrowStrokeWidth: 4,
            arrowLineStyle: "dashed",
            arrowPathType: "curved",
            arrowCurveBulge: 24,
            arrowCurveT: 0.45,
          },
          avnacStroke: { type: "solid", color: "#0ea5e9" },
        },
      ],
    };

    const direct = fromDirectAvnac(doc);
    const legacy = fromLegacyFabricCompat(doc);

    expect(direct).toEqual(legacy);
  });
});
