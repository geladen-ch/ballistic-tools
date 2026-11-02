import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const scopes = await import('../src/scopes.js');
const reticles = await import('../src/reticles.js');
const { validateScopeRecord, actualMagnificationMin, DEFAULT_CLICK_RAD } = await import('../src/scope-record.js');
const { validateReferenceScope } = await import('../src/reticle/scope.js');
const { fieldOfViewWidth } = await import('../src/quantity.js');

const close = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

const GENERIC_SCOPES = ['generic-3-12x-ffp-mrad', 'generic-4-16x-ffp-mrad', 'generic-4-24x-ffp-mrad', 'generic-5-25x-ffp-mrad', 'generic-5-30x-ffp-mrad'];
const GENERIC_RETICLES = ['generic-mildot', 'generic-milhash', 'generic-tree-mrad'];
const MSR2_RETICLES = ['finnaccuracy-msr2-sb', 'finnaccuracy-msr2-sb5', 'finnaccuracy-msr2-sb-high-power'];
const FINNACCURACY_RETICLES = [...MSR2_RETICLES, 'finnaccuracy-msr'];
const HORUS_RETICLES = ['horus-tremor-3', 'horus-tremor-5'];
const MSR2_SCOPES = ['sb-pm2-3-20x50-ultra-short', 'sb-pm2-5-20x50-ultra-short', 'sb-pm2-5-25x56', 'sb-pm2-5-45x56-high-power', 'sb-pm2-3-27x56-high-power'];
const ELEMENT_SCOPES = ['element-immersive-5x30-mrad', 'element-immersive-5x30-bdc'];
const ELEMENT_RETICLES = ['element-lpr-1d-mrad', 'element-lpr-1d-bdc'];

test('the built-in catalogs are plain id lists', () => {
  assert.deepEqual(scopes.loadScopeCatalog(), ['sb-pm2-3-20x50', 'sb-cm2-6-36x56', ...MSR2_SCOPES, 'trijicon-acog-4x32-rco-m4', ...ELEMENT_SCOPES, ...GENERIC_SCOPES]);
  assert.deepEqual(reticles.loadReticleCatalog(), ['sb-p4fl', 'sb-p5fl', 'sb-tr2id', 'sb-gr2id', 'sb-m1fl', ...FINNACCURACY_RETICLES, ...HORUS_RETICLES, 'trijicon-rco-m4-chevron', ...ELEMENT_RETICLES, ...GENERIC_RETICLES]);
  assert.ok(scopes.isBuiltInScopeId('sb-pm2-3-20x50') && !scopes.isBuiltInScopeId('user-scope-x'));
  assert.ok(reticles.isBuiltInReticleId('sb-p4fl') && !reticles.isBuiltInReticleId('user-reticle-x'));
});

test('every built-in scope is valid and lists only built-in reticles that load', async () => {
  const all = await scopes.loadBuiltInScopes();
  assert.equal(all.length, 15);
  for (const scope of all) {
    assert.deepEqual(validateScopeRecord(scope), {}, scope.id);
    assert.ok(scope.reticleIds.length > 0, scope.id);
    for (const id of scope.reticleIds) {
      assert.ok(reticles.isBuiltInReticleId(id), `${scope.id} -> ${id}`);
      await reticles.loadReticle(id);
    }
  }
});

test('the built-in scopes, as specified', async () => {
  const pm2 = await scopes.loadScope('sb-pm2-3-20x50');
  assert.equal(pm2.name, 'Schmidt & Bender 3-20x50 PM II');
  assert.deepEqual([pm2.type, pm2.magnificationMin, pm2.magnificationMax, pm2.clickUnit], ['ffp', 3, 20, 'mrad']);
  close(pm2.clickHorizontalRad, DEFAULT_CLICK_RAD.mrad, 1e-15);
  close(actualMagnificationMin(pm2), 3.23, 0.005);
  assert.deepEqual(pm2.reticleIds, ['sb-p4fl', 'sb-gr2id', 'finnaccuracy-msr']);

  const cm2 = await scopes.loadScope('sb-cm2-6-36x56');
  assert.deepEqual([cm2.model, cm2.magnificationMin, cm2.magnificationMax, cm2.reticleIds[0]], ['6-36x56 CM II', 6, 36, 'sb-tr2id']);
  assert.deepEqual(cm2.reticleIds, ['sb-tr2id', 'sb-m1fl', 'sb-p5fl']);
  close(actualMagnificationMin(cm2), 6.16, 0.005);

  const acog = await scopes.loadScope('trijicon-acog-4x32-rco-m4');
  assert.deepEqual([acog.manufacturer, acog.type, acog.magnificationMin, acog.magnificationMax, acog.clickUnit], ['Trijicon', 'fixed', 4, 4, 'arcmin']);
  close(acog.clickVerticalRad, DEFAULT_CLICK_RAD.arcmin, 1e-15);
  assert.deepEqual(acog.reticleIds, ['trijicon-rco-m4-chevron']);
});

