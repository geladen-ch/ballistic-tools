// The camera clinometer: a full-screen rear-camera view with a crosshair
// at its centre, an instruction line, a large live readout of the
// camera's elevation and Confirm / Cancel. The video fills the screen
// with `object-fit: cover`, which crops symmetrically, so the screen's
// centre stays on the camera's optical axis — the direction the readout
// measures (clinometer.js).
//
// The readout is the mean of a short window of readings, corrected by
// this phone's calibration (calibration.js) when it has one; Confirm
// hands that same value, in radians, to `onConfirm`. "Calibrate" runs the
// five-reading calibration inside the same overlay: each step's schematic
// (calibration-illustration.js) takes the crosshair's place, and every
// step's instruction and status is also spoken (speech.js).
//
// The text, buttons and schematic sit on one "stage" that is turned to
// read upright for the person however the phone stands, allowing for any
// turn the operating system's auto-rotate already made (upright.js). The
// video and crosshair stay as they are: the crosshair is symmetric and
// marks the camera axis whichever way up.
//
// One layer appended to <body> above #app-dialog, not a route: the view
// underneath keeps its state. Cancel, Escape, the browser's Back (a
// same-URL history entry is pushed for it, so no hashchange — the hash
// router never sees it) and any navigation close it; the page going to
// the background stops the camera and sensors until it comes back.
import { el } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { FIELD_UNITS, UNIT_GROUPS, FIELD_BOUNDS, siToDisplay, roundForDisplay, unitChoice } from '../../units.js';
import { degToRad } from '../../quantity.js';
import { requestWakeLock } from '../../wake-lock.js';
import { getClinometerCalibration, setClinometerCalibration, clearClinometerCalibration } from '../../clinometer-calibration-prefs.js';
import { startClinometer, sampleWindow } from './clinometer.js';
import { correctedElevationRad, createCalibrationRun, CALIBRATION_STEPS } from './calibration.js';
import { calibrationIllustration } from './calibration-illustration.js';
import { cameraZoom } from './camera-zoom.js';
import { createSpeaker } from './speech.js';
import { rollQuarterTurns, screenQuarterTurns, contentQuarterTurns } from './upright.js';

// Wall-clock bookkeeping, not quantities of the domain.
const LIVE_WINDOW_MS = 1000;
// How long the confirmed angle is shown before returning to the page.
const RESULT_SHOW_MS = 2000;
const MIN_LIVE_COVERED_MS = 300;
const NO_SAMPLES_TIMEOUT_MS = 2500;
const NOTE_FLASH_MS = 4000;
const MIN_LIVE_SAMPLES = 5;
// Hand-held tremor is a few tenths of a degree; under this the reading is
// as still as a person holds a phone.
// "Steady" is the spread of the readings over the last LIVE_WINDOW_MS, held
// in the hand: tighter limits proved practically unreachable offhand. The
// readout is the window's mean, which is far steadier than the spread.
const STEADY_STD_RAD = degToRad(0.4);
// The accelerometer alone also feels the hand's small accelerations.
const STEADY_STD_GRAVITY_RAD = degToRad(0.7);
// A single reading this far from the window's median is a glitch, left out.
const LIVE_OUTLIER_RAD = degToRad(1.5);

const CALIBRATION_STATUS_KEYS = {
  position: 'angleMeter.calibration.statusPosition',
  turn: 'angleMeter.calibration.statusTurn',
  hold: 'angleMeter.calibration.statusHold',
  aim: 'angleMeter.calibration.statusAim',
  unsteady: 'angleMeter.calibration.statusUnsteady',
  captured: 'angleMeter.calibration.statusCaptured'
};
// How long a rejected sighting tap's message stays up (bookkeeping).
const UNSTEADY_NOTE_MS = 3000;

// "+3.4°" / "−3.4°" / "0.0°", in the line-of-sight field's own display
// unit and rounding.
export function formatLosAngle(rad) {
  const unit = UNIT_GROUPS[FIELD_UNITS.losAngle.group].defaultUnit;
  const choice = unitChoice('losAngle', unit);
  const shown = roundForDisplay('losAngle', unit, siToDisplay('losAngle', rad, unit));
  const sign = shown > 0 ? '+' : shown < 0 ? '−' : '';
  return `${sign}${Math.abs(shown).toFixed(choice.decimals)}${choice.label}`;
}

