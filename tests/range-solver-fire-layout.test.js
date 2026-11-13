import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { fireLayoutFor, buildFireLayout, layoutElementIds, layoutFloor, manualRowWidth, phonePortrait, MANUAL_NARROW_W, FIXED_ELEMENTS } = await import('../src/ui/range-solver/fire-layout.js');
const { makeElement } = await import('./helpers/fake-dom.js');

const OPTIONAL = ['scope', 'readout', 'list', 'picker'];
const ALWAYS = ['gun', 'context', 'flight', 'manual', 'wind'];
const CTX = {
  portrait: { paneWidth: 366, paneHeight: 758, vmin: 390, pictureIcon: false, ignoreLos: false },
  landscape: { paneWidth: 756, paneHeight: 366, vmin: 390, pictureIcon: false, ignoreLos: false }
};

function combos() {
  const out = [];
  for (let mask = 0; mask < 16; mask++) out.push(OPTIONAL.filter((_, i) => mask & (1 << i)));
  return out;
}

function walk(node, fn) {
  fn(node);
  if (node.dir) node.items.forEach((child) => walk(child, fn));
}

test('every orientation × combination: each shown element appears exactly once, nothing else does', () => {
  for (const orientation of ['portrait', 'landscape']) {
    for (const ids of combos()) {
      const { tree } = fireLayoutFor(orientation, ids, CTX[orientation]);
      const leaves = layoutElementIds(tree);
      assert.deepEqual([...leaves].sort(), [...ALWAYS, ...ids].sort(), `${orientation} ${ids}`);
    }
  }
});

test('no container is left with fewer than two items; fixed elements carry no weight, flexible ones do', () => {
  for (const orientation of ['portrait', 'landscape']) {
    for (const ids of combos()) {
      walk(fireLayoutFor(orientation, ids, CTX[orientation]).tree, (node) => {
        if (node.dir) assert.ok(node.items.length >= 2, `${orientation} ${ids}: ${node.dir} with ${node.items.length}`);
        else if (FIXED_ELEMENTS.includes(node.id)) assert.equal(node.w ?? null, null, `${node.id} must be auto-sized`);
        else assert.ok(node.w > 0, `${orientation} ${ids}: ${node.id} needs a weight`);
      });
    }
  }
});

const TABLET_PORTRAIT = { paneWidth: 744, paneHeight: 938, vmin: 768, pictureIcon: false, ignoreLos: false };
const SMALL_PHONE = { paneWidth: 336, paneHeight: 714, vmin: 360, pictureIcon: false, ignoreLos: false };
const BIG_PHONE = { paneWidth: 406, paneHeight: 846, vmin: 430, pictureIcon: false, ignoreLos: false };
const PHONES = [CTX.portrait, SMALL_PHONE, BIG_PHONE, { paneWidth: 351, paneHeight: 581, vmin: 375, pictureIcon: false, ignoreLos: false }];
const nodeOf = (tree, id) => { let found = null; walk(tree, (n) => { if (n.id === id) found = n; }); return found; };
const isBeside = (tree) => !!nodeOf(tree, 'manual')?.narrow;

test('portrait on a tablet keeps priority order: gun, context, scope, readout|wind, flight, manual, list|picker', () => {
  assert.equal(phonePortrait({ ...TABLET_PORTRAIT, compact: true }), false);
  const { tree } = fireLayoutFor('portrait', OPTIONAL, TABLET_PORTRAIT);
  assert.deepEqual(layoutElementIds(tree), ['gun', 'context', 'scope', 'readout', 'wind', 'flight', 'manual', 'list', 'picker']);
  assert.equal(isBeside(tree), false);
});

