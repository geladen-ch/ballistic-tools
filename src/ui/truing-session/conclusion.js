// The ranked conclusion list. Every item is one of a small set of named
// cases (a resolved BC correction, a resolved zero, a degenerate pair, a
// flagged target, ...), rendered from session-model.js's analyseSession():
// each cause with its P(material) at R_max, its size as mu +/- 1.96 sigma
// in its own units, and degenerate causes only ever as one joint finding.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { bcCorrectionOffer, recommendedMvShots, HOMEWORK_DOUBT_SHOWN } from './session-model.js';
import { recheckPrompt } from './recheck-prompt.js';
import { flagText } from './shoot-panel.js';
import { dist, angle, toDisplayAngle, angleLabel, vel, velLabel, toDisplayVelocityText } from './units.js';

const pctP = (p) => `${Math.round(p * 100)}%`;
const paramName = (k) => t(`truingSession.params.${k}`);

// A fitted quantity as value (confidence ±size), in the shooter's own units: the precision unit for angles, the velocity and wind units for
// speeds; a zero also in scope clicks.
function sizeText(f, clickMrad) {
  const sign = f.value >= 0 ? '+' : '';
  const conf = (text) => `(${t('truingSession.conclusion.confidenceLabel')} ±${text})`;
  switch (f.param) {
    case 'dragPct': return `${sign}${f.value.toFixed(1)}% ${conf(`${f.size.toFixed(1)}%`)}`;
    case 'trackPct': return `${sign}${f.value.toFixed(2)}% ${conf(`${f.size.toFixed(2)}%`)}`;
    case 'zeroMrad': {
      const clicks = t('truingSession.certainty.clicksUnit');
      return `${sign}${toDisplayAngle(f.value)} ${angleLabel()} ${conf(`${toDisplayAngle(f.size)} ${angleLabel()}`)} = ${(f.value / clickMrad).toFixed(1)} ${clicks} ${conf(`${(f.size / clickMrad).toFixed(1)} ${clicks}`)}`;
    }
    case 'v0Ms': return `${sign}${toDisplayVelocityText(f.value)} ${velLabel()} ${conf(`${toDisplayVelocityText(f.size)} ${velLabel()}`)}`;
    default: return `${sign}${f.value.toFixed(2)} ${conf(f.size.toFixed(2))}`;
  }
}

