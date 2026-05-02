/**
 * Pure, chainable migration entry-point for persisted Avnac documents.
 *
 * Usage:
 *   import { migrateAvnacDocument } from "@/lib/avnac-migration";
 *   const doc = migrateAvnacDocument(rawJson); // AvnacDocumentV1 | null
 *
 * Rules:
 *  - Returns AvnacDocumentV1 or null — never throws.
 *  - Each migration step is pure: (prev: DocVN) => DocVN+1.
 *  - Future versions: downgrade is never performed — unknown higher versions
 *    return null.
 *  - To add V2: add { fromVersion: 1, migrate: migrateV1toV2 } to MIGRATIONS
 *    and bump AVNAC_DOC_VERSION in avnac-document.ts.
 *  - Saraswati-native format is never stored — this function handles the
 *    desktop Avnac persistence format only.
 */

import { AVNAC_DOC_VERSION, type AvnacDocumentV1 } from "@/lib/avnac-document";

type AnyVersionDoc = Record<string, unknown>;

// ─── Migration steps ──────────────────────────────────────────────────────────
// Add entries here when bumping the schema version.
// Each entry upgrades fromVersion → fromVersion+1.
//
// Example:
//   { fromVersion: 1, migrate: migrateV1toV2 }
//
const MIGRATIONS: Array<{
  fromVersion: number;
  migrate: (doc: AnyVersionDoc) => AnyVersionDoc;
}> = [];

// ─── Internal helpers ─────────────────────────────────────────────────────────

function applyMigrations(doc: AnyVersionDoc): AnyVersionDoc {
  let current = doc;
  let version = typeof current.v === "number" ? current.v : 0;
  while (version < AVNAC_DOC_VERSION) {
    const step = MIGRATIONS.find((m) => m.fromVersion === version);
    if (!step) break; // no migration path — cannot recover
    current = step.migrate(current);
    version = typeof current.v === "number" ? current.v : 0;
  }
  return current;
}

function validateV1(doc: AnyVersionDoc): AvnacDocumentV1 | null {
  if (doc.v !== AVNAC_DOC_VERSION) return null;
  const artboard = doc.artboard as Record<string, unknown> | undefined;
  if (
    !artboard ||
    typeof artboard.width !== "number" ||
    typeof artboard.height !== "number"
  )
    return null;
  if (!doc.bg || typeof doc.bg !== "object") return null;
  if (!doc.fabric || typeof doc.fabric !== "object") return null;
  return doc as unknown as AvnacDocumentV1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Migrate raw persisted JSON to the current AvnacDocumentV1 schema.
 *
 * Handles:
 *  - Current version → validated as-is.
 *  - Older versions → upgraded through the migration chain.
 *  - Future/unknown versions → null (never downgrade).
 *  - Malformed input → null.
 */
export function migrateAvnacDocument(raw: unknown): AvnacDocumentV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as AnyVersionDoc;
  const v = typeof doc.v === "number" ? doc.v : null;
  if (v === null) return null;

  // Unknown future version — do not attempt downgrade.
  if (v > AVNAC_DOC_VERSION) return null;

  // Already at current version — validate and return.
  if (v === AVNAC_DOC_VERSION) return validateV1(doc);

  // Older version — run through the migration chain.
  const migrated = applyMigrations(doc);
  return validateV1(migrated);
}
