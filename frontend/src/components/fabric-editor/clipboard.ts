export async function readClipboardImageFiles(): Promise<File[]> {
  const read = navigator.clipboard?.read;
  if (!read) return [];
  const items = await read.call(navigator.clipboard);
  const files: File[] = [];
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    const ext = imageType.split("/")[1]?.split("+")[0] || "png";
    files.push(
      new File([blob], `clipboard-image.${ext}`, {
        type: imageType,
      }),
    );
  }
  return files;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
}

export function imageFilesFromClipboardData(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const files = Array.from(dt.files).filter(isImageFile);
  const itemFiles = Array.from(dt.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file && isImageFile(file));
  const seen = new Set<string>();
  return [...files, ...itemFiles].filter((file) => {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}