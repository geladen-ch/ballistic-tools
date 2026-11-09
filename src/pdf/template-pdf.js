// PDF documents from SVG templates: one template per page, with strings
// replaced by values and generated SVG placed into named boxes. Rendering
// is jsPDF + svg2pdf.js (vendored); the rules a template and a font must
// follow are in tools/pdf-templates/README.md.
//
//   const bytes = await buildTemplatePdf([{
//     templateUrl: new URL('./range-card-pdf-template.svg', import.meta.url),
//     replacements: [['[RANGE]', '1000 m']],
//     slots: [{ id: 'chart', content: svgMarkup, mode: 'fit', viewBox: [0, 0, 400, 300] }]
//   }], { title: 'Range card', lang: 'de', translate: (key) => t(key) });
//
// A template's fixed text is i18n keys, `{rangeCard.distance}` (or
// `{key|upper}` for capitals), translated by `translate` before the
// replacements are applied, so a value is never read as a key.
//   downloadFile('range-card.pdf', bytes, 'application/pdf');
//
// Everything that would make the PDF differ from the template is an error,
// not a silent fallback: a string that matches nowhere on its page, a face
// that is not registered, a character the face lacks, pages of different
// sizes. These are template or asset bugs, so the messages are for the
// developer and are not translated.
import { styleKey, resolveFaces, missingCharacters, describeCharacters } from './font-style.js';
import { findFace, describeFace, loadFaceBinary, ensureDocumentFace } from './font-registry.js';
import { pageSizeM, sameSize } from './page-size.js';
import { validatePairs } from './text-replace.js';
import { parseSvg, applyTranslations, applyReplacements, fillSlot, faceTree } from './template-dom.js';
import { mToPoint } from '../quantity.js';

const CREATOR = 'geladen.ch ballistics';

export class TemplatePdfError extends Error {
  constructor(problems) {
    super(problems.length === 1 ? problems[0] : `${problems.length} problems:\n- ${problems.join('\n- ')}`);
    this.name = 'TemplatePdfError';
    this.problems = problems;
  }
}

// jsPDF and svg2pdf.js are about 0.5 MB of script, so they are only
// evaluated when a PDF is first made. Both are UMD builds that attach to
// globalThis; svg2pdf.js needs jsPDF in place first.
let renderer;
function loadRenderer() {
  renderer ??= (async () => {
    await import('../vendor/jspdf/jspdf.umd.min.js');
    await import('../vendor/svg2pdf/svg2pdf.umd.min.js');
    const { jsPDF } = globalThis.jspdf;
    if (typeof jsPDF?.API?.svg !== 'function') throw new Error('svg2pdf.js did not register with jsPDF');
    return jsPDF;
  })();
  renderer.catch(() => { renderer = undefined; });
  return renderer;
}

const templateTexts = new Map();
function loadTemplateText(url) {
  const key = String(url);
  let p = templateTexts.get(key);
  if (!p) {
    // 'no-cache': always revalidate with the server. A host that sends no
    // Cache-Control lets the browser reuse a stale template from its HTTP
    // cache heuristically, and a template that no longer matches the code
    // filling it prints its placeholders. (Offline, the service worker
    // still answers from its own cache.)
    p = fetch(url, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`${templateLabel(url)}: HTTP ${res.status}`);
      return res.text();
    });
    p.catch(() => templateTexts.delete(key));
    templateTexts.set(key, p);
  }
  return p;
}

function templateLabel(url) {
  return String(url).split('/').pop();
}

// Prepares one page: parse, replace, fill slots, read the page size.
// Returns the SVG root plus the problems found, without throwing for them,
// so one call reports every problem of every page at once.
async function preparePage(page, index, { translate, lang }) {
  const problems = [];
  const label = `page ${index + 1} (${templateLabel(page.templateUrl)})`;
  const svg = parseSvg(await loadTemplateText(page.templateUrl), label);
  for (const key of applyTranslations(svg, translate, lang)) {
    problems.push(`${label}: no translation for "{${key}}"${translate ? '' : ' (no translate function given)'}`);
  }
  const pairs = page.replacements ?? [];
  validatePairs(pairs);
  const matched = applyReplacements(svg, pairs);
  pairs.forEach(([from], i) => {
    if (!matched.has(i)) {
      problems.push(`${label}: "${from}" does not occur in any single text node (misspelt, or split across <tspan>s?)`);
    }
  });
  const ids = new Set();
  for (const slot of page.slots ?? []) {
    if (ids.has(slot.id)) problems.push(`${label}: slot "${slot.id}" is filled twice`);
    ids.add(slot.id);
    try { fillSlot(svg, slot, label); } catch (e) { problems.push(e.message); }
  }
  let size = null;
  try { size = pageSizeM(svg.getAttribute('width'), svg.getAttribute('height')); }
  catch (e) { problems.push(`${label}: root ${e.message}`); }
  return { svg, label, size, problems };
}

