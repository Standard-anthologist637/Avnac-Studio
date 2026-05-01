import { describe, expect, it } from "vitest";
import {
  AVNAC_DOC_VERSION,
  type AvnacDocumentV1,
} from "../../src/lib/avnac-document";
import { buildRenderCommands } from "../../src/lib/saraswati/render/commands";
import { fromAvnacDocument } from "../../src/lib/saraswati/compat/legacy/from-fabric";

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

  it("prefers avnacStroke for line color", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "line-color-1",
          avnacShape: {
            kind: "line",
            arrowEndpoints: { x1: 10, y1: 20, x2: 210, y2: 220 },
            arrowStrokeWidth: 2,
          },
          avnacFill: { type: "solid", color: "#ef4444" },
          avnacStroke: { type: "solid", color: "#0ea5e9" },
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["line-color-1"];
    expect(node?.type).toBe("line");
    if (node?.type === "line") {
      expect(node.stroke).toEqual({ type: "solid", color: "#0ea5e9" });
    }
  });

  it("recurses through nested Fabric groups", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "group-outer",
          objects: [
            {
              type: "group",
              avnacLayerId: "group-inner",
              objects: [
                {
                  type: "rect",
                  avnacLayerId: "group-child-rect",
                  left: 32,
                  top: 64,
                  width: 120,
                  height: 80,
                  fill: "#f97316",
                },
              ],
            },
          ],
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    expect(adapted.scene.nodes["group-outer"]?.type).toBe("group");
    expect(adapted.scene.nodes["group-inner"]?.type).toBe("group");
    expect(adapted.scene.nodes["group-child-rect"]?.type).toBe("rect");
  });

  it("uses group center (left+width/2) as the offset for children with originX=left", () => {
    // Fabric v6 groups default to originX='left', so group.left is the LEFT EDGE.
    // Children are in group-local space where (0,0) = group center.
    // Absolute child position = groupCenter + child.left
    //   = (group.left + group.width/2) + child.left
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "outer-g",
          // originX defaults to 'left' in Fabric v6
          left: 100, // left edge of group bounding box
          top: 50, // top edge of group bounding box
          width: 200,
          height: 120,
          // group center in canvas space = (100+100, 50+60) = (200, 110)
          objects: [
            {
              type: "rect",
              avnacLayerId: "child-r",
              left: -30, // in group-local space (relative to group center)
              top: 15,
              width: 60,
              height: 40,
              fill: "#111111",
            },
          ],
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["child-r"];
    expect(node?.type).toBe("rect");
    if (node?.type === "rect") {
      // canvas_x = (100 + 200/2) + (-30) = 200 - 30 = 170
      // canvas_y = (50  + 120/2) + 15   = 110 + 15 = 125
      expect(node.x).toBe(170);
      expect(node.y).toBe(125);
    }
  });

  it("uses group.left directly as center when originX=center", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "group",
          avnacLayerId: "center-g",
          originX: "center",
          originY: "center",
          left: 300, // IS the center x (originX='center')
          top: 200, // IS the center y
          width: 160,
          height: 80,
          objects: [
            {
              type: "rect",
              avnacLayerId: "center-child",
              left: 20,
              top: -10,
              width: 50,
              height: 30,
              fill: "#222222",
            },
          ],
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["center-child"];
    expect(node?.type).toBe("rect");
    if (node?.type === "rect") {
      // canvas_x = 300 + 20 = 320  (group.left IS center when originX='center')
      // canvas_y = 200 + (-10) = 190
      expect(node.x).toBe(320);
      expect(node.y).toBe(190);
    }
  });

  it("ingests images with clipPath instead of skipping them", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "image",
          avnacLayerId: "img-clip-1",
          left: 120,
          top: 140,
          width: 300,
          height: 180,
          src: "https://example.com/image.png",
          clipPath: { type: "rect", width: 100, height: 100 },
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["img-clip-1"];
    expect(node?.type).toBe("image");
    if (node?.type === "image") {
      expect(node.clipPath?.type).toBe("rect");
      expect(node.clipPath?.width).toBe(100);
      expect(node.clipPath?.height).toBe(100);
    }
    expect(adapted.issues.some((issue) => issue.reason === "clip-path")).toBe(
      false,
    );
  });

  it("ingests rect clipPath without reporting clip-path unsupported", () => {
    const doc = makeBaseDocument();
    doc.fabric = {
      objects: [
        {
          type: "rect",
          avnacLayerId: "rect-clip-1",
          left: 80,
          top: 90,
          width: 240,
          height: 160,
          fill: "#f97316",
          clipPath: { type: "ellipse", rx: 60, ry: 45, left: 0, top: 0 },
        },
      ],
    };

    const adapted = fromAvnacDocument(doc);
    const node = adapted.scene.nodes["rect-clip-1"];
    expect(node?.type).toBe("rect");
    if (node?.type === "rect") {
      expect(node.clipPath?.type).toBe("ellipse");
      expect(node.clipPath?.width).toBe(120);
      expect(node.clipPath?.height).toBe(90);
    }
    expect(adapted.issues.some((issue) => issue.reason === "clip-path")).toBe(
      false,
    );
  });
});
