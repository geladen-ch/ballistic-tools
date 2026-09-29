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
// was asked for or the user has no way to measure it.
export function recheckPrompt({ target, rangeDeclaredFlat, angleMeasured, onSubmit }) {
  const askAngle = !rangeDeclaredFlat && !angleMeasured;
  const node = el('div', { class: 'truing-session-recheck' });
  node.appendChild(el('p', { text: t(askAngle ? 'truingSession.recheck.promptWithAngle' : 'truingSession.recheck.promptDistanceOnly', { range: dist(target.rangeM) }) }));

  const distanceInput = el('input', { type: 'number', step: 0.1, min: 1 }); // in the shooter's distance unit
  node.appendChild(el('div', { class: 'field' }, [el('label', { text: t('truingSession.recheck.distanceLabel', { unit: distLabel() }) }), distanceInput]));

  let angleInput = null;
  let noToolCheckbox = null;
  if (askAngle) {
    angleInput = el('input', { type: 'number', step: 0.1 });
    node.appendChild(el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.recheck.angleLabel' }), angleInput]));
    noToolCheckbox = el('input', { type: 'checkbox' });
    noToolCheckbox.addEventListener('change', () => { angleInput.disabled = noToolCheckbox.checked; });
    node.appendChild(el('label', { class: 'checkbox-field' }, [noToolCheckbox, el('span', { i18n: 'truingSession.recheck.noAngleTool' })]));
  }

  const error = el('p', { class: 'hint warning', i18n: 'truingSession.recheck.needValues' });
  error.style.display = 'none';
  const submit = el('button', { i18n: 'truingSession.recheck.submitButton' });
  submit.addEventListener('click', () => {
    const shown = parseFloat(distanceInput.value);
    const newReadingM = Number.isFinite(shown) ? fromDisplayDistance(shown) : NaN;
    let angleDeg = null;
    if (askAngle && !noToolCheckbox.checked) {
      angleDeg = parseFloat(angleInput.value);
      if (!Number.isFinite(angleDeg)) { error.style.display = ''; return; }
    }
    if (!Number.isFinite(newReadingM) || newReadingM <= 0) { error.style.display = ''; return; }
    error.style.display = 'none';
    onSubmit({ newReadingM, angleDeg });
  });
  node.appendChild(error);
  node.appendChild(submit);
  if (askAngle) node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.recheck.noAngleCaveat' }));
  return { node };
}

// The entry gate's two-way choice, reused wherever a registered target's
// distance or angle has been corrected: write it to the location card, or
// keep it for this truing session only. `changes`: [{ name, field, from, to }].
export function locationChoice({ changes, onUpdateCard, onSessionOnly }) {
  const node = el('div', { class: 'truing-session-choice' });
  node.appendChild(el('p', { i18n: 'truingSession.choice.changedIntro' }));
  node.appendChild(el('ul', {}, changes.map((c) => el('li', {
    text: t(c.field === 'angle' ? 'truingSession.choice.changedAngle' : 'truingSession.choice.changedRange', { name: c.name, from: c.field === 'angle' ? c.from : dist(c.from), to: c.field === 'angle' ? c.to : dist(c.to) })
  }))));
  const update = el('button', { i18n: 'truingSession.choice.updateCard' });
  update.addEventListener('click', onUpdateCard);
  const sessionOnly = el('button', { class: 'secondary', i18n: 'truingSession.choice.sessionOnly' });
  sessionOnly.addEventListener('click', onSessionOnly);
  node.appendChild(el('div', { class: 'field-row' }, [update, sessionOnly]));
  return { node };
}
