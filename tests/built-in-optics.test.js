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

test('the built-in catalogs are plain id lists', () => {
  assert.deepEqual(scopes.loadScopeCatalog(), ['sb-pm2-3-20x50', 'sb-cm2-6-36x56', 'trijicon-acog-4x32-rco-m4', ...GENERIC_SCOPES]);
  assert.deepEqual(reticles.loadReticleCatalog(), ['sb-p4lf', 'sb-tr2id', 'trijicon-rco-m4-chevron', ...GENERIC_RETICLES]);
  assert.ok(scopes.isBuiltInScopeId('sb-pm2-3-20x50') && !scopes.isBuiltInScopeId('user-scope-x'));
  assert.ok(reticles.isBuiltInReticleId('sb-p4lf') && !reticles.isBuiltInReticleId('user-reticle-x'));
});

test('every built-in scope is valid and lists only built-in reticles that load', async () => {
  const all = await scopes.loadBuiltInScopes();
  assert.equal(all.length, 8);
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
  assert.deepEqual(pm2.reticleIds, ['sb-p4lf']);

  const cm2 = await scopes.loadScope('sb-cm2-6-36x56');
  assert.deepEqual([cm2.model, cm2.magnificationMin, cm2.magnificationMax, cm2.reticleIds[0]], ['6-36x56 CM II', 6, 36, 'sb-tr2id']);
  close(actualMagnificationMin(cm2), 6.16, 0.005);

  const acog = await scopes.loadScope('trijicon-acog-4x32-rco-m4');
  assert.deepEqual([acog.manufacturer, acog.type, acog.magnificationMin, acog.magnificationMax, acog.clickUnit], ['Trijicon', 'fixed', 4, 4, 'arcmin']);
  close(acog.clickVerticalRad, DEFAULT_CLICK_RAD.arcmin, 1e-15);
  assert.deepEqual(acog.reticleIds, ['trijicon-rco-m4-chevron']);
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
  assert.deepEqual(all.map((r) => r.name), ['Schmidt & Bender P4LF', 'Schmidt & Bender TR²ID', 'Trijicon RCO M4/M150 Chevron', 'Generic Mildot', 'Generic Milhash', 'Generic Tree (mrad)']);
  for (const r of all) {
    assert.deepEqual(validateReferenceScope(r.referenceScope), {}, r.id);
    assert.ok(r.elements.length > 0 && r.elements.every((e) => e.id), r.id);
    assert.equal(r.illumination.enabled, !r.id.startsWith('generic-'), r.id);
  }
  assert.deepEqual(all.map((r) => r.referenceScope), [
    { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 },
    { type: 'ffp', zoomMin: 6, zoomMax: 36, calibrationZoom: 36 },
    { type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 },
    { type: 'ffp', zoomMin: 3, zoomMax: 12, calibrationZoom: 12 },
    { type: 'ffp', zoomMin: 5, zoomMax: 25, calibrationZoom: 25 },
    { type: 'ffp', zoomMin: 3, zoomMax: 18, calibrationZoom: 18 }
  ]);
});
