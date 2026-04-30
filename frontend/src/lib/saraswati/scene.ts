import type {
  SaraswatiPreviewRenderableObject,
  SaraswatiSceneDocumentV1,
  SaraswatiSceneObject,
} from "./types";

export const SARASWATI_SCENE_VERSION = 1 as const;

export function createSaraswatiSceneDocument(
  input: Omit<SaraswatiSceneDocumentV1, "v">,
): SaraswatiSceneDocumentV1 {
  return {
    v: SARASWATI_SCENE_VERSION,
    ...input,
  };
}

export function parseSaraswatiSceneDocument(
  raw: unknown,
): SaraswatiSceneDocumentV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Partial<SaraswatiSceneDocumentV1>;
  if (doc.v !== SARASWATI_SCENE_VERSION) return null;
  if (
    !doc.artboard ||
    typeof doc.artboard.width !== "number" ||
    typeof doc.artboard.height !== "number"
  ) {
    return null;
  }
  if (!doc.bg || typeof doc.bg !== "object") return null;
  if (!Array.isArray(doc.objects)) return null;
  return doc as SaraswatiSceneDocumentV1;
}

export function isSaraswatiPreviewRenderableObject(
  object: SaraswatiSceneObject,
): object is SaraswatiPreviewRenderableObject {
  switch (object.kind) {
    case "rect":
    case "ellipse":
    case "polygon":
    case "text":
    case "line":
    case "arrow":
      return true;
    default:
      return false;
  }
}

export function isSaraswatiFastPreviewCapable(
  scene: SaraswatiSceneDocumentV1,
): boolean {
  return scene.objects.every(
    (object) =>
      object.visible === false || isSaraswatiPreviewRenderableObject(object),
  );
}

export * from "./types";