// Widths of text as the PDF will draw it, from jsPDF's metrics of the
// registered faces. Only for deciding what goes into a template (does a
// value fit, or does it take its clipped variant): never for positioning
// text, which templates do with text-anchor alone. `faces` lists the
// { family, weight, style } to be measured with; the result is
// `width(text, { family, weight, style }, fontSize)` in the units of
// `fontSize`.
export async function createTextMeasurer(faces) {
  const jsPDF = await loadRenderer();
  const pdf = new jsPDF({ unit: 'pt', compress: false, putOnlyUsedFonts: true });
  const registered = new Map();
  for (const { family, weight, style } of faces) {
    const face = findFace(family, weight, style);
    if (!face) throw new TemplatePdfError([`face ${describeFace(family, weight, style)} is not registered`]);
    const key = styleKey(face.weight, face.style);
    if (registered.has(`${family}|${key}`)) continue;
    pdf.addFileToVFS(face.file, await loadFaceBinary(face));
    pdf.addFont(face.file, face.family, key, undefined, 'Identity-H');
    registered.set(`${family}|${key}`, true);
  }
  return (text, { family, weight = 400, style = 'normal' }, fontSize) => {
    if (!text) return 0;
    pdf.setFont(family, styleKey(weight, style));
    return pdf.getStringUnitWidth(String(text)) * fontSize;
  };
}

// `translate(key)`: the text for an i18n key of the templates, or null
// when there is none; `lang`: the document's language (BCP 47).
export async function buildTemplatePdf(pages, { title = '', lang = '', translate = null } = {}) {
  if (!Array.isArray(pages) || !pages.length) throw new TemplatePdfError(['no pages given']);
  const [jsPDF, prepared] = await Promise.all([loadRenderer(), Promise.all(pages.map((p, i) => preparePage(p, i, { translate, lang })))]);
  const problems = prepared.flatMap((p) => p.problems);

  const size = prepared[0].size;
  for (const p of prepared.slice(1)) {
    if (size && p.size && !sameSize(size, p.size)) {
      problems.push(`${p.label}: page size differs from page 1; all pages of one PDF share a size`);
    }
  }

  // Faces: every family-declaring element and every text run must resolve
  // to a registered face.
  const uses = [];
  for (const p of prepared) {
    const r = resolveFaces(faceTree(p.svg, p.label));
    problems.push(...r.errors.map((e) => `${e.label}: ${e.message}`));
    for (const u of r.uses) {
      const face = u.family === null ? null : findFace(u.family, u.weight, u.style);
      if (!face) problems.push(`${u.label}: face ${describeFace(u.family, u.weight, u.style)} is not registered`);
      else uses.push({ ...u, face });
    }
  }
  if (problems.length) throw new TemplatePdfError(problems);

  const widthPt = mToPoint(size.widthM);
  const heightPt = mToPoint(size.heightM);
  // jsPDF swaps a [w, h] format to match the orientation argument, so the
  // orientation has to agree with the template's own proportions.
  const orientation = widthPt > heightPt ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ unit: 'pt', format: [widthPt, heightPt], orientation, compress: true, putOnlyUsedFonts: true });

  // Register only the faces in use, then check every text run against the
  // cmap of the face that will draw it (fixed text and substituted values).
  const faces = [...new Set(uses.map((u) => u.face))];
  const [binaries] = await Promise.all([
    Promise.all(faces.map(loadFaceBinary)),
    Promise.all(faces.map(ensureDocumentFace))
  ]);
  const cmaps = new Map();
  faces.forEach((face, i) => {
    const key = styleKey(face.weight, face.style);
    pdf.addFileToVFS(face.file, binaries[i]);
    pdf.addFont(face.file, face.family, key, undefined, 'Identity-H');
    pdf.setFont(face.family, key);
    const codeMap = pdf.getFont().metadata?.cmap?.unicode?.codeMap;
    if (!codeMap) throw new TemplatePdfError([`font ${face.file}: jsPDF could not read its character map`]);
    cmaps.set(face, codeMap);
  });
  for (const u of uses) {
    const codeMap = cmaps.get(u.face);
    const missing = missingCharacters(u.text, (cp) => Boolean(codeMap[cp]));
    if (missing.length) problems.push(`${u.label}: ${u.face.file} has no glyph for ${describeCharacters(missing)}`);
  }
  if (problems.length) throw new TemplatePdfError(problems);

  // The cmap reads above left jsPDF on the last face registered. svg2pdf.js
  // only passes a style to setFont() where weight or style change, and
  // jsPDF keeps the current style otherwise, so text at the default weight
  // would come out in that face (e.g. everything bold). Start rendering
  // from jsPDF's own normal-style state; no text is drawn with it.
  pdf.setFont('helvetica', 'normal');

  for (const [i, p] of prepared.entries()) {
    if (i) pdf.addPage([widthPt, heightPt], orientation);
    await pdf.svg(p.svg, { x: 0, y: 0, width: widthPt, height: heightPt });
  }
  pdf.setProperties({ title, creator: CREATOR });
  if (lang) pdf.setLanguage(lang);
  return new Uint8Array(pdf.output('arraybuffer'));
}