test('the S&B PM II scopes with the MSR2 reticles: FFP, 0.1 mrad, field of view and zoom as specified, an MSR2 variant, the P4FL and, where S&B offer it, the GR²ID', async () => {
  const spec = [
    ['3-20x50 PM II Ultra Short', 3, 20, 13, 2.1, ['finnaccuracy-msr2-sb', 'sb-p4fl', 'horus-tremor-3']],
    ['5-20x50 PM II Ultra Short', 5, 20, 7.8, 2.0, ['finnaccuracy-msr2-sb', 'sb-p4fl', 'finnaccuracy-msr', 'horus-tremor-3', 'horus-tremor-5']],
    ['5-25x56 PM II', 5, 25, 5.3, 1.5, ['finnaccuracy-msr2-sb5', 'sb-p4fl', 'sb-gr2id', 'finnaccuracy-msr', 'horus-tremor-3', 'sb-p5fl']],
    ['5-45x56 PM II High Power', 5, 45, 7.8, 0.9, ['finnaccuracy-msr2-sb5', 'sb-p4fl', 'sb-gr2id', 'horus-tremor-3']],
    ['3-27x56 PM II High Power', 3, 27, 13, 1.4, ['finnaccuracy-msr2-sb-high-power', 'sb-p4fl', 'sb-gr2id', 'horus-tremor-3']]
  ];
  for (const [i, [model, min, max, fovMaxM, fovMinM, reticleIds]] of spec.entries()) {
    const scope = await scopes.loadScope(MSR2_SCOPES[i]);
    assert.equal(scope.name, `Schmidt & Bender ${model}`);
    assert.deepEqual([scope.type, scope.magnificationMin, scope.magnificationMax, scope.clickUnit], ['ffp', min, max, 'mrad']);
    close(scope.clickHorizontalRad, DEFAULT_CLICK_RAD.mrad, 1e-15);
    close(scope.clickVerticalRad, DEFAULT_CLICK_RAD.mrad, 1e-15);
    close(fieldOfViewWidth(scope.fovMaxRad, scope.fovDistanceM), fovMaxM, 1e-9);
    close(fieldOfViewWidth(scope.fovMinRad, scope.fovDistanceM), fovMinM, 1e-9);
    assert.deepEqual(scope.reticleIds, reticleIds);
  }
  for (const id of FINNACCURACY_RETICLES) {
    const reticle = await reticles.loadReticle(id);
    assert.equal(reticle.manufacturer, 'FinnAccuracy', id);
    assert.deepEqual([reticle.illumination.enabled, reticle.illumination.colour], [true, 'red'], id);
  }
});

test('the Element Optics Immersive 5x30 scopes: fixed 5x, 10.2 m at 100 m, the MRAD variant in 0.1 mrad clicks and the BDC one in 1/4 MOA, each with its LPR-1D reticle', async () => {
  for (const [i, [variant, clickUnit, click]] of [['MRAD', 'mrad', DEFAULT_CLICK_RAD.mrad], ['BDC', 'arcmin', DEFAULT_CLICK_RAD.arcmin]].entries()) {
    const scope = await scopes.loadScope(ELEMENT_SCOPES[i]);
    assert.equal(scope.name, `Element Optics Immersive 5x30 ${variant}`);
    assert.deepEqual([scope.type, scope.magnificationMin, scope.magnificationMax, scope.clickUnit], ['fixed', 5, 5, clickUnit]);
    close(scope.clickHorizontalRad, click, 1e-15);
    close(scope.clickVerticalRad, click, 1e-15);
    close(fieldOfViewWidth(scope.fovMaxRad, scope.fovDistanceM), 10.2, 1e-9);
    assert.deepEqual(scope.reticleIds, [ELEMENT_RETICLES[i]]);
    const reticle = await reticles.loadReticle(ELEMENT_RETICLES[i]);
    assert.equal(reticle.name, `Element Optics LPR-1D ${variant}`);
    assert.ok(reticle.elements.some((e) => e.type === 'svg'), reticle.id);
  }
});

