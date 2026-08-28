// The "confidence-o-meter" — legacy's own shot-count-adequacy gauge,
// ported with its irreverent tone intact (the "3+"-style URURA scores,
// the "bullshit threshold" joke label on the worst tier). Redesigned as
// a continuous vertical scale — a smooth gradient bar with a pointer
// whose position is driven directly by confidenceScaleFraction() (the
// raw confidence-interval width), not snapped to one of the 8 discrete
// levels — replacing the previous flat list of 8 separate rows. Traced
// from the real legacy gauge math (data/legacy.code/taran/synth-pane.js's
// own cipos formula), not just the reference screenshot. The
// "Confidence rating:" row label itself is plain, user-facing copy, not
// part of that legacy tone.
// Factory returning {node, update(confidenceLower, confidenceUpper)},
// same "update rebuilds content" shape as src/ui/stability-indicator.js.
import { el, clear } from '../../dom.js';
import { t, tOptional } from '../../i18n.js';
import { confidenceLevel, confidenceScaleFraction } from '../../engine/rifle-precision-stats.js';

// Legacy's own CONFI_LEVELS colors (data/legacy.code/taran/synth-pane.js),
// index 0 (worst/"Useless") through 7 (best/"Awesome") — same order
// confidenceLevel() itself returns. Also the same 6 (non-flat) stops the
// gauge's own background gradient is built from, in CSS custom
// properties below.
export const LEVEL_COLORS = ['#7a5901', '#FF0000', '#FF5B00', '#FFA500', '#FFD200', '#FFFF00', '#80FF00', '#00FF00'];
// Legacy's own URURA score strings, indexed identically to LEVEL_COLORS.
// Exported so the analysis view's own SVG-export confidence gauge (e.g.
// "2+, Above average") can reuse the exact same score without a second
// copy of this array.
export const URURA_SCORES = ['0', '1', '1+', '2', '2+', '3', '3+', '4'];

// The gauge's 5 named bands, each an equal 20%-tall zone (bottom to top),
// ported from the legacy gauge's own fixed label positions (see the
// redesign plan for the pixel math this was measured from) — independent
// of the 8-level quantization, which is why there are 5 bands but 8
// levels. `light` bands need white text against the gauge's dark-brown
// bottom; the rest read fine with dark text against their brighter zone.
// Exported for the SVG-export gauge (confidence-gauge-svg.js), which
// draws the same 5 bands directly on its own (much narrower) bar.
export const BANDS = [
  { key: 'riflePrecision.confidenceQualityMeaningless', bottomPercent: 4, light: true },
  { key: 'riflePrecision.confidenceQualityPoor', bottomPercent: 28, light: false },
  { key: 'riflePrecision.confidenceQualityFair', bottomPercent: 48, light: false },
  { key: 'riflePrecision.confidenceQualityGood', bottomPercent: 68, light: false },
  { key: 'riflePrecision.confidenceQualityExcellent', bottomPercent: 88, light: false }
];
// The dashed divider between level 0 ("Meaningless") and everything above
// it sits at the 20%-from-bottom mark — the same boundary
// confidenceScaleFraction(0, 0.5) resolves to. The "(bullshit threshold)"
// caption is drawn just below that line, inside level 0's own band, per
// the redesign's explicit "just above level 0" placement. Exported for
// confidence-gauge-svg.js's own threshold line.
export const THRESHOLD_LINE_BOTTOM_PERCENT = 20;
const THRESHOLD_CAPTION_BOTTOM_PERCENT = 13;

