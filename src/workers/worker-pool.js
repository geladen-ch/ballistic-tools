// Fixed pool of module workers running ballistics-worker.js, round-robin
// dispatched. One pool serves every tool: single quick jobs (trajectory,
// BC estimate) land on whichever worker is next in rotation; Monte Carlo
// batches are split across the whole pool by the caller via runAll().
export class WorkerPool {
  constructor(scriptUrl, size = Math.max(1, navigator.hardwareConcurrency || 4)) {
    this.workers = Array.from({ length: size }, () => new Worker(scriptUrl, { type: 'module' }));
    this.pending = new Map();
    this.nextId = 0;
    this.nextWorker = 0;
    for (const worker of this.workers) {
      worker.onmessage = (e) => {
        const { id, ok, result, error } = e.data;
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        ok ? entry.resolve(result) : entry.reject(new Error(error));
      };
    }
  }

  get size() {
    return this.workers.length;
  }

  run(type, payload, { workerIndex } = {}) {
    const id = ++this.nextId;
    const idx = workerIndex !== undefined ? workerIndex : this.nextWorker;
    if (workerIndex === undefined) this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.workers[idx].postMessage({ id, type, payload });
    });
  }

  // Dispatches one payload per worker in the pool concurrently — the shape
  // Monte Carlo batches use to spread `shots` across every core.
  runAll(type, payloads) {
    return Promise.all(payloads.map((payload, i) => this.run(type, payload, { workerIndex: i % this.workers.length })));
  }

  terminate() {
    for (const worker of this.workers) worker.terminate();
  }
}
