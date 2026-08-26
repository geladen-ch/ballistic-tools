import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const { confidenceOMeter, computeConfidenceFacts, LEVEL_COLORS, URURA_SCORES } = await import('../src/ui/rifle-precision/confidence-o-meter.js');
const { confidenceLevel, confidenceScaleFraction } = await import('../src/engine/rifle-precision-stats.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function mount(confidenceLower, confidenceUpper) {
  const container = makeElement('main');
  const meter = confidenceOMeter();
  container.appendChild(meter.node);
  meter.update(confidenceLower, confidenceUpper);
  return container;
}

test('renders the gauge structure: bar with 5 band labels + threshold line/caption, a pointer, and an info panel', () => {
  const container = mount(0.86, 1.20); // ci=0.34, matches the reference legacy example exactly
  assert.equal(findByClass(container, 'rp-confidence-bar').length, 1);
  assert.equal(findByClass(container, 'rp-confidence-band-label').length, 5, 'Excellent/Good/Fair/Poor/Meaningless');
  assert.equal(findByClass(container, 'rp-confidence-threshold-line').length, 1);
  assert.equal(findByClass(container, 'rp-confidence-threshold-caption').length, 1);
  assert.equal(findByClass(container, 'rp-confidence-pointer').length, 1);
  assert.equal(findByClass(container, 'rp-confidence-info').length, 1);

  assert.ok(container.textContent.includes(t('riflePrecision.confidenceQualityExcellent')));
  assert.ok(container.textContent.includes(t('riflePrecision.confidenceQualityGood')));
  assert.ok(container.textContent.includes(t('riflePrecision.confidenceQualityFair')));
  assert.ok(container.textContent.includes(t('riflePrecision.confidenceQualityPoor')));
  assert.ok(container.textContent.includes(t('riflePrecision.confidenceQualityMeaningless')));
  assert.ok(container.textContent.includes(t('riflePrecision.bullshitThresholdLabel')), 'threshold caption always shown, not gated on the current level');
});

test('the reference legacy example (ci=0.34) reproduces "Above average", score "2+", pointer/level exactly', () => {
  const container = mount(0.86, 1.20);
  const level = confidenceLevel(0.86, 1.20);
  assert.equal(level, 4, 'sanity: this is level 4');
  assert.ok(container.textContent.includes('Above'));
  assert.ok(container.textContent.includes('average'));

  const rating = findByClass(container, 'rp-confidence-rating')[0];
  assert.ok(rating.textContent.includes('2+'), 'URURA score "2+" shown');

  const pointer = findByClass(container, 'rp-confidence-pointer')[0];
  const expectedFraction = confidenceScaleFraction(0.86, 1.20);
  assert.equal(pointer.style.bottom, `${expectedFraction * 100}%`);

  const info = findByClass(container, 'rp-confidence-info')[0];
  assert.equal(info.style.background, '#FFD200', 'info panel tinted with level 4\'s own color');
});

test('confidence margin shows the width plus the signed lower/upper bounds, e.g. "34% (-14%..+20%)"', () => {
  const container = mount(0.86, 1.20);
  const margin = findByClass(container, 'rp-confidence-margin')[0];
  assert.ok(margin.textContent.includes('34%'), margin.textContent);
  assert.ok(margin.textContent.includes('(-14%..+20%)'), margin.textContent);
});

test('confidence margin signs both bounds correctly when the lower bound is itself non-negative', () => {
  // confidenceLower=1.02 (+2%), confidenceUpper=1.30 (+30%) — an
  // unusual but structurally valid case (both bounds above 1). Both
  // signs must come from formatSignedPercent(), not just relying on a
  // naturally-negative lower bound to supply its own "-".
  const container = mount(1.02, 1.30);
  const margin = findByClass(container, 'rp-confidence-margin')[0];
  assert.ok(margin.textContent.includes('(+2%..+30%)'), margin.textContent);
});

