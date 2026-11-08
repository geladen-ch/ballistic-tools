import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { initI18n, t, SUPPORTED_LANGUAGES } = await import('../src/i18n.js');
await initI18n();
const { mradToRad, degToRad } = await import('../src/quantity.js');
const { dopeText, magnitudeText, signedDegreesText, machDistanceM, angleInOutputUnit, outputUnitToRad, spinDriftOffered, temperatureColumns } =
  await import('../src/printable-card/card-data.js');
const { tableSvg } = await import('../src/printable-card/table-svg.js');
const { cropBox, placeBadges, photoSvg, notesSvg } = await import('../src/printable-card/photo-svg.js');
const { TEMPLATE_TEXT, labelPairs, freeTextPairs, PAPER_FORMATS } = await import('../src/printable-card/card-pdf.js');
const {
  loadPrintableCardState, savePrintableCardState, savePrintableCardScopeState, resetPrintableCardStateForTests
} = await import('../src/printable-card-state.js');
const { cardFileName, defaultCardTitle, cardTargets, todayIso } = await import('../src/ui/printable-card/card-panel.js');
const { escapeXml } = await import('../src/printable-card/svg-text.js');

const output = (unit, style) => ({ unit, style, clickVerticalRad: mradToRad(0.1), clickHorizontalRad: mradToRad(0.1), clicksLabel: 'clicks' });

test('corrections are written as the Range Solver writes them', () => {
  assert.equal(dopeText(mradToRad(6.3), 'elevation', output('clicks', 'signs')), '+63');
  assert.equal(dopeText(mradToRad(6.3), 'elevation', output('clicks', 'udlr')), 'U 63');
  assert.equal(dopeText(mradToRad(-0.3), 'elevation', output('clicks', 'arrows')), '↓ 3');
  assert.equal(dopeText(mradToRad(0.01), 'elevation', output('clicks', 'signs')), '0');
  assert.equal(dopeText(mradToRad(6.3), 'elevation', output('mrad', 'signs')), '+6.3');
  assert.equal(dopeText(mradToRad(-0.4), 'windage', output('clicks', 'udlr')), 'L 4');
});

test('windage is a magnitude, without a glyph', () => {
  assert.equal(magnitudeText(mradToRad(-2.2), 'windage', output('clicks', 'udlr')), '22');
  assert.equal(magnitudeText(mradToRad(2.2), 'windage', output('mrad', 'signs')), '2.2');
});

test('the refinement threshold converts between radians and the output unit', () => {
  for (const unit of ['clicks', 'mrad', 'moa']) {
    const o = output(unit, 'signs');
    assert.ok(Math.abs(angleInOutputUnit(outputUnitToRad(5, 'elevation', o), 'elevation', o) - 5) < 1e-9, unit);
  }
  assert.ok(Math.abs(outputUnitToRad(5, 'elevation', output('clicks', 'signs')) - mradToRad(0.5)) < 1e-12);
});

test('angles are signed whole degrees', () => {
  assert.equal(signedDegreesText(degToRad(4.2)), '+4°');
  assert.equal(signedDegreesText(degToRad(-7.6)), '−8°');
  assert.equal(signedDegreesText(0), '0°');
});

test('the Mach distance is interpolated where the Mach number first drops to the limit', () => {
  const points = [{ range: 0, mach: 2.4 }, { range: 100, mach: 1.3 }, { range: 200, mach: 1.1 }, { range: 300, mach: 0.9 }];
  assert.equal(machDistanceM(points, 1.1), 200);
  assert.ok(Math.abs(machDistanceM(points, 1.0) - 250) < 1e-9);
  assert.equal(machDistanceM(points, 0.5), null);
});

test('the spin drift column is offered only with spin drift on in Settings and computable', () => {
  const computable = { muzzleVelocity: 800, massKg: 0.0113, caliberM: 0.00782, lengthM: 0.0315, riflingTwistM: 0.254, twistDirection: 'right' };
  assert.equal(spinDriftOffered(computable, 'off'), false);
  assert.equal(spinDriftOffered(computable, 'litz'), true);
  assert.equal(spinDriftOffered({ ...computable, riflingTwistM: null }, 'litz'), false);
});

