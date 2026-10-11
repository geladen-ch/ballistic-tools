// Thin message-protocol shell. All math lives in src/engine/ — pure
// modules importable here, from the main thread, or from a Node test
// runner without pulling in worker/DOM globals.
import { integrate, solveDirectHit, solveDangerZone } from '../engine/trajectory.js';
import { estimateBC, estimateBCFromTof } from '../engine/bc-estimate.js';
import { estimateTrackBCWholeWindow } from '../engine/labradar-bc.js';
import { computePrepare } from '../ui/truing-session/prepare-compute.js';
import { analyseSession } from '../ui/truing-session/session-model.js';

// the truing session's analysis, without its internal mixture (large, and read by nothing outside it)
const truingAnalyse = (request) => { const { joint, ...analysis } = analyseSession(request); return analysis; };

const HANDLERS = {
  trajectory: integrate,
  directHit: solveDirectHit,
  dangerZone: solveDangerZone,
  bcEstimate: estimateBC,
  bcEstimateTof: estimateBCFromTof,
  labradarTrackBc: estimateTrackBCWholeWindow,
  truingPrepare: computePrepare,
  truingAnalyse
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
