// The printable card as a PDF: the paper format's template with its labels
// translated, its values filled in and its three boxes (table, reticle,
// photo) filled with generated content, rendered by buildTemplatePdf().
//
// One entry per paper format: its template and the geometry the
// generated content is drawn to. A4 and Letter share one layout (the
// content area both pages hold, centred); further formats get their own
// template and entry.
import { buildTemplatePdf, createTextMeasurer } from '../pdf/template-pdf.js';
import { tableSvg } from './table-svg.js';
import { notesSvg, photoSvg } from './photo-svg.js';
import { SLOPE_ANGLES_DEG } from './card-data.js';

const FULL_PAGE_LAYOUT = {
  slots: { table: { widthMm: 190, heightMm: 104.4 }, reticle: { widthMm: 72.45, heightMm: 72.45 }, photo: { widthMm: 113.55, heightMm: 72.45 } },
  // The rifle box's inner width, and where a free-text value that doesn't
  // fit starts (after the longest translation of its label), in mm.
  rifleBox: { innerMm: 89, freeStartMm: 16.2, labelSizeMm: 2.6, valueSizeMm: 2.9, gapMm: 1.5 }
};

export const PAPER_FORMATS = {
  a4: { templateUrl: new URL('./printable-card-a4-pdf-template.svg', import.meta.url), ...FULL_PAGE_LAYOUT },
  letter: { templateUrl: new URL('./printable-card-letter-pdf-template.svg', import.meta.url), ...FULL_PAGE_LAYOUT }
};

// The template's fixed text (English, as authored) and the i18n key that
// translates it. Headings are written in capitals.
export const TEMPLATE_TEXT = [
  ['RIFLE AND CARTRIDGE', 'printableCard.pdf.rifleAndCartridge', true],
  ['REFERENCE CONDITIONS', 'printableCard.pdf.referenceConditions', true],
  ['CORRECTIONS', 'printableCard.pdf.corrections', true],
  ['Peaceful. Precise. Armed.', 'app.tagline'],
  ['Computed values. Confirm on the range before relying on them.', 'printableCard.pdf.disclaimer'],
  ['Scope click (vert. · horiz.)', 'printableCard.pdf.scopeClick'],
  ['Zero · sight height', 'printableCard.pdf.zeroSightHeight'],
  ['Ballistic coefficient', 'printableCard.pdf.ballisticCoefficient'],
  ['Muzzle velocity', 'printableCard.pdf.muzzleVelocity'],
  ['Velocity change', 'printableCard.pdf.velocityChange'],
  ['Crosswind speed', 'printableCard.pdf.crosswindSpeed'],
  ['Correction unit', 'printableCard.pdf.correctionUnit'],
  ['Distance unit', 'printableCard.pdf.distanceUnit'],
  ['Temperature', 'printableCard.pdf.temperature'],
  ['Shot angle', 'printableCard.pdf.shotAngle'],
  ['Range card', 'printableCard.pdf.rangeCard'],
  ['Cartridge', 'printableCard.pdf.cartridge'],
  ['Altitude', 'printableCard.pdf.altitude'],
  ['Pressure', 'printableCard.pdf.pressure'],
  ['Humidity', 'printableCard.pdf.humidity'],
  ['Bullet', 'printableCard.pdf.bullet'],
  ['Rifle', 'printableCard.pdf.rifle']
];

// The rows of the rifle box whose values are free text: their label's
// i18n key and placeholder.
const FREE_TEXT_ROWS = [
  ['rifle', 'printableCard.pdf.rifle'],
  ['cartridge', 'printableCard.pdf.cartridge'],
  ['bullet', 'printableCard.pdf.bullet']
];

const FACES = [
  { family: 'Overpass', weight: 400, style: 'normal' },
  { family: 'Overpass', weight: 700, style: 'normal' }
];

let measurer = null;
function textMeasurer() {
  measurer ??= createTextMeasurer(FACES);
  measurer.catch(() => { measurer = null; });
  return measurer;
}

// The template text pairs, longest English first, so no pair can hit
// another's translation; then the values. `t`: the translator; `lang`.
export function labelPairs(t, lang) {
  return [...TEMPLATE_TEXT]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([english, key, caps]) => [english, caps ? t(key).toLocaleUpperCase(lang || undefined) : t(key)]);
}

