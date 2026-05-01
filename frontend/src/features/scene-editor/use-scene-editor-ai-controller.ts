/**
 * Builds an AiDesignController that drives the Saraswati scene engine
 * via useSceneEditorStore.  Passed to image / apps / AI panels so they
 * can place content on the scene without knowing about the engine.
 *
 * All mutations go through applyCommands → Saraswati commands — no direct
 * scene mutation, no renderer coupling.
 */
import { useMemo } from "react";
import type { AiDesignController, AiObjectKind } from "@/lib/avnac-ai-controller";
import type {
  SaraswatiRectNode,
  SaraswatiEllipseNode,
  SaraswatiTextNode,
  SaraswatiImageNode,
  SaraswatiLineNode,
} from "@/lib/saraswati";
import { SARASWATI_ROOT_ID } from "@/lib/saraswati";
import { useSceneEditorStore } from "./store";

function placeTopLeft(
  spec: { x?: number; y?: number; origin?: "center" | "top-left" },
  width: number,
  height: number,
  artboardW: number,
  artboardH: number,
): { x: number; y: number } {
  const isCenter = spec.origin === "center";
  const rawX = spec.x ?? artboardW / 2;
  const rawY = spec.y ?? artboardH / 2;
  return {
    x: isCenter ? rawX - width / 2 : rawX,
    y: isCenter ? rawY - height / 2 : rawY,
  };
}

