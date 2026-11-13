import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFireElements, effectiveElementIds, LOS_IGNORE_LIMIT_RAD } from '../src/ui/range-solver/fire-elements.js';
import { degToRad } from '../src/quantity.js';

const target = (deg = 0) => ({ id: 't' + deg, rangeM: 300, losAngleRad: degToRad(deg) });
const LOCATIONS = {
  none: null,
  empty: { id: 'l0', photo: 'data:image/jpeg;base64,AAA', targets: [] },
  noPhoto: { id: 'l1', photo: null, targets: [target(1)] },
  photo: { id: 'l2', photo: 'data:image/jpeg;base64,AAA', targets: [target(1), target(-2)] }
};

const combos = [];
for (const scope of [false, true]) for (const readout of [false, true]) for (const list of [false, true]) for (const picker of [false, true]) combos.push({ scope, readout, list, picker, listRowsOptimal: true, ignoreLos: false });

test('all 16 combinations × location kinds × optic: effective, reasons and the picture icon', () => {
  for (const config of combos) {
    for (const [kind, location] of Object.entries(LOCATIONS)) {
      for (const hasOptic of [false, true]) {
        const r = resolveFireElements({ config, location, hasOptic });
        const usable = kind === 'noPhoto' || kind === 'photo';
        const photo = kind === 'photo';
        const label = `${JSON.stringify(config)} ${kind} optic=${hasOptic}`;
        assert.equal(r.usableLocation, usable, label);
        assert.equal(r.showLocationName, usable, label);
        assert.equal(r.scope.effective, config.scope && hasOptic, label);
        assert.equal(r.scope.reason, hasOptic ? null : 'noOptic', label);
        assert.equal(r.readout.effective, config.readout, label);
        assert.equal(r.readout.reason, config.readout ? null : 'readoutOff', label);
        assert.equal(r.list.effective, config.list && usable, label);
        assert.equal(r.list.reason, usable ? null : 'noLocation', label);
        assert.equal(r.picker.effective, config.picker && photo, label);
        assert.equal(r.picker.reason, !usable ? 'noLocation' : (photo ? null : 'noPhoto'), label);
        assert.equal(r.pictureIcon, !config.list && !config.picker && photo, label);
        for (const id of ['scope', 'readout', 'list', 'picker']) assert.equal(r[id].enabled, config[id], label);
      }
    }
  }
});

test('effectiveElementIds lists the five fixed elements plus the effective optional ones', () => {
  const r = resolveFireElements({ config: { scope: true, readout: false, list: true, picker: true }, location: LOCATIONS.noPhoto, hasOptic: true });
  assert.deepEqual(effectiveElementIds(r).sort(), ['context', 'flight', 'gun', 'list', 'manual', 'scope', 'wind']);
});

test('Ignore LoS is blocked at 5° either way, not at 4.99°, and only by the active location', () => {
  const at = (deg) => ({ id: 'l', photo: null, targets: [target(0), target(deg)] });
  const config = { ignoreLos: true };
  assert.equal(resolveFireElements({ config, location: at(4.99), hasOptic: false }).ignoreLos.blocked, false);
  assert.equal(resolveFireElements({ config, location: at(4.99), hasOptic: false }).ignoreLos.effective, true);
  assert.equal(resolveFireElements({ config, location: at(5), hasOptic: false }).ignoreLos.blocked, true);
  assert.equal(resolveFireElements({ config, location: at(-5), hasOptic: false }).ignoreLos.blocked, true);
  assert.equal(resolveFireElements({ config, location: at(-5), hasOptic: false }).ignoreLos.effective, false);
  assert.equal(resolveFireElements({ config, location: null, hasOptic: false }).ignoreLos.effective, true);
  assert.equal(resolveFireElements({ config: { ignoreLos: false }, location: null, hasOptic: false }).ignoreLos.effective, false);
  assert.equal(LOS_IGNORE_LIMIT_RAD, degToRad(5));
});
