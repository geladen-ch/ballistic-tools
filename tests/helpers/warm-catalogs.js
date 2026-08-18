// Pre-loads every built-in bullet/rifle record plus the caliber
// designations list, and waits for the real fetches to finish, before any
// test runs.
//
// Why this exists: bullets.js/rifles.js cache each fetch's *promise* in a
// module-level Map, keyed by id — so within one test-file process, only
// the very first bulletSection()/rifleSection() instance ever pays for a
// real disk read per id; every later one gets an already-resolved promise
// back and resolves on the next microtask (sub-millisecond). But that
// first, cold load touches ~27 separate files (26 bullets + the caliber
// list) via the fake `fetch` in fake-dom.js, which shells out to real
// `fs.readFile` — genuine async I/O funneled through Node's default
// 4-slot libuv threadpool. `node --test` runs every test *file* concurrently,
// each independently doing its own cold load through that same shared,
// small threadpool, so under load the real completion time can climb well
// past a short fixed guess (measured up to 100+ ms under heavy concurrent
// load in this repo, against tests that were guessing 30ms was enough) —
// the exact cause of an intermittent failure in a couple of tests that
// asserted on catalog-derived state (a resolved bullet caliberM, a
// library bullet correctly locked in) right after a fixed-delay wait.
//
// Calling this once, awaiting the *real* promises (not a guessed
// duration), before any test body runs moves that one-time, unbounded-
// under-contention cost out of any individual test's timing-sensitive
// path. Every `await settle()` a test does afterward is then racing an
// already-warm, microtask-speed cache — not real I/O — so a short fixed
// delay is genuinely sufficient, no matter how loaded the machine is.
export async function warmCatalogs() {
  const { loadBulletCatalog, loadBullet, loadCaliberDesignations } = await import('../../src/bullets.js');
  const { loadRifleCatalog, loadRifle } = await import('../../src/rifles.js');
  await Promise.all([
    loadCaliberDesignations(),
    ...loadBulletCatalog().map((id) => loadBullet(id)),
    ...loadRifleCatalog().map((id) => loadRifle(id))
  ]);
}
