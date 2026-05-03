import type { SaraswatiRenderCommand } from "@/lib/saraswati";

export type DirtyRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function collectDirtyRenderCommandRects(
  previous: readonly SaraswatiRenderCommand[],
  next: readonly SaraswatiRenderCommand[],
  pad = 8,
): DirtyRect[] {
  const dirty: DirtyRect[] = [];
  const maxLen = Math.max(previous.length, next.length);
  for (let index = 0; index < maxLen; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (before && !after) {
      const rect = commandBounds(before);
      if (rect) dirty.push(expandRect(rect, pad));
      continue;
    }
    if (!before && after) {
      const rect = commandBounds(after);
      if (rect) dirty.push(expandRect(rect, pad));
      continue;
    }
    if (!before || !after) continue;
    if (commandSignature(before) === commandSignature(after)) continue;
    const beforeRect = commandBounds(before);
    const afterRect = commandBounds(after);
    if (beforeRect) dirty.push(expandRect(beforeRect, pad));
    if (afterRect) dirty.push(expandRect(afterRect, pad));
  }
  return dirty;
}

function commandSignature(command: SaraswatiRenderCommand): string {
  return JSON.stringify(command);
}

function commandBounds(command: SaraswatiRenderCommand): DirtyRect | null {
  if (command.type === "line") {
    const x = Math.min(command.x1, command.x2);
    const y = Math.min(command.y1, command.y2);
    const pad = Math.max(
      2,
      command.strokeWidth + Math.max(command.blur ?? 0, 0),
    );
    return {
      x: x - pad,
      y: y - pad,
      width: Math.max(1, Math.abs(command.x2 - command.x1)) + pad * 2,
      height: Math.max(1, Math.abs(command.y2 - command.y1)) + pad * 2,
    };
  }
  if (command.type === "text") {
    const lineCount = Math.max(1, command.text.split(/\r?\n/).length);
    const approxHeight =
      Math.max(1, command.fontSize) *
      Math.max(1, command.lineHeight) *
      lineCount;
    return {
      x: command.x,
      y: command.y,
      width: Math.max(1, command.width * Math.abs(command.scaleX)),
      height: Math.max(1, approxHeight * Math.abs(command.scaleY)),
    };
  }
  return {
    x: command.x,
    y: command.y,
    width: Math.max(1, command.width * Math.abs(command.scaleX)),
    height: Math.max(1, command.height * Math.abs(command.scaleY)),
  };
}

function expandRect(rect: DirtyRect, pad: number): DirtyRect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}
