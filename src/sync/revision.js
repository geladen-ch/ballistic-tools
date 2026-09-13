// A Lamport-style integer counter carried on every synced record — see
// docs/plans/backup-sync.md Phase 4's "revision counter" for the original
// rationale: unlike modifiedAt/deletedAt (wall-clock, so dependent on every
// device's clock being roughly correct), a revision only ever moves
// forward through an unbroken local chain of "I wrote this, building on
// whatever I'd already seen" — so the common sequential case (edit on the
// phone, let it sync, edit on the laptop) resolves correctly regardless of
// which device's clock, if either, is wrong. It's a strict addition to the
// timestamp-based comparison, not a replacement for it: see merge.js's own
// comment on why genuinely concurrent edits (equal revisions) still fall
// through to the timestamp tiebreak.
//
// A record with no revision at all (everything that existed before this
// field did) reads as 0 — backward compatible by construction.
export function revisionOf(record) {
  return (record && typeof record.revision === 'number' && Number.isFinite(record.revision)) ? record.revision : 0;
}

// An ordinary LOCAL write's revision (a real edit, or a local delete) —
// always exactly one more than whatever this device already had stored
// for this id, regardless of what the value being written over it
// happens to carry. That "regardless of" is deliberate and load-bearing,
// not an oversight of the more literal "combine with the incoming value"
// rule the plan originally described (see merge.js's own comment on why
// that literal rule breaks under this app's bidirectional gossip
// topology): a revert (Phase 9) writing back an old, low-revision
// snapshot, or a conflict resolution's "Keep mine"/"Take theirs" writing
// back a value that lost the review, both still need to end up strictly
// ahead of whatever is *currently* stored — never behind it, and never
// merely equal to it — and using only `previousStored` (never anything
// about the value being written) is what guarantees that unconditionally,
// with no special-casing at either call site.
export function nextLocalRevision(previousStored) {
  return revisionOf(previousStored) + 1;
}
