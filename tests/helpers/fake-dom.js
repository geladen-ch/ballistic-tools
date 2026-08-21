// Minimal DOM shim so view modules (written for a real browser) can be
// mounted and exercised under Node's test runner, since no browser is
// available in this environment. Deliberately just enough surface for
// src/dom.js's el()/clear() and the view modules — not a general jsdom
// replacement.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const canvasContext = {
  clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  arc() {}, fill() {}, strokeStyle: '', fillStyle: '', lineWidth: 1
};

function makeElement(tag) {
  let leafText = '';
  const node = {
    tagName: tag.toUpperCase(),
    attributes: {},
    childNodes: [],
    parentNode: null,
    _listeners: {},
    id: '',
    value: '',
    disabled: false,
    className: '',
    // Plain property assignment (style.transform = '...') already worked
    // as a bare object; these three methods are only for CSS custom
    // properties (--foo), which real browsers require setProperty()/
    // getPropertyValue() for — direct dot/bracket assignment is a no-op
    // on a real CSSStyleDeclaration for those (see photo-viewport.js's
    // own --marker-scale-compensation).
    style: {
      setProperty(prop, value) { this[prop] = value; },
      removeProperty(prop) { const value = this[prop]; delete this[prop]; return value ?? ''; },
      getPropertyValue(prop) { return this[prop] ?? ''; }
    },
    get firstChild() { return this.childNodes[0] || null; },
    // Real textContent recursively concatenates descendant text; a flat
    // property would go stale the moment children are appended after it
    // (e.g. a <th> built from an i18n <span> plus a plain unit-suffix
    // text node — neither child's text would ever surface).
    get textContent() {
      if (this.childNodes.length === 0) return leafText;
      return this.childNodes.map((c) => c.textContent || '').join('');
    },
    set textContent(v) {
      leafText = v;
      this.childNodes = [];
    },
    setAttribute(key, val) {
      // Real HTMLInputElement reflects min/max/step/value/id/type as live
      // IDL properties, not just content attributes — mirror that here
      // since view code reads e.g. `input.step` directly.
      this.attributes[key] = String(val);
      this[key] = String(val);
    },
    getAttribute(key) { return this.attributes[key] ?? null; },
    // Chartist sets a couple of namespaced attributes (xmlns:ct etc.) on
    // the root <svg> — the namespace itself isn't meaningful here, so this
    // just reuses the plain setAttribute storage, keyed by the local name.
    setAttributeNS(ns, key, val) { this.setAttribute(key, val); },
    appendChild(child) {
      child.parentNode = this;
      // Real <select> defaults its value to the first <option> when
      // nothing has been explicitly selected yet — several views rely on
      // this instead of setting an initial value themselves. Checked
      // *before* pushing (i.e. "is an OPTION already among my children"),
      // not by inferring "not yet chosen" from `this.value === ''` — a
      // legitimate blank-value placeholder option (bullet-form.js's
      // required caliber select) has value '' too, and inferring from
      // that would keep "defaulting" through it onto the *second* option
      // instead of correctly stopping at the first.
      const isFirstOption = this.tagName === 'SELECT' && child.tagName === 'OPTION'
        && !this.childNodes.some((c) => c.tagName === 'OPTION');
      this.childNodes.push(child);
      if (isFirstOption) this.value = child.attributes.value ?? '';
      return child;
    },
    removeChild(child) {
      this.childNodes = this.childNodes.filter((c) => c !== child);
      return child;
    },
    addEventListener(type, handler) {
      (this._listeners[type] ||= []).push(handler);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    // A detached download-triggering <a> (see arsenal-view.js's
    // downloadJsonFile) is never appended anywhere in this shim and has
    // no click listeners of its own to dispatch to — just needs to exist
    // so calling it doesn't throw, matching every real HTMLElement.
    click() {},
    // Layout is meaningless under this shim (nothing is ever actually
    // rendered) — just needs to exist so arsenal-view.js's "scroll the
    // newly-opened form into view" calls don't throw.
    scrollIntoView() {}
  };
  if (tag === 'canvas') node.getContext = () => canvasContext;
  if (tag === 'option') {
    Object.defineProperty(node, 'text', {
      get() { return node.textContent; },
      set(v) { node.textContent = v; }
    });
  }
  return node;
}

export function fireEvent(node, type, extra = {}) {
  for (const handler of node._listeners[type] || []) handler({ target: node, preventDefault() {}, ...extra });
}

export function installFakeDom() {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
  // Defaults to "confirmed" — tests that need to exercise the cancel path
  // override this per-test (e.g. `global.confirm = () => false;`).
  global.confirm = () => true;
  const cookieJar = new Map();
  global.document = {
    createElement: makeElement,
    // Chartist (src/vendor/chartist/) builds every chart element through
    // this — SVG elements have to come from createElementNS, not
    // createElement, in a real browser. The namespace URI itself doesn't
    // matter to this shim; it's just routed to the same generic element
    // factory as everything else.
    createElementNS: (ns, tag) => makeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text, parentNode: null }),
    getElementById: () => null,
    querySelectorAll: () => [], // nothing is attached to this fake `document` tree in tests
    documentElement: { lang: '' },
    title: '',
    visibilityState: 'visible',
    // Range Solver's wake-lock re-request listens for this (see
    // range-solver-view.js) — same no-op-stub posture as global.window's
    // own addEventListener/removeEventListener below, just enough surface
    // that real code calling it doesn't throw in this shim.
    addEventListener() {},
    removeEventListener() {},
    // Mimics the real document.cookie accessor: writes are one
    // "name=value; attr; attr" string at a time (max-age<=0 deletes),
    // reads return every stored cookie joined as "name=value; name2=...".
    get cookie() {
      return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(cookieString) {
      const [pair, ...attrs] = cookieString.split(';').map((s) => s.trim());
      const eqIdx = pair.indexOf('=');
      const name = pair.slice(0, eqIdx);
      const value = pair.slice(eqIdx + 1);
      const maxAgeAttr = attrs.find((a) => a.toLowerCase().startsWith('max-age='));
      const maxAge = maxAgeAttr ? parseInt(maxAgeAttr.split('=')[1], 10) : null;
      if (maxAge !== null && maxAge <= 0) cookieJar.delete(name);
      else cookieJar.set(name, value);
    }
  };
  global.location = { protocol: 'https:' };
  global.requestAnimationFrame = (cb) => cb();
  // hit-probability-view.js reads a few theme colors via getComputedStyle
  // (see its own cssVar() helper) — there's no real CSS engine here (see
  // this file's own module comment), so every custom property just reads
  // back empty; nothing in this suite asserts on the resulting fill/stroke
  // values, only that the illustration's elements get created at all.
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  // Chartist unconditionally checks for window.matchMedia on every chart's
  // initialize() (even with no responsive options configured) and
  // registers a resize listener — neither is meaningful in this shim, but
  // both have to exist or Chartist throws before it ever draws anything.
  global.window = {
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  };
  // Chartist branches on `name instanceof Element` to tell "wrap this
  // existing element" apart from "create a new one by tag name" — our
  // fake elements are plain objects, never real Element instances, so an
  // empty stand-in class is enough to always take the "create new" path
  // (the only one this app's usage ever exercises) instead of throwing on
  // the bare reference.
  global.Element = class Element {};
  // Node >=21 already defines a read-only global `navigator` — redefine
  // the property itself rather than assigning into it.
  Object.defineProperty(global, 'navigator', { value: { hardwareConcurrency: 2, languages: ['en-US'] }, configurable: true });
  global.Worker = class FakeWorker {
    postMessage() {} // never responds — fine for synchronous mount-time assertions
    terminate() {}
  };
  // src/i18n.js fetches locale JSON via `new URL(..., import.meta.url)`,
  // which resolves to a file:// URL — Node's built-in fetch (undici)
  // doesn't support file:// at all, so serve those requests from disk
  // instead of trying to stub the whole fetch surface.
  global.fetch = async (input) => {
    const url = input instanceof URL ? input : new URL(input);
    if (url.protocol !== 'file:') throw new Error('fetch stub only supports file:// URLs, got ' + url);
    const text = await readFile(fileURLToPath(url), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  };
}

export { makeElement };
