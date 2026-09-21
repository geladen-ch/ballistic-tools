// Several backup files for one device.
//
// A device writes exactly one file, `backup-<id>.json`, and overwrites it
// each time. More than one file naming the same device is therefore never
// something the app made: it is a browser or cloud client stepping around a
// name collision, or a user renaming a download in a save dialog. The
// everyday source is a browser without folder access (Firefox) exporting by
// download.
//
// No decision here looks at a file name. Which device a file belongs to is
// the `device.id` inside its bundle, and which is newest is the
// `exportedAt` inside it — not the file's modified time, which a copy, a
// restore or a cloud client all rewrite freely. (Only files named
// `backup-*.json` are looked at in the first place; that is a filter on
// what to open, and the fence that keeps a removal from touching anything
// else.)

// Newest first. An unparseable/missing `exportedAt` ranks below any real
// date rather than throwing. Two files with the *same* `exportedAt` are the
// same export saved twice, so which one is kept does not matter — but every
// device must pick the same one, or two devices could each delete the copy
// the other kept. The file name is used for that and nothing else: a fixed
// order over strings, not a claim about what the name means.
function compareNewestFirst(a, b) {
  const timeA = Date.parse(a.bundle.exportedAt);
  const timeB = Date.parse(b.bundle.exportedAt);
  const rankA = Number.isFinite(timeA) ? timeA : -Infinity;
  const rankB = Number.isFinite(timeB) ? timeB : -Infinity;
  if (rankA !== rankB) return rankB - rankA;
  return a.fileName > b.fileName ? -1 : a.fileName < b.fileName ? 1 : 0;
}

/**
 * Splits parsed bundles into the one to use per device and the ones it
 * supersedes.
 *
 * `entries` is `[{ fileName, bundle }]`, every bundle already parsed — a
 * file that could not be read never reaches here, and so can never be
 * classed as superseded: a half-downloaded file must not cost anyone the
 * good one beside it, nor be deleted itself.
 *
 * Returns `{ latest, superseded }`. `latest` keeps first-seen device order;
 * each `superseded` entry carries `supersededBy`, the winning file's name.
 */
export function selectLatestPerDevice(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const id = entry.bundle.device.id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(entry);
  }
  const latest = [];
  const superseded = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(compareNewestFirst);
    latest.push(ordered[0]);
    for (const older of ordered.slice(1)) superseded.push({ ...older, supersededBy: ordered[0].fileName });
  }
  return { latest, superseded };
}
