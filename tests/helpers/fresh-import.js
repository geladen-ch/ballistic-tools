// Unique ids for cache-busting a dynamic import().
//
// Several suites re-import a module mid-test to get a *fresh* evaluation of
// it — the point being to watch what that module does when it reads cookies
// or localStorage on first load, under state the test has just set up. Since
// import() caches by resolved URL, forcing a re-evaluation means giving it a
// URL it has not seen: `../src/thing.js?reload=<something unique>`.
//
// That "something unique" used to be Date.now(), which is only accurate to
// the millisecond. Two of these imports in the same millisecond — routine,
// since they sit in adjacent tests doing almost no work — produce the *same*
// URL, so the second one silently receives the first one's already-evaluated
// module instead of a fresh one. It then reports whatever state was in force
// during the earlier test, and the assertion fails for a reason nowhere near
// the actual mistake. It also passes about half the time, which is worse.
//
// A counter cannot collide. The module cache is per-process and node:test
// runs each test file in its own process, so a plain counter is enough; it is
// also strictly monotonic by construction rather than by assumption, unlike a
// clock reading.
let counter = 0;

export function freshId() {
  return String(++counter);
}
