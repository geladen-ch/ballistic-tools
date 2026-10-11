// The in-session re-check prompt for one flagged target: a second distance
// reading and -- unless the range was declared flat, or the angle was
// already measured this session -- the angle, in the same prompt. A wrong
// distance and an unrecorded slope are exactly degenerate for one group,
// so the angle is the reading that actually separates them; the distance
// alone never can. Used both live (Shoot) and on the Conclude screen.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { dist, distLabel, fromDisplayDistance } from './units.js';

// `onSubmit({ newReadingM, angleDeg })` -- angleDeg is null when no angle
// was asked for: never on a range declared flat, where a clinometer is
// not needed; off a flat range one is required, so an asked-for angle is
// always given. `onCancel`, when
// given, makes this a re-measure the shooter asked for on their own: it
// takes the angle again even if one was measured this session (the
// shooter chose to re-measure), and can be confirmed or cancelled.
export function recheckPrompt({ target, rangeDeclaredFlat, angleMeasured, onSubmit, onCancel = null }) {
  const userInitiated = onCancel != null;
  const askAngle = !rangeDeclaredFlat && (!angleMeasured || userInitiated);
  const node = el('div', { class: 'truing-session-recheck' });
  node.appendChild(el('p', { text: t(askAngle ? 'truingSession.recheck.promptWithAngle' : 'truingSession.recheck.promptDistanceOnly', { range: dist(target.rangeM) }) }));

  const distanceInput = el('input', { type: 'number', step: 0.1, min: 1 }); // in the shooter's distance unit
  node.appendChild(el('div', { class: 'field' }, [el('label', { text: t('truingSession.recheck.distanceLabel', { unit: distLabel() }) }), distanceInput]));

  let angleInput = null;
  if (askAngle) {
    angleInput = el('input', { type: 'number', step: 0.1 });
    node.appendChild(el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.recheck.angleLabel' }), angleInput]));
  }

  const error = el('p', { class: 'hint warning', i18n: askAngle ? 'truingSession.recheck.needValues' : 'truingSession.recheck.needDistance' });
  error.style.display = 'none';
  const submit = el('button', { i18n: userInitiated ? 'truingSession.recheck.confirmButton' : 'truingSession.recheck.submitButton' });
  submit.addEventListener('click', () => {
    const shown = parseFloat(distanceInput.value);
    const newReadingM = Number.isFinite(shown) ? fromDisplayDistance(shown) : NaN;
    let angleDeg = null;
    if (askAngle) {
      angleDeg = parseFloat(angleInput.value);
      if (!Number.isFinite(angleDeg)) { error.style.display = ''; return; }
    }
    if (!Number.isFinite(newReadingM) || newReadingM <= 0) { error.style.display = ''; return; }
    error.style.display = 'none';
    onSubmit({ newReadingM, angleDeg });
  });
  node.appendChild(error);
  if (userInitiated) {
    const cancel = el('button', { class: 'secondary', i18n: 'truingSession.recheck.cancelButton' });
    cancel.addEventListener('click', onCancel);
    node.appendChild(el('div', { class: 'field-row' }, [submit, cancel]));
  } else node.appendChild(submit);
  return { node };
}

// What a corrected registered target's distance or angle did: it holds for this truing session only, and the location is left as it
// is. `changes`: [{ name, field, from, to }].
export function sessionOnlyNotice({ changes, onDismiss }) {
  const node = el('div', { class: 'truing-session-choice' });
  node.appendChild(el('p', { i18n: 'truingSession.choice.changedIntro' }));
  node.appendChild(el('ul', {}, changes.map((c) => el('li', {
    text: t(c.field === 'angle' ? 'truingSession.choice.changedAngle' : 'truingSession.choice.changedRange', { name: c.name, from: c.field === 'angle' ? c.from : dist(c.from), to: c.field === 'angle' ? c.to : dist(c.to) })
  }))));
  node.appendChild(el('p', { class: 'hint prominent', i18n: 'truingSession.choice.sessionOnlyNote' }));
  const dismiss = el('button', { class: 'secondary', i18n: 'truingSession.choice.dismiss' });
  dismiss.addEventListener('click', onDismiss);
  node.appendChild(dismiss);
  return { node };
}
