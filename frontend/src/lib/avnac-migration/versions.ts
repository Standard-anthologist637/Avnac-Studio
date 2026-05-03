/**
 * Avnac document schema version registry.
 *
 * Rules:
 *  - Version field is required on every saved file.
 *  - Migration functions must be pure and chainable by version.
 *  - Saraswati-native format is never stored — serialization always converts
 *    back to Avnac format.
 *  - Never introduce a Saraswati-native storage format.
 */

/** The current desktop persistence schema version. */
export const AVNAC_CURRENT_DOC_VERSION = 1 as const;

/** The current desktop multi-page wrapper schema version. */
export const AVNAC_CURRENT_MULTI_PAGE_VERSION = 1 as const;

/** All known single-page document schema versions. */
export type AvnacDocSchemaVersion = 1;

/** Narrows unknown data to something with a numeric `v` field. */
export function hasVersionField(raw: unknown): raw is { v: number } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "v" in raw &&
    typeof (raw as Record<string, unknown>).v === "number"
  );
}
