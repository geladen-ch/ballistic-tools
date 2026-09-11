import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { loadBulletCatalog, loadBullet, loadBulletLibraries, bulletLibraryForBullet, loadCaliberDesignations, designationFor, matchCaliberDesignation } = await import('../src/bullets.js');

test('loadBulletCatalog resolves a plain list of bullet ids — no duplicated name/manufacturer/etc.', () => {
  const catalog = loadBulletCatalog();
  assert.ok(Array.isArray(catalog));
  assert.deepEqual([...catalog].sort(), [
    'bpb-17-fbvarmint-25',
    'bpb-20-btvarmint-40',
    'bpb-20-fbvarmint-35',
    'bpb-223-bttarget-69',
    'bpb-223-bttarget-73',
    'bpb-223-fbtarget-52',
    'bpb-223-fbtarget-55',
    'bpb-223-fbvarmint-40',
    'bpb-223-fbvarmint-52',
    'bpb-223-fbvarmint-55',
    'bpb-223-fbvarmint-60',
    'bpb-223-fullboretarget-81',
    'bpb-223-longrangehybridtarget-86',
    'bpb-223-otmtactical-77',
    'bpb-223-verylowdragvldtarget-70',
    'bpb-223-verylowdragvldtarget-75',
    'bpb-223-verylowdragvldtarget-80',
    'bpb-223-verylowdragvldtarget-90',
    'bpb-25-elitehunter-133',
    'bpb-25-longrangehybridtarget-135',
    'bpb-25-verylowdragvldhunting-115',
    'bpb-270-classichunter-130',
    'bpb-270-classichunter-140',
    'bpb-270-elitehunter-170',
    'bpb-270-hybridtarget-150',
    'bpb-270-verylowdragvldhunting-130',
    'bpb-270-verylowdragvldhunting-140',
    'bpb-270-verylowdragvldhunting-150',
    'bpb-30-classichunter-168',
    'bpb-30-classichunter-185',
    'bpb-30-elitehunter-180',
    'bpb-30-elitehunter-205',
    'bpb-30-elitehunter-217',
    'bpb-30-elitehunter-245',
    'bpb-30-fbtarget-115',
    'bpb-30-fbtarget-150',
    'bpb-30-fullboretarget-156',
    'bpb-30-hybridotmtactical-230',
    'bpb-30-hybridtarget-155',
    'bpb-30-hybridtarget-168',
    'bpb-30-hybridtarget-185',
    'bpb-30-hybridtarget-200-1',
    'bpb-30-hybridtarget-200-2',
    'bpb-30-hybridtarget-215',
    'bpb-30-hybridtarget-230',
    'bpb-30-juggernautotmtactical-185',
    'bpb-30-juggernauttarget-185',
    'bpb-30-longrangebttarget-175',
    'bpb-30-longrangehybridtarget-208',
    'bpb-30-longrangehybridtarget-220',
    'bpb-30-longrangehybridtarget-245',
    'bpb-30-otmtactical-175',
    'bpb-30-verylowdragvldhunting-155',
    'bpb-30-verylowdragvldhunting-168',
    'bpb-30-verylowdragvldhunting-175',
    'bpb-30-verylowdragvldhunting-185',
    'bpb-30-verylowdragvldhunting-190',
    'bpb-30-verylowdragvldhunting-210',
    'bpb-30-verylowdragvldtarget-168',
    'bpb-30-verylowdragvldtarget-185',
    'bpb-30-verylowdragvldtarget-210',
    'bpb-338-elitehunter-250',
    'bpb-338-elitehunter-300',
    'bpb-338-hybridotmtactical-250',
    'bpb-338-hybridotmtactical-300',
    'bpb-375-elrmatchsolidbullets-379',
    'bpb-375-elrmatchsolidbullets-407',
    'bpb-375-hybridtarget-410',
    'bpb-6-brcolumntarget-64',
    'bpb-6-bttarget-105',
    'bpb-6-bttarget-108',
    'bpb-6-bttarget-65',
    'bpb-6-bttarget-90',
    'bpb-6-classichunter-95',
    'bpb-6-elitehunter-108',
    'bpb-6-fbtarget-68',
    'bpb-6-fbvarmint-80',
    'bpb-6-highbcfbvarmint-88',
    'bpb-6-hybridtarget-105',
    'bpb-6-longrangehybridtarget-109',
    'bpb-6-longrangehybridtarget-120',
    'bpb-6-verylowdragvldhunting-105',
    'bpb-6-verylowdragvldhunting-115',
    'bpb-6-verylowdragvldhunting-87',
    'bpb-6-verylowdragvldhunting-95',
    'bpb-6-verylowdragvldtarget-105',
    'bpb-6-verylowdragvldtarget-115',
    'bpb-6-verylowdragvldtarget-95',
    'bpb-65-arhybridotmtactical-130',
    'bpb-65-bttarget-120',
    'bpb-65-classichunter-135',
    'bpb-65-elitehunter-140',
    'bpb-65-elitehunter-156',
    'bpb-65-hybridtarget-140',
    'bpb-65-longrangebttarget-140',
    'bpb-65-longrangehybridtarget-144',
    'bpb-65-longrangehybridtarget-154',
    'bpb-65-verylowdragvldhunting-130',
    'bpb-65-verylowdragvldhunting-140',
    'bpb-65-verylowdragvldtarget-130',
    'bpb-65-verylowdragvldtarget-140',
    'bpb-7-classichunter-150',
    'bpb-7-classichunter-168',
    'bpb-7-elitehunter-175',
    'bpb-7-elitehunter-195',
    'bpb-7-fopenhybridtarget-184',
    'bpb-7-hybridtarget-180',
    'bpb-7-longrangehybridtarget-190',
    'bpb-7-verylowdragvldhunting-140',
    'bpb-7-verylowdragvldhunting-168',
    'bpb-7-verylowdragvldhunting-180',
    'bpb-7-verylowdragvldtarget-168',
    'bpb-7-verylowdragvldtarget-180',
    'hrb-223-fullboretarget-81',
    'hrb-223-lrhybridtarget-86',
    'hrb-223-vldt-90',
    'hrb-223-vldtarget-80',
    'hrb-25-elitehunter-133',
    'hrb-25-lrhybridtarget-135',
    'hrb-277-elitehunter-170',
    'hrb-277-vldh-140',
    'hrb-30-classichunter-168',
    'hrb-30-elitehunter-180',
    'hrb-30-hybridtarget-185',
    'hrb-30-hybridtarget-200',
    'hrb-30-juggernauttarget-185',
    'hrb-30-lrhybridtarget-220',
    'hrb-30-lrhybridtarget-245',
    'hrb-30-otmtactical-175',
    'hrb-30-targethybrid-215',
    'hrb-30-targethybrid-230',
    'hrb-30-vldh-168',
    'hrb-30-vldh-175',
    'hrb-30-vldh-185',
    'hrb-30-vldh-210',
    'hrb-30-vldtarget-168',
    'hrb-338-hybridtac-300',
    'hrb-6-boattailtarget-90',
    'hrb-6-btt-105',
    'hrb-6-bttarget-108',
    'hrb-6-classichunter-95',
    'hrb-6-elitehunter-108',
    'hrb-6-targethybrid-105',
    'hrb-6-targethybridmrt-109',
    'hrb-6-vldh-95',
    'hrb-6-vldt-105',
    'hrb-6-vldtarget-115',
    'hrb-6-vldtarget-95',
    'hrb-65-arhybridotm-130',
    'hrb-65-classichunter-135',
    'hrb-65-elitehunter-140',
    'hrb-65-eolelitehunter-156',
    'hrb-65-lrhybridtarget-144',
    'hrb-65-lrhybridtarget-154',
    'hrb-65-targethybrid-140',
    'hrb-65-vldtarget-130',
    'hrb-7-elitehunter-195',
    'hrb-7-hybridtarget-180',
    'hrb-7-hybridtarget-184',
    'hrb-7-lrhybridtarget-190',
    'hrb-7-vldh-140',
    'hrb-7-vldh-180',
    'hrb-7-vldhunting-168',
    'hrb-7-vldt-180',
    'hrl-30-scenar-167',
    'hrl-30-scenar-185',
    'hrl-30-scenarl-175',
    'hrl-30-scenarl-220',
    'hrl-338-lockbase-250',
    'hrl-338-scenar-300',
    'hrl-65-scenar-139',
    'hrl-65-scenarl-136',
    'hrr-223-aeromatch-69',
    'hrr-223-aeromatch-77',
    'hrr-223-atip-76',
    'hrr-223-atip-90',
    'hrr-223-bthp-75',
    'hrr-223-cx-65',
    'hrr-223-cx-70',
    'hrr-223-cxtappatrol-53',
    'hrr-223-eldm-73',
    'hrr-223-eldm-75',
    'hrr-223-eldm-80',
    'hrr-223-eldm-88',
    'hrr-223-eldvt-62',
    'hrr-223-eldvt-69',
    'hrr-223-eldx-80',
    'hrr-223-t2-75',
    'hrr-25-atip-138',
    'hrr-25-cx-112',
    'hrr-25-cx-90',
    'hrr-25-eldm-134',
    'hrr-25-eldvt-95',
    'hrr-25-eldx-110',
    'hrr-25-eldx-128',
    'hrr-270-cx-100',
    'hrr-270-cx-130',
    'hrr-270-eldx-145',
    'hrr-30-aeromatch-168',
    'hrr-30-aeromatch-175',
    'hrr-30-atip-176',
    'hrr-30-atip-177',
    'hrr-30-atip-230',
    'hrr-30-atip-250',
    'hrr-30-bthp-168',
    'hrr-30-bthp-178',
    'hrr-30-bthp-195',
    'hrr-30-bthp-208',
    'hrr-30-bthp-220',
    'hrr-30-bthp-225',
    'hrr-30-cx-110',
    'hrr-30-cx-125',
    'hrr-30-cx-150',
    'hrr-30-cx-165',
    'hrr-30-cx-180',
    'hrr-30-cx-190',
    'hrr-30-eldm-155',
    'hrr-30-eldm-168',
    'hrr-30-eldm-178',
    'hrr-30-eldm-195',
    'hrr-30-eldm-208',
    'hrr-30-eldm-225',
    'hrr-30-eldvt-174',
    'hrr-30-eldx-178',
    'hrr-30-eldx-200',
    'hrr-30-eldx-212',
    'hrr-30-eldx-220',
    'hrr-30-subx-190',
    'hrr-30-subx-225',
    'hrr-338-atip-300',
    'hrr-338-bthp-250',
    'hrr-338-bthp-285',
    'hrr-338-cx-185',
    'hrr-338-cx-225',
    'hrr-338-cx-240',
    'hrr-338-eldm-285',
    'hrr-338-eldx-230',
    'hrr-338-eldx-270',
    'hrr-338-subx-307',
    'hrr-375-atip-390',
    'hrr-375-cx-250',
    'hrr-416-atip-500',
    'hrr-50-amax-750',
    'hrr-50-boredrivereldx-340',
    'hrr-6-aeromatch-105',
    'hrr-6-atip-110',
    'hrr-6-atip-120',
    'hrr-6-bthp-105',
    'hrr-6-cx-80',
    'hrr-6-cx-90',
    'hrr-6-dod-106',
    'hrr-6-eldm-108',
    'hrr-6-eldm-109',
    'hrr-6-eldvt-80',
    'hrr-6-eldx-103',
    'hrr-6-eldx-90',
    'hrr-6-tap-106',
    'hrr-65-aeromatch-140',
    'hrr-65-atip-135',
    'hrr-65-atip-153',
    'hrr-65-bthp-140',
    'hrr-65-cx-120',
    'hrr-65-cx-130',
    'hrr-65-cx-90',
    'hrr-65-eldm-100',
    'hrr-65-eldm-120',
    'hrr-65-eldm-123',
    'hrr-65-eldm-130',
    'hrr-65-eldm-140',
    'hrr-65-eldm-147',
    'hrr-65-eldvt-100',
    'hrr-65-eldx-143',
    'hrr-7-atip-166',
    'hrr-7-atip-190',
    'hrr-7-bthp-162',
    'hrr-7-cx-139',
    'hrr-7-cx-150',
    'hrr-7-cx-160',
    'hrr-7-eldm-162',
    'hrr-7-eldm-180',
    'hrr-7-eldx-150',
    'hrr-7-eldx-162',
    'hrr-7-eldx-175',
    'hrs-223-smk-77',
    'hrs-223-smk-90',
    'hrs-223-smk-95',
    'hrs-30-smk-168',
    'hrs-30-smk-175',
    'hrs-30-smk-190',
    'hrs-30-smk-210',
    'hrs-30-smk-220',
    'hrs-30-smkhpbtcn-169',
    'hrs-30-smkhpbtcn-177',
    'hrs-338-smk-300',
    'hrs-338-smk-325',
    'hrs-6-smk-107',
    'hrs-6-smk-110',
    'hrs-65-smk-140',
    'hrs-65-smk-142',
    'hrs-65-smk-150',
    'hrs-7-smk-175',
    'hrs-7-smk-183',
    'lapua-224-scenarl-69',
    'lapua-22lr',
    'lapua-30-scenar-167',
    'lapua-30-scenarl-155',
    'lapua-338-scenar-250',
    'lapua-338-scenar-300',
    'lapua-65-scenar-139',
    'lapua-65-scenarl-136',
    'lcd-224-e539-55',
    'lcd-224-s538-55',
    'lcd-224-scenar-69-gb501',
    'lcd-224-scenar-69-gb541',
    'lcd-224-scenar-77',
    'lcd-224-scenarl-77',
    'lcd-243-hp-77',
    'lcd-243-scenar-105',
    'lcd-243-scenar-90',
    'lcd-243-scenarl-105',
    'lcd-243-scenarl-90',
    'lcd-30-ap-165',
    'lcd-30-fmj-123',
    'lcd-30-fmjbt-185',
    'lcd-30-fmjbt-200',
    'lcd-30-lockbase-150',
    'lcd-30-lockbase-170',
    'lcd-30-naturalis-170-n518',
    'lcd-30-naturalis-170-n558',
    'lcd-30-naturalis-180',
    'lcd-30-scenar-154',
    'lcd-30-scenar-185',
    'lcd-30-scenarl-175',
    'lcd-30-scenarl-220',
    'lcd-30-subsonic-200',
    'lcd-303-fmj-123',
    'lcd-338-ap-248',
    'lcd-338-ap-300',
    'lcd-338-api-253',
    'lcd-338-lockbase-250',
    'lcd-338-lockbase-300',
    'lcd-338-naturalis-231',
    'lcd-366-naturalis-221',
    'lcd-366-naturalis-250',
    'lcd-65-naturalis-140',
    'lcd-65-scenar-100',
    'lcd-65-scenar-108',
    'lcd-65-scenar-123',
    'lcd-65-scenarl-120',
    'lcd-7mm-scenarl-150',
    'lcd-7mm-scenarl-180',
    'nato-m193',
    'nato-m80',
    'nato-m855',
    'ruag-338-swissp-ball-252',
    'ruag-338-swissp-target-250',
    'russian-545x39-7n10',
    'russian-545x39-7n6',
    'russian-762x39-m43',
    'russian-762x54r-7n1',
    'swiss-gp11',
    'swiss-gp90',
    'swp-223-ap-63',
    'swp-223-ball-63',
    'swp-223-ballsx-55',
    'swp-223-bondedstyx-55',
    'swp-223-styxaction-69',
    'swp-223-target-69',
    'swp-308-ap-196',
    'swp-308-ball-176',
    'swp-308-styxaction-167',
    'swp-308-tactical-163',
    'swp-308-target-168',
    'swp-308-target-175',
    'swp-338-ap-260',
    'swp-338-api-263',
    'swp-338-ball-251',
    'swp-338-styxaction-247',
    'swp-338-tactical-250',
    'swp-338-target-250',
    'swp-338-target-300',
    'swp-375-ball-350',
    'swp-50-hcsx-733',
    'swp-50-trainingsx-644',
    'swp-65cm-targetsx-130'
  ]);
  for (const entry of catalog) assert.equal(typeof entry, 'string');
});

