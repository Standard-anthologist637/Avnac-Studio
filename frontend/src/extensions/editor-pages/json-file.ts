export async function readJsonFromFile(
  file: File,
): Promise<unknown | null> {
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
