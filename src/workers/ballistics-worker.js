// Thin message-protocol shell. All math lives in src/engine/ — pure
// modules importable here, from the main thread, or from a Node test
// runner without pulling in worker/DOM globals.
import { integrate } from '../engine/trajectory.js';
import { estimateBC, estimateBCFromTof } from '../engine/bc-estimate.js';

const HANDLERS = {
  trajectory: integrate,
  bcEstimate: estimateBC,
  bcEstimateTof: estimateBCFromTof
};

self.onmessage = (e) => {
  const { id, type, payload } = e.data;
  const handler = HANDLERS[type];
  try {
    if (!handler) throw new Error(`unknown job type: ${type}`);
    self.postMessage({ id, ok: true, result: handler(payload) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