test('loadBulletCatalog returns the same array instance across repeated calls (it\'s an imported module binding, not a fetch)', () => {
  const first = loadBulletCatalog();
  const second = loadBulletCatalog();
  assert.equal(first, second);
});

test('loadBulletLibraries returns every known built-in library with its own id/prefix', () => {
  const libraries = loadBulletLibraries();
  assert.deepEqual(libraries.map((lib) => lib.id).sort(), ['berger-published', 'berger-reverse', 'geladen', 'hornady-reverse', 'lapua-cd', 'lapua-reverse', 'sierra-reverse', 'swiss-p']);
  const geladen = libraries.find((lib) => lib.id === 'geladen');
  assert.equal(geladen.prefix, 'Gldn');
  const lapuaCd = libraries.find((lib) => lib.id === 'lapua-cd');
  assert.equal(lapuaCd.prefix, 'LCd');
  const hornadyReverse = libraries.find((lib) => lib.id === 'hornady-reverse');
  assert.equal(hornadyReverse.prefix, 'Hrr');
  const swissP = libraries.find((lib) => lib.id === 'swiss-p');
  assert.equal(swissP.prefix, 'SwP');
  const bergerReverse = libraries.find((lib) => lib.id === 'berger-reverse');
  assert.equal(bergerReverse.prefix, 'HrB');
  const sierraReverse = libraries.find((lib) => lib.id === 'sierra-reverse');
  assert.equal(sierraReverse.prefix, 'HrS');
  const bergerPublished = libraries.find((lib) => lib.id === 'berger-published');
  assert.equal(bergerPublished.prefix, 'BpB');
  const lapuaReverse = libraries.find((lib) => lib.id === 'lapua-reverse');
  assert.equal(lapuaReverse.prefix, 'HrL');
});

