// Spoken status for the clinometer's calibration, through the browser's
// own text-to-speech (the phone's installed voices, so it works offline):
// in the turned reading the screen may face away, and a voice reaches the
// person wherever they stand. Spoken in the app's language; when the
// phone has voices but none for that language it stays silent rather than
// reading the text in a foreign accent — the vibration still marks each
// reading.
//
// iOS only lets a page speak once a tap has started speech, so the first
// say() must come from inside the Calibrate tap itself.
import { getLanguage } from '../../i18n.js';

function pickVoice(synth, lang) {
  const voices = synth.getVoices ? synth.getVoices() : [];
  if (voices.length === 0) return { voice: null, silent: false }; // not loaded yet: let the platform choose by `lang`
  const prefix = lang.toLowerCase();
  const match = voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith(prefix));
  return match ? { voice: match, silent: false } : { voice: null, silent: true };
}

export function createSpeaker() {
  const synth = globalThis.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  const available = !!synth && typeof Utterance === 'function';
  let last = null;

  return {
    // `interrupt`: drop whatever is still being said first (a new step's
    // instruction); otherwise queue behind it ("Reading taken", then the
    // next instruction). The same text twice in a row is said once.
    say(text, { interrupt = false } = {}) {
      if (!available || !text || text === last) return;
      const lang = getLanguage();
      const { voice, silent } = pickVoice(synth, lang);
      if (silent) return;
      last = text;
      try {
        if (interrupt) synth.cancel();
        const utterance = new Utterance(text);
        utterance.lang = lang;
        if (voice) utterance.voice = voice;
        synth.speak(utterance);
      } catch {
        // best-effort — no voice is not an error
      }
    },
    reset() { last = null; },
    stop() {
      last = null;
      if (!available) return;
      try { synth.cancel(); } catch { /* best-effort */ }
    }
  };
}
