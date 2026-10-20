// Interactive "hit probability" control for the analysis view — a 0..99%
// range input whose live readout and radius are computed straight from
// hitProbabilityRadiusMm()/mmToAngularUnit() (src/engine/rifle-precision-stats.js).
// Takes sigma/distanceM/formatLengthMm once at construction (the project
// this view is looking at never changes mid-mount, so there's no separate
// update() the way the diagram/confidence-o-meter need — see caller).
// onChange(percent, radiusMm) fires on every input event so the caller can
// redraw analysisDiagram()'s hit-probability circle live. initialPercent
// (default 0) lets the caller restore a previously-saved position.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { hitProbabilityRadius, linearToAngularUnit } from '../../engine/rifle-precision-stats.js';

export function hitProbabilitySlider({ sigma, distanceM, formatLength, onChange, initialPercent = 0 } = {}) {
  const slider = el('input', {
    type: 'range', min: '0', max: '99', step: '1', value: String(initialPercent), id: 'riflePrecisionHitProbability'
  });
  const readout = el('p', { class: 'hint rp-hit-probability-readout' });

  function refresh() {
    const percent = parseInt(slider.value, 10) || 0;
    const radiusM = hitProbabilityRadius(sigma, percent);
    readout.textContent = t('riflePrecision.hitProbabilityReadout', {
      percent,
      radius: formatLength(radiusM),
      mrad: linearToAngularUnit(radiusM, 'mrad', distanceM).toFixed(2),
      moa: linearToAngularUnit(radiusM, 'arcmin', distanceM).toFixed(2)
    });
    if (onChange) onChange(percent, radiusM);
  }

  slider.addEventListener('input', refresh);
  refresh();

  const node = el('div', { class: 'field rp-hit-probability' }, [
    el('label', { for: 'riflePrecisionHitProbability', i18n: 'riflePrecision.hitProbabilityLabel' }),
    slider,
    readout
  ]);

  return { node, refresh };
}