// Must run synchronously inside the opening tap: iOS only shows its
// motion-access prompt from a user gesture. Everywhere else there is no
// prompt and access is simply there.
function requestOrientationPermission() {
  // Both prompts are asked for in the same tick, so both are still inside
  // the tap; access is there when either is granted (iOS grants them
  // together, as one "Motion & Orientation Access").
  const ask = (Api) => {
    if (!Api || typeof Api.requestPermission !== 'function') return null;
    try {
      return Api.requestPermission().then((r) => r === 'granted', () => false);
    } catch {
      return Promise.resolve(false);
    }
  };
  const asks = [ask(globalThis.DeviceOrientationEvent), ask(globalThis.DeviceMotionEvent)].filter(Boolean);
  if (asks.length === 0) return Promise.resolve(true);
  return Promise.all(asks).then((results) => results.some(Boolean));
}

// Four arms around an open centre, each drawn twice — a dark halo under a
// light line — so it reads against sky and shadow alike.
function crosshair() {
  const arms = [[0, -9, 0, -46], [0, 9, 0, 46], [-9, 0, -46, 0], [9, 0, 46, 0]];
  const line = (cls) => arms.map(([x1, y1, x2, y2]) => svgEl('line', { x1, y1, x2, y2, class: cls }));
  return svgEl('svg', { class: 'angle-meter-crosshair', viewBox: '-50 -50 100 100', 'aria-hidden': 'true' }, [
    ...line('angle-meter-crosshair-halo'),
    ...line('angle-meter-crosshair-line'),
    svgEl('circle', { cx: 0, cy: 0, r: 0.9, class: 'angle-meter-crosshair-dot' })
  ]);
}

