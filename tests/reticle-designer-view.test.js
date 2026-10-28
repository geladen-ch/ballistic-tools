import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const view = await import('../src/views/reticle-designer-view.js');
const state = await import('../src/reticle-designer-state.js');
const { radToMrad, radToMoa } = await import('../src/quantity.js');
const { visibleFieldRadius, referenceOptics } = await import('../src/reticle/scope.js');
const svgClient = await import('../src/reticle/svg-import/client.js');
const reticleLibrary = await import('../src/reticle-library.js');
const { takePendingArsenalTab } = await import('../src/arsenal-prefill.js');
const { extractShape } = await import('../src/reticle/svg-import/extract.js');
const { parseReticle } = await import('../src/reticle/file-codec.js');
// The parsers run in-process here (the test DOM's Worker never answers),
// with the same outcome shape the worker gives.
const inProcess = (fn) => (text) => {
  try {
    return { ok: true, ...fn(text) };
  } catch (err) {
    return { ok: false, code: err.code, detail: err.detail || {} };
  }
};
svgClient.setImportersForTests({
  svg: inProcess((text) => ({ shape: extractShape(text) })),
  reticle: inProcess((text) => ({ doc: parseReticle(text) }))
});

function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, out);
  return out;
}
// SVG nodes get their class through setAttribute, HTML ones through className (and the shim's classList).
const classesOf = (n) => `${n.className || ''} ${n.getAttribute?.('class') || ''}`.split(' ');
const byClass = (root, cls) => findAll(root, (n) => classesOf(n).includes(cls));
const svgOf = (root) => byClass(root, 'reticle-canvas')[0];
const toolButton = (root, tool) => findAll(root, (n) => n.getAttribute?.('data-tool') === tool)[0];
const doc = () => state.getReticleSession().history.present;

// Drawing units per mrad at the default view (the field circle fits 470 of 1000 units).
function unitsPerMrad() {
  return 470 / radToMrad(visibleFieldRadius(referenceOptics(doc().referenceScope)));
}
function at(xMrad, yMrad) {
  const k = unitsPerMrad();
  return { offsetX: 500 + xMrad * k, offsetY: 500 + yMrad * k };
}
function press(svg, from, to = from, extra = {}) {
  fireEvent(svg, 'pointerdown', { pointerId: 1, button: 0, ...from, ...extra });
  if (to !== from) {
    fireEvent(svg, 'pointermove', { pointerId: 1, ...{ offsetX: (from.offsetX + to.offsetX) / 2, offsetY: (from.offsetY + to.offsetY) / 2 } });
    fireEvent(svg, 'pointermove', { pointerId: 1, ...to });
  }
  fireEvent(svg, 'pointerup', { pointerId: 1, ...to });
}
function inputLabelled(root, key) {
  const label = findAll(root, (n) => n.tagName === 'LABEL' && n.textContent.startsWith(t(key)))[0];
  return label && findAll(label, (n) => n.tagName === 'INPUT')[0];
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);
const buttonText = (root, key) => findAll(root, (n) => n.tagName === 'BUTTON' && n.textContent === t(key))[0];

test.beforeEach(async () => {
  state.resetReticleDesignerStateForTests();
  await reticleLibrary.resetReticleLibraryForTests();
  global.location.hash = '#/reticle-designer';
  takePendingArsenalTab();
});

test('mount() shows the five panes, the scope section and the file bar', () => {
  const container = makeElement('main');
  view.mount(container);
  for (const key of ['options', 'palette', 'settings', 'list']) {
    assert.ok(container.textContent.includes(t(`reticleDesigner.panes.${key}`)), key);
  }
  assert.ok(svgOf(container), 'expected the reticle view');
  assert.ok(container.textContent.includes(t('reticleDesigner.scope.title')));
  assert.ok(container.textContent.includes(t('reticleDesigner.list.empty')));
  assert.ok(container.textContent.includes(t('reticleDesigner.file.saveToArsenal')));
});

test('placing a dot with a click: snapped, selected, back to the arrow, one undo step', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'dot'), 'click');
  assert.equal(state.getReticleSession().editor.tool, 'dot');
  press(svgOf(container), at(3.04, -1.96));
  assert.equal(doc().elements.length, 1);
  const dot = doc().elements[0];
  near(radToMrad(dot.x), 3);
  near(radToMrad(dot.y), -2);
  assert.deepEqual(state.getReticleSession().editor.selection, [dot.id]);
  assert.equal(state.getReticleSession().editor.tool, 'select');
  assert.ok(inputLabelled(container, 'reticleDesigner.params.diameter'), 'settings show the dot');
  fireEvent(findAll(container, (n) => n.tagName === 'BUTTON' && n.textContent === t('reticleDesigner.options.undo'))[0], 'click');
  assert.equal(doc().elements.length, 0);
});

test('a plain click with the line tool makes a short segment outward from the click', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(-2, 1));
  const line = doc().elements[0];
  near(radToMrad(line.x), -2);
  near(radToMrad(line.endX), -3);
});

test('press-and-drag with the line tool sets the end; drawn inwards, the ends swap so the start is nearer zero', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(1, 2), at(4, 2));
  fireEvent(toolButton(container, 'vbar'), 'click');
  press(svgOf(container), at(1, -9), at(1, -3));
  const [outward, inward] = doc().elements;
  near(radToMrad(outward.x), 1);
  near(radToMrad(outward.endX), 4);
  near(radToMrad(inward.y), -3);
  near(radToMrad(inward.endY), -9);
  near(radToMrad(inward.x), 1);
  assert.equal(state.getReticleSession().history.past.length, 2, 'each placement is one undo step');
});

test('a plain click with a thinning bar runs it out to the field circle', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'vbar'), 'click');
  press(svgOf(container), at(0, 5));
  const bar = doc().elements[0];
  near(bar.endY, visibleFieldRadius(referenceOptics(doc().referenceScope)), 1e-12);
});