test('no built-in bullet id is claimed by more than one library', () => {
  const seen = new Set();
  for (const lib of loadBulletLibraries()) {
    for (const id of lib.ids) {
      assert.ok(!seen.has(id), `"${id}" is claimed by more than one library`);
      seen.add(id);
    }
  }
});

test('bulletLibraryForBullet resolves a bullet id to its owning library, or null for an unknown/non-built-in id', () => {
  assert.equal(bulletLibraryForBullet('lapua-30-scenar-167').id, 'lapua-cd');
  assert.equal(bulletLibraryForBullet('hrr-30-eldm-208').id, 'hornady-reverse');
  assert.equal(bulletLibraryForBullet('not-a-real-bullet-id'), null);
});

test('loadBulletCatalog is synchronous — no network round-trip for the catalog itself', () => {
  const result = loadBulletCatalog();
  assert.ok(Array.isArray(result), 'should be the array itself, not a Promise of one');
});

test('loadBullet resolves a BC-profile bullet with SI-unit fields and no redundant caliber label', async () => {
  const bullet = await loadBullet('swiss-gp11');
  assert.equal(bullet.name, '174gr GP11');
  assert.equal(bullet.manufacturer, 'Military');
  assert.equal('caliber' in bullet, false, 'colloquial caliber label should come from the designations lookup, not be stored here');
  assert.equal(typeof bullet.caliberM, 'number');
  assert.equal(typeof bullet.lengthM, 'number');
  assert.equal(typeof bullet.massKg, 'number');
  assert.ok(bullet.massKg < 1, 'massKg should be a small SI value, not a raw grain count');
  assert.equal(typeof bullet.source, 'string');
  assert.equal(bullet.profile.type, 'bc');
  assert.equal(typeof bullet.profile.bc, 'number');
  assert.ok(bullet.profile.model === 'G1' || bullet.profile.model === 'G7');
});

