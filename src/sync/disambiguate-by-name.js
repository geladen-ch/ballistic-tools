// Display-only disambiguation for two independently-created records that
// happen to share a name — see docs/plans/backup-sync.md Phase 4b for why
// this is deliberately never stored or propagated (the rejected
// auto-rename-on-import approach can't converge under bidirectional
// automatic sync). A pure function of "the current live list", recomputed
// on every render, so every device derives the identical labeling from the
// identical underlying ids with nothing to disagree about.
//
// The suffixes themselves are translated like any other shipped UI copy —
// they render in the Arsenal lists, the cartridge form's bullet picker,
// the Locations list and the Rifle Precision project list, which is to say
// in four of the app's main views rather than anywhere developer-facing.
import { getDeviceLabel } from './device-registry.js';
import { logSyncEvent } from './sync-log.js';
import { t } from '../i18n.js';

function normalizedName(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function shortDate(isoString) {
  const ms = Date.parse(isoString);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

// Resolves one record's disambiguation suffix once its name is known to
// collide with at least one other live record: prefer the authoring
// device's name (via modifiedBy + the device registry), falling back to a
// short authoring date (modifiedAt, or createdAt for Rifle Precision
// Projects) when modifiedBy is missing/unresolvable, and finally a
// fragment of the record's own id if two members also share that date.
function suffixFor(record, dateFallbackField) {
  const deviceLabel = record.modifiedBy && getDeviceLabel(record.modifiedBy);
  if (deviceLabel) return t('sync.disambiguation.fromDevice', { device: deviceLabel });

  const date = shortDate(record.modifiedAt) || shortDate(record[dateFallbackField]);
  if (date) return t('sync.disambiguation.addedOn', { date });

  return record.id.slice(-6);
}

// Groups `liveRecords` by normalized name and returns a Map from record id
// to display label: the plain name for a group of one, "<name> (<suffix>)"
// for every member of a group of more than one. `dateFallbackField` names
// the field to fall back to for the "added <date>" suffix when a record
// predates modifiedAt (createdAt, Rifle Precision Projects only) —
// defaults to 'createdAt' but is a no-op for record types that don't have
// one, since shortDate() on an absent field just returns null.
export function disambiguateByName(liveRecords, { dateFallbackField = 'createdAt' } = {}) {
  const groups = new Map(); // normalized name -> records[]
  for (const record of liveRecords) {
    const key = normalizedName(record.name);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }

  const labels = new Map();
  for (const group of groups.values()) {
    if (group.length === 1) {
      labels.set(group[0].id, group[0].name);
      continue;
    }
    logSyncEvent('debug', 'name collision detected:', group.length, 'records named', `"${group[0].name}"`);
    // Two members landing on the exact same suffix (same date, no
    // resolvable device on either) still need to differ — fall through to
    // the id fragment for whichever member(s) collide even after the
    // device/date suffix.
    const seenSuffixes = new Set();
    for (const record of group) {
      let suffix = suffixFor(record, dateFallbackField);
      if (seenSuffixes.has(suffix)) suffix = record.id.slice(-6);
      seenSuffixes.add(suffix);
      labels.set(record.id, `${record.name} (${suffix})`);
    }
  }
  return labels;
}