test('dragging a thinning bar moves it, and stops when its start reaches zero; a line moves freely across', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hbar'), 'click');
  press(svgOf(container), at(2, 0), at(5, 0));
  press(svgOf(container), at(3.5, 0), at(-1.5, 0));
  const bar = doc().elements[0];
  near(radToMrad(bar.x), 0);
  near(radToMrad(bar.endX), 3);

  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(2, 6), at(5, 6));
  press(svgOf(container), at(3.5, 6), at(-1.5, 6));
  const line = doc().elements[1];
  near(radToMrad(line.x), -3, 1e-6);
  near(radToMrad(line.endX), 0, 1e-6);
});

test('typing in a setting applies live, one undo step per field, and becomes the next line\'s default', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'vline'), 'click');
  press(svgOf(container), at(0, 2), at(0, 6));
  const input = inputLabelled(container, 'reticleDesigner.params.width');
  fireEvent(input, 'focus');
  for (const typed of ['0', '0.', '0.1', '0.12']) {
    input.value = typed;
    fireEvent(input, 'input');
  }
  fireEvent(input, 'blur');
  near(radToMrad(doc().elements[0].width), 0.12);
  // '0' was rejected (must be positive), so 0.1 and 0.12 coalesced into one step after placing.
  assert.equal(state.getReticleSession().history.past.length, 2);

  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  near(radToMrad(doc().elements[1].diameter), 0.12);
});

test('an invalid dimension is refused with a message, and the reticle keeps the last valid one', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'circle'), 'click');
  press(svgOf(container), at(0, 0));
  const inner = inputLabelled(container, 'reticleDesigner.params.innerDiameter');
  inner.value = '5';
  fireEvent(inner, 'input');
  near(radToMrad(doc().elements[0].innerDiameter), 1.8);
  assert.ok(container.textContent.includes(t('reticleDesigner.errors.innerBelowOuter')));
});

test('mirror and repeat draw linked copies, highlighted as derived', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(2, 0));
  const checkbox = (key) => findAll(container, (n) => n.tagName === 'LABEL' && n.textContent === t(key))[0].childNodes[0];
  const mirror = checkbox('reticleDesigner.settings.mirror');
  mirror.checked = true;
  fireEvent(mirror, 'change');
  const repeat = checkbox('reticleDesigner.settings.repeat');
  repeat.checked = true;
  fireEvent(repeat, 'change');
  const e = doc().elements[0];
  assert.equal(e.repeat.enabled, true);
  assert.equal(e.repeat.count, 5);
  near(radToMrad(e.repeat.step), 1);
  const shapes = byClass(container, 'reticle-shape');
  assert.equal(shapes.length, 12);
  assert.equal(shapes.filter((s) => s.getAttribute('class').includes('derived')).length, 11);
  assert.ok(shapes.every((s) => s.getAttribute('class').includes('selected')));
});

test('the MOA switch changes the defaults of new elements', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(findAll(container, (n) => n.getAttribute?.('data-units') === 'moa')[0], 'click');
  fireEvent(toolButton(container, 'chevron'), 'click');
  press(svgOf(container), at(0, 0));
  const chevron = doc().elements[0];
  near(radToMoa(chevron.lineWidth), 1.5);
  near(radToMoa(chevron.overallWidth), 3.5);
  near(radToMoa(chevron.height), 3.5);
});

test('state, undo history included, survives leaving the tool and coming back', () => {
  const container = makeElement('main');
  const cleanup = view.mount(container);
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  cleanup();
  const again = makeElement('main');
  view.mount(again);
  assert.equal(doc().elements.length, 1);
  assert.equal(byClass(again, 'reticle-shape').length, 1);
  assert.ok(state.getReticleSession().history.past.length >= 1);
});

test('dragging an end handle moves just that end: a bar within the end-point rule, a line freely', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hbar'), 'click');
  press(svgOf(container), at(2, 0), at(5, 0));
  press(svgOf(container), at(5, 0), at(1, 0));
  const bar = doc().elements[0];
  near(radToMrad(bar.x), 2);
  near(radToMrad(bar.endX), 2);

  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(2, 6), at(5, 6));
  press(svgOf(container), at(5, 6), at(1, 6));
  const line = doc().elements[1];
  near(radToMrad(line.x), 2);
  near(radToMrad(line.endX), 1, 1e-6);
});

test('grouping from a multi-selection: the list shows the group, settings its position and shared settings', () => {
  const container = makeElement('main');
  view.mount(container);
  for (const x of [1, 3]) {
    fireEvent(toolButton(container, 'dot'), 'click');
    press(svgOf(container), at(x, 2));
  }
  press(svgOf(container), at(1, 2), at(1, 2), { shiftKey: true });
  assert.equal(state.getReticleSession().editor.selection.length, 2);
  fireEvent(buttonText(container, 'reticleDesigner.palette.group'), 'click');
  const [groupId] = state.getReticleSession().editor.selection;
  assert.ok(groupId.startsWith('g'));
  assert.ok(container.textContent.includes(t('reticleDesigner.settings.group', { count: 2 })));
  const groupX = inputLabelled(container, 'reticleDesigner.params.groupX');
  assert.equal(groupX.value, '2');
  assert.ok(inputLabelled(container, 'reticleDesigner.params.diameter'), 'two dots share their diameter');
  groupX.value = '4';
  fireEvent(groupX, 'input');
  assert.deepEqual(doc().elements.map((e) => Math.round(radToMrad(e.x) * 1e6) / 1e6), [3, 5]);
  // A click on a member in the view selects the whole group; a member row in the list selects just it.
  fireEvent(container, 'click');
  const memberRow = findAll(container, (n) => n.getAttribute?.('data-entry') === doc().elements[0].id)[0];
  fireEvent(memberRow, 'click', {});
  assert.deepEqual(state.getReticleSession().editor.selection, [doc().elements[0].id]);
  fireEvent(buttonText(container, 'reticleDesigner.palette.ungroup'), 'click');
  assert.equal(doc().groups.length, 0);
});

