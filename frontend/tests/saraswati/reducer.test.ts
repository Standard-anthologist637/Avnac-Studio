import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/lib/saraswati/commands/reducer";
import { createEmptySaraswatiScene } from "../../src/lib/saraswati/scene";

describe("saraswati reducer", () => {
  it("moves line endpoints with MOVE_NODE", () => {
    const scene = createEmptySaraswatiScene({
      width: 800,
      height: 600,
      bg: { type: "solid", color: "#ffffff" },
    });

    scene.nodes["line-1"] = {
      id: "line-1",
      type: "line",
      parentId: scene.root,
      visible: true,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      originX: "left",
      originY: "top",
      x1: 10,
      y1: 20,
      x2: 110,
      y2: 220,
      stroke: { type: "solid", color: "#111111" },
      strokeWidth: 2,
      arrowStart: false,
      arrowEnd: false,
      lineStyle: "solid",
      pathType: "straight",
      curveBulge: 0,
      curveT: 0.5,
    };

    const root = scene.nodes[scene.root];
    if (root?.type === "group") {
      scene.nodes[scene.root] = {
        ...root,
        children: [...root.children, "line-1"],
      };
    }

    const next = applyCommand(scene, {
      type: "MOVE_NODE",
      id: "line-1",
      dx: 5,
      dy: -3,
    });

    const moved = next.nodes["line-1"];
    expect(moved?.type).toBe("line");
    if (moved?.type === "line") {
      expect(moved.x1).toBe(15);
      expect(moved.y1).toBe(17);
      expect(moved.x2).toBe(115);
      expect(moved.y2).toBe(217);
    }
  });
});