test('portrait on a phone: the readout is never stacked, it gets the full width under the scope', () => {
  for (const ctx of PHONES) {
    assert.equal(phonePortrait({ ...ctx, compact: true }), true);
    for (const ids of combos().filter((c) => c.includes('readout'))) {
      const readout = nodeOf(fireLayoutFor('portrait', ids, ctx).tree, 'readout');
      assert.equal(readout.minMode, 'row', `${ctx.paneWidth} ${ids}`);
      assert.equal(readout.strip, true);
    }
  }
  const strip = layoutFloor({ id: 'readout', minMode: 'row', strip: true }, { ...CTX.portrait, compact: true });
  assert.equal(strip.h, 54 + 20, 'with the scope too, the strip is as tall as the full-size readout');
});

test('portrait on a phone: wind dial and range/LoS on separate lines when there is room, beside each other otherwise', () => {
  const lines = fireLayoutFor('portrait', ['readout', 'list', 'picker'], CTX.portrait);
  assert.deepEqual(layoutElementIds(lines.tree), ['gun', 'context', 'readout', 'flight', 'wind', 'manual', 'list', 'picker']);
  assert.equal(isBeside(lines.tree), false);
  assert.ok(lines.minHeight <= CTX.portrait.paneHeight);
  const beside = fireLayoutFor('portrait', ['readout', 'list', 'picker'], SMALL_PHONE);
  assert.deepEqual(layoutElementIds(beside.tree), ['gun', 'context', 'readout', 'flight', 'manual', 'wind', 'list', 'picker']);
  assert.equal(isBeside(beside.tree), true, 'separate lines would scroll a 360 × 800 phone');
  const all = fireLayoutFor('portrait', OPTIONAL, CTX.portrait);
  assert.deepEqual(layoutElementIds(all.tree), ['gun', 'context', 'scope', 'readout', 'flight', 'manual', 'wind', 'list', 'picker']);
  assert.equal(isBeside(fireLayoutFor('portrait', ['scope', 'readout'], CTX.portrait).tree), true, 'separate lines would shrink the reticle');
  assert.equal(isBeside(fireLayoutFor('portrait', ['scope'], BIG_PHONE).tree), false, 'room for a full-width reticle and separate lines');
});

test('portrait on a phone: the dial keeps the size it gets beside range/LoS, on either arrangement', () => {
  for (const ctx of PHONES) {
    const dial = Math.max(130, Math.floor((ctx.paneWidth - 8 - MANUAL_NARROW_W) / 1.44));
    for (const ids of combos()) {
      const wind = nodeOf(fireLayoutFor('portrait', ids, ctx).tree, 'wind');
      assert.equal(wind.dial, dial, `${ctx.paneWidth} ${ids}`);
      assert.equal(layoutFloor(wind, ctx).h, dial);
    }
  }
  assert.equal(Math.floor((366 - 8 - MANUAL_NARROW_W) / 1.44), 154, '390 × 844: 154 px, against 130 px beside the stacked readout');
});

test('portrait on a phone: the narrow range/LoS column is fixed-width and marks its cell', () => {
  const layout = fireLayoutFor('portrait', OPTIONAL, CTX.portrait);
  const cells = Object.fromEntries([...ALWAYS, ...OPTIONAL].map((id) => [id, makeElement('div')]));
  buildFireLayout(layout.tree, cells, layout.floorCtx);
  assert.ok(cells.manual.classList.contains('fire-cell-narrow'));
  const besideRow = cells.manual.parentNode;
  assert.match(besideRow.style.gridTemplateColumns, new RegExp(`^${MANUAL_NARROW_W}px minmax\\(`));
  const lines = fireLayoutFor('portrait', ['readout', 'list', 'picker'], CTX.portrait);
  buildFireLayout(lines.tree, cells, lines.floorCtx);
  assert.equal(cells.manual.classList.contains('fire-cell-narrow'), false, 'the class goes when the column does');
  const narrow = { id: 'manual', narrow: true };
  assert.equal(layoutFloor(narrow, { ...CTX.portrait, pictureIcon: true }).h - layoutFloor(narrow, CTX.portrait).h, 48, 'the picture icon takes its own line');
});