test('dragging shows the dragged element\'s snapped coordinates next to the pointer, hidden on release', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  const svg = svgOf(container);
  const readout = byClass(container, 'reticle-readout')[0];
  fireEvent(svg, 'pointerdown', { pointerId: 1, button: 0, ...at(1, 1) });
  fireEvent(svg, 'pointermove', { pointerId: 1, ...at(3.04, -2.27) });
  assert.equal(readout.style.display, '');
  assert.equal(readout.textContent, 'x 3   y −2.3 mrad');
  fireEvent(svg, 'pointerup', { pointerId: 1, ...at(3.04, -2.27) });
  assert.equal(readout.style.display, 'none');

  fireEvent(toolButton(container, 'hline'), 'click');
  fireEvent(svg, 'pointerdown', { pointerId: 1, button: 0, ...at(-1, 4) });
  fireEvent(svg, 'pointermove', { pointerId: 1, ...at(-5.53, 4) });
  assert.equal(readout.textContent, 'x −1 … −5.5   y 4 mrad');
  fireEvent(svg, 'pointerup', { pointerId: 1, ...at(-5.53, 4) });
});

test('a newly enabled repeat takes the last direction, count and step entered', () => {
  const container = makeElement('main');
  view.mount(container);
  const repeatBox = () => findAll(container, (n) => n.tagName === 'LABEL' && n.textContent === t('reticleDesigner.settings.repeat'))[0].childNodes[0];
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  repeatBox().checked = true;
  fireEvent(repeatBox(), 'change');
  const direction = findAll(container, (n) => n.tagName === 'SELECT' && (n.id || '').startsWith('reticle-repeat-direction'))[0];
  direction.value = 'left';
  fireEvent(direction, 'change');
  const count = inputLabelled(container, 'reticleDesigner.settings.repeatCount');
  count.value = '3';
  fireEvent(count, 'input');

  fireEvent(toolButton(container, 'vline'), 'click');
  press(svgOf(container), at(0, 2), at(0, 5));
  repeatBox().checked = true;
  fireEvent(repeatBox(), 'change');
  const { repeat } = doc().elements[1];
  assert.equal(repeat.direction, 'left');
  assert.equal(repeat.count, 3);
  near(radToMrad(repeat.step), 1);
});

test('the magnification slider previews FFP zoom; reset goes back to the lowest magnification', () => {
  const container = makeElement('main');
  view.mount(container);
  const slider = findAll(container, (n) => n.id === 'reticle-magnification')[0];
  const bar = byClass(container, 'reticle-magnification')[0];
  assert.equal(bar.style.display, '');
  assert.equal(Number(slider.min), doc().referenceScope.zoomMin);
  near(Number(slider.max), doc().referenceScope.zoomMax, 1e-9);
  const rim = byClass(container, 'reticle-rim')[0];
  const r0 = Number(rim.getAttribute('r'));

  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(2, 0));
  const dotPath = () => byClass(container, 'reticle-shape')[0].getAttribute('d');
  const before = dotPath();

  slider.value = String(doc().referenceScope.zoomMax);
  fireEvent(slider, 'input');
  assert.equal(Number(rim.getAttribute('r')), r0, 'the field circle stays put on screen');
  assert.notEqual(dotPath(), before, 'an FFP reticle grows with the zoom');
  assert.ok(container.textContent.includes('25×'));

  const reset = findAll(container, (n) => n.tagName === 'BUTTON' && n.getAttribute('aria-label') === t('reticleDesigner.view.reset'))[0];
  fireEvent(reset, 'click');
  assert.equal(state.getReticleSession().editor.magnification, null);
  assert.equal(dotPath(), before);
});

test('SFP: the slider shows what the subtensions are worth; a fixed scope has no slider', async () => {
  const { updateReferenceScope } = await import('../src/reticle/model.js');
  const { commit } = await import('../src/reticle/history.js');
  const session = state.getReticleSession();
  state.setReticleHistory(commit(session.history, updateReferenceScope(session.history.present, { type: 'sfp', calibrationZoom: 10 })));
  const container = makeElement('main');
  view.mount(container);
  const slider = findAll(container, (n) => n.id === 'reticle-magnification')[0];
  slider.value = '20';
  fireEvent(slider, 'input');
  assert.ok(container.textContent.includes(t('reticleDesigner.view.sfpScale', { factor: '0.5' })));

  const s2 = state.getReticleSession();
  state.setReticleHistory(commit(s2.history, updateReferenceScope(s2.history.present, { type: 'fixed' })));
  const again = makeElement('main');
  view.mount(again);
  assert.equal(byClass(again, 'reticle-magnification')[0].style.display, 'none');
});

