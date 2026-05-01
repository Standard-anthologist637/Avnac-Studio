import type { AvnacDocumentV1 } from "@/lib/avnac-document";
import { renderAvnacDocumentPreviewDataUrl } from "@/lib/avnac-document-preview";
import {
  idbGetEditorRecord,
  idbListDocuments,
  type AvnacEditorIdbListItem,
} from "@/lib/avnac-editor-idb";
import { renderSaraswatiScenePreviewDataUrl } from "@/lib/renderer/preview";
import { fromAvnacDocument as fromDirectAvnacDocument } from "../compat/from-avnac";
import type { SaraswatiAdapterResult } from "../types";

export type DualRunAdapter = (
  document: AvnacDocumentV1,
) => SaraswatiAdapterResult;

export type DualRunDocumentInput = {
  id: string;
  persistId: string;
  name?: string;
  document: AvnacDocumentV1;
};

export type DualRunValidationOptions = {
  adapter: DualRunAdapter;
  maxCssPx?: number;
  channelTolerance?: number;
  alphaTolerance?: number;
  includePartialAdapterResults?: boolean;
  onDocumentCompared?: (result: DualRunDocumentResult) => void;
};

export type DualRunPixelDiff = {
  width: number;
  height: number;
  mismatchedPixels: number;
  totalPixels: number;
  mismatchRatio: number;
  meanAbsChannelDiff: number;
};

export type DualRunDocumentResult = {
  id: string;
  persistId: string;
  name: string;
  fullySupported: boolean;
  issueCount: number;
  legacyDataUrl: string | null;
  candidateDataUrl: string | null;
  pixelDiff: DualRunPixelDiff | null;
  error: string | null;
};

export type DualRunBatchResult = {
  total: number;
  compared: number;
  failed: number;
  results: DualRunDocumentResult[];
};

export type DualRunStoredDocumentsOptions = DualRunValidationOptions & {
  ids?: string[];
  limit?: number;
};

export type DualRunStoredDocumentsDefaultsOptions = Omit<
  DualRunStoredDocumentsOptions,
  "adapter"
>;

export async function runDualRunValidation(
  documents: readonly DualRunDocumentInput[],
  options: DualRunValidationOptions,
): Promise<DualRunBatchResult> {
  if (typeof document === "undefined") {
    throw new Error("Dual-run validation requires a browser canvas context.");
  }

  const results: DualRunDocumentResult[] = [];
  for (const row of documents) {
    const result = await compareSingleDocument(row, options);
    results.push(result);
    options.onDocumentCompared?.(result);
  }

  const compared = results.filter((row) => row.pixelDiff != null).length;
  const failed = results.filter((row) => row.error != null).length;

  return {
    total: results.length,
    compared,
    failed,
    results,
  };
}

export async function runDualRunValidationForStoredDocuments(
  options: DualRunStoredDocumentsOptions,
): Promise<DualRunBatchResult> {
  const listed = await idbListDocuments();
  const filtered = filterListedDocuments(listed, options.ids, options.limit);

  const docs: DualRunDocumentInput[] = [];
  for (const entry of filtered) {
    const record = await idbGetEditorRecord(entry.id);
    if (!record) continue;
    docs.push({
      id: record.id,
      persistId: record.id,
      name: record.name ?? entry.name,
      document: record.document,
    });
  }

  return runDualRunValidation(docs, options);
}

/**
 * Executes Task 5.5 against currently stored user documents.
 * Uses the active direct Avnac adapter (`compat/from-avnac`) as candidate.
 */
export async function runDualRunValidationForStoredDocumentsWithDirectAdapter(
  options: DualRunStoredDocumentsDefaultsOptions = {},
): Promise<DualRunBatchResult> {
  return runDualRunValidationForStoredDocuments({
    ...options,
    adapter: fromDirectAvnacDocument,
  });
}