export function useSceneEditorAiController(): AiDesignController {
  // Capture a stable reference to getState — the controller is memo-stable
  // but reads live state at call time, which is correct Zustand practice.
  const getState = useSceneEditorStore.getState;

  return useMemo<AiDesignController>(() => ({
    getCanvas() {
      const { scene } = getState();
      if (!scene) return null;
      const { artboard, nodes, root } = scene;
      const bg = artboard.bg.type === "solid" ? artboard.bg.color : null;
      const objects = Object.values(nodes)
        .filter((n) => n.id !== root && n.type !== "group")
        .map((n) => {
          const any = n as Record<string, unknown>;
          return {
            id: n.id,
            kind: n.type as AiObjectKind,
            label: (typeof any["name"] === "string" && any["name"]) ? any["name"] as string : n.type,
            left: typeof any["x"] === "number" ? (any["x"] as number) : 0,
            top: typeof any["y"] === "number" ? (any["y"] as number) : 0,
            width: typeof any["width"] === "number" ? (any["width"] as number) : 0,
            height: typeof any["height"] === "number" ? (any["height"] as number) : 0,
            angle: typeof any["rotation"] === "number" ? (any["rotation"] as number) : 0,
            fill: null,
            stroke: null,
            text: n.type === "text" ? (any["text"] as string ?? null) : null,
          };
        });
      return {
        width: artboard.width,
        height: artboard.height,
        background: bg,
        objectCount: objects.length,
        objects,
      };
    },

    addRectangle(spec) {
      const { scene, applyCommands, setSelectedIds } = getState();
      if (!scene) return null;
      const id = crypto.randomUUID();
      const { x, y } = placeTopLeft(spec, spec.width, spec.height, scene.artboard.width, scene.artboard.height);
      const node: SaraswatiRectNode = {
        id,
        type: "rect",
        parentId: scene.root ?? SARASWATI_ROOT_ID,
        visible: true,
        x,
        y,
        width: spec.width,
        height: spec.height,
        rotation: spec.rotation ?? 0,
        scaleX: 1,
        scaleY: 1,
        opacity: spec.opacity ?? 1,
        originX: "left",
        originY: "top",
        fill: { type: "solid", color: spec.fill ?? "#262626" },
        stroke: null,
        strokeWidth: 0,
        radiusX: spec.cornerRadius ?? 0,
        radiusY: spec.cornerRadius ?? 0,
        clipPath: null,
      };
      applyCommands([{ type: "ADD_NODE", node }]);
      setSelectedIds([id]);
      return { id };
    },

    addEllipse(spec) {
      const { scene, applyCommands, setSelectedIds } = getState();
      if (!scene) return null;
      const id = crypto.randomUUID();
      const { x, y } = placeTopLeft(spec, spec.width, spec.height, scene.artboard.width, scene.artboard.height);
      const node: SaraswatiEllipseNode = {
        id,
        type: "ellipse",
        parentId: scene.root ?? SARASWATI_ROOT_ID,
        visible: true,
        x,
        y,
        width: spec.width,
        height: spec.height,
        rotation: spec.rotation ?? 0,
        scaleX: 1,
        scaleY: 1,
        opacity: spec.opacity ?? 1,
        originX: "left",
        originY: "top",
        fill: { type: "solid", color: spec.fill ?? "#262626" },
        stroke: null,
        strokeWidth: 0,
        clipPath: null,
      };
      applyCommands([{ type: "ADD_NODE", node }]);
      setSelectedIds([id]);
      return { id };
    },

    addText(spec) {
      const { scene, applyCommands, setSelectedIds } = getState();
      if (!scene) return null;
      const id = crypto.randomUUID();
      const fontSize = spec.fontSize ?? 48;
      const estimatedW = spec.width ?? Math.max(60, spec.text.length * fontSize * 0.6);
      const estimatedH = fontSize * 1.3;
      const { x, y } = placeTopLeft(spec, estimatedW, estimatedH, scene.artboard.width, scene.artboard.height);
      const fw =
        typeof spec.fontWeight === "number"
          ? String(spec.fontWeight)
          : spec.fontWeight === "bold"
            ? "700"
            : "400";
      const node: SaraswatiTextNode = {
        id,
        type: "text",
        parentId: scene.root ?? SARASWATI_ROOT_ID,
        visible: true,
        x,
        y,
        width: estimatedW,
        rotation: spec.rotation ?? 0,
        scaleX: 1,
        scaleY: 1,
        opacity: spec.opacity ?? 1,
        originX: "left",
        originY: "top",
        text: spec.text,
        fontSize,
        fontFamily: spec.fontFamily ?? "Inter",
        fontWeight: fw,
        fontStyle: spec.fontStyle ?? "normal",
        textAlign:
          spec.textAlign === "justify" || !spec.textAlign
            ? "left"
            : spec.textAlign,
        lineHeight: 1.2,
        underline: false,
        color: { type: "solid", color: spec.fill ?? "#111111" },
        stroke: null,
        strokeWidth: 0,
      };
      applyCommands([{ type: "ADD_NODE", node }]);
      setSelectedIds([id]);
      return { id };
    },

    addLine(spec) {
      const { scene, applyCommands, setSelectedIds } = getState();
      if (!scene) return null;
      const id = crypto.randomUUID();
      const node: SaraswatiLineNode = {
        id,
        type: "line",
        parentId: scene.root ?? SARASWATI_ROOT_ID,
        visible: true,
        x: Math.min(spec.x1, spec.x2),
        y: Math.min(spec.y1, spec.y2),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: spec.opacity ?? 1,
        originX: "left",
        originY: "top",
        x1: spec.x1,
        y1: spec.y1,
        x2: spec.x2,
        y2: spec.y2,
        stroke: { type: "solid", color: spec.stroke ?? "#111111" },
        strokeWidth: spec.strokeWidth ?? 2,
        arrowStart: false,
        arrowEnd: false,
        lineStyle: "solid",
        pathType: "straight",
        curveBulge: 0,
        curveT: 0.5,
      };
      applyCommands([{ type: "ADD_NODE", node }]);
      setSelectedIds([id]);
      return { id };
    },

    async addImageFromUrl(spec) {
      const { scene, applyCommands, setSelectedIds } = getState();
      if (!scene) return null;
      const id = crypto.randomUUID();
      const width = spec.width ?? Math.round(scene.artboard.width * 0.4);
      const height = spec.height ?? Math.round(scene.artboard.height * 0.4);
      const { x, y } = placeTopLeft(spec, width, height, scene.artboard.width, scene.artboard.height);
      const node: SaraswatiImageNode = {
        id,
        type: "image",
        parentId: scene.root ?? SARASWATI_ROOT_ID,
        visible: true,
        x,
        y,
        width,
        height,
        rotation: spec.rotation ?? 0,
        scaleX: 1,
        scaleY: 1,
        opacity: spec.opacity ?? 1,
        originX: "left",
        originY: "top",
        src: spec.url,
        cropX: 0,
        cropY: 0,
        clipPath: null,
      };
      applyCommands([{ type: "ADD_NODE", node }]);
      setSelectedIds([id]);
      return { id };
    },

    updateObject(id, patch) {
      const { scene, applyCommands } = getState();
      if (!scene) return false;
      const node = scene.nodes[id];
      if (!node) return false;
      const commands: Parameters<typeof applyCommands>[0] = [];
      if (patch.left !== undefined || patch.top !== undefined) {
        const any = node as Record<string, unknown>;
        const curX = typeof any["x"] === "number" ? (any["x"] as number) : 0;
        const curY = typeof any["y"] === "number" ? (any["y"] as number) : 0;
        const dx = (patch.left ?? curX) - curX;
        const dy = (patch.top ?? curY) - curY;
        if (dx !== 0 || dy !== 0) {
          commands.push({ type: "MOVE_NODE", id, dx, dy });
        }
      }
      if (patch.width !== undefined || patch.height !== undefined) {
        const any = node as Record<string, unknown>;
        const curX = typeof any["x"] === "number" ? (any["x"] as number) : 0;
        const curY = typeof any["y"] === "number" ? (any["y"] as number) : 0;
        const curW = typeof any["width"] === "number" ? (any["width"] as number) : 0;
        const curH = typeof any["height"] === "number" ? (any["height"] as number) : 0;
        commands.push({
          type: "RESIZE_NODE",
          id,
          x: curX,
          y: curY,
          width: patch.width ?? curW,
          height: patch.height ?? curH,
        });
      }
      if (patch.fill !== undefined && node.type !== "line" && node.type !== "group") {
        commands.push({
          type: "SET_NODE_FILL",
          id,
          fill: { type: "solid", color: patch.fill },
        });
      }
      if (patch.stroke !== undefined && node.type !== "group") {
        commands.push({
          type: "SET_NODE_STROKE",
          id,
          stroke: patch.stroke ? { type: "solid", color: patch.stroke } : null,
          strokeWidth: patch.strokeWidth,
        });
      }
      if (commands.length === 0) return false;
      applyCommands(commands);
      return true;
    },

    deleteObject(id) {
      const { scene, applyCommands } = getState();
      if (!scene || !scene.nodes[id]) return false;
      applyCommands([{ type: "DELETE_NODE", id }]);
      return true;
    },

    selectObjects(ids) {
      const { scene, setSelectedIds } = getState();
      if (!scene) return 0;
      const valid = ids.filter((id) => Boolean(scene.nodes[id]));
      setSelectedIds(valid);
      return valid.length;
    },

    setBackgroundColor(color) {
      const { applyCommands } = getState();
      applyCommands([{ type: "SET_ARTBOARD", bg: { type: "solid", color } }]);
    },

    clearCanvas() {
      const { scene, applyCommands, setSelectedIds } = getState();
      if (!scene) return 0;
      const root = scene.nodes[scene.root];
      if (!root || root.type !== "group") return 0;
      const ids = [...root.children];
      if (ids.length === 0) return 0;
      applyCommands(ids.map((id) => ({ type: "DELETE_NODE" as const, id })));
      setSelectedIds([]);
      return ids.length;
    },
  }), [getState]);
}