test('a number: placed, its digits typed live, font/height/anchor remembered for the next one, listed by its digits', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'number'), 'click');
  press(svgOf(container), at(3, -2));
  const n = doc().elements[0];
  assert.equal(n.type, 'number');
  assert.equal(n.text, '1');
  assert.equal(n.font, 'b612-regular');
  near(radToMrad(n.digitHeight), 0.5);
  const text = findAll(container, (x) => (x.id || '').startsWith('reticle-number-text-'))[0];
  fireEvent(text, 'focus');
  for (const typed of ['1', '12', '12x']) {
    text.value = typed;
    fireEvent(text, 'input');
  }
  assert.equal(doc().elements[0].text, '12', 'the invalid keystroke is refused');
  assert.ok(container.textContent.includes(t('reticleDesigner.errors.digitsOnly')));
  fireEvent(text, 'blur');
  assert.equal(byClass(container, 'reticle-shape').length, 2, 'one path per digit');
  const font = findAll(container, (x) => (x.id || '').startsWith('reticle-number-font-'))[0];
  font.value = 'barlow-light';
  fireEvent(font, 'change');
  assert.ok(container.textContent.includes(`${t('reticleDesigner.types.number')} 12`));
  const anchor = findAll(container, (x) => (x.id || '').startsWith('reticle-number-anchor-'))[0];
  anchor.value = 'right';
  fireEvent(anchor, 'change');
  const height = inputLabelled(container, 'reticleDesigner.params.digitHeight');
  height.value = '0.8';
  fireEvent(height, 'input');

  fireEvent(toolButton(container, 'number'), 'click');
  press(svgOf(container), at(-3, -2));
  const next = doc().elements[1];
  assert.equal(next.font, 'barlow-light');
  assert.equal(next.anchor, 'right');
  near(radToMrad(next.digitHeight), 0.8);
  assert.equal(next.text, '1', 'the digits themselves are not carried over');
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('SVG shape: pasted, previewed, inserted with its origin at zero; scale, width and height edit one another', async () => {
  const container = makeElement('main');
  view.mount(container);
  const panel = byClass(container, 'reticle-svg-import')[0];
  assert.equal(panel.style.display, 'none');
  fireEvent(toolButton(container, 'svg'), 'click');
  assert.equal(panel.style.display, '');
  const textArea = findAll(container, (n) => n.id === 'reticle-svg-text')[0];
  textArea.value = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="20" height="10"/><path d="M0 20L20 20" stroke="#f00" stroke-dasharray="2"/></svg>';
  fireEvent(buttonText(container, 'reticleDesigner.svg.read'), 'click');
  await tick();
  assert.ok(container.textContent.includes(t('reticleDesigner.svg.warnings.dashes')));
  assert.equal(byClass(panel, 'reticle-svg-preview-canvas').length, 1);
  fireEvent(buttonText(container, 'reticleDesigner.svg.insert'), 'click');
  assert.equal(panel.style.display, 'none');
  const shape = doc().elements[0];
  assert.equal(shape.type, 'svg');
  assert.equal(shape.x, 0);
  assert.equal(shape.y, 0);
  near(radToMrad(shape.scale) * 20.5, 5, 1e-9); // larger side (20 wide, 20.5 tall: the butt-capped stroke adds half its width only across the line) scaled to 5 mrad
  assert.equal(byClass(container, 'stroked').length, 1);

  const width = inputLabelled(container, 'reticleDesigner.params.svgWidth');
  const scaleInput = inputLabelled(container, 'reticleDesigner.params.svgScale');
  width.value = '10';
  fireEvent(width, 'input');
  near(radToMrad(doc().elements[0].scale), 0.5, 1e-9);
  assert.equal(scaleInput.value, '0.5');
  scaleInput.value = '0.1';
  fireEvent(scaleInput, 'input');
  assert.equal(width.value, '2');
  assert.equal(inputLabelled(container, 'reticleDesigner.params.svgHeight').value, '2.05');
});

test('SVG shape: refused input shows its reason and inserts nothing', async () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'svg'), 'click');
  const textArea = findAll(container, (n) => n.id === 'reticle-svg-text')[0];
  textArea.value = '<svg xmlns="http://www.w3.org/2000/svg"><text>12</text></svg>';
  fireEvent(buttonText(container, 'reticleDesigner.svg.read'), 'click');
  await tick();
  assert.ok(container.textContent.includes(t('reticleDesigner.svg.errors.text')));
  assert.equal(buttonText(container, 'reticleDesigner.svg.insert').disabled, true);
  textArea.value = '<script>alert(1)</script>';
  fireEvent(buttonText(container, 'reticleDesigner.svg.read'), 'click');
  await tick();
  assert.ok(container.textContent.includes(t('reticleDesigner.svg.errors.notSvg')));
  fireEvent(buttonText(container, 'reticleDesigner.svg.cancel'), 'click');
  assert.equal(doc().elements.length, 0);
});

test('a multi-selection edits what its elements share; differing values show as mixed until set', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(1, 3), at(4, 3));
  fireEvent(toolButton(container, 'vline'), 'click');
  press(svgOf(container), at(-3, 1), at(-3, 4));
  const width = () => inputLabelled(container, 'reticleDesigner.params.width');
  width().value = '0.2';
  fireEvent(width(), 'input');
  fireEvent(container, 'click');
  press(svgOf(container), at(2, 3), at(2, 3), { shiftKey: true });
  assert.equal(state.getReticleSession().editor.selection.length, 2);
  assert.ok(container.textContent.includes(t('reticleDesigner.settings.multiple', { count: 2 })));
  assert.equal(width().value, '', 'the widths differ (0.2 and 0.05)');
  assert.equal(width().getAttribute('placeholder'), t('reticleDesigner.settings.mixed'));
  const steps = state.getReticleSession().history.past.length;
  width().value = '0.1';
  fireEvent(width(), 'input');
  assert.deepEqual(doc().elements.map((e) => Math.round(radToMrad(e.width) * 1e6) / 1e6), [0.1, 0.1]);
  assert.equal(state.getReticleSession().history.past.length, steps + 1, 'one undo step for all');
  assert.ok(!inputLabelled(container, 'reticleDesigner.params.endX'), 'per-element fields are not shared');
});

test('only settings every element has are shown; mirror and repeat for any but BDC marks', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(1, 3), at(4, 3));
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(-3, 1));
  press(svgOf(container), at(2, 3), at(2, 3), { shiftKey: true });
  assert.ok(!inputLabelled(container, 'reticleDesigner.params.width'));
  assert.ok(!inputLabelled(container, 'reticleDesigner.params.diameter'));
  const check = (key) => findAll(container, (n) => n.tagName === 'LABEL' && n.textContent === t(key))[0].childNodes[0];
  const repeat = check('reticleDesigner.settings.repeat');
  repeat.checked = true;
  fireEvent(repeat, 'change');
  assert.ok(doc().elements.every((e) => e.repeat.enabled));
  const count = inputLabelled(container, 'reticleDesigner.settings.repeatCount');
  count.value = '2';
  fireEvent(count, 'input');
  assert.deepEqual(doc().elements.map((e) => e.repeat.count), [2, 2]);
  const mirror = check('reticleDesigner.settings.mirror');
  mirror.checked = true;
  fireEvent(mirror, 'change');
  assert.ok(doc().elements.every((e) => e.mirror));
});

