import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import type { SaraswatiCommand } from "@/lib/saraswati";
import type { SaraswatiClipPath } from "@/lib/saraswati/types";

function saraswatiClipPathToFabricClipPath(clipPath: SaraswatiClipPath | null) {
  if (!clipPath) return null;
  if (clipPath.type === "ellipse") {
    return {
      type: "ellipse",
      left: clipPath.x,
      top: clipPath.y,
      originX: "center",
      originY: "center",
      rx: clipPath.width / 2,
      ry: clipPath.height / 2,
      width: clipPath.width,
      height: clipPath.height,
    } as Record<string, unknown>;
  }
  return {
    type: "rect",
    left: clipPath.x,
    top: clipPath.y,
    originX: "center",
    originY: "center",
    width: clipPath.width,
    height: clipPath.height,
    rx: clipPath.radiusX,
    ry: clipPath.radiusY,
  } as Record<string, unknown>;
}

function patchClipPathOnFabricObjects(
  objects: unknown[],
  updates: Map<string, Record<string, unknown> | null>,
): unknown[] {
  return objects.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const obj = entry as Record<string, unknown>;
    const next: Record<string, unknown> = { ...obj };
    const layerId =
      typeof obj.avnacLayerId === "string" ? obj.avnacLayerId : null;
    if (layerId && updates.has(layerId)) {
      const clipPath = updates.get(layerId) ?? null;
      if (clipPath) {
        next.clipPath = clipPath;
      } else {
        delete next.clipPath;
      }
    }
    if (Array.isArray(obj.objects)) {
      next.objects = patchClipPathOnFabricObjects(obj.objects, updates);
    }
    return next;
  });
}

export function applyClipPathCommandsToDocument(
  doc: AvnacDocumentV1,
  commands: SaraswatiCommand[],
): AvnacDocumentV1 {
  const updates = new Map<string, Record<string, unknown> | null>();
  for (const command of commands) {
    if (command.type === "SET_NODE_CLIP_PATH") {
      updates.set(
        command.id,
        saraswatiClipPathToFabricClipPath(command.clipPath),
      );
      continue;
    }
    if (command.type === "SET_NODE_CLIP_STACK") {
      const topMost =
        command.clipPathStack[command.clipPathStack.length - 1] ?? null;
      updates.set(command.id, saraswatiClipPathToFabricClipPath(topMost));
    }
  }
  if (updates.size === 0) return doc;
  const fabric = doc.fabric as Record<string, unknown>;
  const rawObjects = fabric.objects;
  if (!Array.isArray(rawObjects)) return doc;
  const nextObjects = patchClipPathOnFabricObjects(rawObjects, updates);
  return {
    ...doc,
    fabric: {
      ...fabric,
      objects: nextObjects,
    },
  } as AvnacDocumentV1;
}