test('portrait on a phone: the scope keeps its full width when fitting would leave it under 60 %', () => {
  const ids = ['scope', 'readout', 'list'];
  const layout = fireLayoutFor('portrait', ids, CTX.portrait);
  assert.ok(layout.minHeight <= CTX.portrait.paneHeight, 'it would fit without scrolling');
  assert.equal(layout.scopeFull, true);
  assert.equal(fireLayoutFor('portrait', ids, TABLET_PORTRAIT).scopeFull, false, 'phones only');
});

const TABLET = { paneWidth: 1096, paneHeight: 949, vmin: 1024, pictureIcon: false, ignoreLos: false };
const columnsOf = (ids, ctx) => {
  const { tree } = fireLayoutFor('landscape', ids, ctx);
  return (tree.dir === 'wrap' ? tree.items : [tree]).map((column) => layoutElementIds(column));
};

test('the gun is always first and the location line second, in every orientation, combination and pane size', () => {
  for (const [orientation, ctx] of [['portrait', CTX.portrait], ['landscape', CTX.landscape], ['landscape', TABLET]]) {
    for (const ids of combos()) {
      const leaves = layoutElementIds(fireLayoutFor(orientation, ids, ctx).tree);
      assert.deepEqual(leaves.slice(0, 2), ['gun', 'context'], `${orientation} ${ctx.paneWidth} ${ids}`);
    }
  }
});

test('landscape on a tablet: three columns fold into two whenever a large element is hidden', () => {
  assert.deepEqual(columnsOf(OPTIONAL, TABLET), [['gun', 'context', 'scope', 'readout'], ['manual', 'wind', 'flight'], ['list', 'picker']], 'everything on: three columns');
  assert.deepEqual(columnsOf(['readout', 'list', 'picker'], TABLET), [['gun', 'context', 'readout', 'manual', 'wind', 'flight'], ['list', 'picker']], 'scope off: the readout joins the inputs');
  assert.deepEqual(columnsOf(['readout', 'list'], TABLET), [['gun', 'context', 'readout', 'manual', 'wind', 'flight'], ['list']]);
  assert.deepEqual(columnsOf(['scope', 'list', 'picker'], TABLET), [['gun', 'context', 'scope'], ['manual', 'wind', 'list', 'picker', 'flight']], 'readout off: the targets join the inputs');
  assert.deepEqual(columnsOf(['scope', 'readout', 'list'], TABLET), [['gun', 'context', 'scope', 'readout'], ['manual', 'wind', 'list', 'flight']], 'photo off');
  assert.deepEqual(columnsOf(['scope', 'readout', 'picker'], TABLET), [['gun', 'context', 'scope', 'readout'], ['manual', 'wind', 'picker', 'flight']], 'list off');
  assert.deepEqual(columnsOf(['readout'], TABLET), [['gun', 'context', 'readout', 'flight'], ['manual', 'wind']], 'readout alone: a wide readout column');
  assert.deepEqual(columnsOf(['list', 'picker'], TABLET), [['gun', 'context', 'manual', 'wind', 'flight'], ['list', 'picker']]);
  assert.deepEqual(columnsOf([], TABLET), [['gun', 'context', 'manual', 'wind', 'flight']]);
});

test('landscape on a phone: a fold that does not fit the pane falls back to three columns', () => {
  assert.deepEqual(columnsOf(['readout', 'list', 'picker'], CTX.landscape), [['gun', 'context', 'readout', 'flight'], ['manual', 'wind'], ['list', 'picker']]);
  assert.deepEqual(columnsOf(['scope', 'list', 'picker'], CTX.landscape), [['gun', 'context', 'scope'], ['manual', 'wind', 'flight'], ['list', 'picker']]);
  assert.deepEqual(columnsOf(['scope', 'readout', 'list'], CTX.landscape), [['gun', 'context', 'scope', 'readout'], ['manual', 'wind', 'flight'], ['list']]);
  assert.deepEqual(columnsOf(['readout'], CTX.landscape), [['gun', 'context', 'readout', 'flight'], ['manual', 'wind']], 'the wide readout column fits a phone');
  assert.deepEqual(columnsOf(['scope', 'readout', 'list'], { ...CTX.landscape, paneWidth: 0, paneHeight: 0 }), [['gun', 'context', 'scope', 'readout'], ['manual', 'wind', 'flight'], ['list']], 'no pane size yet: no fold');
});