export function openAngleMeter({ onConfirm }) {
  const permission = requestOrientationPermission(); // first — see above

  let open = true;
  let calibration = getClinometerCalibration();
  let mode = 'measure';
  let run = null;
  let calibrationStatus = 'position';
  let illustration = null;
  let spokenThisStep = new Set();
  let rollQuarters = 0;
  let appliedQuarters = null;
  let permissionSettled = false;
  let sensorsAllowed = false;
  let sensorErrorKey = null;
  let cameraErrorKey = null;
  let flashNoteKey = null;
  let flashTimer = null;
  let gotSample = false;
  let stopSensors = null;
  let noSampleTimer = null;
  let stream = null;
  let cameraStarting = false;
  let wakeLock = null;
  let frame = null;
  const live = sampleWindow(LIVE_WINDOW_MS);
  const speaker = createSpeaker();

  const video = el('video', { class: 'angle-meter-video', autoplay: '', muted: '', playsinline: '' });
  video.muted = true;
  const instruction = el('p', { class: 'angle-meter-instruction' });
  const note = el('p', { class: 'angle-meter-note' });
  let lastSample = null;
  const readout = el('div', { class: 'angle-meter-readout', text: '—' });
  const calibrateButton = el('button', { type: 'button', class: 'secondary angle-meter-link', text: t('angleMeter.calibrate') });
  const resetButton = el('button', { type: 'button', class: 'secondary angle-meter-link', text: t('angleMeter.resetCalibration') });
  const cancelButton = el('button', { type: 'button', class: 'secondary', text: t('angleMeter.cancel') });
  const confirmButton = el('button', { type: 'button', text: t('angleMeter.confirm') });
  const takeReadingButton = el('button', { type: 'button', text: t('angleMeter.calibration.takeReading') });
  let unsteadyUntilMs = -Infinity; // sensor clock
  let rejectedStatus = null;
  const figure = el('div', { class: 'angle-meter-figure' });
  const stage = el('div', { class: 'angle-meter-stage' }, [
    el('div', { class: 'angle-meter-top' }, [instruction, note]),
    figure,
    el('div', { class: 'angle-meter-bottom' }, [
      readout,
      el('div', { class: 'angle-meter-links' }, [calibrateButton, resetButton]),
      el('div', { class: 'angle-meter-actions' }, [cancelButton, confirmButton, takeReadingButton])
    ])
  ]);
  const root = el('div', { class: 'angle-meter', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('angleMeter.title') }, [
    video,
    crosshair(),
    stage
  ]);
  // On the stage, so the buttons turn with the text; pinches anywhere.
  const zoom = cameraZoom({ video, pinchArea: root });
  stage.appendChild(zoom.node);

  // Sizes and turns the stage so its content reads upright: a quarter
  // turn swaps its width and height, so it still fills the screen.
  function layoutStage() {
    const quarters = contentQuarterTurns(rollQuarters, screenQuarterTurns());
    const w = root.clientWidth;
    const h = root.clientHeight;
    const sideways = quarters % 2 !== 0;
    stage.style.width = `${sideways ? h : w}px`;
    stage.style.height = `${sideways ? w : h}px`;
    stage.style.setProperty('--quarter-turns', String(quarters));
    appliedQuarters = quarters;
  }

  function onLayoutChange() {
    if (open) layoutStage();
  }

  function liveStats() {
    return live.stats((s) => s.correctedRad, { outlierRad: LIVE_OUTLIER_RAD });
  }

  function liveReady(stats) {
    return gotSample && !sensorErrorKey && stats.count >= MIN_LIVE_SAMPLES && stats.coveredMs >= MIN_LIVE_COVERED_MS;
  }

  function render() {
    frame = null;
    if (!open) return;
    const calibrating = mode === 'calibrate';
    root.classList.toggle('calibrating', calibrating);
    if (calibrating) {
      const step = CALIBRATION_STEPS[run.stepIndex];
      readout.textContent = t('angleMeter.calibration.stepCounter', { n: run.stepIndex + 1, total: CALIBRATION_STEPS.length });
      instruction.textContent = step ? t(step.textKey) : '';
      note.textContent = sensorErrorKey ? t(sensorErrorKey) : t(CALIBRATION_STATUS_KEYS[calibrationStatus] || CALIBRATION_STATUS_KEYS.position);
      note.style.display = '';
      root.classList.remove('steady');
      const sighting = !!step && step.kind === 'sight';
      root.classList.toggle('sighting', sighting);
      calibrateButton.style.display = 'none';
      resetButton.style.display = 'none';
      confirmButton.style.display = 'none';
      takeReadingButton.style.display = sighting ? '' : 'none';
      takeReadingButton.disabled = sighting && calibrationStatus === 'position';
      return;
    }
    root.classList.remove('sighting');
    takeReadingButton.style.display = 'none';
    const stats = liveStats();
    const ready = liveReady(stats);
    const steady = ready && stats.stdElevationRad <= (lastSample && lastSample.source === 'gravity' ? STEADY_STD_GRAVITY_RAD : STEADY_STD_RAD);
    readout.textContent = ready ? formatLosAngle(stats.meanElevationRad) : '—';
    root.classList.toggle('steady', steady);
    instruction.textContent = sensorErrorKey ? t(sensorErrorKey) : t(steady ? 'angleMeter.steady' : 'angleMeter.aim');
    const noteKey = flashNoteKey || cameraErrorKey || (calibration ? null : 'angleMeter.notCalibrated');
    note.textContent = noteKey ? t(noteKey) : '';
    note.style.display = noteKey ? '' : 'none';
    calibrateButton.style.display = sensorErrorKey ? 'none' : '';
    resetButton.style.display = calibration && !sensorErrorKey ? '' : 'none';
    confirmButton.style.display = '';
    confirmButton.disabled = !ready;
  }

  function scheduleRender() {
    if (frame === null && open) frame = requestAnimationFrame(render);
  }

  // `sticky`: stays until the next calibration starts (a failure is easy
  // to miss in a few seconds).
  function flashNote(key, { sticky = false } = {}) {
    flashNoteKey = key;
    if (flashTimer !== null) clearTimeout(flashTimer);
    flashTimer = sticky ? null : setTimeout(() => { flashTimer = null; flashNoteKey = null; scheduleRender(); }, NOTE_FLASH_MS);
  }

  // The camera runs only while it is needed: measuring, and the sighting
  // steps; never while the phone stands on a surface.
  function syncCamera() {
    const step = mode === 'calibrate' && run ? CALIBRATION_STEPS[run.stepIndex] : null;
    const wanted = mode !== 'calibrate' || (step && step.kind === 'sight');
    if (wanted && permissionSettled && document.visibilityState !== 'hidden') startCamera();
    else stopCamera();
  }

  // Shows step `index`'s schematic; speaks its instruction, after
  // whatever is still being said unless `interrupt`.
  function startStep(index, { interrupt = false } = {}) {
    figure.replaceChildren();
    illustration = null;
    spokenThisStep = new Set();
    calibrationStatus = 'position';
    const step = CALIBRATION_STEPS[index];
    if (!step) return;
    illustration = calibrationIllustration(step);
    figure.appendChild(illustration.node);
    speaker.say(t(step.textKey), { interrupt });
    syncCamera();
  }

  function leaveCalibration() {
    mode = 'measure';
    run = null;
    illustration = null;
    figure.replaceChildren();
    root.classList.remove('sighting');
    syncCamera();
  }

  function finishCalibration() {
    const result = run.result();
    leaveCalibration();
    if (result) {
      setClinometerCalibration(result);
      calibration = getClinometerCalibration() || result;
      live.clear(); // older readings carry the previous correction
      flashNote('angleMeter.calibration.done');
      speaker.say(t('angleMeter.calibration.done'));
    } else {
      flashNote('angleMeter.calibration.failed', { sticky: true });
      speaker.say(t('angleMeter.calibration.failed'));
    }
  }

  // Each status is spoken once per step, the first time it comes up.
  function speakStatus(status) {
    if ((status !== 'hold' && status !== 'turn') || spokenThisStep.has(status)) return;
    spokenThisStep.add(status);
    speaker.say(t(CALIBRATION_STATUS_KEYS[status]));
  }

  function onSample(sample, tMs) {
    if (!open) return;
    if (!gotSample) {
      gotSample = true;
      if (sensorErrorKey === 'angleMeter.error.noSensor') sensorErrorKey = null;
    }
    if (lastSample && lastSample.source !== sample.source) live.clear(); // a source switch: don't mix them
    lastSample = sample;
    const correctedRad = correctedElevationRad(calibration, sample.elevationRad, sample.rollRad);
    live.push(tMs, { ...sample, correctedRad });
    rollQuarters = rollQuarterTurns(sample.rollRad, sample.elevationRad, rollQuarters);
    if (contentQuarterTurns(rollQuarters, screenQuarterTurns()) !== appliedQuarters) layoutStage();
    if (mode === 'calibrate') {
      const { status, progress } = run.addSample(sample, tMs);
      if (illustration) illustration.setProgress(progress, status === 'captured' || status === 'done');
      if (status === 'captured' || status === 'done') navigator.vibrate?.(80);
      if (status === 'done') {
        finishCalibration();
      } else if (status === 'captured') {
        speaker.say(t(CALIBRATION_STATUS_KEYS.captured));
        startStep(run.stepIndex);
      } else {
        // a refused tap's reason stays up a few seconds rather than being
        // replaced by the next reading's status at once
        calibrationStatus = tMs < unsteadyUntilMs && rejectedStatus ? rejectedStatus : status;
        speakStatus(status);
      }
    }
    scheduleRender();
  }

  // A sighting step's tap: the reading is the mean of the moment before it.
  function takeSighting() {
    if (mode !== 'calibrate' || !run) return;
    const tapMs = run.lastSampleMs ?? 0; // the sensor clock, see calibration.js's capture()
    const status = run.capture();
    if (status === 'captured' || status === 'done') {
      navigator.vibrate?.(80);
      unsteadyUntilMs = -Infinity;
      rejectedStatus = null;
      if (status === 'done') finishCalibration();
      else {
        speaker.say(t(CALIBRATION_STATUS_KEYS.captured));
        startStep(run.stepIndex);
      }
    } else {
      calibrationStatus = status;
      rejectedStatus = status;
      unsteadyUntilMs = tapMs + UNSTEADY_NOTE_MS;
      speaker.say(t(CALIBRATION_STATUS_KEYS[status]), { interrupt: true });
      speaker.reset(); // the same advice may need saying again on the next tap
    }
    scheduleRender();
  }

  function startSensors() {
    if (!sensorsAllowed || stopSensors) return;
    stopSensors = startClinometer(onSample);
    noSampleTimer = setTimeout(() => {
      noSampleTimer = null;
      if (!gotSample) { sensorErrorKey = 'angleMeter.error.noSensor'; scheduleRender(); }
    }, NO_SAMPLES_TIMEOUT_MS);
  }

  function stopSensorsNow() {
    if (stopSensors) stopSensors();
    stopSensors = null;
    if (noSampleTimer !== null) clearTimeout(noSampleTimer);
    noSampleTimer = null;
    live.clear();
    gotSample = false;
  }

  async function startCamera() {
    if (stream || cameraStarting || !navigator.mediaDevices?.getUserMedia) {
      if (!navigator.mediaDevices?.getUserMedia) { cameraErrorKey = 'angleMeter.error.cameraUnavailable'; scheduleRender(); }
      return;
    }
    cameraStarting = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!open || document.visibilityState === 'hidden') {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = s;
      video.srcObject = s;
      cameraErrorKey = null;
      const playing = video.play();
      if (playing && playing.catch) playing.catch(() => {});
    } catch (err) {
      cameraErrorKey = err && err.name === 'NotAllowedError' ? 'angleMeter.error.cameraDenied' : 'angleMeter.error.cameraUnavailable';
    } finally {
      cameraStarting = false;
      scheduleRender();
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function takeWakeLock() {
    requestWakeLock().then((sentinel) => {
      if (!open || document.visibilityState === 'hidden') { sentinel?.release(); return; }
      wakeLock?.release();
      wakeLock = sentinel;
    });
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      stopCamera();
      stopSensorsNow();
      wakeLock?.release();
      wakeLock = null;
    } else {
      startSensors();
      syncCamera();
      takeWakeLock();
    }
    scheduleRender();
  }

  // While the confirmed angle is shown, any way out still hands it over.
  let resultRad = null;
  let resultTimer = null;

  function onKeyDown(evt) {
    if (evt.key === 'Escape') close(resultRad);
  }

  function onPopState() {
    close(resultRad, { fromHistory: true });
  }

  function onHashChange() {
    close(resultRad, { fromHistory: true });
  }

  // The confirmed angle in big numbers on black for RESULT_SHOW_MS (a tap
  // ends it sooner), then back to the page with it. The camera and
  // sensors stop straight away.
  function showResult(valueRad) {
    resultRad = valueRad;
    stopSensorsNow();
    stopCamera();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    const result = el('div', { class: 'angle-meter-result' }, [
      el('div', { class: 'angle-meter-result-value', text: formatLosAngle(valueRad) }),
      el('div', { class: 'angle-meter-result-label', text: t('angleMeter.resultLabel') })
    ]);
    stage.appendChild(result);
    root.classList.add('result');
    // after this tap: the Confirm tap is still bubbling up through root
    setTimeout(() => root.addEventListener('click', () => close(resultRad)), 0);
    resultTimer = setTimeout(() => close(resultRad), RESULT_SHOW_MS);
  }

  function close(valueRad, { fromHistory = false } = {}) {
    if (!open) return;
    open = false;
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('resize', onLayoutChange);
    window.removeEventListener('orientationchange', onLayoutChange);
    globalThis.screen?.orientation?.removeEventListener?.('change', onLayoutChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('keydown', onKeyDown);
    if (frame !== null) cancelAnimationFrame(frame);
    if (flashTimer !== null) clearTimeout(flashTimer);
    if (resultTimer !== null) clearTimeout(resultTimer);
    stopSensorsNow();
    stopCamera();
    speaker.stop();
    zoom.dispose();
    wakeLock?.release();
    wakeLock = null;
    root.remove();
    document.documentElement.classList.remove('angle-meter-open');
    if (!fromHistory && history.state && history.state.angleMeter) history.back();
    if (valueRad != null && onConfirm) onConfirm(valueRad);
  }

  cancelButton.addEventListener('click', () => {
    if (resultRad != null) return; // the result screen's own tap handles it
    if (mode === 'calibrate') {
      leaveCalibration();
      speaker.stop();
      scheduleRender();
      return;
    }
    close(null);
  });
  confirmButton.addEventListener('click', () => {
    const stats = liveStats();
    if (!liveReady(stats)) return;
    const { min, max } = FIELD_BOUNDS.losAngle;
    showResult(Math.max(min, Math.min(max, stats.meanElevationRad)));
  });
  takeReadingButton.addEventListener('click', () => takeSighting());
  calibrateButton.addEventListener('click', () => {
    mode = 'calibrate';
    run = createCalibrationRun();
    flashNoteKey = null;
    if (flashTimer !== null) clearTimeout(flashTimer);
    flashTimer = null;
    speaker.reset();
    startStep(0, { interrupt: true }); // inside the tap: iOS only starts speech from one
    scheduleRender();
  });
  resetButton.addEventListener('click', () => {
    clearClinometerCalibration();
    calibration = null;
    live.clear();
    scheduleRender();
  });

  document.body.appendChild(root);
  document.documentElement.classList.add('angle-meter-open');
  history.pushState({ angleMeter: true }, '');
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('resize', onLayoutChange);
  window.addEventListener('orientationchange', onLayoutChange);
  globalThis.screen?.orientation?.addEventListener?.('change', onLayoutChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('keydown', onKeyDown);
  cancelButton.focus();
  takeWakeLock();
  layoutStage();
  render();

  // The camera's own prompt waits for the motion one, so iOS never shows
  // both at once.
  permission.then((allowed) => {
    if (!open) return;
    permissionSettled = true;
    if (!allowed) {
      sensorErrorKey = 'angleMeter.error.sensorDenied';
    } else {
      sensorsAllowed = true;
      if (document.visibilityState !== 'hidden') startSensors();
    }
    syncCamera();
    scheduleRender();
  });

  return { close: () => close(null) };
}