// `ctx`: { analysis, state, clickMrad, session, rangeDeclaredFlat, rMax,
// cartridgeName, bcDecision ({ kind, fromFactor, toFactor? } | null),
// mvOverride ({ sd, sampleSize, recordedSd, usedSd } | null), mvSdSaved,
// onSaveBc(newFactor), onMvSdToArsenal(sd), onRecheck(key, rangeM, reading),
// onNewSession() }.
export function conclusionPanel(ctx) {
  const node = el('div', {});
  node.appendChild(el('h3', { i18n: 'truingSession.conclusion.heading' }));
  const { session, analysis, clickMrad } = ctx;

  // Unconditional, whether zero or not: the count is evidence in its own right.
  node.appendChild(el('p', { text: t('truingSession.conclusion.missedImpactCount', { n: session.missedImpactCount || 0 }) }));

  if (session.groups.length === 0) {
    node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.conclusion.noData' }));
    node.appendChild(newSessionControl(ctx.onNewSession));
    return { node };
  }

  if (!analysis.plannedFarReached) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.conclusion.planFarNotReached', { planned: dist(analysis.planFar), farthest: dist(analysis.farthestShot) }) }));
  }

  const list = el('ol', { class: 'truing-session-conclusion-list' });
  node.appendChild(list);
  const item = (children) => list.appendChild(el('li', {}, children));
  const pLine = (p) => el('p', { class: 'hint', text: t('truingSession.conclusion.pMaterial', { p: pctP(p) }) });

  for (const f of analysis.findings) {
    switch (f.case) {
      case 6: {
        item([
          el('p', { text: t('truingSession.conclusion.case6Joint', { causes: f.members.map(paramName).join(' / '), value: toDisplayAngle(f.valueMrad, 2), size: angle(f.sizeMrad), rMax: dist(ctx.rMax) }) }),
          pLine(f.pMaterial),
          el('p', { class: 'hint', i18n: f.action === 'chronograph' ? 'truingSession.conclusion.case6ActionChrono' : 'truingSession.conclusion.case6ActionSeparate' })
        ]);
        break;
      }
      case 3: item(bcOffer(f, ctx, pLine)); break;
      case 4: {
        const up = f.value > 0;
        item([
          el('p', { text: t('truingSession.conclusion.case4Zero', { size: sizeText(f, clickMrad) }) }),
          pLine(f.pMaterial),
          el('p', { class: 'hint', text: t(up ? 'truingSession.conclusion.case4ActionUp' : 'truingSession.conclusion.case4ActionDown', { clicks: Math.abs(f.clicks).toFixed(1) }) })
        ]);
        break;
      }
      case 5: item([el('p', { text: t('truingSession.conclusion.case5Tracking', { size: sizeText(f, clickMrad) }) }), pLine(f.pMaterial)]); break;
      case 'measuredV0': item([
        el('p', { text: t('truingSession.conclusion.measuredV0', { size: sizeText(f, clickMrad) }) }),
        pLine(f.pMaterial),
        // how to settle it: one long string, ideally at today's temperature, since a difference that follows the temperature
        // points at the cartridge's temperature sensitivity as much as its velocity
        el('p', { class: 'hint', text: t('truingSession.conclusion.measuredV0Advice', { n: recommendedMvShots(ctx.mvSD), sd: Number.isFinite(ctx.mvSD) ? vel(ctx.mvSD) : '?', tol: vel(2, 0) }) })
      ]); break;
      case 8: {
        if (f.reason === 'overlap') {
          item([el('p', { text: t('truingSession.conclusion.case8Overlap', { a: paramName(f.members[0]), b: paramName(f.members[1]), corr: Math.abs(f.corr).toFixed(2) }) })]);
        } else {
          const key = { underdetermined: 'case8Unresolved', noChrono: 'case8NoChrono', grade: 'case8Grade', possible: 'case8Possible' }[f.reason];
          item([
            el('p', { text: t(`truingSession.conclusion.${key}`, { param: paramName(f.param), size: sizeText(f, clickMrad), grade: f.grade }) }),
            pLine(f.pMaterial)
          ]);
        }
        break;
      }
      case 7: {
        item([
          el('p', { text: flagText(f) }),
          recheckPrompt({
            target: { rangeM: f.rangeM }, rangeDeclaredFlat: ctx.rangeDeclaredFlat,
            angleMeasured: session.angleChecks && session.angleChecks[f.targetKey] != null,
            onSubmit: (reading) => ctx.onRecheck(f.targetKey, f.rangeM, reading)
          }).node
        ]);
        break;
      }
      case 2: {
        item([
          el('p', { text: t('truingSession.conclusion.case2Dial', { grade: f.grade }) }),
          el('ul', {}, f.corrections.map((c) => el('li', {
            text: t(c.deltaMrad >= 0 ? 'truingSession.conclusion.dialMore' : 'truingSession.conclusion.dialLess', {
              range: dist(c.rangeM), mrad: angle(Math.abs(c.deltaMrad)), clicks: (Math.abs(c.deltaMrad) / clickMrad).toFixed(1)
            })
          })))
        ]);
        break;
      }
      default: break;
    }
  }

  // A cause the shots did not determine is never listed as checking out: it is neither cleared nor confirmed.
  const notDetermined = analysis.notDetermined || [];
  if (analysis.nothingMaterial) {
    item([el('p', { i18n: notDetermined.length ? 'truingSession.conclusion.case1NothingMaterialOpen' : 'truingSession.conclusion.case1NothingMaterial' })]);
  } else if (analysis.notMaterial.length) {
    item([el('p', { text: t('truingSession.conclusion.checksOut', { causes: analysis.notMaterial.map(paramName).join(', ') }) })]);
  }
  if (notDetermined.length) {
    item([
      el('p', { text: t('truingSession.conclusion.notDetermined', { causes: notDetermined.map(paramName).join(', ') }) }),
      ...(notDetermined.includes('trackPct') ? [el('p', { i18n: 'truingSession.conclusion.notDeterminedClick' })] : [])
    ]);
  }

  // Today's chronograph spread governed the fit once it differed significantly from the recorded one; writing it to the
  // cartridge is the only decision left.
  if (ctx.mvOverride) {
    const o = ctx.mvOverride;
    const kids = [el('p', { text: t('truingSession.shoot.sdOverride', { today: vel(o.sd), n: o.sampleSize, recorded: vel(o.recordedSd), used: vel(o.usedSd) }) })];
    if (ctx.mvSdSaved) {
      kids.push(el('p', { class: 'hint', i18n: 'truingSession.shoot.sdSavedToArsenal' }));
    } else {
      const save = el('button', { i18n: 'truingSession.shoot.sdToArsenal' });
      save.addEventListener('click', () => ctx.onMvSdToArsenal(o.sd));
      kids.push(save);
    }
    item(kids);
  }

  // A ticked item the shots do not bear out: the analysis already allows for it (its bands are the wider for it); say which.
  const DOUBT_TICK = { zeroMrad: 'zeroVerified', v0Ms: 'mvAverageChecked' };
  const doubted = Object.entries((analysis && analysis.homeworkDoubt) || {}).filter(([, p]) => p > HOMEWORK_DOUBT_SHOWN);
  if (doubted.length) {
    item(doubted.map(([k, p]) => el('p', { class: 'hint warning', text: t('truingSession.conclusion.homeworkDoubt', { item: t(`truingSession.homework.tick.${DOUBT_TICK[k]}`), p: `${Math.round(100 * p)}%` }) })));
  }

  // The stated bands and the grade take every ticked homework item as done (as likely, when the shots do not say otherwise).
  if ((ctx.homeworkTicked || []).length) {
    item([
      el('p', { class: 'hint', text: t('truingSession.conclusion.homeworkAssumed', { items: ctx.homeworkTicked.map((k) => t(`truingSession.homework.tick.${k}`)).join(', ') }) }),
      ...(ctx.homeworkTicked.includes('trackTested') ? [el('p', { class: 'hint', i18n: 'truingSession.conclusion.homeworkClickValue' })] : [])
    ]);
  }

  node.appendChild(newSessionControl(ctx.onNewSession));
  return { node };
}

