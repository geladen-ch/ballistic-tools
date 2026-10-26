// The "Import SVG shape" panel: an SVG file or pasted SVG code is read by
// the import worker (reticle/svg-import/client.js) and, if accepted,
// previewed with what was found and anything drawn differently from the
// original; Insert adds it to the reticle with its origin at zero. A
// refused or failed import only shows its reason — nothing reaches the
// reticle, and the app never waits on it for more than the import's
// timeout.
import { el, clear } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { importSvg } from '../../reticle/svg-import/client.js';
import { LIMITS } from '../../reticle/svg-import/extract.js';
import { shapePathNodes } from './shape-paths.js';

const PREVIEW_SIZE = 200;
const PREVIEW_MARGIN = 10;

export function svgImportPanel(ctl) {
  let pending = 0;
  let result = null; // { shape, name } once a file or paste is accepted

  const fileInput = el('input', { type: 'file', accept: '.svg,image/svg+xml', id: 'reticle-svg-file' });
  const textArea = el('textarea', { id: 'reticle-svg-text', rows: '5', spellcheck: 'false', placeholder: t('reticleDesigner.svg.pastePlaceholder') });
  const readButton = el('button', { type: 'button', class: 'secondary', i18n: 'reticleDesigner.svg.read' });
  const status = el('p', { class: 'reticle-svg-status', role: 'status' });
  const preview = el('div', { class: 'reticle-svg-preview' });
  const insertButton = el('button', { type: 'button', i18n: 'reticleDesigner.svg.insert' });
  const cancelButton = el('button', { type: 'button', class: 'secondary', i18n: 'reticleDesigner.svg.cancel' });

  const node = el('section', { class: 'card reticle-svg-import', 'aria-labelledby': 'reticle-svg-heading' }, [
    el('h2', { id: 'reticle-svg-heading', i18n: 'reticleDesigner.svg.title' }),
    el('p', { class: 'hint', i18n: 'reticleDesigner.svg.intro' }),
    el('label', { class: 'reticle-field', for: 'reticle-svg-file' }, [
      el('span', { class: 'reticle-field-label', i18n: 'reticleDesigner.svg.chooseFile' }),
      fileInput
    ]),
    el('label', { class: 'reticle-field', for: 'reticle-svg-text' }, [
      el('span', { class: 'reticle-field-label', i18n: 'reticleDesigner.svg.pasteLabel' }),
      textArea
    ]),
    el('div', { class: 'reticle-svg-actions' }, [readButton]),
    status,
    preview,
    el('div', { class: 'reticle-svg-actions' }, [insertButton, cancelButton])
  ]);
  node.style.display = 'none';

  function showStatus(text, kind = '') {
    status.textContent = text;
    status.className = `reticle-svg-status ${kind}`.trim();
  }

  function reset() {
    pending += 1;
    result = null;
    textArea.value = '';
    fileInput.value = '';
    clear(preview);
    showStatus('');
    insertButton.disabled = true;
  }

  function renderPreview(shape) {
    clear(preview);
    const [x0, y0, x1, y1] = shape.bounds;
    const side = Math.max(x1 - x0, y1 - y0) || 1;
    const size = (PREVIEW_SIZE - 2 * PREVIEW_MARGIN) / side;
    const ox = PREVIEW_MARGIN + ((PREVIEW_SIZE - 2 * PREVIEW_MARGIN) - (x1 - x0) * size) / 2 - x0 * size;
    const oy = PREVIEW_MARGIN + ((PREVIEW_SIZE - 2 * PREVIEW_MARGIN) - (y1 - y0) * size) / 2 - y0 * size;
    preview.appendChild(svgEl('svg', { viewBox: `0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`, class: 'reticle-svg-preview-canvas', role: 'img', 'aria-label': t('reticleDesigner.svg.previewLabel') },
      shapePathNodes(shape.paths, { x: ox, y: oy, size, className: 'reticle-shape', minStroke: 1 })));
  }

  async function read(text, name) {
    const token = ++pending;
    result = null;
    insertButton.disabled = true;
    clear(preview);
    showStatus(t('reticleDesigner.svg.reading'));
    const outcome = await importSvg(text);
    if (token !== pending) return; // superseded or cancelled meanwhile
    if (!outcome.ok) {
      const key = `reticleDesigner.svg.errors.${outcome.code}`;
      const message = t(key, outcome.detail || {});
      showStatus(message === key ? t('reticleDesigner.svg.errors.unexpected') : message, 'error');
      return;
    }
    result = { shape: outcome.shape, name };
    renderPreview(outcome.shape);
    const lines = [t('reticleDesigner.svg.summary', { paths: outcome.shape.paths.length, segments: outcome.shape.segments })];
    for (const warning of outcome.shape.warnings || []) lines.push(t(`reticleDesigner.svg.warnings.${warning}`));
    showStatus(lines.join(' '), outcome.shape.warnings?.length ? 'warning' : 'ok');
    insertButton.disabled = false;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > LIMITS.maxChars) {
      pending += 1;
      showStatus(t('reticleDesigner.svg.errors.tooLarge'), 'error');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      showStatus(t('reticleDesigner.svg.errors.unexpected'), 'error');
      return;
    }
    textArea.value = '';
    read(text, String(file.name || '').replace(/\.svg$/i, ''));
  });
  readButton.addEventListener('click', () => read(textArea.value, ''));
  insertButton.addEventListener('click', () => {
    if (!result) return;
    const id = ctl.placeSvg(result.shape, result.name);
    if (!id) {
      showStatus(t('reticleDesigner.svg.errors.badShape'), 'error');
      return;
    }
    close();
  });
  cancelButton.addEventListener('click', () => close());

  function open() {
    reset();
    node.style.display = '';
    node.scrollIntoView?.({ block: 'nearest' });
  }

  function close() {
    reset();
    node.style.display = 'none';
  }

  return { node, open, close, read };
}
