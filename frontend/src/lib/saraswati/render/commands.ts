import type { BgValue } from "../../editor-paint";
import {
  type SaraswatiEllipseNode,
  listSaraswatiNodesInRenderOrder,
  type SaraswatiImageNode,
  type SaraswatiNodeOriginX,
  type SaraswatiNodeOriginY,
  type SaraswatiPolygonNode,
  type SaraswatiRectNode,
  type SaraswatiRenderableNode,
  type SaraswatiScene,
  type SaraswatiTextNode,
} from "../scene";

type RenderTransform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  originX: SaraswatiNodeOriginX;
  originY: SaraswatiNodeOriginY;
};

export type SaraswatiRenderRectCommand = RenderTransform & {
  type: "rect";
  width: number;
  height: number;
  fill: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
  radiusX: number;
  radiusY: number;
};

export type SaraswatiRenderEllipseCommand = RenderTransform & {
  type: "ellipse";
  width: number;
  height: number;
  fill: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
};

export type SaraswatiRenderPolygonCommand = RenderTransform & {
  type: "polygon";
  width: number;
  height: number;
  fill: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
  points: Array<{ x: number; y: number }>;
};

export type SaraswatiRenderTextCommand = RenderTransform & {
  type: "text";
  text: string;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  underline: boolean;
  color: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
};

export type SaraswatiRenderImageCommand = RenderTransform & {
  type: "image";
  width: number;
  height: number;
  src: string;
  cropX: number;
  cropY: number;
};

export type SaraswatiRenderCommand =
  | SaraswatiRenderRectCommand
  | SaraswatiRenderEllipseCommand
  | SaraswatiRenderPolygonCommand
  | SaraswatiRenderTextCommand
  | SaraswatiRenderImageCommand;

export function buildRenderCommands(
  scene: SaraswatiScene,
): SaraswatiRenderCommand[] {
  const commands: SaraswatiRenderCommand[] = [
    {
      type: "rect",
      x: 0,
      y: 0,
      width: scene.artboard.width,
      height: scene.artboard.height,
      fill: scene.artboard.bg,
      stroke: null,
      strokeWidth: 0,
      radiusX: 0,
      radiusY: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      originX: "left",
      originY: "top",
    },
  ];

  for (const node of listSaraswatiNodesInRenderOrder(scene)) {
    commands.push(nodeToRenderCommand(node));
  }

  return commands;
}

function nodeToRenderCommand(
  node: SaraswatiRenderableNode,
): SaraswatiRenderCommand {
  switch (node.type) {
    case "rect":
      return rectNodeToCommand(node);
    case "ellipse":
      return ellipseNodeToCommand(node);
    case "polygon":
      return polygonNodeToCommand(node);
    case "text":
      return textNodeToCommand(node);
    case "image":
      return imageNodeToCommand(node);
  }
}

function rectNodeToCommand(
  node: SaraswatiRectNode,
): SaraswatiRenderRectCommand {
  return {
    type: "rect",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fill: node.fill,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    radiusX: node.radiusX,
    radiusY: node.radiusY,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
    opacity: node.opacity,
    originX: node.originX,
    originY: node.originY,
  };
}

function ellipseNodeToCommand(
  node: SaraswatiEllipseNode,
): SaraswatiRenderEllipseCommand {
  return {
    type: "ellipse",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fill: node.fill,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
    opacity: node.opacity,
    originX: node.originX,
    originY: node.originY,
  };
}

function polygonNodeToCommand(
  node: SaraswatiPolygonNode,
): SaraswatiRenderPolygonCommand {
  return {
    type: "polygon",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fill: node.fill,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    points: node.points.map((point) => ({ ...point })),
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
    opacity: node.opacity,
    originX: node.originX,
    originY: node.originY,
  };
}

function textNodeToCommand(
  node: SaraswatiTextNode,
): SaraswatiRenderTextCommand {
  return {
    type: "text",
    x: node.x,
    y: node.y,
    text: node.text,
    width: node.width,
    fontSize: node.fontSize,
    fontFamily: node.fontFamily,
    fontWeight: node.fontWeight,
    fontStyle: node.fontStyle,
    textAlign: node.textAlign,
    lineHeight: node.lineHeight,
    underline: node.underline,
    color: node.color,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
    opacity: node.opacity,
    originX: node.originX,
    originY: node.originY,
  };
}

function imageNodeToCommand(
  node: SaraswatiImageNode,
): SaraswatiRenderImageCommand {
  return {
    type: "image",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    src: node.src,
    cropX: node.cropX,
    cropY: node.cropY,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
    opacity: node.opacity,
    originX: node.originX,
    originY: node.originY,
  };
}