// Which of a free-text row's two placeholders takes the value: the
// right-aligned one when label and value fit side by side, else the
// clipped one that starts after the label.
export function freeTextPairs({ values, labels, measure, rifleBox }) {
  const pairs = [];
  for (const [key, labelKey] of FREE_TEXT_ROWS) {
    const value = values[key] ?? '';
    const labelW = measure(labels[labelKey], { family: 'Overpass', weight: 400 }, rifleBox.labelSizeMm);
    const valueW = measure(value, { family: 'Overpass', weight: 700 }, rifleBox.valueSizeMm);
    const fits = labelW + rifleBox.gapMm + valueW <= rifleBox.innerMm;
    pairs.push([`[${key} (long)]`, fits ? '' : value], [`[${key}]`, fits ? value : '']);
  }
  return pairs;
}

// `card`: {
//   paper, lang, t,
//   values: { cardTitle, date, rifle, cartridge, bullet, muzzleVelocity,
//     velocityChange, ballisticCoefficient, zero, sightHeight,
//     clickVertical, clickHorizontal, altitude, pressure, temperature,
//     humidity, shotAngle, distanceUnit, correctionUnit,
//     crosswindSpeed, tableNote, appLink, version },
//   table: { rows, spin, slope, temperature, labels },
//   reticle: { heading, content, viewBox } | null,
//   photo: { heading, photo, targets } | null,
//   notesHeading
// }
export async function buildCardPdf(card) {
  const format = PAPER_FORMATS[card.paper] || PAPER_FORMATS.a4;
  const { t, lang, values } = card;
  const measure = await textMeasurer();
  const labels = Object.fromEntries(FREE_TEXT_ROWS.map(([, key]) => [key, t(key)]));
  const notesHeading = card.notesHeading.toLocaleUpperCase(lang || undefined);

  const valuePairs = [
    ...freeTextPairs({ values, labels, measure, rifleBox: format.rifleBox }),
    ['[card title]', values.cardTitle],
    ['[date]', values.date],
    ['[muzzle velocity]', values.muzzleVelocity],
    ['[velocity change]', values.velocityChange],
    ['[ballistic coefficient]', values.ballisticCoefficient],
    ['[zero]', values.zero],
    ['[sight height]', values.sightHeight],
    ['[click vertical]', values.clickVertical],
    ['[click horizontal]', values.clickHorizontal],
    ['[altitude]', values.altitude],
    ['[pressure]', values.pressure],
    ['[temperature]', values.temperature],
    ['[humidity]', values.humidity],
    ['[shot angle]', values.shotAngle],
    ['[distance unit]', values.distanceUnit],
    ['[correction unit]', values.correctionUnit],
    ['[crosswind speed]', values.crosswindSpeed],
    ['[table note]', values.tableNote],
    ['[corrections table]', ''],
    ['[reticle]', ''],
    ['[target photo]', ''],
    ['[reticle heading]', card.reticle ? card.reticle.heading.toLocaleUpperCase(lang || undefined) : notesHeading],
    ['[targets heading]', card.photo ? card.photo.heading.toLocaleUpperCase(lang || undefined) : notesHeading],
    ['[app link]', values.appLink],
    ['[version]', values.version]
  ];

  const { slots: geometry } = format;
  const slots = [{
    id: 'table', mode: 'clip',
    content: tableSvg({ ...card.table, slopeAngles: SLOPE_ANGLES_DEG, widthMm: geometry.table.widthMm, heightMm: geometry.table.heightMm, measure })
  }];
  slots.push(card.reticle
    ? { id: 'reticle', mode: 'fit', content: card.reticle.content, viewBox: card.reticle.viewBox }
    : { id: 'reticle', mode: 'clip', content: notesSvg(geometry.reticle) });
  slots.push(card.photo
    ? { id: 'photo', mode: 'clip', content: photoSvg({ photo: card.photo.photo, targets: card.photo.targets, ...geometry.photo }) }
    : { id: 'photo', mode: 'clip', content: notesSvg(geometry.photo) });

  return buildTemplatePdf([{
    templateUrl: format.templateUrl,
    replacements: [...labelPairs(t, lang), ...valuePairs],
    slots
  }], { title: values.cardTitle, lang });
}
