// Pure logic for exporting/importing (parts of) the user's Arsenal to/from
// a local JSON file — no DOM, no localStorage. arsenal-view.js supplies
// the current bullets/rifles and does the actual file I/O (a browser
// download, reading a picked <input type="file">); this module only knows
// how to shape a file's contents and how to resolve conflicts against
// what's already in the library. See user-library.js for the storage
// side (the `unsaved` flag, markUserBulletsSaved/importUserBullet etc.).

const FILE_FORMAT = 'ebalka2-arsenal';
const FILE_VERSION = 1;

function normalizedName(name) {
  return name.trim().toLowerCase();
}

// The `unsaved` flag is purely local bookkeeping — stripped from the
// exported file since it would always misleadingly read `false` once
// read back (an export is, by definition, the record being saved) and
// carries no meaning on another device anyway. `id` stays in, purely as
// a stable key so multiple items in one file can be told apart before
// the user has picked what to do with any naming conflicts; a fresh
// import never reuses a file's id verbatim (see resolveImportItem below).
function stripLocalOnlyFields(entry) {
  const { unsaved, ...rest } = entry;
  return rest;
}

// Builds the plain object that gets JSON-serialized to the exported file.
export function buildExportPayload({ bullets, rifles }) {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    bullets: bullets.map(stripLocalOnlyFields),
    rifles: rifles.map(stripLocalOnlyFields)
  };
}

export function serializeExport(payload) {
  return JSON.stringify(payload, null, 2);
}

// A rifle's cartridges each reference a bulletId. Since cartridge-form.js
// now always copies a built-in bullet into the user library before a
// cartridge can point at it, every reference here should already resolve
// to a user bullet — userBulletIds (a Set of every current user bullet's
// id) is passed in so a stray/legacy reference to something that isn't
// (or no longer is) a user bullet is silently skipped rather than
// exported as a dangling id nothing can resolve.
export function collectRifleBulletIds(rifle, userBulletIds) {
  const ids = new Set();
  for (const cartridge of rifle.cartridges) {
    if (userBulletIds.has(cartridge.bulletId)) ids.add(cartridge.bulletId);
  }
  return ids;
}

// Parses and validates a candidate import file's text, throwing a
// descriptive, typed error (`.code`) rather than letting a malformed file
// produce a confusing downstream failure — the UI maps `.code` to a
// translated message.
export function parseImportPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('not valid JSON'), { code: 'invalid-json' });
  }
  const looksRight = payload && typeof payload === 'object'
    && payload.format === FILE_FORMAT
    && Array.isArray(payload.bullets) && Array.isArray(payload.rifles);
  if (!looksRight) {
    throw Object.assign(new Error('not a recognized Arsenal export'), { code: 'invalid-format' });
  }
  return { bullets: payload.bullets, rifles: payload.rifles };
}

// 'newer'/'older'/'same' when both sides have a usable timestamp,
// 'unknown' otherwise (a record saved before modifiedAt existed, or a
// hand-edited file missing/mangling it) — used both for the conflict list
// display and by resolveImportItem's 'overwriteIfNewer' mode.
export function compareModifiedAt(importedAt, existingAt) {
  const a = importedAt ? Date.parse(importedAt) : NaN;
  const b = existingAt ? Date.parse(existingAt) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'unknown';
  if (a > b) return 'newer';
  if (a < b) return 'older';
  return 'same';
}

// Matches an imported item against the current library by id first —
// required for repeated automatic merging to recognize the same record
// across cycles (see docs/plans/backup-sync.md's Prerequisite fix #2) —
// falling back to case/whitespace-insensitive name matching only when the
// item has no id or it doesn't resolve locally (covers old hand-edited
// files predating this field's use as a merge key).
function findExisting(item, existingList) {
  // Manual-import matching: id first, name as a fallback — this keeps the
  // existing single-file "overwrite this same-named item" dialog behavior
  // working (a re-imported/hand-edited file's id often won't equal the
  // local record's own id at all), while still preferring an id match when
  // one resolves (Prerequisite fix #2). Phase 4's automatic merge
  // (merge.js) is the one that matches by id only, with no name fallback —
  // that's where "two independently created same-named records never
  // conflict" (Phase 4b) actually lives, not here.
  if (item.id) {
    const byId = existingList.find((e) => e.id === item.id);
    if (byId) return byId;
  }
  return existingList.find((e) => normalizedName(e.name) === normalizedName(item.name));
}

