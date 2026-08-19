// Opens a Labradar export ZIP and returns its .csv entries as text —
// everything else (folders, the device's own .lbr project file, its
// Report.csv summary) is filtered out by filename before any
// decompression happens; content-sniffing for "is this actually a
// track" (as opposed to some other .csv the device wrote) happens one
// layer up, in track-parse.js — this module only knows about ZIP/CSV,
// not the Labradar track format itself.
import { unzipSync, strFromU8 } from '../vendor/fflate/fflate.js';

export async function openTrackBatch(file) {
  const buf = await file.arrayBuffer();
  const files = unzipSync(new Uint8Array(buf), {
    filter: (entry) => entry.name.toLowerCase().endsWith('.csv')
  });
  // Object.entries() on a plain object built by unzipSync() preserves
  // insertion order, i.e. the ZIP's own entry order — the same order the
  // UI lists rows in.
  return Object.entries(files).map(([filename, bytes]) => ({
    filename,
    text: strFromU8(bytes)
  }));
}
