// Undo/redo over immutable document snapshots. Pure — every function
// returns a new history. Documents share structure between snapshots
// (model.js only copies what an edit changes), so a long history costs
// little more than its edits.
//
// Coalescing: commits that carry the same non-null `coalesceKey` as the
// one before them replace the latest snapshot instead of adding a new
// one, so a whole drag, or a run of keystrokes in one field, is a single
// undo step. Undo, redo and breakCoalescing() end a run.
export const HISTORY_LIMIT = 1000;

export function createHistory(present, { limit = HISTORY_LIMIT } = {}) {
  return { past: [], present, future: [], limit, coalesceKey: null };
}

export function commit(history, next, { coalesceKey = null } = {}) {
  if (next === history.present) return history;
  if (coalesceKey !== null && coalesceKey === history.coalesceKey) {
    return { ...history, present: next, future: [] };
  }
  const past = [...history.past, history.present];
  if (past.length > history.limit) past.splice(0, past.length - history.limit);
  return { ...history, past, present: next, future: [], coalesceKey };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}

export function undo(history) {
  if (!canUndo(history)) return history;
  const past = history.past.slice(0, -1);
  return { ...history, past, present: history.past[history.past.length - 1], future: [history.present, ...history.future], coalesceKey: null };
}

export function redo(history) {
  if (!canRedo(history)) return history;
  const [present, ...future] = history.future;
  return { ...history, past: [...history.past, history.present], present, future, coalesceKey: null };
}

export function breakCoalescing(history) {
  return history.coalesceKey === null ? history : { ...history, coalesceKey: null };
}