test('loadBullet resolves a cdTable-profile bullet with a well-formed Mach/Cd table', async () => {
  const bullet = await loadBullet('hrr-30-eldm-208');
  assert.equal(bullet.profile.type, 'cdTable');
  assert.ok(Array.isArray(bullet.profile.table));
  assert.ok(bullet.profile.table.length > 10);
  for (const [mach, cd] of bullet.profile.table) {
    assert.equal(typeof mach, 'number');
    assert.equal(typeof cd, 'number');
    assert.ok(cd > 0 && cd < 2, `implausible Cd value ${cd} at Mach ${mach}`);
  }
  for (let i = 1; i < bullet.profile.table.length; i++) {
    assert.ok(bullet.profile.table[i][0] > bullet.profile.table[i - 1][0]);
  }
});

test('loadBullet rejects for an unknown id', async () => {
  await assert.rejects(() => loadBullet('does-not-exist'));
});

test('loadCaliberDesignations resolves the diameter -> colloquial name lookup table', async () => {
  const designations = await loadCaliberDesignations();
  assert.ok(Array.isArray(designations));
  assert.ok(designations.some((d) => d.designation === '7.62 / .308 / .30'));
  assert.ok(designations.some((d) => d.designation === '6.5 / .264'));
});

test('designationFor matches an exact (or near-exact) diameter', async () => {
  const designations = await loadCaliberDesignations();
  assert.equal(designationFor(0.0078232, designations), '7.62 / .308 / .30');
  // .264in bullets are marketed as "6.5 / .264" even though 0.0067056m is
  // actually 6.7056mm — this is exactly the mismatch the lookup exists for.
  assert.equal(designationFor(0.0067056, designations), '6.5 / .264');
});