test('a shared edit that would make any element invalid is refused for all', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'circle'), 'click');
  press(svgOf(container), at(5, 5));
  const outer = () => inputLabelled(container, 'reticleDesigner.params.outerDiameter');
  outer().value = '4';
  fireEvent(outer(), 'input');
  fireEvent(toolButton(container, 'horseshoe'), 'click');
  press(svgOf(container), at(-5, 5));
  press(svgOf(container), at(5 + 2, 5), at(5 + 2, 5), { shiftKey: true });
  assert.equal(state.getReticleSession().editor.selection.length, 2);
  const inner = inputLabelled(container, 'reticleDesigner.params.innerDiameter');
  assert.equal(inner.value, '1.8');
  inner.value = '3';
  fireEvent(inner, 'input');
  assert.ok(container.textContent.includes(t('reticleDesigner.errors.innerBelowOuter')), 'the horseshoe is only 2 across');
  assert.deepEqual(doc().elements.map((e) => Math.round(radToMrad(e.innerDiameter) * 1e6) / 1e6), [1.8, 1.8]);
});

test('BDC marks: placed on the vertical axis, dragged only up and down, fixed-size markers that can be hidden', () => {
  const container = makeElement('main');
  view.mount(container);
  const svg = svgOf(container);
  fireEvent(toolButton(container, 'bdc'), 'click');
  press(svg, at(3, 4));
  const mark = doc().elements[0];
  assert.equal(mark.type, 'bdc');
  assert.equal(mark.x, 0, 'a click off the axis places it on the axis');
  near(radToMrad(mark.y), 4);
  assert.equal(byClass(container, 'reticle-bdc-mark').length, 1);
  assert.equal(byClass(container, 'reticle-shape').length, 0, 'not drawn as part of the reticle');
  assert.equal(byClass(container, 'reticle-bdc-ring').length, 1, 'selected');
  const r = () => byClass(container, 'reticle-bdc-mark')[0].getAttribute('r');
  const radius = r();

  // Settings: y only, no mirror or repeat.
  assert.ok(!inputLabelled(container, 'reticleDesigner.params.markX'));
  assert.ok(inputLabelled(container, 'reticleDesigner.params.markY'));
  assert.ok(!container.textContent.includes(t('reticleDesigner.settings.mirror')));
  assert.ok(!container.textContent.includes(t('reticleDesigner.settings.repeat')));

  // A diagonal drag moves it straight down.
  press(svg, at(0, 4), at(2, 6));
  assert.equal(doc().elements[0].x, 0);
  near(radToMrad(doc().elements[0].y), 6, 1e-6);

  // Fixed size: zooming in doesn't grow it.
  fireEvent(findAll(container, (n) => n.getAttribute?.('aria-label') === t('reticleDesigner.view.zoomIn'))[0], 'click');
  assert.equal(r(), radius);

  // Hidden: gone from the view and not clickable there, still in the list.
  const hide = findAll(container, (n) => n.tagName === 'LABEL' && n.textContent === t('reticleDesigner.options.bdc'))[0].childNodes[0];
  hide.checked = false;
  fireEvent(hide, 'change');
  assert.equal(byClass(container, 'reticle-bdc-mark').length, 0);
  state.patchReticleEditor({ selection: [], view: null });
  press(svg, at(0, 6));
  assert.deepEqual(state.getReticleSession().editor.selection, []);
  assert.ok(container.textContent.includes(t('reticleDesigner.types.bdc')));

  // Placing another one shows them again.
  fireEvent(toolButton(container, 'bdc'), 'click');
  press(svg, at(0, -2));
  assert.equal(state.getReticleSession().editor.showBdc, true);
  assert.equal(byClass(container, 'reticle-bdc-mark').length, 2);
});

test('a group with a BDC mark: no mirror or repeat; a multi-selection of BDC marks has no x', () => {
  const container = makeElement('main');
  view.mount(container);
  const svg = svgOf(container);
  fireEvent(toolButton(container, 'bdc'), 'click');
  press(svg, at(0, 3));
  fireEvent(toolButton(container, 'bdc'), 'click');
  press(svg, at(0, 6));
  press(svg, at(0, 3), at(0, 3), { shiftKey: true });
  assert.equal(state.getReticleSession().editor.selection.length, 2);
  assert.ok(!inputLabelled(container, 'reticleDesigner.params.selectionX'));
  const y = inputLabelled(container, 'reticleDesigner.params.selectionY');
  y.value = '5';
  fireEvent(y, 'input');
  assert.deepEqual(doc().elements.map((e) => Math.round(radToMrad(e.y) * 1e6) / 1e6), [3.5, 6.5]);

  fireEvent(toolButton(container, 'dot'), 'click');
  press(svg, at(2, 1));
  press(svg, at(0, 3.5), at(0, 3.5), { shiftKey: true });
  fireEvent(findAll(container, (n) => n.tagName === 'BUTTON' && n.textContent === t('reticleDesigner.palette.group'))[0], 'click');
  assert.equal(doc().groups.length, 1);
  assert.ok(inputLabelled(container, 'reticleDesigner.params.groupX'));
  assert.ok(!container.textContent.includes(t('reticleDesigner.settings.mirror')));
  assert.ok(!container.textContent.includes(t('reticleDesigner.settings.repeat')));
});

