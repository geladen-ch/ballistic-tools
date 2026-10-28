// Pure logic for exporting/importing (parts of) the user's Arsenal to/from
// a local JSON file — no DOM, no localStorage. arsenal-view.js supplies
// the current bullets/rifles and does the actual file I/O (a browser
// download, reading a picked <input type="file">); this module only knows
// how to shape a file's contents and how to resolve conflicts against
// what's already in the library. See user-library.js for the storage
// side (the `unsaved` flag, markUserBulletsSaved/importUserBullet etc.).
// Files hold records in their stored form (record-codec.js): an export
// writes what is stored, and an import stores what the file holds.
//
// Scopes and reticles (the user's own; built-in ones are only referred to
// by id) travel in the same file, in lists of their own. The file format's
// version is unchanged for them: a build that predates them ignores the
// two lists and imports the rest, a rifle's scope link included (an
// unknown field to it).
import { storedUserBulletOf, storedUserRifleOf, storedUserScopeOf } from './user-library.js';
import { storedUserReticleOf } from './reticle-library.js';
import { opticLabel } from './scope-record.js';

const FILE_FORMAT = 'ebalka2-arsenal';
const FILE_VERSION = 1;

// The largest file the Arsenal loads: reading one means holding its text,
// its parsed records and the copy its reticles are checked in all at once,
// which a phone's browser may not survive much beyond this.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// From this share of MAX_FILE_BYTES on, the Arsenal warns that it is
// getting too large to be saved as one file it can load again.
export const NEAR_FILE_LIMIT = 0.75;

const utf8 = new TextEncoder();
const byteLength = (text) => utf8.encode(text).length;

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
export function buildExportPayload({ bullets = [], rifles = [], scopes = [], reticles = [] }) {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    bullets: bullets.map((b) => stripLocalOnlyFields(storedUserBulletOf(b))),
    rifles: rifles.map((r) => stripLocalOnlyFields(storedUserRifleOf(r))),
    scopes: scopes.map((s) => stripLocalOnlyFields(storedUserScopeOf(s))),
    reticles: reticles.map((r) => stripLocalOnlyFields(storedUserReticleOf(r)))
  };
}

// How large the whole Arsenal is as one export file, and how much of that
// each reticle takes (its record in the file) — imported drawings are what
// makes an Arsenal large.
export function exportSizes({ bullets = [], rifles = [], scopes = [], reticles = [] }) {
  const total = byteLength(serializeExport(buildExportPayload({ bullets, rifles, scopes, reticles })));
  const byReticle = new Map(reticles.map((r) => [r.id, byteLength(JSON.stringify(stripLocalOnlyFields(storedUserReticleOf(r))))]));
  let reticleBytes = 0;
  for (const bytes of byReticle.values()) reticleBytes += bytes;
  return { total, reticles: reticleBytes, byReticle };
}

// What goes along with rifles, scopes and reticles chosen for one file: a
// rifle's own scope (when it is one of the user's — a built-in one is
// referred to by id), and every one of the user's reticles those scopes
// list. `userScopes`/`userReticles`: the user's whole lists.
export function exportBundle({ rifles = [], scopes = [], reticles = [], userScopes, userReticles }) {
  const scopeIds = new Set(scopes.map((s) => s.id));
  for (const rifle of rifles) if (rifle.scopeId) scopeIds.add(rifle.scopeId);
  const bundledScopes = userScopes.filter((s) => scopeIds.has(s.id));
  const reticleIds = new Set(reticles.map((r) => r.id));
  for (const scope of bundledScopes) for (const id of scope.reticleIds) reticleIds.add(id);
  return { scopes: bundledScopes, reticles: userReticles.filter((r) => reticleIds.has(r.id)) };
}

// Unindented: an Arsenal with imported reticle drawings runs to megabytes,
// and indentation alone would double it.
export function serializeExport(payload) {
  return JSON.stringify(payload);
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
  const optionalList = (v) => v === undefined || Array.isArray(v);
  const looksRight = payload && typeof payload === 'object'
    && payload.format === FILE_FORMAT
    && Array.isArray(payload.bullets) && Array.isArray(payload.rifles)
    && optionalList(payload.scopes) && optionalList(payload.reticles);
  if (!looksRight) {
    throw Object.assign(new Error('not a recognized Arsenal export'), { code: 'invalid-format' });
  }
  // A file from a newer build may hold fields this build can't read
  // correctly, so it is refused outright rather than half-imported. A file
  // with no version at all (hand-edited, or from before the field existed)
  // is read as the oldest format.
  if (typeof payload.version === 'number' && payload.version > FILE_VERSION) {
    throw Object.assign(new Error(`export format version ${payload.version} is newer than this build supports`), { code: 'unsupported-version' });
  }
  return { bullets: payload.bullets, rifles: payload.rifles, scopes: payload.scopes || [], reticles: payload.reticles || [] };
}

