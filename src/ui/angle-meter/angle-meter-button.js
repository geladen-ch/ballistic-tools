// The small icon button next to a target's line-of-sight angle input that
// opens the camera clinometer (angle-meter-overlay.js). Same quiet
// `.icon-button` treatment as photo-picker-button.js. Created hidden and
// only shown once this device has proved it has a tilt sensor (see
// clinometer-availability.js) — on a desktop it never appears, and
// nothing shifts when it does.
//
// `onMeasure(losAngleRad)` gets the confirmed angle, +up, in radians.
import { el } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { whenClinometerAvailabilityKnown } from '../../clinometer-availability.js';
import { openAngleMeter } from './angle-meter-overlay.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

// A camera with an incline wedge beside it — "measure the angle through
// the camera," distinct from losAngleIcon's plain wedge.
function angleMeterIcon(size = 18) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('rect', { x: '1.5', y: '6', width: '11', height: '8.5', rx: '1.5' }),
    svgEl('path', { d: 'M4.5 6l1-1.8h3l1 1.8' }),
    svgEl('circle', { cx: '7', cy: '10.25', r: '2.1' }),
    svgEl('path', { d: 'M14.5 17.5h4M14.5 17.5L18.5 12' })
  ]);
}

export function angleMeterButton({ onMeasure }) {
  const label = t('angleMeter.buttonLabel');
  const button = el('button', { type: 'button', class: 'icon-button angle-meter-button', title: label, 'aria-label': label }, [angleMeterIcon()]);
  button.style.display = 'none';
  whenClinometerAvailabilityKnown((available) => { button.style.display = available ? '' : 'none'; });
  // openAngleMeter() asks for motion-sensor access first thing — iOS only
  // grants that from inside the tap itself, so nothing may run before it.
  button.addEventListener('click', () => openAngleMeter({ onConfirm: onMeasure }));
  return button;
}