test('the generic scopes: FFP, 0.1 mrad, every generic reticle, the field of view from 12 m at 100 m at 3x', async () => {
  for (const [id, min, max] of [[0, 3, 12], [1, 4, 16], [2, 4, 24], [3, 5, 25], [4, 5, 30]]) {
    const scope = await scopes.loadScope(GENERIC_SCOPES[id]);
    assert.equal(scope.name, `Generic ${min}-${max}x FFP (mrad)`);
    assert.deepEqual([scope.manufacturer, scope.type, scope.magnificationMin, scope.magnificationMax, scope.clickUnit], ['Generic', 'ffp', min, max, 'mrad']);
    close(scope.clickHorizontalRad, DEFAULT_CLICK_RAD.mrad, 1e-15);
    close(scope.clickVerticalRad, DEFAULT_CLICK_RAD.mrad, 1e-15);
    assert.deepEqual(scope.reticleIds, GENERIC_RETICLES);
    close(fieldOfViewWidth(scope.fovMaxRad, scope.fovDistanceM) * min, 36, 1e-9);
    close(fieldOfViewWidth(scope.fovMinRad, 100) * max, 36, 1e-9);
    close(actualMagnificationMin(scope), min, 1e-9);
  }
});

test('the built-in reticles decode, with their reference scopes', async () => {
  const all = await reticles.loadBuiltInReticles();
  assert.deepEqual(all.map((r) => r.name), ['Schmidt & Bender P4FL', 'Schmidt & Bender P5FL', 'Schmidt & Bender TR²ID', 'Schmidt & Bender GR²ID', 'Schmidt & Bender M1FL', 'FinnAccuracy MSR2 SB', 'FinnAccuracy MSR2 SB5', 'FinnAccuracy MSR2 SB High Power', 'FinnAccuracy MSR', 'Horus Tremor 3', 'Horus Tremor 5', 'Trijicon RCO M4/M150 Chevron', 'Element Optics LPR-1D MRAD', 'Element Optics LPR-1D BDC', 'Generic Mildot', 'Generic Milhash', 'Generic Tree (mrad)']);
  for (const r of all) {
    assert.deepEqual(validateReferenceScope(r.referenceScope), {}, r.id);
    assert.ok(r.elements.length > 0 && r.elements.every((e) => e.id), r.id);
    assert.equal(r.illumination.enabled, !r.id.startsWith('generic-'), r.id);
  }
  assert.deepEqual(all.map((r) => r.referenceScope), [
    { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 },
    { type: 'ffp', zoomMin: 6, zoomMax: 36, calibrationZoom: 36 },
    { type: 'ffp', zoomMin: 6, zoomMax: 36, calibrationZoom: 36 },
    { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 },
    { type: 'ffp', zoomMin: 6, zoomMax: 36, calibrationZoom: 36 },
    { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 },
    { type: 'ffp', zoomMin: 5, zoomMax: 45, calibrationZoom: 45 },
    { type: 'ffp', zoomMin: 3, zoomMax: 27, calibrationZoom: 27 },
    { type: 'ffp', zoomMin: 5, zoomMax: 25, calibrationZoom: 25 },
    { type: 'ffp', zoomMin: 5, zoomMax: 25, calibrationZoom: 25 },
    { type: 'ffp', zoomMin: 5, zoomMax: 25, calibrationZoom: 25 },
    { type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 },
    { type: 'fixed', zoomMin: 5, zoomMax: 5, calibrationZoom: 5 },
    { type: 'fixed', zoomMin: 5, zoomMax: 5, calibrationZoom: 5 },
    { type: 'ffp', zoomMin: 3, zoomMax: 12, calibrationZoom: 12 },
    { type: 'ffp', zoomMin: 5, zoomMax: 25, calibrationZoom: 25 },
    { type: 'ffp', zoomMin: 3, zoomMax: 18, calibrationZoom: 18 }
  ]);
});