test('New reticle scraps the reticle and its history, asking first when there are unsaved changes', () => {
  const container = makeElement('main');
  view.mount(container);
  state.patchReticleEditor({ units: 'moa', grid: false });
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(2, 2));
  const name = findAll(container, (n) => n.id === 'reticle-manufacturer')[0];
  name.value = 'Old';
  fireEvent(name, 'input');
  const newButton = findAll(container, (n) => n.id === 'reticle-new')[0];
  let asked = 0;
  const saved = global.confirm;
  try {
    global.confirm = () => { asked += 1; return false; };
    fireEvent(newButton, 'click');
    assert.equal(asked, 1);
    assert.equal(doc().elements.length, 1, 'declined: nothing changes');

    global.confirm = () => { asked += 1; return true; };
    fireEvent(newButton, 'click');
    assert.equal(asked, 2);
    assert.equal(doc().elements.length, 0);
    assert.equal(doc().manufacturer, '');
    assert.equal(name.value, '');
    const session = state.getReticleSession();
    assert.equal(session.history.past.length, 0, 'not undoable');
    assert.deepEqual(session.editor.selection, []);
    assert.equal(session.editor.units, 'moa', 'editor preferences are kept');
    assert.equal(session.editor.grid, false);
    assert.equal(state.hasUnsavedReticleChanges(), false);
    assert.ok(container.textContent.includes(t('reticleDesigner.list.empty')));

    // Nothing unsaved: no question.
    fireEvent(newButton, 'click');
    assert.equal(asked, 2);
  } finally {
    global.confirm = saved;
  }
});

test('illumination: switched on in the scope section, colours, lit elements, the view options, and the next element', () => {
  const container = makeElement('main');
  view.mount(container);
  const svg = svgOf(container);
  const label = (key) => findAll(container, (n) => n.tagName === 'LABEL' && n.textContent === t(key))[0];
  const check = (key) => label(key).childNodes[0];
  const shown = (key) => label(key).style.display !== 'none';
  assert.ok(!shown('reticleDesigner.options.illumination'), 'hidden for a reticle that isn\'t illuminated');
  assert.ok(!shown('reticleDesigner.options.dimField'));

  fireEvent(toolButton(container, 'dot'), 'click');
  press(svg, at(2, 2));
  assert.ok(!container.textContent.includes(t('reticleDesigner.settings.illuminated')), 'no lit flag on an unlit reticle');

  const on = check('reticleDesigner.illumination.enabled');
  on.checked = true;
  fireEvent(on, 'change');
  assert.deepEqual(doc().illumination, { enabled: true, colour: 'red' });
  assert.ok(shown('reticleDesigner.options.illumination') && check('reticleDesigner.options.illumination').checked);
  assert.ok(classesOf(svg).includes('illum-red'));

  const lit = check('reticleDesigner.settings.illuminated');
  lit.checked = true;
  fireEvent(lit, 'change');
  assert.equal(doc().elements[0].illuminated, true);
  assert.ok(byClass(container, 'reticle-shape').every((n) => classesOf(n).includes('lit')));

  const amber = findAll(container, (n) => n.getAttribute?.('data-colour') === 'amber')[0];
  fireEvent(amber, 'click');
  assert.equal(doc().illumination.colour, 'amber');
  assert.ok(classesOf(svg).includes('illum-amber') && !classesOf(svg).includes('illum-red'));

  const dim = check('reticleDesigner.options.dimField');
  dim.checked = true;
  fireEvent(dim, 'change');
  assert.ok(classesOf(svg).includes('dim'));

  // Show illumination off: drawn black again, the flag kept.
  const show = check('reticleDesigner.options.illumination');
  show.checked = false;
  fireEvent(show, 'change');
  assert.ok(!byClass(container, 'reticle-shape').some((n) => classesOf(n).includes('lit')));
  assert.equal(doc().elements[0].illuminated, true);
  show.checked = true;
  fireEvent(show, 'change');

  // The next element is lit too (last choice remembered).
  fireEvent(toolButton(container, 'circle'), 'click');
  press(svg, at(-4, 4));
  assert.equal(doc().elements[1].illuminated, true);

  // Switching the reticle's illumination off keeps the flags but draws nothing lit; undo brings it back.
  on.checked = false;
  fireEvent(on, 'change');
  assert.equal(doc().illumination.enabled, false);
  assert.ok(doc().elements.every((e) => e.illuminated));
  assert.ok(!byClass(container, 'reticle-shape').some((n) => classesOf(n).includes('lit')));
  assert.ok(!classesOf(svg).includes('dim'));
  assert.ok(!shown('reticleDesigner.options.illumination'));
  fireEvent(findAll(container, (n) => n.tagName === 'BUTTON' && n.textContent === t('reticleDesigner.options.undo'))[0], 'click');
  assert.equal(doc().illumination.enabled, true);
});

test('coordinate fields step by 0.1 mrad / 0.05 MOA; dimensions keep free entry', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'hline'), 'click');
  press(svgOf(container), at(1, 3), at(4, 3));
  for (const key of ['startX', 'startY', 'endX']) {
    assert.equal(inputLabelled(container, `reticleDesigner.params.${key}`).getAttribute('step'), '0.1', key);
  }
  assert.equal(inputLabelled(container, 'reticleDesigner.params.width').getAttribute('step'), 'any');
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(-3, 1));
  press(svgOf(container), at(2, 3), at(2, 3), { shiftKey: true });
  assert.equal(inputLabelled(container, 'reticleDesigner.params.selectionX').getAttribute('step'), '0.1');
  assert.equal(inputLabelled(container, 'reticleDesigner.params.selectionY').getAttribute('step'), '0.1');  state.patchReticleEditor({ units: 'moa' });
  fireEvent(findAll(container, (n) => n.getAttribute?.('data-units') === 'moa')[0], 'click');
  assert.equal(inputLabelled(container, 'reticleDesigner.params.selectionX').getAttribute('step'), '0.05', 'MOA');
});

