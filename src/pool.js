// Single shared worker pool for the whole app — every tool dispatches
// through this instead of spinning up its own workers.
import { WorkerPool } from './workers/worker-pool.js';

let pool = null;

export function getPool() {
  if (!pool) pool = new WorkerPool(new URL('./workers/ballistics-worker.js', import.meta.url));
  return pool;
}
