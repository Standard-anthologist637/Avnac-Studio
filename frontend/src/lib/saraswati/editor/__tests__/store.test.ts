import { describe, expect, it } from "vitest";
import {
  createEmptySaraswatiScene,
  createSaraswatiEditorStore,
  type SaraswatiRectNode,
} from "../..";

function buildRectNode(id: string): SaraswatiRectNode {
  return {
    id,
    type: "rect",
    parentId: "root",
    visible: true,
    x: 100,
    y: 120,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    originX: "left",
    originY: "top",
    width: 80,
    height: 60,
    radiusX: 0,
    radiusY: 0,
    fill: { type: "solid", color: "#000000" },
    stroke: null,
    strokeWidth: 0,
    clipPath: null,
    clipPathStack: [],
  };
}

function buildStore() {
  const scene = createEmptySaraswatiScene({ width: 800, height: 600 });
  const rect = buildRectNode("rect-1");
  scene.nodes[rect.id] = rect;
  const root = scene.nodes.root;
  if (root.type !== "group") {
    throw new Error("Expected root group");
  }
  root.children.push(rect.id);
  return createSaraswatiEditorStore(scene);
}

describe("createSaraswatiEditorStore", () => {
  it("undoes and redoes a single dispatched command", () => {
    const store = buildStore();

    store.dispatch({ type: "MOVE_NODE", id: "rect-1", dx: 25, dy: -10 });

    let rect = store.getState().scene.nodes["rect-1"];
    if (rect.type !== "rect") {
      throw new Error("Expected rect node");
    }
    expect(rect.x).toBe(125);
    expect(rect.y).toBe(110);
    expect(store.getState().canUndo).toBe(true);

    store.undo();
    rect = store.getState().scene.nodes["rect-1"];
    if (rect.type !== "rect") {
      throw new Error("Expected rect node");
    }
    expect(rect.x).toBe(100);
    expect(rect.y).toBe(120);
    expect(store.getState().canRedo).toBe(true);

    store.redo();
    rect = store.getState().scene.nodes["rect-1"];
    if (rect.type !== "rect") {
      throw new Error("Expected rect node");
    }
    expect(rect.x).toBe(125);
    expect(rect.y).toBe(110);
  });

  it("collapses a batched drag into one undo step", () => {
    const store = buildStore();

    store.beginBatch();
    store.dispatch({ type: "MOVE_NODE", id: "rect-1", dx: 10, dy: 0 });
    store.dispatch({ type: "MOVE_NODE", id: "rect-1", dx: 15, dy: 5 });
    store.dispatch({ type: "MOVE_NODE", id: "rect-1", dx: -3, dy: 7 });
    expect(store.getState().canUndo).toBe(false);

    store.endBatch();

    let rect = store.getState().scene.nodes["rect-1"];
    if (rect.type !== "rect") {
      throw new Error("Expected rect node");
    }
    expect(rect.x).toBe(122);
    expect(rect.y).toBe(132);
    expect(store.getState().canUndo).toBe(true);

    store.undo();
    rect = store.getState().scene.nodes["rect-1"];
    if (rect.type !== "rect") {
      throw new Error("Expected rect node");
    }
    expect(rect.x).toBe(100);
    expect(rect.y).toBe(120);

    store.redo();
    rect = store.getState().scene.nodes["rect-1"];
    if (rect.type !== "rect") {
      throw new Error("Expected rect node");
    }
    expect(rect.x).toBe(122);
    expect(rect.y).toBe(132);
  });

  it("does not create undo history for an empty batch", () => {
    const store = buildStore();

    store.beginBatch();
    store.endBatch();

    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);
  });
});