test('Shift-drag on empty field selects by rectangle, adding to the selection; groups only when whole; a plain drag still pans', () => {
  const container = makeElement('main');
  view.mount(container);
  const svg = svgOf(container);
  const place = (tool, x, y) => { fireEvent(toolButton(container, tool), 'click'); press(svg, at(x, y)); return doc().elements.at(-1).id; };
  const d1 = place('dot', 2, 2);
  const d2 = place('dot', 3, 3);
  const d3 = place('dot', -5, -5);
  const d4 = place('dot', 6, 6);
  const sel = () => state.getReticleSession().editor.selection;
  // Group d3 + d4.
  state.patchReticleEditor({ selection: [d3, d4] });
  fireEvent(findAll(container, (n) => n.tagName === 'BUTTON' && n.textContent === t('reticleDesigner.palette.group'))[0], 'click');
  const g = doc().groups[0].id;
  state.patchReticleEditor({ selection: [] });

  press(svg, at(1, 1), at(4, 4), { shiftKey: true });
  assert.deepEqual(sel(), [d1, d2]);
  assert.equal(byClass(container, 'reticle-marquee')[0].style.display, 'none', 'hidden on release');

  // Takes in d4 only: its group is not whole, so nothing of it is added.
  press(svg, at(5, 5), at(7, 7), { shiftKey: true });
  assert.deepEqual(sel(), [d1, d2]);
  press(svg, at(-6, -6), at(7, 7), { ctrlKey: true });
  assert.deepEqual(sel(), [d1, d2, g], 'added, not replaced');

  // A plain drag on empty field pans and doesn't select.
  const before = state.getReticleSession().editor.view;
  press(svg, at(-8, 8), at(-6, 9));
  assert.notDeepEqual(state.getReticleSession().editor.view, before);
});

test('the selection rectangle never takes in a BDC mark; a group with one counts by its other members', () => {
  const container = makeElement('main');
  view.mount(container);
  const svg = svgOf(container);
  const place = (tool, x, y) => { fireEvent(toolButton(container, tool), 'click'); press(svg, at(x, y)); return doc().elements.at(-1).id; };
  place('bdc', 0, 3);
  const dot = place('dot', 1, 2);
  const grouped = place('dot', -4, -4);
  const groupedMark = place('bdc', 0, 8);
  state.patchReticleEditor({ selection: [grouped, groupedMark] });
  fireEvent(findAll(container, (n) => n.tagName === 'BUTTON' && n.textContent === t('reticleDesigner.palette.group'))[0], 'click');
  const g = doc().groups[0].id;
  state.patchReticleEditor({ selection: [] });
  press(svg, at(-2, 1), at(2, 4), { shiftKey: true });
  assert.deepEqual(state.getReticleSession().editor.selection, [dot], 'the mark at 3 mrad is left out');
  press(svg, at(-5, -5), at(-3, -3), { shiftKey: true });
  assert.deepEqual(state.getReticleSession().editor.selection, [dot, g]);
});

test('scope section: a reference scope by its magnification only, the field assumed from it', () => {
  const container = makeElement('main');
  view.mount(container);
  const scopeBody = () => byClass(container, 'reticle-scope-body')[0];
  const zoomInputs = () => findAll(scopeBody(), (n) => n.tagName === 'INPUT' && n.type === 'number');
  const type = findAll(container, (n) => n.id === 'reticle-scope-type')[0];
  const typeInto = (input, value) => {
    fireEvent(input, 'focus');
    input.value = value;
    fireEvent(input, 'input');
    fireEvent(input, 'blur');
  };
  const rim = () => Number(byClass(container, 'reticle-rim')[0].getAttribute('r'));

  // FFP 5-25x by default: two zoom fields, no field-of-view inputs.
  assert.equal(zoomInputs().length, 2);
  assert.ok(scopeBody().textContent.includes(t('reticleDesigner.scope.referenceHint')));
  typeInto(zoomInputs()[0], '3');
  typeInto(zoomInputs()[1], '20');
  assert.deepEqual(doc().referenceScope, { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 }, 'the calibration zoom follows the top');
  // 3x: 12 m at 100 m, the field circle drawn for it.
  near(visibleFieldRadius(referenceOptics(doc().referenceScope)), Math.atan(0.06), 1e-15);
  assert.equal(rim(), 470);

  // An upside-down range is refused with a message, the last valid one kept.
  const top = zoomInputs()[1];
  fireEvent(top, 'focus');
  top.value = '2';
  fireEvent(top, 'input');
  assert.ok(scopeBody().textContent.includes(t('reticleDesigner.errors.zoomMaxAboveMin')));
  assert.equal(doc().referenceScope.zoomMax, 20);
  fireEvent(top, 'blur');

  // SFP adds the calibration zoom, which must lie in the range.
  type.value = 'sfp';
  fireEvent(type, 'change');
  assert.equal(zoomInputs().length, 3);
  typeInto(zoomInputs()[2], '10');
  assert.equal(doc().referenceScope.calibrationZoom, 10);
  const calibration = zoomInputs()[2];
  fireEvent(calibration, 'focus');
  calibration.value = '30';
  fireEvent(calibration, 'input');
  assert.ok(scopeBody().textContent.includes(t('reticleDesigner.errors.calibrationInRange')));
  fireEvent(calibration, 'blur');

  // Fixed: one magnification, held as both ends; back to variable gets a range above it.
  type.value = 'fixed';
  fireEvent(type, 'change');
  assert.equal(zoomInputs().length, 1);
  typeInto(zoomInputs()[0], '4');
  assert.deepEqual(doc().referenceScope, { type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 });
  type.value = 'ffp';
  fireEvent(type, 'change');
  assert.deepEqual(doc().referenceScope, { type: 'ffp', zoomMin: 4, zoomMax: 20, calibrationZoom: 20 });

  // Every change is an undo step.
  fireEvent(findAll(container, (n) => n.tagName === 'BUTTON' && n.textContent === t('reticleDesigner.options.undo'))[0], 'click');
  assert.equal(doc().referenceScope.type, 'fixed');
});

// ---- the Arsenal ----

const byId = (root, id) => findAll(root, (n) => n.id === id)[0];
function typeIdentity(container, manufacturer, model) {
  for (const [id, value] of [['reticle-manufacturer', manufacturer], ['reticle-model', model]]) {
    const input = byId(container, id);
    input.value = value;
    fireEvent(input, 'input');
  }
}
function withConfirm(answer, fn) {
  const saved = global.confirm;
  const asked = [];
  global.confirm = (message) => { asked.push(message); return answer; };
  try { fn(); } finally { global.confirm = saved; }
  return asked;
}

