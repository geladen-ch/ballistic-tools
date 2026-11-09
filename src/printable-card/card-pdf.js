// The printable card as a PDF: the paper format's templates with their
// i18n keys translated, their values filled in and their boxes (table,
// reticle, photo) filled with generated content, rendered by
// buildTemplatePdf().
//
// One entry per paper format: its pages, each a template and the parts it
// carries (the header with the rifle and cartridge, the corrections
// table, the media: scope view and location photo), and the geometry the
// generated content is drawn to. A4 and Letter share a one-page layout,
// A5 and Half-letter a two-page one (the content area every paper of a
// layout holds, centred).
import { buildTemplatePdf, createTextMeasurer } from '../pdf/template-pdf.js';
import { tableSvg, tableRowCapacity } from './table-svg.js';
import { notesSvg, photoSvg } from './photo-svg.js';
import { SLOPE_ANGLES_DEG } from './card-data.js';

const template = (name) => new URL(`./printable-card-${name}-pdf-template.svg`, import.meta.url);

// `rifleBox`: the info boxes' inner width, and where a free-text value
// that doesn't fit starts (after the longest translation of its label),
// in mm. `photoLegend`: where the photo's target legend goes.
const FULL_PAGE_LAYOUT = {
  slots: { table: { widthMm: 190, heightMm: 123.8 }, reticle: { widthMm: 72.45, heightMm: 72.45 }, photo: { widthMm: 113.55, heightMm: 72.45 } },
  rifleBox: { innerMm: 89, freeStartMm: 16.2, labelSizeMm: 2.6, valueSizeMm: 2.9, gapMm: 1.5 },
  photoLegend: 'right'
};
// Two landscape pages, the header repeated on both: the table on the
// first; on the second the media part, drawn rotated a quarter turn
// (portrait, its top at the page's right edge), the scope view a square
// across its width and the photo below it with the legend underneath.
const HALF_PAGE_LAYOUT = {
  slots: { table: { widthMm: 190, heightMm: 88.95 }, reticle: { widthMm: 93.65, heightMm: 93.65 }, photo: { widthMm: 93.65, heightMm: 82.35 } },
  rifleBox: { innerMm: 89, freeStartMm: 15.2, labelSizeMm: 2.4, valueSizeMm: 2.7, gapMm: 1.4 },
  photoLegend: 'below'
};

const onePage = (name) => [{ templateUrl: template(name), parts: ['header', 'table', 'media'] }];
const twoPages = (name) => [
  { templateUrl: template(`${name}-table`), parts: ['header', 'table'] },
  { templateUrl: template(`${name}-media`), parts: ['header', 'media'] }
];

export const PAPER_FORMATS = {
  a4: { pages: onePage('a4'), ...FULL_PAGE_LAYOUT },
  letter: { pages: onePage('letter'), ...FULL_PAGE_LAYOUT },
  a5: { pages: twoPages('a5'), ...HALF_PAGE_LAYOUT },
  halfLetter: { pages: twoPages('half-letter'), ...HALF_PAGE_LAYOUT }
};

// The most table rows (reference distances and targets together) the
// paper's card holds.
export function paperMaxRows(paper) {
  return tableRowCapacity((PAPER_FORMATS[paper] || PAPER_FORMATS.a4).slots.table.heightMm);
}

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

// The templates' i18n keys, translated: null for a key with no
// translation (t() returns the key itself then), which buildTemplatePdf
// reports as an error.
export function templateTranslator(t) {
  return (key) => {
    const v = t(key);
    return typeof v === 'string' && v && v !== key ? v : null;
  };
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
//     dragLabel, drag, zero, sightHeight, clickVertical, clickHorizontal,
//     conditions, correctionUnit, correctionUnitIsSymbol,
//     appLink, version },
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
  const upper = (text) => text.toLocaleUpperCase(lang || undefined);
  const notesHeading = upper(card.notesHeading);

  const header = [
    ...freeTextPairs({ values, labels, measure, rifleBox: format.rifleBox }),
    ['[card title]', values.cardTitle],
    ['[date]', values.date],
    ['[muzzle velocity]', values.muzzleVelocity],
    ['[drag label]', values.dragLabel],
    ['[drag]', values.drag],
    ['[zero]', values.zero],
    ['[sight height]', values.sightHeight],
    ['[click vertical]', values.clickVertical],
    ['[click horizontal]', values.clickHorizontal],
    ['[app link]', values.appLink],
    ['[version]', values.version]
  ];
  const { slots: geometry } = format;
  const parts = {
    header: { pairs: header, slots: [] },
    table: {
      pairs: [
        ['[conditions heading]', t('printableCard.pdf.headingWithValues', { heading: upper(t('printableCard.pdf.referenceConditions')), values: values.conditions })],
        ['[corrections heading]', t('printableCard.pdf.headingWithUnit', {
          heading: upper(t('printableCard.pdf.corrections')),
          unit: values.correctionUnitIsSymbol ? values.correctionUnit : upper(values.correctionUnit)
        })],
        ['[corrections table]', '']
      ],
      slots: [{
        id: 'table', mode: 'clip',
        content: tableSvg({ ...card.table, slopeAngles: SLOPE_ANGLES_DEG, widthMm: geometry.table.widthMm, heightMm: geometry.table.heightMm, measure })
      }]
    },
    media: {
      pairs: [
        ['[reticle]', ''],
        ['[target photo]', ''],
        ['[reticle heading]', card.reticle ? upper(card.reticle.heading) : notesHeading],
        ['[targets heading]', card.photo ? upper(card.photo.heading) : notesHeading]
      ],
      slots: [
        card.reticle
          ? { id: 'reticle', mode: 'fit', content: card.reticle.content, viewBox: card.reticle.viewBox }
          : { id: 'reticle', mode: 'clip', content: notesSvg(geometry.reticle) },
        card.photo
          ? { id: 'photo', mode: 'clip', content: photoSvg({ photo: card.photo.photo, targets: card.photo.targets, ...geometry.photo, legend: format.photoLegend }) }
          : { id: 'photo', mode: 'clip', content: notesSvg(geometry.photo) }
      ]
    }
  };

  return buildTemplatePdf(format.pages.map((page) => ({
    templateUrl: page.templateUrl,
    replacements: page.parts.flatMap((p) => parts[p].pairs),
    slots: page.parts.flatMap((p) => parts[p].slots)
  })), { title: values.cardTitle, lang, translate: templateTranslator(t) });
}
