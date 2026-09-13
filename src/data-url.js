// data-URL <-> Blob conversion, shared by location-library.js,
// rifle-precision-library.js (the IndexedDB write/read boundary for a
// photo field) and sync/photo-assets.js (Phase 7's photo-splitting —
// hashing/writing/reading the same bytes as standalone asset files).
// Deliberately not `fetch(dataUrl).then(r => r.blob())` (fails under
// node --test: the test suite's fetch stub only serves file:// URLs) —
// atob/btoa are real globals in both Node 18+ and every browser, so this
// one implementation works identically in prod and tests. Not FileReader
// either, for the same reason (isn't a Node global).
export function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, commaIdx).split(';')[0] || 'application/octet-stream';
  const binary = atob(dataUrl.slice(commaIdx + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// `mimeOverride`, when given, wins over `blob.type` entirely — needed by
// sync/photo-assets.js's asset-file read path, where `blob.type` isn't the
// original photo's real MIME at all: `FileSystemFileHandle.getFile()`
// infers it from the file's *extension*, which is hardcoded ('.jpg') for
// every referenced photo regardless of the photo's actual format. A photo
// that was never JPEG to begin with (location-photo.js's own
// renderPhoto() returns an unedited upload's original bytes untouched —
// whatever the source file's real type was, PNG included — whenever no
// rotation/crop/downscale is actually needed) would otherwise come back
// mislabeled ("image/jpeg" inferred from '.jpg') even though the
// originating device's own copy correctly says "image/png" — identical
// bytes, a one-character-different data-URL prefix, which is exactly
// enough for a byte-for-byte record comparison to call it "diverged
// content" and route an unremarkable, unedited photo to manual review on
// every single sync, forever.
export async function blobToDataUrl(blob, { mimeOverride } = {}) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const mime = mimeOverride || blob.type || 'application/octet-stream';
  return `data:${mime};base64,${btoa(binary)}`;
}