test('designationFor falls back to a raw-mm label for an uncatalogued diameter', async () => {
  const designations = await loadCaliberDesignations();
  // 6.40mm sits in the gap between "6 / .243" (0.00617) and "6.5 / .264"
  // (0.00671) — well outside DESIGNATION_TOLERANCE_M (3e-5) of either, so
  // it's genuinely uncatalogued, unlike 0.009 (the old test value), which
  // the table now has an entry within tolerance of ("9 Luger", 0.00901).
  assert.equal(designationFor(0.0064, designations), '6.40mm');
});

// matchCaliberDesignation is designationFor()'s own building block, used
// directly by ui/arsenal/caliber-field.js — unlike designationFor() it
// must distinguish "matched a real designation" from "nothing close
// enough" (a raw-mm label isn't a valid <select> value there), so it
// returns the entry object itself, or null, rather than always a string.
test('matchCaliberDesignation returns the matched entry object within tolerance, or null when nothing is close enough', async () => {
  const designations = await loadCaliberDesignations();
  const match = matchCaliberDesignation(0.0078232, designations);
  assert.equal(match.designation, '7.62 / .308 / .30');
  assert.equal(match.caliberM, 0.00782);

  assert.equal(matchCaliberDesignation(0.0064, designations), null);
});

// Regression coverage for the data/bullets.info import: every catalog
// entry must resolve to a well-formed record, and the manufacturer
// inferred from the source filename/name (Hornady, Lapua, RUAG) or
// "Military" for everything else must actually match what's stored.
test('every catalog bullet resolves to a well-formed record', async () => {
  const catalog = loadBulletCatalog();
  assert.ok(catalog.length >= 23, `expected at least 23 bullets, got ${catalog.length}`);

  for (const id of catalog) {
    const bullet = await loadBullet(id);
    assert.equal(bullet.id, id, `id mismatch for ${id}`);
    assert.equal(typeof bullet.name, 'string');
    assert.ok(bullet.name.length > 0, `${id} has an empty name`);
    assert.equal(typeof bullet.manufacturer, 'string');
    assert.equal(typeof bullet.caliberM, 'number');
    assert.ok(bullet.caliberM > 0 && bullet.caliberM < 0.02, `implausible caliberM for ${id}: ${bullet.caliberM}`);
    // Optional, like every other bullet record (see bullet-form.js's own
    // readValues()) — every built-in bullet happened to carry one until
    // the Swiss P library, whose own source PDFs never state a bullet
    // length, so this only checks the type when present rather than
    // requiring it.
    if (bullet.lengthM != null) assert.equal(typeof bullet.lengthM, 'number');
    assert.equal(typeof bullet.massKg, 'number');
    assert.ok(bullet.massKg > 0 && bullet.massKg < 1, `implausible massKg for ${id}: ${bullet.massKg}`);
    assert.equal(typeof bullet.source, 'string');

    if (bullet.profile.type === 'bc') {
      assert.equal(typeof bullet.profile.bc, 'number');
      assert.ok(bullet.profile.model === 'G1' || bullet.profile.model === 'G7', `unexpected drag model for ${id}`);
    } else {
      assert.equal(bullet.profile.type, 'cdTable');
      assert.ok(Array.isArray(bullet.profile.table) && bullet.profile.table.length > 5, `${id}'s cdTable is too short`);
      for (const [mach, cd] of bullet.profile.table) {
        assert.equal(typeof mach, 'number');
        assert.ok(cd > 0 && cd < 2, `implausible Cd ${cd} at Mach ${mach} for ${id}`);
      }
      for (let i = 1; i < bullet.profile.table.length; i++) {
        assert.ok(bullet.profile.table[i][0] > bullet.profile.table[i - 1][0], `${id}'s cdTable Mach values aren't strictly ascending`);
      }
    }
  }
});

test('manufacturer is inferred from the bullet id/name (Hornady, Lapua, RUAG), "Military" otherwise', async () => {
  const catalog = loadBulletCatalog();
  assert.ok(catalog.length >= 23, `expected at least 23 bullets, got ${catalog.length}`);

  for (const id of catalog) {
    const bullet = await loadBullet(id);
    let expected = 'Military';
    if (id.startsWith('hrr-')) expected = 'Hornady';
    else if (id.startsWith('hrb-') || id.startsWith('bpb-')) expected = 'Berger';
    else if (id.startsWith('hrs-')) expected = 'Sierra';
    else if (id.startsWith('lapua-') || id.startsWith('lcd-') || id.startsWith('hrl-')) expected = 'Lapua';
    else if (id.startsWith('ruag-')) expected = 'RUAG';
    else if (id.startsWith('swp-')) expected = 'Swiss P';
    assert.equal(bullet.manufacturer, expected, `${id} should be manufacturer "${expected}"`);
  }
});
