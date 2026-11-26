// Cloning an Arsenal rifle (with all its cartridges) or one cartridge of a
// rifle — the pure record side of the Arsenal's Clone buttons. The view
// asks for a name in a modal (ui/arsenal/clone-dialog.js) and saves what
// these return through user-library.js, which stamps the new record's
// modifiedAt/modifiedBy/revision the same as any other first save.

// The bookkeeping a stored record carries about *its own* history — never
// part of a copy, which is a new record with a history of its own.
const RECORD_METADATA = ['modifiedAt', 'modifiedBy', 'revision', 'unsaved', 'deletedAt', 'deletedBy'];

function withoutMetadata(record) {
  const copy = { ...record };
  for (const key of RECORD_METADATA) delete copy[key];
  return copy;
}

function normalizedName(name) {
  return name.trim().toLowerCase();
}

export function isNameTaken(name, takenNames) {
  const wanted = normalizedName(name);
  return takenNames.some((n) => normalizedName(n) === wanted);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The first free "<name> (Clone n)" for n = 1, 2, …, compared the same
// case/whitespace-insensitive way user-library.js's findByName() does.
// `format(name, n)` builds one candidate (the localized pattern). Cloning
// a clone counts on from the original's name — "Foo (Clone 1)" proposes
// "Foo (Clone 2)", not "Foo (Clone 1) (Clone 1)" — recognized by matching
// the name against that same pattern.
export function proposeCloneName(name, takenNames, format) {
  const pattern = format('\u0000', '\u0001');
  const [beforeName, afterName] = pattern.split('\u0000');
  const suffix = new RegExp(`^(.+?)${escapeRegExp(afterName).replace('\u0001', '\\d+')}$`);
  let base = name.trim();
  if (!beforeName && afterName && afterName.includes('\u0001')) {
    const match = base.match(suffix);
    if (match) base = match[1];
  }
  for (let n = 1; ; n++) {
    const candidate = format(base, n);
    if (!isNameTaken(candidate, takenNames)) return candidate;
  }
}

// A full copy of `rifle`: every cartridge copied under a fresh id, and a
// cartridge's "zeroed with" reference (zero-donor.js) re-pointed at the
// copy of its donor, so the clone's zeros stay among its own cartridges.
// Bullets and the scope are shared library entries, referenced, not
// copied.
export function cloneRifleRecord(rifle, { id, name, newCartridgeId }) {
  const idMap = new Map(rifle.cartridges.map((c) => [c.id, newCartridgeId()]));
  const cartridges = rifle.cartridges.map((c) => {
    const copy = { ...c, id: idMap.get(c.id) };
    if (c.zeroedWithCartridgeId) copy.zeroedWithCartridgeId = idMap.get(c.zeroedWithCartridgeId) ?? null;
    return copy;
  });
  return { ...withoutMetadata(rifle), id, name, cartridges };
}

// A copy of one cartridge, for the same rifle. It keeps the original's
// "zeroed with" reference — the donor is a sibling on that same rifle — so
// a clone of a recipient is zeroed with the same cartridge. A clone of a
// donor is just a cartridge; nothing points at it yet.
export function cloneCartridgeRecord(cartridge, { id, name }) {
  return { ...cartridge, id, name };
}