test('Save to arsenal needs a manufacturer and a model, then saves the reticle there and stays bound to it', () => {
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  fireEvent(byId(container, 'reticle-save'), 'click');
  assert.ok(container.textContent.includes(t('reticleDesigner.file.identityRequired')));
  assert.deepEqual(reticleLibrary.loadUserReticles(), []);
  assert.equal(state.hasUnsavedReticleChanges(), true);

  typeIdentity(container, 'Acme', 'Dot');
  fireEvent(byId(container, 'reticle-save'), 'click');
  const [saved] = reticleLibrary.loadUserReticles();
  assert.equal(saved.name, 'Acme Dot');
  assert.equal(saved.elements.length, 1);
  assert.deepEqual(saved.referenceScope, doc().referenceScope);
  assert.equal(state.getReticleTarget().reticleId, saved.id);
  assert.equal(state.hasUnsavedReticleChanges(), false);
  assert.ok(container.textContent.includes(t('reticleDesigner.file.saved')));
  assert.equal(global.location.hash, '#/reticle-designer', 'not opened from the Arsenal: stays');

  // Saving again updates the same reticle.
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(2, 2));
  fireEvent(byId(container, 'reticle-save'), 'click');
  assert.equal(reticleLibrary.loadUserReticles().length, 1);
  assert.equal(reticleLibrary.loadUserReticles()[0].elements.length, 2);
  assert.equal(reticleLibrary.loadUserReticles()[0].revision, 2);
});

test('saving under another reticle\'s name asks, and replaces that one, keeping its id', () => {
  const other = reticleLibrary.saveUserReticle({ ...state.getReticleSession().history.present, id: 'user-reticle-other', manufacturer: 'Acme', model: 'Dot' });
  const container = makeElement('main');
  view.mount(container);
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  typeIdentity(container, 'acme', 'dot ');
  const declined = withConfirm(false, () => fireEvent(byId(container, 'reticle-save'), 'click'));
  assert.equal(declined.length, 1);
  assert.equal(reticleLibrary.getUserReticle(other.id).elements.length, 0, 'declined: untouched');
  withConfirm(true, () => fireEvent(byId(container, 'reticle-save'), 'click'));
  assert.equal(reticleLibrary.loadUserReticles().length, 1);
  assert.equal(reticleLibrary.getUserReticle(other.id).elements.length, 1);
  assert.equal(state.getReticleTarget().reticleId, other.id);
});

test('opened from the Arsenal: Save goes back to its Scopes tab; Discard reverts to the saved reticle and goes back too', () => {
  const saved = reticleLibrary.saveUserReticle({ ...state.getReticleSession().history.present, id: 'user-reticle-1', manufacturer: 'Acme', model: 'Dot' });
  state.openReticle(saved, { fromArsenal: true });
  const container = makeElement('main');
  view.mount(container);
  assert.equal(byId(container, 'reticle-model').value, 'Dot');
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));

  // Discard: asked, back to the saved (empty) reticle, then to the Arsenal.
  const asked = withConfirm(true, () => fireEvent(byId(container, 'reticle-discard'), 'click'));
  assert.equal(asked.length, 1);
  assert.equal(doc().elements.length, 0);
  assert.equal(state.hasUnsavedReticleChanges(), false);
  assert.equal(global.location.hash, '#/guns/arsenal');
  assert.equal(takePendingArsenalTab(), 'scopes');
  assert.equal(state.getReticleTarget().fromArsenal, false, 'back once; a later visit stays');

  // Save: back to the Arsenal as well.
  state.openReticle(reticleLibrary.getUserReticle(saved.id), { fromArsenal: true });
  global.location.hash = '#/reticle-designer';
  const again = makeElement('main');
  view.mount(again);
  fireEvent(toolButton(again, 'dot'), 'click');
  press(svgOf(again), at(1, 1));
  fireEvent(byId(again, 'reticle-save'), 'click');
  assert.equal(reticleLibrary.getUserReticle(saved.id).elements.length, 1);
  assert.equal(global.location.hash, '#/guns/arsenal');
  assert.equal(takePendingArsenalTab(), 'scopes');
});

test('Discard changes on a reticle never saved empties it; with nothing to discard and nowhere to go back to, it is off', () => {
  const container = makeElement('main');
  view.mount(container);
  const discard = byId(container, 'reticle-discard');
  assert.equal(discard.disabled, true);
  fireEvent(toolButton(container, 'dot'), 'click');
  press(svgOf(container), at(1, 1));
  assert.equal(discard.disabled, false);
  withConfirm(false, () => fireEvent(discard, 'click'));
  assert.equal(doc().elements.length, 1, 'declined');
  withConfirm(true, () => fireEvent(discard, 'click'));
  assert.equal(doc().elements.length, 0);
  assert.equal(state.getReticleSession().history.past.length, 0);
});

test('the manufacturer and model are undo steps, and follow an undo in their fields', () => {
  const container = makeElement('main');
  view.mount(container);
  typeIdentity(container, 'Acme', 'Dot');
  assert.equal(doc().manufacturer, 'Acme');
  fireEvent(buttonText(container, 'reticleDesigner.options.undo'), 'click');
  assert.equal(doc().model, '');
  assert.equal(byId(container, 'reticle-model').value, '');
});

test('the reticle manufacturer suggests optics makers; picking one sets it as an undo step', async () => {
  const container = makeElement('main');
  view.mount(container);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const input = byId(container, 'reticle-manufacturer');
  fireEvent(input, 'focus');
  const list = byClass(container, 'field-suggest-list')[0];
  const row = list.childNodes.find((r) => r.textContent === 'Schmidt & Bender');
  assert.ok(row);
  fireEvent(row, 'mousedown');
  assert.equal(doc().manufacturer, 'Schmidt & Bender');
  fireEvent(buttonText(container, 'reticleDesigner.options.undo'), 'click');
  assert.equal(doc().manufacturer, '');
});