function bcOffer(f, ctx, pLine) {
  const offer = bcCorrectionOffer({ state: ctx.state, dragPct: f.value });
  const children = [
    el('p', { text: t('truingSession.conclusion.case3Resolved', { size: sizeText(f, ctx.clickMrad), grade: f.grade }) }),
    pLine(f.pMaterial)
  ];
  if (!offer.inHardBounds) {
    children.push(el('p', { class: 'hint warning', i18n: 'truingSession.conclusion.implausibleWarning' }));
    return children;
  }
  children.push(el('p', {
    text: offer.isCdTable
      ? t('truingSession.conclusion.case3OfferCd', { cartridge: ctx.cartridgeName, from: offer.oldFactor.toFixed(3), to: offer.newFactor.toFixed(3), pct: Math.abs(offer.dragChangePct).toFixed(1), direction: t(offer.dragChangePct < 0 ? 'truingSession.conclusion.lessDrag' : 'truingSession.conclusion.moreDrag') })
      : t('truingSession.conclusion.case3OfferBc', { cartridge: ctx.cartridgeName, from: offer.oldFactor.toFixed(3), to: offer.newFactor.toFixed(3), model: offer.dragModel, newBc: offer.newEffectiveBc.toFixed(4), oldBc: offer.oldEffectiveBc.toFixed(4) })
  }));
  // the drag scale absorbs whatever is wrong with the air: say what it was taken to be
  if (ctx.conditionsText) children.push(el('p', { class: 'hint', text: t('truingSession.conclusion.bcAssumesAir', { summary: ctx.conditionsText }) }));
  if (!offer.inTypicalBand) children.push(el('p', { class: 'hint warning', i18n: 'arsenal.bcGainFactorWarning' }));
  // A decision only applies to the offer it was made on -- the factor it
  // started from -- never to a later, different one.
  const decision = ctx.bcDecision && Math.abs(ctx.bcDecision.fromFactor - offer.oldFactor) < 1e-9 ? ctx.bcDecision.kind : null;
  if (decision === 'saved') {
    children.push(el('p', { class: 'hint', text: t('truingSession.conclusion.savedLabel', { factor: ctx.bcDecision.toFactor.toFixed(3) }) }));
  } else {
    const save = el('button', { i18n: 'truingSession.conclusion.saveButton' });
    save.addEventListener('click', () => ctx.onSaveBc(offer.newFactor));
    children.push(save);
  }
  return children;
}

// Two-step, so a stray tap can't discard a session.
function newSessionControl(onNewSession) {
  const wrap = el('div', { class: 'field-row' });
  const button = el('button', { class: 'secondary', i18n: 'truingSession.conclusion.newSessionButton' });
  let armed = false;
  button.addEventListener('click', () => {
    if (armed) { onNewSession(); return; }
    armed = true;
    button.textContent = t('truingSession.conclusion.newSessionConfirm');
  });
  wrap.appendChild(button);
  return wrap;
}