test('pointer position is continuous — two different ci values inside the same discrete level still get different pointer positions', () => {
  // Both land on level 4 (0.3 < ci <= 0.35) per confidenceLevel(), but
  // are not the same ci, so a truly continuous gauge must place them at
  // two different heights, unlike the old discrete 8-row design.
  const a = mount(0.9, 1.21); // ci = 0.31
  const b = mount(0.85, 1.20); // ci = 0.35
  assert.equal(confidenceLevel(0.9, 1.21), 4);
  assert.equal(confidenceLevel(0.85, 1.20), 4);

  const pointerA = findByClass(a, 'rp-confidence-pointer')[0];
  const pointerB = findByClass(b, 'rp-confidence-pointer')[0];
  assert.notEqual(pointerA.style.bottom, pointerB.style.bottom, 'same discrete level, different continuous pointer position');
});

// Regression test for a real bug found in manual browser verification: this
// app sets i18next's returnEmptyString:false (src/i18n.js), which makes a
// genuinely-empty translation (several confidence levels' own Line2 is ''
// by design, matching legacy's single-line labels) indistinguishable from a
// *missing* key to t() — and t() then falls back to rendering the raw key
// string. `{ defaultValue: '' }` looks like the fix but silently does NOT
// work (i18next only substitutes a truthy defaultValue) — the real fix is
// tOptional() (src/i18n.js), which reads the raw resource value directly.
// Exhaustive: one confidence-bound pair per level (0..7), each checked in
// its own mount, since the redesigned gauge (unlike the old full-8-row
// list) only ever renders whichever single level is "current" at a time.
test('no raw "riflePrecision.*" key leaks for any of the 8 levels, including the ones with an empty Line2', () => {
  // One (confidenceLower, confidenceUpper) pair per level, spanning each
  // level's own ci bucket from confidenceLevel()'s thresholds.
  const boundsPerLevel = [
    [0, 0.65], // level 0, ci=0.65 > 0.5
    [0, 0.475], // level 1
    [0, 0.425], // level 2
    [0, 0.375], // level 3
    [0, 0.325], // level 4
    [0, 0.275], // level 5
    [0, 0.225], // level 6
    [0, 0.12] // level 7, ci <= 0.2
  ];
  boundsPerLevel.forEach(([lower, upper], expectedLevel) => {
    assert.equal(confidenceLevel(lower, upper), expectedLevel, `sanity: bounds pair ${expectedLevel} lands on level ${expectedLevel}`);
    const container = mount(lower, upper);
    assert.ok(!container.textContent.includes('riflePrecision.'), `level ${expectedLevel}: no raw i18n key leaked (Line2="${t(`riflePrecision.confidenceLevel${expectedLevel}Line2`)}")`);
  });
});

test('computeConfidenceFacts() is the single source of truth the widget renders from — same level/color/quality/score/margin the on-page assertions above already pin down', () => {
  const facts = computeConfidenceFacts(0.86, 1.20);
  assert.equal(facts.level, 4);
  assert.equal(facts.color, LEVEL_COLORS[4]);
  assert.equal(facts.color, '#FFD200');
  assert.equal(facts.quality, 'Above average');
  assert.equal(facts.ururaScore, URURA_SCORES[4]);
  assert.equal(facts.ururaScore, '2+');
  assert.equal(facts.marginText, '34% (-14%..+20%)');
  assert.equal(facts.fraction, confidenceScaleFraction(0.86, 1.20));
});

test('computeConfidenceFacts() falls back to just Line1 (no trailing space) when a level\'s Line2 is genuinely empty', () => {
  const facts = computeConfidenceFacts(0, 0.65); // level 0 — "Useless", empty Line2
  assert.equal(facts.level, 0);
  assert.equal(facts.quality, 'Useless');
});

test('update() rebuilds content in place — a second call replaces, not appends to, the first', () => {
  const meter = confidenceOMeter();
  const container = makeElement('main');
  container.appendChild(meter.node);
  meter.update(0, 0.65); // level 0
  meter.update(0.86, 1.20); // level 4

  assert.equal(findByClass(container, 'rp-confidence-info').length, 1, 'exactly one info panel after two updates');
  assert.equal(findByClass(container, 'rp-confidence-pointer').length, 1, 'exactly one pointer after two updates');
});
