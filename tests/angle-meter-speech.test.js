import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { createSpeaker } = await import('../src/ui/angle-meter/speech.js');

function installSynth(voices) {
  const spoken = [];
  let cancels = 0;
  globalThis.speechSynthesis = {
    getVoices: () => voices,
    speak: (u) => spoken.push(u),
    cancel: () => { cancels++; }
  };
  globalThis.SpeechSynthesisUtterance = function (text) { this.text = text; };
  return { spoken, cancels: () => cancels };
}

test.afterEach(() => {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

test('speaks in the app language with a matching voice, once per repeated text', () => {
  const synth = installSynth([{ lang: 'de-DE' }, { lang: 'en-GB' }]);
  const speaker = createSpeaker();
  speaker.say('Keep still…');
  speaker.say('Keep still…');
  speaker.say('Reading taken.', { interrupt: true });
  assert.deepEqual(synth.spoken.map((u) => u.text), ['Keep still…', 'Reading taken.']);
  assert.equal(synth.spoken[0].voice.lang, 'en-GB');
  assert.equal(synth.spoken[0].lang, 'en');
  assert.equal(synth.cancels(), 1);
});

test('stays silent when the phone has voices but none for the app language', () => {
  const synth = installSynth([{ lang: 'de-DE' }]);
  createSpeaker().say('Keep still…');
  assert.equal(synth.spoken.length, 0);
});

test('without speech support nothing happens and nothing throws', () => {
  const speaker = createSpeaker();
  speaker.say('Keep still…');
  speaker.stop();
});