// Whether a file's text is a reticle file of 4.3.x (file-codec.js) rather
// than an Arsenal export — read with legacy-file.js, not imported as is.
export function isLegacyReticleFile(text) {
  try {
    const payload = JSON.parse(text);
    return Boolean(payload) && payload.format === 'ebalka2-reticle';
  } catch {
    return false;
  }
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
// across cycles — falling back to case/whitespace-insensitive name
// matching only when the
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

// The renamed copy of an imported item: a new name — or, for a scope or a
// reticle, whose name is its manufacturer and model, a new model.
function renamedCopy(item, nameTaken) {
  if (typeof item.model !== 'string') return { ...item, name: generateCopyName(item.name, nameTaken) };
  const model = generateCopyName(item.model, (candidate) => nameTaken(opticLabel({ manufacturer: item.manufacturer, model: candidate })));
  return { ...item, model, name: opticLabel({ manufacturer: item.manufacturer, model }) };
}

// Resolves what to actually write for one imported item under the chosen
// conflict mode. A genuinely new item (no match by id or name) keeps its
// own id verbatim rather than minting a fresh one — required so a repeated
// automatic merge recognizes it as the same
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
    return { action: 'save', record: { ...renamedCopy(item, nameTaken), id: generateId() } };
  }
  throw new Error(`unknown import mode: ${mode}`);
}

// Orchestrates importing a whole selected batch, each kind resolved
// before the kinds that refer to it, building a map from the file's own
// ids to whatever id each one actually lands under locally (reused via
// overwrite, or freshly minted): reticles, then scopes (their reticleIds
// remapped), then bullets, then rifles (their cartridges' bulletId, and
// their scopeId and reticleId, remapped) — so a renamed/re-idned record
// doesn't leave anything pointing at an id that no longer resolves. A
// reference to something not part of *this* import batch (deselected, or
// an older/hand-built file never bundled it, or a built-in scope or
// reticle) is left as it is: harmless if that id already exists locally
// (or is built in), a dangling (but not crashing) reference otherwise.
export function planImportBatch({
  bullets = [], rifles = [], scopes = [], reticles = [], mode,
  existingBullets = [], existingRifles = [], existingScopes = [], existingReticles = [],
  generateBulletId, generateRifleId, generateScopeId, generateReticleId
}) {
  function resolveAll(items, existingList, generateId, remap = (item) => item) {
    const claimed = new Set(existingList.map((e) => normalizedName(e.name)));
    const idMap = new Map(); // file id -> resolved local id
    const results = [];
    for (const item of items) {
      const resolved = resolveImportItem(remap(item), {
        existingList, mode, generateId, nameTaken: (name) => claimed.has(normalizedName(name))
      });
      if (resolved.action === 'save') {
        claimed.add(normalizedName(resolved.record.name));
        idMap.set(item.id, resolved.record.id);
      }
      results.push({ item, resolved });
    }
    return { results, idMap };
  }
  const via = (map) => (id) => (id ? map.get(id) || id : id);

  const reticlePlan = resolveAll(reticles, existingReticles, generateReticleId);
  const reticleId = via(reticlePlan.idMap);
  const scopePlan = resolveAll(scopes, existingScopes, generateScopeId,
    (item) => ({ ...item, reticleIds: (item.reticleIds || []).map(reticleId) }));
  const scopeId = via(scopePlan.idMap);
  const bulletPlan = resolveAll(bullets, existingBullets, generateBulletId);
  const bulletId = via(bulletPlan.idMap);
  const riflePlan = resolveAll(rifles, existingRifles, generateRifleId, (item) => {
    const remapped = { ...item, cartridges: item.cartridges.map((c) => ({ ...c, bulletId: bulletId(c.bulletId) })) };
    if ('scopeId' in item) remapped.scopeId = scopeId(item.scopeId);
    if ('reticleId' in item) remapped.reticleId = reticleId(item.reticleId);
    return remapped;
  });

  return {
    bulletResults: bulletPlan.results,
    rifleResults: riflePlan.results,
    scopeResults: scopePlan.results,
    reticleResults: reticlePlan.results
  };
}