// Classifies one imported item against the current library, for the
// import dialog's conflict list.
export function classifyImportItem(item, existingList) {
  const existing = findExisting(item, existingList);
  if (!existing) return { conflict: false };
  return { conflict: true, existing, comparison: compareModifiedAt(item.modifiedAt, existing.modifiedAt) };
}

export const IMPORT_MODES = ['overwrite', 'overwriteIfNewer', 'rename'];

// The auto-generated name for a renamed-to-avoid-conflict import — tries
// "<name> - copy (1)", "(2)", ... until nameTaken() reports one that's
// free. nameTaken must account for both the existing library *and*
// anything already claimed earlier in the same import batch (see
// planImportBatch below), so two same-named conflicting items imported
// together in 'rename' mode land on sequential, non-colliding names
// rather than both claiming "(1)".
export function generateCopyName(baseName, nameTaken) {
  let n = 1;
  let candidate;
  do {
    candidate = `${baseName} - copy (${n})`;
    n++;
  } while (nameTaken(candidate));
  return candidate;
}

// Resolves what to actually write for one imported item under the chosen
// conflict mode. A genuinely new item (no match by id or name) keeps its
// own id verbatim rather than minting a fresh one — required so a repeated
// automatic merge (docs/plans/backup-sync.md) recognizes it as the same
// record on every future cycle instead of re-inserting a duplicate; a
// fresh id is only minted as a defensive fallback if the imported id
// happens to collide with a *different* existing record's id. An
// intentional overwrite reuses the existing record's id, preserving
// referential integrity for anything already pointing at it.
export function resolveImportItem(item, { existingList, mode, generateId, nameTaken }) {
  const existing = findExisting(item, existingList);

  if (!existing) {
    const idCollides = item.id && existingList.some((e) => e.id === item.id);
    const id = idCollides || !item.id ? generateId() : item.id;
    return { action: 'save', record: { ...item, id } };
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

// Orchestrates importing a whole selected batch: every bullet first
// (building a map from the file's own bullet ids to whatever id each one
// actually lands under locally — reused via overwrite, or freshly
// minted), then every rifle, remapping its cartridges' bulletId
// references through that map first so a renamed/re-idned bullet doesn't
// leave the rifle pointing at an id that no longer resolves to anything.
// A cartridge whose bullet wasn't part of *this* import batch (the user
// deselected it, or an older/hand-built file never bundled it) is left
// pointing at its original file id verbatim — harmless if that id
// happens to already exist locally, a dangling (but not crashing)
// reference otherwise.
export function planImportBatch({
  bullets, rifles, mode, existingBullets, existingRifles, generateBulletId, generateRifleId
}) {
  const claimedBulletNames = new Set(existingBullets.map((b) => normalizedName(b.name)));
  const bulletIdMap = new Map(); // file id -> resolved local id
  const bulletResults = [];

  for (const item of bullets) {
    const resolved = resolveImportItem(item, {
      existingList: existingBullets, mode, generateId: generateBulletId,
      nameTaken: (name) => claimedBulletNames.has(normalizedName(name))
    });
    if (resolved.action === 'save') {
      claimedBulletNames.add(normalizedName(resolved.record.name));
      bulletIdMap.set(item.id, resolved.record.id);
    }
    bulletResults.push({ item, resolved });
  }

  const claimedRifleNames = new Set(existingRifles.map((r) => normalizedName(r.name)));
  const rifleResults = [];

  for (const item of rifles) {
    const remapped = {
      ...item,
      cartridges: item.cartridges.map((c) => ({ ...c, bulletId: bulletIdMap.get(c.bulletId) || c.bulletId }))
    };
    const resolved = resolveImportItem(remapped, {
      existingList: existingRifles, mode, generateId: generateRifleId,
      nameTaken: (name) => claimedRifleNames.has(normalizedName(name))
    });
    if (resolved.action === 'save') claimedRifleNames.add(normalizedName(resolved.record.name));
    rifleResults.push({ item, resolved });
  }

  return { bulletResults, rifleResults };
}