// +sign on non-negative values, so confidenceLower's own negative sign
// (the common case, a lower bound below 1) still prints correctly on its
// own — matches legacy's own "-14%..+20%" convention.
function formatSignedPercent(value) {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

// Every fact this widget (and the SVG-export gauge) needs to render one
// reading, computed once so neither renderer duplicates the
// confidenceLevel()/confidenceScaleFraction()/Line1+Line2 logic.
export function computeConfidenceFacts(confidenceLower, confidenceUpper) {
  const level = confidenceLevel(confidenceLower, confidenceUpper);
  const fraction = confidenceScaleFraction(confidenceLower, confidenceUpper);
  // tOptional(), not t() — see the module-level note on returnEmptyString
  // below, in update(), for why a genuinely-empty Line2 needs this.
  const line2 = tOptional(`riflePrecision.confidenceLevel${level}Line2`);
  const line1 = t(`riflePrecision.confidenceLevel${level}Line1`);
  const marginPercent = (confidenceUpper - confidenceLower) * 100;
  const lowerBoundPercent = (confidenceLower - 1) * 100;
  const upperBoundPercent = (confidenceUpper - 1) * 100;
  return {
    level, fraction, color: LEVEL_COLORS[level],
    quality: line2 ? `${line1} ${line2}` : line1,
    ururaScore: URURA_SCORES[level],
    marginText: `${marginPercent.toFixed(0)}% (${formatSignedPercent(lowerBoundPercent)}%..${formatSignedPercent(upperBoundPercent)}%)`
  };
}

function bandLabel(band) {
  const node = el('div', {
    class: `rp-confidence-band-label ${band.light ? 'rp-confidence-band-light' : 'rp-confidence-band-dark'}`,
    i18n: band.key
  });
  node.style.bottom = `${band.bottomPercent}%`;
  return node;
}

export function confidenceOMeter() {
  const node = el('div', { class: 'rp-confidence-meter' });

  function update(confidenceLower, confidenceUpper) {
    clear(node);
    // returnEmptyString:false (src/i18n.js) makes a genuinely-empty Line2
    // (levels 0/2/3/5 are single-line, same as legacy) indistinguishable
    // from a missing key to t() — computeConfidenceFacts() already routes
    // that through tOptional() rather than t() for exactly this reason.
    const { level, fraction, color, quality, ururaScore, marginText } = computeConfidenceFacts(confidenceLower, confidenceUpper);

    const thresholdLine = el('div', { class: 'rp-confidence-threshold-line' });
    thresholdLine.style.bottom = `${THRESHOLD_LINE_BOTTOM_PERCENT}%`;
    const thresholdCaption = el('div', {
      class: 'rp-confidence-threshold-caption', i18n: 'riflePrecision.bullshitThresholdLabel'
    });
    thresholdCaption.style.bottom = `${THRESHOLD_CAPTION_BOTTOM_PERCENT}%`;

    const bar = el('div', { class: 'rp-confidence-bar' }, [
      ...BANDS.map(bandLabel),
      thresholdLine,
      thresholdCaption
    ]);

    const pointer = el('div', { class: 'rp-confidence-pointer' }, [
      el('div', { class: 'rp-confidence-pointer-tri' }),
      el('div', { class: 'rp-confidence-pointer-bar' })
    ]);
    pointer.style.bottom = `${fraction * 100}%`;

    const info = el('div', { class: 'rp-confidence-info' }, [
      el('div', { class: 'rp-confidence-info-line', text: quality }),
      el('p', { class: 'rp-confidence-rating' }, [
        el('span', { i18n: 'riflePrecision.ururaLevelLabel' }),
        el('b', { text: ururaScore })
      ]),
      el('p', { class: 'rp-confidence-margin' }, [
        el('span', { i18n: 'riflePrecision.confidenceMarginLabel' }),
        document.createTextNode(`: ${marginText}`)
      ])
    ]);
    info.style.background = color;

    node.appendChild(el('h4', { i18n: 'riflePrecision.confidenceMeterTitle' }));
    node.appendChild(el('div', { class: 'rp-confidence-body' }, [
      el('div', { class: 'rp-confidence-bar-col' }, [bar]),
      el('div', { class: 'rp-confidence-pointer-col' }, [pointer]),
      info
    ]));
  }

  return { node, update };
}
