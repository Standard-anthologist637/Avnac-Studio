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

  it("keeps line shape-meta as unsupported when arrowEndpoints are missing", () => {
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

  it("ingests line with arrowEndpoints into a SaraswatiLineNode", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "line-ep-1",
          avnacShape: {
            kind: "line",
            arrowEndpoints: { x1: 100, y1: 200, x2: 400, y2: 350 },
            arrowStrokeWidth: 4,
          },
          avnacFill: { type: "solid", color: "#ef4444" },
          opacity: 0.9,
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["line-ep-1"];

    expect(node?.type).toBe("line");
    if (node?.type === "line") {
      expect(node.x1).toBe(100);
      expect(node.y1).toBe(200);
      expect(node.x2).toBe(400);
      expect(node.y2).toBe(350);
      expect(node.strokeWidth).toBe(4);
      expect(node.arrowEnd).toBe(false);
    }

    const commands = buildRenderCommands(adapted.scene);
    expect(commands.some((c) => c.type === "line")).toBe(true);
  });

  it("ingests arrow with arrowEndpoints and sets arrowEnd=true", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "arrow-1",
          avnacShape: {
            kind: "arrow",
            arrowEndpoints: { x1: 50, y1: 50, x2: 300, y2: 300 },
            arrowStrokeWidth: 3,
          },
          avnacFill: { type: "solid", color: "#3b82f6" },
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["arrow-1"];

    expect(node?.type).toBe("line");
    if (node?.type === "line") {
      expect(node.arrowEnd).toBe(true);
      expect(node.arrowStart).toBe(false);
    }
  });
});
