// The registry of built-in bullet libraries. Each library is a named,
// independently-toggleable (see bullet-library-prefs.js) collection with
// its own directory of per-bullet JSON files (bullets/<id>.json) plus a
// small catalog.js listing that directory's ids — same "JS for catalog +
// JSON for individual bullets" split every single-library setup already
// used, just one level deeper. Adding a new library later is purely
// additive: a new subdirectory + catalog.js + one entry here.
//
// A real ES module (not fetched) for the same reason each per-library
// catalog.js is: the module-type service worker needs to derive every
// bullet's precache URL from this at import time, with no network round
// trip — see service-worker.js.
//
// `prefix` is the short tag shown in square brackets in every bullet
// picker (e.g. "[LCd]"); `nameKey`/`descriptionKey` point into the
// `bulletLibraries` i18n namespace (src/locales/*.json).
import { BULLET_IDS as GELADEN_IDS } from './geladen/catalog.js';
import { BULLET_IDS as LAPUA_CD_IDS } from './lapua-cd/catalog.js';
import { BULLET_IDS as HORNADY_REVERSE_IDS } from './hornady-reverse/catalog.js';

export const BULLET_LIBRARIES = [
  {
    id: 'geladen',
    ids: GELADEN_IDS,
    nameKey: 'bulletLibraries.geladen.name',
    descriptionKey: 'bulletLibraries.geladen.description',
    prefix: 'Gldn'
  },
  {
    id: 'lapua-cd',
    ids: LAPUA_CD_IDS,
    nameKey: 'bulletLibraries.lapuaCd.name',
    descriptionKey: 'bulletLibraries.lapuaCd.description',
    prefix: 'LCd'
  },
  {
    id: 'hornady-reverse',
    ids: HORNADY_REVERSE_IDS,
    nameKey: 'bulletLibraries.hornadyReverse.name',
    descriptionKey: 'bulletLibraries.hornadyReverse.description',
    prefix: 'Hrr'
  }
];
