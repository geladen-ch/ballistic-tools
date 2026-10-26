// Runs the Reticle Designer's untrusted-input parsing off the main
// thread: an SVG import (reticle/svg-import/extract.js) or a reticle file
// being loaded (reticle/file-codec.js). One worker per job, terminated
// afterwards (or on timeout by the caller), so a pathological input can
// neither freeze the app nor leave state behind for the next job.
import { extractShape } from '../reticle/svg-import/extract.js';
import { parseReticle } from '../reticle/file-codec.js';

const JOBS = {
  svg: (text) => ({ shape: extractShape(text) }),
  reticle: (text) => ({ doc: parseReticle(text) })
};

self.onmessage = (event) => {
  const { kind, text } = event.data || {};
  try {
    const job = JOBS[kind];
    if (!job) throw new Error('unknown job');
    self.postMessage({ ok: true, ...job(text) });
  } catch (err) {
    self.postMessage({
      ok: false,
      code: typeof err?.code === 'string' ? err.code : 'unexpected',
      detail: err?.name === 'ImportError' ? err.detail : {}
    });
  }
};