export function summarizeDualRunBatch(result: DualRunBatchResult): {
  total: number;
  compared: number;
  failed: number;
  worstMismatchRatio: number;
  avgMismatchRatio: number;
  topMismatches: Array<{
    id: string;
    name: string;
    mismatchRatio: number;
    issueCount: number;
  }>;
} {
  const withDiff = result.results.filter(
    (row): row is DualRunDocumentResult & { pixelDiff: DualRunPixelDiff } =>
      row.pixelDiff != null,
  );
  const mismatches = [...withDiff]
    .sort((a, b) => b.pixelDiff.mismatchRatio - a.pixelDiff.mismatchRatio)
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      name: row.name,
      mismatchRatio: row.pixelDiff.mismatchRatio,
      issueCount: row.issueCount,
    }));

  const sumMismatchRatio = withDiff.reduce(
    (sum, row) => sum + row.pixelDiff.mismatchRatio,
    0,
  );

  return {
    total: result.total,
    compared: result.compared,
    failed: result.failed,
    worstMismatchRatio: mismatches[0]?.mismatchRatio ?? 0,
    avgMismatchRatio:
      withDiff.length > 0 ? sumMismatchRatio / withDiff.length : 0,
    topMismatches: mismatches,
  };
}

export function findDualRunMismatchOutliers(
  result: DualRunBatchResult,
  minMismatchRatio = 0.01,
): Array<{
  id: string;
  name: string;
  mismatchRatio: number;
  issueCount: number;
}> {
  return result.results
    .filter(
      (row): row is DualRunDocumentResult & { pixelDiff: DualRunPixelDiff } =>
        row.pixelDiff != null,
    )
    .filter((row) => row.pixelDiff.mismatchRatio >= minMismatchRatio)
    .sort((a, b) => b.pixelDiff.mismatchRatio - a.pixelDiff.mismatchRatio)
    .map((row) => ({
      id: row.id,
      name: row.name,
      mismatchRatio: row.pixelDiff.mismatchRatio,
      issueCount: row.issueCount,
    }));
}

export function printDualRunSummaryToConsole(result: DualRunBatchResult) {
  const summary = summarizeDualRunBatch(result);
  console.groupCollapsed("[dual-run] summary");
  console.log(summary);
  const tableRows = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    fullySupported: row.fullySupported,
    issueCount: row.issueCount,
    mismatchRatio: row.pixelDiff?.mismatchRatio ?? null,
    meanAbsChannelDiff: row.pixelDiff?.meanAbsChannelDiff ?? null,
    error: row.error,
  }));
  console.table(tableRows);
  console.groupEnd();
}

function filterListedDocuments(
  listed: AvnacEditorIdbListItem[],
  ids?: string[],
  limit?: number,
): AvnacEditorIdbListItem[] {
  const whitelist = ids && ids.length > 0 ? new Set(ids) : null;
  const filtered = whitelist
    ? listed.filter((row) => whitelist.has(row.id))
    : listed;
  if (limit == null || limit <= 0) return filtered;
  return filtered.slice(0, limit);
}

