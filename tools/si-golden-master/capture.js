// Records the golden master for the SI-units refactor: runs every case
// kind in tests/golden/si-golden-cases.js over its seeded inputs and writes
// tests/golden/<kind>.json. Kinds are sharded across worker threads.
//
// The fixtures are the pre-refactor engine's results, so they are captured
// once, before any engine module changes units, and never regenerated after
// that — a regeneration would quietly re-baseline the refactor against
// itself. This script therefore refuses to overwrite an existing fixture
// unless given --force.
//
//   node tools/si-golden-master/capture.js [--force] [kind ...]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const GOLDEN_DIR = fileURLToPath(new URL('../../tests/golden/', import.meta.url));

// A fixed seed per kind (not one shared stream), so adding a kind later
// never changes another kind's inputs.
function seedFor(kind) {
  let h = 2166136261;
  for (const c of `si-golden:${kind}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

async function captureKind(kind) {
  const { installFakeDom } = await import('../../tests/helpers/fake-dom.js');
  installFakeDom();
  const { generateInput, runCase, CASE_COUNTS, makeRng, encode, decode } = await import('../../tests/golden/si-golden-cases.js');
  const seed = seedFor(kind);
  const rng = makeRng(seed);
  const cases = [];
  for (let i = 0; i < CASE_COUNTS[kind]; i++) {
    const input = encode(await generateInput(kind, rng));
    let output;
    try {
      output = encode(await runCase(kind, decode(structuredClone(input))));
    } catch (err) {
      output = { $error: String((err && err.message) || err) };
    }
    // A case is only useful if the engine is deterministic on it.
    let again;
    try {
      again = encode(await runCase(kind, decode(structuredClone(input))));
    } catch (err) {
      again = { $error: String((err && err.message) || err) };
    }
    if (JSON.stringify(again) !== JSON.stringify(output)) throw new Error(`${kind} case ${i} is not deterministic`);
    cases.push({ input, output });
  }
  return { kind, seed, cases };
}

if (isMainThread) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const { CASE_COUNTS } = await import('../../tests/golden/si-golden-cases.js');
  const requested = args.filter((a) => !a.startsWith('--'));
  const kinds = requested.length ? requested : Object.keys(CASE_COUNTS);
  mkdirSync(GOLDEN_DIR, { recursive: true });
  const blocked = kinds.filter((k) => existsSync(`${GOLDEN_DIR}${k}.json`));
  if (blocked.length && !force) {
    console.error(`refusing to overwrite existing fixtures (${blocked.join(', ')}) — they are the pre-refactor baseline; pass --force only if the engine has not changed yet`);
    process.exit(1);
  }
  const queue = [...kinds].sort((a, b) => CASE_COUNTS[b] - CASE_COUNTS[a]);
  const parallel = Math.min(availableParallelism(), queue.length);
  let failed = false;
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (queue.length) {
      const kind = queue.shift();
      const started = Date.now();
      try {
        const result = await new Promise((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { kind } });
          w.once('message', resolve);
          w.once('error', reject);
          w.once('exit', (code) => { if (code !== 0) reject(new Error(`worker exited ${code}`)); });
        });
        const errors = result.cases.filter((c) => c.output && c.output.$error).length;
        writeFileSync(`${GOLDEN_DIR}${kind}.json`, `${JSON.stringify(result)}\n`);
        console.log(`${kind}: ${result.cases.length} cases (${errors} throwing), ${((Date.now() - started) / 1000).toFixed(1)} s`);
      } catch (err) {
        failed = true;
        console.error(`${kind}: FAILED — ${err.stack || err}`);
      }
    }
  }));
  if (failed) process.exit(1);
} else {
  parentPort.postMessage(await captureKind(workerData.kind));
}