function fontSizes(svg) {
  return [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
}

const LABELS = {
  target: 'Target', angle: 'angle', shorter: '← shorter', longer: 'longer →', distance: 'Distance', distanceUnit: 'm',
  wind: 'Wind', windUnit: '4 m/s', spin: 'Spin', slope: 'Slope', temperature: 'Temperature (°C)',
  temperatureColumns: ['5', '10', '20', '25', '30']
};

function referenceRow(d) {
  return {
    kind: 'reference', distance: String(d), elevation: '+12',
    neighbours: [{ distance: String(d - 50), elevation: '+8' }, { distance: String(d - 25), elevation: '+10' }, { distance: String(d + 25), elevation: '+14' }, { distance: String(d + 50), elevation: '+16' }],
    windage: '3', spin: '−1', slope: ['0', '−1', '−1', '−2', '−3'], temperature: ['+2', '+1', '−1', '−2', '−3']
  };
}

test('the table: fonts of 100 units and more, values aligned by text-anchor only, at fixed edges', () => {
  for (const count of [10, 31]) {
    const rows = Array.from({ length: count }, (_, i) => referenceRow(100 * (i + 1)));
    rows.splice(2, 0, { kind: 'target', id: 'T1', angle: '+4°', distance: '312', elevation: '+24', windage: '6', spin: '−1' });
    const svg = tableSvg({ rows, labels: LABELS, spin: true, slope: true, temperature: true, widthMm: 190, heightMm: 104.4, slopeAngles: [10, 15, 20, 25, 30] });
    assert.ok(Math.min(...fontSizes(svg)) >= 100, `${count} rows: smallest font ${Math.min(...fontSizes(svg))}`);
    assert.ok(!/\btextLength\b|letter-spacing|dominant-baseline/.test(svg));
    // Every reference row's elevation sits on the same right edge.
    const elevationXs = [...svg.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="end">\+12</g)].map((m) => m[1]);
    assert.equal(new Set(elevationXs).size, 1, `${count} rows: one edge for the reference elevations`);
  }
});

test('the table widens to the full width without the optional columns', () => {
  const svg = tableSvg({ rows: [referenceRow(100)], labels: LABELS, spin: false, slope: false, widthMm: 190, heightMm: 116, slopeAngles: [] });
  assert.ok(!svg.includes('Spin') && !svg.includes('Slope') && !svg.includes('Temperature'));
  assert.ok(svg.includes('width="19000"'));
});

test('with all optional columns, the table keeps its designed font sizes for realistic values', () => {
  const rows = Array.from({ length: 31 }, (_, i) => referenceRow(50 * (i + 1)));
  const args = { rows, labels: LABELS, spin: true, slope: true, temperature: true, widthMm: 190, heightMm: 104.4, slopeAngles: [10, 15, 20, 25, 30] };
  // A generous measure (0.6 em per character): everything fits as designed.
  const measure = (s, _face, size) => s.length * size * 0.6;
  assert.equal(tableSvg({ ...args, measure }), tableSvg(args));
});

test('values too long for their room shrink the whole table\'s fonts, keeping every edge', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ ...referenceRow(200 * (i + 1)), elevation: 'U 1650.5' }));
  const args = { rows, labels: LABELS, spin: true, slope: true, temperature: true, widthMm: 190, heightMm: 104.4, slopeAngles: [10, 15, 20, 25, 30] };
  const measure = (s, _face, size) => s.length * size * 0.6;
  const plain = tableSvg(args);
  const fitted = tableSvg({ ...args, measure });
  assert.ok(Math.max(...fontSizes(fitted)) < Math.max(...fontSizes(plain)));
  const edges = (svg) => [...svg.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="end">U 1650.5</g)].map((m) => m[1]);
  assert.deepEqual(edges(fitted), edges(plain));
});

test('temperature columns: five steps up from the first, the reference skipped only when a step lands on it', () => {
  assert.deepEqual(temperatureColumns({ startC: 5, stepC: 5, referenceC: 15 }), { temperaturesC: [5, 10, 20, 25, 30], skipped: true });
  assert.deepEqual(temperatureColumns({ startC: 4, stepC: 5, referenceC: 15 }), { temperaturesC: [4, 9, 14, 19, 24], skipped: false });
  // 10 °F steps from 39 °F with a 59 °F (15 °C) reference: the third step is the reference, up to rounding.
  const fahrenheitStep = 50 / 9;
  const { temperaturesC, skipped } = temperatureColumns({ startC: 15 - 2 * fahrenheitStep, stepC: fahrenheitStep, referenceC: 15 });
  assert.equal(skipped, true);
  assert.equal(temperaturesC.length, 5);
  assert.ok(temperaturesC.every((tc) => Math.abs(tc - 15) > 1));
  assert.deepEqual(temperatureColumns({ startC: 5, stepC: 0, referenceC: 15 }).temperaturesC, []);
});

