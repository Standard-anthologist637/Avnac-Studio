import type { SaraswatiScene } from "@/lib/saraswati";

export function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

export function isChromeTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("[data-avnac-chrome]"))
  );
}

export function shouldIgnoreEditorHotkeys(
  target: EventTarget | null,
  hasInlineTextEdit: boolean,
) {
  if (hasInlineTextEdit) return true;
  return isTextEntryTarget(target);
}

export function collectSelectableNodeIds(
  scene: SaraswatiScene,
  lockedIds: readonly string[],
) {
  return Object.values(scene.nodes)
    .filter((node) => node.id !== scene.root)
    .filter((node) => node.visible !== false)
    .filter((node) => !lockedIds.includes(node.id))
    .map((node) => node.id);
}

export function reorderChildrenForSelection(params: {
  children: readonly string[];
  selectedId: string;
  mode: "forward" | "backward" | "front" | "back";
}) {
  const { children, selectedId, mode } = params;
  const fromIndex = children.indexOf(selectedId);
  if (fromIndex < 0) return null;

  let toIndex = fromIndex;
  if (mode === "forward")
    toIndex = Math.min(children.length - 1, fromIndex + 1);
  if (mode === "backward") toIndex = Math.max(0, fromIndex - 1);
  if (mode === "front") toIndex = children.length - 1;
  if (mode === "back") toIndex = 0;
  if (toIndex === fromIndex) return null;

  const next = [...children];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return null;
  next.splice(toIndex, 0, item);
  return next;
}

export function extractClipboardImageFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return [] as File[];
  const files: File[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file || !file.type.startsWith("image/")) continue;
    files.push(file);
  }
  return files;
}
