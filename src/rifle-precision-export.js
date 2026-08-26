// Pure logic for exporting/importing (parts of) the user's Rifle Precision
// Calculator project library to/from a local JSON file — same shape as
// location-export.js/arsenal-export.js, duplicated rather than shared (see
// location-library.js's own comment for why) since the three features are
// otherwise unrelated. Simpler than arsenal-export.js in one respect: a
// target (and its groups/shots) has no reference outside its own project,
// so there's no cross-list id-remapping/planImportBatch step — each
// project imports as one self-contained unit.

const FILE_FORMAT = 'ebalka2-rifle-precision';
const FILE_VERSION = 1;

function normalizedName(name) {
  return name.trim().toLowerCase();
}

// Strips the local-only `unsaved` flag — see arsenal-export.js's own
// stripLocalOnlyFields for why.
function stripLocalOnlyFields(project) {
  const { unsaved, ...rest } = project;
  return rest;
}

export function buildExportPayload({ projects }) {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    projects: projects.map(stripLocalOnlyFields)
  };
}

export function serializeExport(payload) {
  return JSON.stringify(payload, null, 2);
}

export function parseImportPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('not valid JSON'), { code: 'invalid-json' });
  }
  const looksRight = payload && typeof payload === 'object'
    && payload.format === FILE_FORMAT
    && Array.isArray(payload.projects);
  if (!looksRight) {
    throw Object.assign(new Error('not a recognized Rifle Precision export'), { code: 'invalid-format' });
  }
  return { projects: payload.projects };
}

// 'newer'/'older'/'same'/'unknown' — identical rules to
// arsenal-export.js's own compareModifiedAt.
export function compareModifiedAt(importedAt, existingAt) {
  const a = importedAt ? Date.parse(importedAt) : NaN;
  const b = existingAt ? Date.parse(existingAt) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'unknown';
  if (a > b) return 'newer';
  if (a < b) return 'older';
  return 'same';
}

// Classifies one imported project against the current library, for the
// import dialog's conflict list — matched by name, same
// case/whitespace-insensitive convention as rifle-precision-library.js's
// own findRiflePrecisionProjectByName.
export function classifyImportItem(item, existingList) {
  const existing = existingList.find((e) => normalizedName(e.name) === normalizedName(item.name));
  if (!existing) return { conflict: false };
  return { conflict: true, existing, comparison: compareModifiedAt(item.modifiedAt, existing.modifiedAt) };
}

export const IMPORT_MODES = ['overwrite', 'overwriteIfNewer', 'rename'];

// Same "<name> - copy (1)", "(2)", ... scheme as arsenal-export.js's own
// generateCopyName.
export function generateCopyName(baseName, nameTaken) {
  let n = 1;
  let candidate;
  do {
    candidate = `${baseName} - copy (${n})`;
    n++;
  } while (nameTaken(candidate));
  return candidate;
}

// Resolves what to actually write for one imported project under the
// chosen conflict mode — same rules as arsenal-export.js's own
// resolveImportItem, just for one list instead of two. `...item` already
// carries the project's own createdAt through untouched in every branch —
// no special-casing needed for the field Locations/Arsenal don't have.
export function resolveImportItem(item, { existingList, mode, generateId, nameTaken }) {
  const existing = existingList.find((e) => normalizedName(e.name) === normalizedName(item.name));

  if (!existing) {
    return { action: 'save', record: { ...item, id: generateId() } };
  }
  if (mode === 'overwrite') {
    return { action: 'save', record: { ...item, id: existing.id } };
  }
  if (mode === 'overwriteIfNewer') {
    if (compareModifiedAt(item.modifiedAt, existing.modifiedAt) === 'newer') {
      return { action: 'save', record: { ...item, id: existing.id } };
    }
    return { action: 'skip', reason: 'not-newer' };
  }
  if (mode === 'rename') {
    const name = generateCopyName(item.name, nameTaken);
    return { action: 'save', record: { ...item, id: generateId(), name } };
  }
  throw new Error(`unknown import mode: ${mode}`);
}