test('crop: a box round the targets in the area\'s proportions, inside the image; none placed shows the whole image', () => {
  const box = cropBox({ imageWidth: 2000, imageHeight: 1356, points: [{ x: 1060, y: 1140 }, { x: 545, y: 700 }, { x: 1690, y: 465 }], areaAspect: 91 / 57 });
  assert.ok(box.x0 >= 0 && box.y0 >= 0 && box.x1 <= 2000 && box.y1 <= 1356);
  assert.ok(Math.abs((box.x1 - box.x0) / (box.y1 - box.y0) - 91 / 57) < 1e-9);
  for (const p of [{ x: 1060, y: 1140 }, { x: 545, y: 700 }, { x: 1690, y: 465 }]) {
    assert.ok(p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1);
  }
  assert.deepEqual(cropBox({ imageWidth: 100, imageHeight: 50, points: [], areaAspect: 2 }), { x0: 0, y0: 0, x1: 100, y1: 50, fit: true });
});

test('badges don\'t overlap each other, even for targets close together', () => {
  const points = [{ x: 30, y: 30 }, { x: 32, y: 31 }, { x: 34, y: 29 }, { x: 31, y: 33 }];
  const badges = placeBadges(points, 91, 57);
  for (let i = 0; i < badges.length; i++) {
    for (let j = i + 1; j < badges.length; j++) {
      const apart = Math.abs(badges[i].x - badges[j].x) >= 7.2 || Math.abs(badges[i].y - badges[j].y) >= 4.6;
      assert.ok(apart, `badges ${i} and ${j} overlap`);
    }
  }
});

test('photo and notes content: fonts of 100 units and more, names escaped and clipped', () => {
  const svg = photoSvg({
    photo: { href: 'data:image/jpeg;base64,AAAA', width: 2000, height: 1356 },
    targets: [{ id: 'T1', coords: { x: 0.5, y: 0.8 }, title: '312 m · +4°', subtitle: 'S&B <steel>' }, { id: 'T2', coords: null, title: '515 m', subtitle: 'Far' }],
    widthMm: 129, heightMm: 57
  });
  assert.ok(Math.min(...fontSizes(svg)) >= 100);
  assert.ok(svg.includes('S&amp;B &lt;steel&gt;'));
  assert.ok(svg.includes('clip-path="url(#card-photo-legend)"'));
  assert.ok(notesSvg({ widthMm: 57, heightMm: 57 }).includes('<line'));
  assert.equal(escapeXml('"a" & b'), '&quot;a&quot; &amp; b');
});

const templateText = (name) => readFileSync(join(ROOT, 'src/printable-card', name), 'utf8');

test('A4 and Letter carry the same card content; only the page and its centring differ', () => {
  const card = (svg) => svg.slice(svg.indexOf('<g id="card"')).replace(/transform="translate\([^)]*\)"/, '');
  const a4 = templateText('printable-card-a4-pdf-template.svg');
  const letter = templateText('printable-card-letter-pdf-template.svg');
  assert.equal(card(a4), card(letter));
  for (const svg of [a4, letter]) assert.ok(Math.min(...fontSizes(svg)) >= 100, 'template fonts of 100 units and more');
  assert.deepEqual(Object.keys(PAPER_FORMATS).sort(), ['a4', 'letter']);
});

test('every fixed text the card translates occurs in the templates, and every placeholder the card fills', () => {
  const svg = templateText('printable-card-a4-pdf-template.svg');
  for (const [english] of TEMPLATE_TEXT) assert.ok(svg.includes(english), english);
  for (const placeholder of ['[rifle]', '[rifle (long)]', '[cartridge (long)]', '[bullet (long)]', '[card title]', '[date]', '[table note]', '[reticle heading]', '[targets heading]']) {
    assert.ok(svg.includes(placeholder), placeholder);
  }
  for (const id of ['table', 'reticle', 'photo']) assert.ok(svg.includes(`id="${id}"`), id);
});

test('no translation of the template\'s text contains an English text replaced after it', async () => {
  const { changeLanguage, getLanguage } = await import('../src/i18n.js');
  const before = getLanguage();
  for (const { code } of SUPPORTED_LANGUAGES) {
    await changeLanguage(code);
    const pairs = labelPairs(t, code);
    pairs.forEach(([, translated], i) => {
      for (const [english] of pairs.slice(i + 1)) {
        assert.ok(!translated.includes(english), `${code}: "${translated}" contains the later "${english}"`);
      }
    });
  }
  await changeLanguage(before);
});

