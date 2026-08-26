import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  loadRiflePrecisionAnalysisState, saveRiflePrecisionAnalysisState, resetRiflePrecisionAnalysisStateForTests
} = await import('../src/rifle-precision-analysis-state.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_rifle_precision_analysis_state_v1';

test.beforeEach(() => {
  resetRiflePrecisionAnalysisStateForTests();
  removeCookie(COOKIE_NAME);
});

test('nothing restored on a first-ever visit', () => {
  assert.equal(loadRiflePrecisionAnalysisState(), null);
});

test('save persists and is readable back', () => {
  saveRiflePrecisionAnalysisState({ resultsUnitMode: 'mrad', showSigma: true });
  assert.deepEqual(loadRiflePrecisionAnalysisState(), { resultsUnitMode: 'mrad', showSigma: true });
});

test('each save merges into the saved state rather than replacing it outright', () => {
  saveRiflePrecisionAnalysisState({ resultsUnitMode: 'mrad' });
  saveRiflePrecisionAnalysisState({ showSigma: true });
  assert.deepEqual(loadRiflePrecisionAnalysisState(), { resultsUnitMode: 'mrad', showSigma: true });
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveRiflePrecisionAnalysisState({ includeLegendInExport: false, gridValue: 'mrad-0.1' });
  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/rifle-precision-analysis-state.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.loadRiflePrecisionAnalysisState(), { includeLegendInExport: false, gridValue: 'mrad-0.1' });
});

test('resetRiflePrecisionAnalysisStateForTests() clears the saved state in memory (not the cookie)', () => {
  saveRiflePrecisionAnalysisState({ showSigma: true });
  resetRiflePrecisionAnalysisStateForTests();
  assert.equal(loadRiflePrecisionAnalysisState(), null);
});
