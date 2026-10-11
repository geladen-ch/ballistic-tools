// Runs the truing session's heavy computations off the main thread, on the app's shared worker pool, so a phone stays responsive:
// the Prepare screen's planning (prepare-compute.js) and the Shoot and Conclude screens' analysis (analyseSession). Always the same
// worker, so the engine's planning memo stays warm from one change to the next. `setPlannerTransport` replaces the worker with
// another way of running the job (tests run it in-process).
import { getPool } from '../../pool.js';

const PLANNER_WORKER = 0;
let transport = (type, payload) => getPool().run(type, payload, { workerIndex: PLANNER_WORKER });

export function setPlannerTransport(fn) {
  transport = fn;
}

// Resolves with computePrepare(request)'s result.
export function requestPrepare(request) {
  return transport('truingPrepare', request);
}

// Resolves with analyseSession(request)'s result, without its internal `joint` mixture (large, and read by nothing outside it).
export function requestAnalysis(request) {
  return transport('truingAnalyse', request);
}
