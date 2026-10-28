// The "Insert whole reticle" panel: the user's Arsenal reticles and the
// built-in ones, each with its thumbnail, to pick one whose elements are
// added to the reticle where they are (controller.js's insertReticle).
// The built-in reticles load in the background the first time the panel
// opens; damaged Arsenal reticles aren't offered. A reticle drawn for
// another kind of scope, or an SFP one calibrated at another zoom, gets a
// note that its subtensions go in unchanged.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { loadUserReticles } from '../../reticle-library.js';
import { loadBuiltInReticles } from '../../reticles.js';
import { reticleThumbnail } from '../reticle-thumbnail.js';

const THUMBNAIL_SIZE = 64;
const ZOOM_TOLERANCE = 1e-6;

// Whether the same subtensions mean something different under `target`.
function scopeDiffers(source, target) {
  if (source.type !== target.type) return true;
  if (source.type !== 'sfp') return false;
  return Math.abs(source.calibrationZoom - target.calibrationZoom) > ZOOM_TOLERANCE * target.calibrationZoom;
}

export function libraryInsertPanel(ctl, { loadArsenal = loadUserReticles, loadBuiltIn = loadBuiltInReticles } = {}) {
  let builtIn = null; // null until loaded
  let builtInPromise = null;
  let chosen = null;
  let byId = new Map();

  const list = el('div', { class: 'reticle-library-choices', role: 'radiogroup', 'aria-labelledby': 'reticle-library-heading' });
  const scopeHint = el('p', { class: 'hint', i18n: 'reticleDesigner.library.scopeDiffers' });
  const insertButton = el('button', { type: 'button', i18n: 'reticleDesigner.library.insert' });
  const cancelButton = el('button', { type: 'button', class: 'secondary', i18n: 'reticleDesigner.library.cancel' });

  const node = el('section', { class: 'card reticle-library-insert', 'aria-labelledby': 'reticle-library-heading' }, [
    el('h2', { id: 'reticle-library-heading', i18n: 'reticleDesigner.library.title' }),
    el('p', { class: 'hint', i18n: 'reticleDesigner.library.intro' }),
    list,
    scopeHint,
    el('div', { class: 'reticle-svg-actions' }, [insertButton, cancelButton])
  ]);
  node.style.display = 'none';

  function refreshChoice() {
    const reticle = byId.get(chosen);
    insertButton.disabled = !reticle;
    scopeHint.style.display = reticle && scopeDiffers(reticle.referenceScope, ctl.doc.referenceScope) ? '' : 'none';
  }

  function row(reticle) {
    const radio = el('input', { type: 'radio', name: 'reticle-library-choice', id: `reticle-library-${reticle.id}`, value: reticle.id });
    radio.checked = reticle.id === chosen;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      chosen = reticle.id;
      refreshChoice();
    });
    return el('label', { class: 'checkbox-field reticle-library-choice', for: radio.id }, [
      radio,
      reticleThumbnail(reticle, { size: THUMBNAIL_SIZE, label: reticle.name }),
      el('span', { text: reticle.name })
    ]);
  }

  function render() {
    clear(list);
    const arsenal = loadArsenal().filter((r) => !r.damaged && r.elements.length > 0);
    const builtInList = builtIn || [];
    byId = new Map([...arsenal, ...builtInList].map((r) => [r.id, r]));
    if (!byId.has(chosen)) chosen = null;
    const groups = [['reticleDesigner.library.yours', arsenal], ['reticleDesigner.library.builtIn', builtInList]];
    for (const [headingKey, reticles] of groups) {
      if (reticles.length === 0) continue;
      list.appendChild(el('div', { class: 'hint reticle-library-group', i18n: headingKey }));
      for (const reticle of reticles) list.appendChild(row(reticle));
    }
    if (builtIn === null) list.appendChild(el('p', { class: 'hint', i18n: 'reticleDesigner.library.loading' }));
    else if (byId.size === 0) list.appendChild(el('p', { class: 'hint', i18n: 'reticleDesigner.library.none' }));
    refreshChoice();
  }

  // Built-in reticles that fail to load are left out (loadBuiltInReticles);
  // a failure of the whole lot leaves just the Arsenal's.
  function ensureBuiltIn() {
    if (!builtInPromise) {
      builtInPromise = Promise.resolve().then(loadBuiltIn).catch(() => []).then((reticles) => {
        builtIn = reticles;
        if (node.style.display !== 'none') render();
      });
    }
    return builtInPromise;
  }

  insertButton.addEventListener('click', () => {
    const reticle = byId.get(chosen);
    if (!reticle) return;
    ctl.insertReticle(reticle);
    close();
  });
  cancelButton.addEventListener('click', () => close());

  function open() {
    chosen = null;
    node.style.display = '';
    render();
    ensureBuiltIn();
    node.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  function close() {
    chosen = null;
    clear(list);
    node.style.display = 'none';
  }

  // The scope hint follows the reticle's own scope while the panel is open.
  function update() {
    if (node.style.display !== 'none') refreshChoice();
  }

  return { node, open, close, update, ready: ensureBuiltIn };
}