test('landscape: a folded readout is laid out side by side; the unfolded one without a scope may stack', () => {
  const readoutOf = (ids, ctx) => {
    let found = null;
    walk(fireLayoutFor('landscape', ids, ctx).tree, (node) => { if (node.id === 'readout') found = node; });
    return found;
  };
  assert.equal(readoutOf(['readout', 'list'], TABLET).minMode, 'row');
  assert.equal(readoutOf(['readout'], TABLET).minMode, 'row');
  assert.equal(readoutOf(['readout', 'list'], CTX.landscape).minMode, 'stack');
  assert.equal(readoutOf(OPTIONAL, CTX.landscape).minMode, 'row');
});

test('portrait: the scope keeps its full width only when the pane has to scroll anyway', () => {
  const all = fireLayoutFor('portrait', OPTIONAL, CTX.portrait);
  assert.equal(all.scopeFull, true, 'everything on overflows a 366×758 pane');
  assert.ok(all.minHeight > CTX.portrait.paneHeight);
  const few = fireLayoutFor('portrait', ['scope', 'readout'], CTX.portrait);
  assert.equal(few.scopeFull, false);
  assert.equal(fireLayoutFor('landscape', OPTIONAL, { ...CTX.landscape, paneHeight: 200 }).scopeFull, false, 'portrait only');
  const full = layoutFloor({ id: 'scope' }, all.floorCtx);
  assert.equal(full.w, CTX.portrait.paneWidth);
});

test('a tablet-wide portrait pane pairs list and picker; a phone stacks them', () => {
  const pair = { dir: 'pair', w: 1, items: [{ id: 'list', w: 1 }, { id: 'picker', w: 1 }] };
  const phone = layoutFloor(pair, { ...CTX.portrait, compact: false });
  const tablet = layoutFloor(pair, { ...CTX.portrait, paneWidth: 744, compact: false });
  assert.ok(phone.h > tablet.h);
  assert.equal(tablet.h, 160);
});

test('the manual input needs one more icon of width with the picture icon, and less without LoS', () => {
  assert.equal(manualRowWidth(), 2 * 112 + 12 + 8 + 40);
  assert.equal(manualRowWidth({ pictureIcon: true }), manualRowWidth() + 48);
  assert.equal(manualRowWidth({ ignoreLos: true }), 112);
});

test('buildFireLayout places every cell once and writes minmax tracks for flexible elements', () => {
  const layout = fireLayoutFor('portrait', ['scope', 'readout', 'list'], { ...CTX.portrait, paneHeight: 2000 });
  const cells = Object.fromEntries([...ALWAYS, 'scope', 'readout', 'list'].map((id) => [id, makeElement('div')]));
  const root = buildFireLayout(layout.tree, cells, layout.floorCtx);
  assert.ok(root.className.includes('fire-grid-root'));
  assert.ok(root.className.includes('fire-grid-col'));
  const rows = root.style.gridTemplateRows.split(' ');
  assert.equal(rows[0], 'auto', 'gun is auto-sized');
  assert.match(root.style.gridTemplateRows, /minmax\(212px, 10fr\)/, 'scope floor 200 px + corners');
  const seen = new Set();
  const visit = (n) => { for (const c of n.childNodes || []) { for (const [id, cell] of Object.entries(cells)) if (cell === c) { assert.ok(!seen.has(id)); seen.add(id); } visit(c); } };
  visit(root);
  assert.equal(seen.size, Object.keys(cells).length);
});