test('every printable card string exists in every locale', () => {
  const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${p}${k}.`) : [`${p}${k}`]));
  const keysOf = (code) => {
    const j = JSON.parse(readFileSync(join(ROOT, 'src/locales', `${code}.json`), 'utf8'));
    return new Set([...flatten(j.printableCard, 'printableCard.'), j.trajectory.tabData && 'trajectory.tabData', j.trajectory.tabPrintableCard && 'trajectory.tabPrintableCard', j.fields.cardMaxDistance && 'fields.cardMaxDistance', j.fields.cardCrosswind && 'fields.cardCrosswind']);
  };
  const en = keysOf('en');
  for (const { code } of SUPPORTED_LANGUAGES) assert.deepEqual([...keysOf(code)].sort(), [...en].sort(), code);
});

test('a free-text value takes the clipped placeholder only when it doesn\'t fit beside its label', () => {
  const measure = (text, face, size) => text.length * size * 0.5;
  const rifleBox = PAPER_FORMATS.a4.rifleBox;
  const labels = { 'printableCard.pdf.rifle': 'Rifle', 'printableCard.pdf.cartridge': 'Cartridge', 'printableCard.pdf.bullet': 'Bullet' };
  const pairs = Object.fromEntries(freeTextPairs({ values: { rifle: 'Short', cartridge: 'x'.repeat(80), bullet: '' }, labels, measure, rifleBox }));
  assert.equal(pairs['[rifle]'], 'Short');
  assert.equal(pairs['[rifle (long)]'], '');
  assert.equal(pairs['[cartridge]'], '');
  assert.equal(pairs['[cartridge (long)]'], 'x'.repeat(80));
});

test('settings persist; damaged values fall back to their defaults', () => {
  resetPrintableCardStateForTests();
  document.cookie = 'ballistics_printable_card_v1=; max-age=0';
  const fresh = loadPrintableCardState();
  assert.equal(fresh.paper, 'a4');
  assert.equal(fresh.initialStep, 100);
  savePrintableCardState({ paper: 'letter', initialStep: 50, slope: true, maxDistanceM: 914.4 });
  savePrintableCardScopeState({ zoomByScope: { s1: 12 } });
  resetPrintableCardStateForTests();
  const reloaded = loadPrintableCardState();
  assert.equal(reloaded.paper, 'letter');
  assert.equal(reloaded.initialStep, 50);
  assert.equal(reloaded.slope, true);
  assert.equal(reloaded.maxDistanceM, 914.4);
  assert.deepEqual(reloaded.scope.zoomByScope, { s1: 12 });
  const damaged = savePrintableCardState({ paper: 'a3', initialStep: 70, title: 'x'.repeat(60), refineThresholdRad: -1 });
  assert.equal(damaged.paper, 'a4');
  assert.equal(damaged.initialStep, 100);
  assert.equal(damaged.title, null);
  assert.equal(damaged.refineThresholdRad, 0);
  // Temperature corrections: on by default; first temperature and step follow their defaults until set.
  assert.equal(fresh.temperature, true);
  assert.equal(fresh.temperatureStartC, null);
  assert.equal(fresh.temperatureStepC, null);
  const temps = savePrintableCardState({ temperatureStartC: -5, temperatureStepC: 2.5 });
  assert.equal(temps.temperatureStartC, -5);
  assert.equal(temps.temperatureStepC, 2.5);
  const badStep = savePrintableCardState({ temperatureStepC: 0, temperatureStartC: 'cold' });
  assert.equal(badStep.temperatureStepC, null);
  assert.equal(badStep.temperatureStartC, null);
});

test('file name, default title and target labels', () => {
  assert.equal(cardFileName('Range card', 'Tikka 24" · .308/GP11', '2026-11-08'), 'Range card - Tikka 24_ - .308_GP11 - 2026-11-08.pdf');
  assert.equal(cardFileName('Range card', '', '2026-11-08'), 'Range card - 2026-11-08.pdf');
  assert.equal(defaultCardTitle({ rifleName: 'R'.repeat(40), loadName: 'Load' }).length, 44);
  const targets = cardTargets({ targets: [{ rangeM: 500, name: '' }, { rangeM: 300, name: 'Gong', losAngleRad: 0.1 }] }, (n) => `Target ${n}`);
  assert.deepEqual(targets.map((tg) => [tg.label, tg.name, tg.rangeM]), [['T1', 'Gong', 300], ['T2', 'Target 1', 500]]);
  assert.match(todayIso(new Date(2026, 0, 5)), /^2026-01-05$/);
});
