import { describe, expect, it } from "vitest";
import {
  AVNAC_DOC_VERSION,
  type AvnacDocumentV1,
} from "../../src/lib/avnac-document";
import { buildRenderCommands } from "../../src/lib/saraswati/render/commands";
import { fromAvnacDocument } from "../../src/lib/saraswati/compat/from-fabric";

function makeBaseDocument(): AvnacDocumentV1 {
  return {
    v: AVNAC_DOC_VERSION,
    artboard: { width: 1200, height: 800 },
    bg: { type: "solid", color: "#ffffff" },
    fabric: { objects: [] },
  };
}

describe("fromAvnacDocument shape ingestion", () => {
  it("ingests Fabric star polygons into Saraswati polygon nodes", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "polygon",
          avnacLayerId: "star-1",
          avnacShape: { kind: "star", starPoints: 5 },
          left: 320,
          top: 240,
          originX: "center",
          originY: "center",
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          opacity: 1,
          fill: "#f97316",
          stroke: "#111827",
          strokeWidth: 3,
          points: [
            { x: 0, y: -80 },
            { x: 24, y: -24 },
            { x: 80, y: -24 },
            { x: 34, y: 14 },
            { x: 52, y: 72 },
            { x: 0, y: 38 },
            { x: -52, y: 72 },
            { x: -34, y: 14 },
            { x: -80, y: -24 },
            { x: -24, y: -24 },
          ],
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);

    expect(adapted.issues).toHaveLength(0);
    expect(adapted.fullySupported).toBe(true);

    const star = adapted.scene.nodes["star-1"];
    expect(star).toBeDefined();
    expect(star?.type).toBe("polygon");

    const commands = buildRenderCommands(adapted.scene);
    expect(commands.some((command) => command.type === "polygon")).toBe(true);
  });

  it("keeps line and arrow shape-meta as unsupported for now", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "line-1",
          avnacShape: { kind: "line" },
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);

    expect(adapted.fullySupported).toBe(false);
    expect(adapted.issues).toHaveLength(1);
    expect(adapted.issues[0]?.reason).toBe("shape-meta");
  });

  it("ingests case-variant ellipse type values", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "Ellipse",
          avnacLayerId: "ellipse-1",
          left: 100,
          top: 120,
          originX: "center",
          originY: "center",
          rx: 40,
          ry: 24,
          fill: "#22c55e",
          strokeWidth: 0,
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);

    expect(adapted.fullySupported).toBe(true);
    expect(adapted.issues).toHaveLength(0);
    expect(adapted.scene.nodes["ellipse-1"]?.type).toBe("ellipse");
  });

  it("ingests Fabric circle as Saraswati ellipse", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "circle",
          avnacLayerId: "circle-1",
          left: 180,
          top: 200,
          originX: "center",
          originY: "center",
          r: 36,
          fill: "#38bdf8",
          strokeWidth: 0,
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);

    expect(adapted.fullySupported).toBe(true);
    expect(adapted.issues).toHaveLength(0);

    const node = adapted.scene.nodes["circle-1"];
    expect(node?.type).toBe("ellipse");
    if (node?.type === "ellipse") {
      expect(node.width).toBe(72);
      expect(node.height).toBe(72);
    }
  });
});