async function compareSingleDocument(
  row: DualRunDocumentInput,
  options: DualRunValidationOptions,
): Promise<DualRunDocumentResult> {
  const name = row.name ?? "Untitled";
  try {
    const legacyDataUrl = await renderAvnacDocumentPreviewDataUrl(
      row.document,
      row.persistId,
      {
        maxCssPx: options.maxCssPx,
      },
    );

    const adapted = options.adapter(row.document);
    const shouldRenderCandidate =
      adapted.fullySupported || options.includePartialAdapterResults === true;
    const candidateDataUrl = shouldRenderCandidate
      ? await renderSaraswatiScenePreviewDataUrl(adapted.scene, {
          maxCssPx: options.maxCssPx,
        })
      : null;

    if (!legacyDataUrl || !candidateDataUrl) {
      return {
        id: row.id,
        persistId: row.persistId,
        name,
        fullySupported: adapted.fullySupported,
        issueCount: adapted.issues.length,
        legacyDataUrl,
        candidateDataUrl,
        pixelDiff: null,
        error:
          !legacyDataUrl && !candidateDataUrl
            ? "Both pipelines failed to render"
            : !legacyDataUrl
              ? "Legacy pipeline failed to render"
              : "Candidate pipeline failed to render",
      };
    }

    const pixelDiff = await compareRenderedDataUrls(
      legacyDataUrl,
      candidateDataUrl,
      {
        channelTolerance: options.channelTolerance,
        alphaTolerance: options.alphaTolerance,
      },
    );

    return {
      id: row.id,
      persistId: row.persistId,
      name,
      fullySupported: adapted.fullySupported,
      issueCount: adapted.issues.length,
      legacyDataUrl,
      candidateDataUrl,
      pixelDiff,
      error: null,
    };
  } catch (error) {
    return {
      id: row.id,
      persistId: row.persistId,
      name,
      fullySupported: false,
      issueCount: 0,
      legacyDataUrl: null,
      candidateDataUrl: null,
      pixelDiff: null,
      error: String(error),
    };
  }
}

async function compareRenderedDataUrls(
  legacyDataUrl: string,
  candidateDataUrl: string,
  options?: {
    channelTolerance?: number;
    alphaTolerance?: number;
  },
): Promise<DualRunPixelDiff> {
  const legacy = await decodeDataUrl(legacyDataUrl);
  const candidate = await decodeDataUrl(candidateDataUrl);
  const width = Math.max(1, Math.max(legacy.width, candidate.width));
  const height = Math.max(1, Math.max(legacy.height, candidate.height));

  const legacyImage = resizeImageData(legacy, width, height);
  const candidateImage = resizeImageData(candidate, width, height);

  const channelTolerance = Math.max(
    0,
    Math.floor(options?.channelTolerance ?? 2),
  );
  const alphaTolerance = Math.max(0, Math.floor(options?.alphaTolerance ?? 2));

  const totalPixels = width * height;
  let mismatchedPixels = 0;
  let sumAbs = 0;

  for (let i = 0; i < legacyImage.data.length; i += 4) {
    const dr = Math.abs(legacyImage.data[i]! - candidateImage.data[i]!);
    const dg = Math.abs(legacyImage.data[i + 1]! - candidateImage.data[i + 1]!);
    const db = Math.abs(legacyImage.data[i + 2]! - candidateImage.data[i + 2]!);
    const da = Math.abs(legacyImage.data[i + 3]! - candidateImage.data[i + 3]!);
    sumAbs += dr + dg + db + da;
    if (
      dr > channelTolerance ||
      dg > channelTolerance ||
      db > channelTolerance ||
      da > alphaTolerance
    ) {
      mismatchedPixels += 1;
    }
  }

  return {
    width,
    height,
    mismatchedPixels,
    totalPixels,
    mismatchRatio: totalPixels > 0 ? mismatchedPixels / totalPixels : 0,
    meanAbsChannelDiff: totalPixels > 0 ? sumAbs / (totalPixels * 4 * 255) : 0,
  };
}

async function decodeDataUrl(dataUrl: string): Promise<ImageData> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || image.width);
  canvas.height = Math.max(1, image.naturalHeight || image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D context for image decode.");
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function resizeImageData(
  source: ImageData,
  width: number,
  height: number,
): ImageData {
  if (source.width === width && source.height === height) {
    return source;
  }
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = source.width;
  sourceCanvas.height = source.height;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("Could not acquire source 2D context for resize.");
  }
  sourceCtx.putImageData(source, 0, 0);

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetCtx = targetCanvas.getContext("2d");
  if (!targetCtx) {
    throw new Error("Could not acquire target 2D context for resize.");
  }

  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
  return targetCtx.getImageData(0, 0, width, height);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load data URL image."));
    image.src = src;
  });
}
