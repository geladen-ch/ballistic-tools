import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { applyReferencedPhotoStorage, resolveBundlePhotoRefs } = await import('../src/sync/photo-assets.js');
const { readAssetFile } = await import('../src/sync/fs-folder.js');

function readAssetFrom(dir) {
  return (filename) => readAssetFile(dir, filename);
}

// Same recursive fake as sync-fs-folder.test.js/sync-auto-sync.test.js,
// with one deliberate difference: `getFile()`'s `type` is derived from the
// filename's own extension, exactly like a real browser's
// FileSystemFileHandle.getFile() does for a plain file on disk — never
// from whatever Blob.type the file happened to be *written* with. A real
// disk file carries no MIME metadata of its own; the extension is all the
// browser has to go on. Getting this right in the fake is what makes it
// possible to write a test that would actually catch a regression here —
// a fake that echoed back the written Blob's own `.type` (as an earlier
// version of this fake did) can never fail the way a real browser would,
// since it isn't exercising the same lossy step at all.
function inferTypeFromExtension(name) {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return '';
}

function makeFakeDirHandle(entries = {}) {
  return {
    kind: 'directory',
    async *entries() {
      for (const [name, entry] of Object.entries(entries)) yield [name, entry];
    },
    async getFileHandle(name, { create } = {}) {
      if (!(name in entries) && !create) throw new Error(`not found: ${name}`);
      if (!(name in entries)) entries[name] = { kind: 'file', content: '' };
      return {
        kind: 'file',
        async getFile() {
          const content = entries[name].content;
          const isBlob = content && typeof content.text === 'function';
          return {
            text: async () => (isBlob ? content.text() : content),
            arrayBuffer: async () => (isBlob ? content.arrayBuffer() : new TextEncoder().encode(content).buffer),
            type: inferTypeFromExtension(name)
          };
        },
        async createWritable() {
          return { async write(value) { entries[name].content = value; }, async close() {} };
        }
      };
    },
    async getDirectoryHandle(name, { create } = {}) {
      if (!(name in entries)) {
        if (!create) throw new Error(`not found: ${name}`);
        entries[name] = { kind: 'directory', children: {} };
      }
      return makeFakeDirHandle(entries[name].children);
    },
    _entries: entries
  };
}

// A tiny valid JPEG-ish data-URL — content doesn't need to be a real JPEG
// for these tests, just consistent base64 the atob-based dataUrlToBlob can
// decode.
function makePhoto(content) {
  return `data:image/jpeg;base64,${Buffer.from(content).toString('base64')}`;
}

function makeBundle(overrides = {}) {
  return {
    format: 'ebalka2-backup', version: 1, photoStorage: 'inline',
    device: { id: 'peer-1', name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [], rifles: [] },
    locations: { locations: [] },
    riflePrecision: { projects: [] },
    ...overrides
  };
}

test('applyReferencedPhotoStorage converts a location photo to a photoRef and writes the asset', async () => {
  const dir = makeFakeDirHandle();
  const bundle = makeBundle({
    locations: { locations: [{ id: 'loc1', name: 'Range', photo: makePhoto('photo-bytes'), targets: [] }] }
  });

  await applyReferencedPhotoStorage(bundle, dir);

  assert.equal(bundle.photoStorage, 'referenced');
  const location = bundle.locations.locations[0];
  assert.equal(location.photo, undefined);
  assert.ok(location.photoRef.startsWith('sha256-'));
});

test('applyReferencedPhotoStorage converts every target photo in a rifle-precision project', async () => {
  const dir = makeFakeDirHandle();
  const bundle = makeBundle({
    riflePrecision: {
      projects: [{
        id: 'p1', name: 'Project', createdAt: '2020-01-01T00:00:00.000Z',
        targets: [
          { id: 't1', name: 'T1', photo: makePhoto('a') },
          { id: 't2', name: 'T2', photo: makePhoto('b') },
          { id: 't3', name: 'T3', photo: null }
        ]
      }]
    }
  });

  await applyReferencedPhotoStorage(bundle, dir);

  const [t1, t2, t3] = bundle.riflePrecision.projects[0].targets;
  assert.ok(t1.photoRef.startsWith('sha256-'));
  assert.ok(t2.photoRef.startsWith('sha256-'));
  assert.notEqual(t1.photoRef, t2.photoRef);
  assert.equal(t3.photo, null);
  assert.equal(t3.photoRef, undefined);
});

test('identical photo content across two records produces the same photoRef and writes the asset only once', async () => {
  const dir = makeFakeDirHandle();
  const samePhoto = makePhoto('identical bytes');
  const bundle = makeBundle({
    locations: {
      locations: [
        { id: 'loc1', name: 'A', photo: samePhoto, targets: [] },
        { id: 'loc2', name: 'B', photo: samePhoto, targets: [] }
      ]
    }
  });

  await applyReferencedPhotoStorage(bundle, dir);

  const [a, b] = bundle.locations.locations;
  assert.equal(a.photoRef, b.photoRef);
  assert.equal(Object.keys(dir._entries.assets.children).length, 1);
});

test('a tombstone (no photo field at all) passes through untouched', async () => {
  const dir = makeFakeDirHandle();
  const bundle = makeBundle({
    locations: { locations: [{ id: 'loc1', name: 'Deleted', deletedAt: '2021-01-01T00:00:00.000Z', deletedBy: 'dev', targets: [] }] }
  });

  await applyReferencedPhotoStorage(bundle, dir);
  assert.equal(bundle.locations.locations[0].photoRef, undefined);
});

test('round-trip: applyReferencedPhotoStorage then resolveBundlePhotoRefs recovers the original photo', async () => {
  const dir = makeFakeDirHandle();
  const originalPhoto = makePhoto('roundtrip bytes');
  const bundle = makeBundle({
    locations: { locations: [{ id: 'loc1', name: 'Range', photo: originalPhoto, targets: [] }] }
  });

  await applyReferencedPhotoStorage(bundle, dir);
  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset: readAssetFrom(dir) });

  assert.equal(bundle.locations.locations[0].photo, originalPhoto);
  assert.equal(bundle.locations.locations[0].photoRef, undefined);
  assert.equal(anySkipped, false);
});

// Regression: reproduces a real field report. location-photo.js's own
// renderPhoto() returns an unedited upload's original bytes untouched
// whenever no rotation/crop/downscale is needed — whatever MIME the
// source file actually was, not necessarily JPEG. The asset file this
// photo gets split into is always named '.jpg' regardless (see
// ASSET_EXTENSION's own comment), so a peer resolving it back gets a File
// whose `.type` the browser infers from that extension — "image/jpeg" —
// even when the true original was "image/png". Byte-identical photo, a
// one-character-different data-URL prefix ("png" vs "jpeg") — enough for
// a strict record comparison to call it "diverged content" on every
// single sync, forever, for a photo nobody ever touched.
test('regression: a non-JPEG photo (e.g. an unedited PNG upload) survives the referenced round-trip with its true MIME type intact', async () => {
  const dir = makeFakeDirHandle();
  const originalPhoto = `data:image/png;base64,${Buffer.from('png-shaped bytes').toString('base64')}`;
  const bundle = makeBundle({
    locations: { locations: [{ id: 'loc1', name: 'Range', photo: originalPhoto, targets: [] }] }
  });

  await applyReferencedPhotoStorage(bundle, dir);
  assert.equal(bundle.locations.locations[0].photoMime, 'image/png', 'the true MIME travels alongside photoRef');

  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset: readAssetFrom(dir) });

  assert.equal(anySkipped, false);
  assert.equal(bundle.locations.locations[0].photo, originalPhoto,
    'reconstructed exactly, not mislabeled via the asset file\'s own (.jpg-inferred) type');
  assert.equal(bundle.locations.locations[0].photoRef, undefined);
  assert.equal(bundle.locations.locations[0].photoMime, undefined, 'transient — cleaned up once resolved');
});

test('resolveBundlePhotoRefs is a no-op for an inline (or pre-Phase-7) bundle', async () => {
  const bundle = makeBundle({
    photoStorage: 'inline',
    locations: { locations: [{ id: 'loc1', name: 'Range', photo: makePhoto('x'), targets: [] }] }
  });
  const before = JSON.stringify(bundle);
  await resolveBundlePhotoRefs(bundle, { readAsset: null });
  assert.equal(JSON.stringify(bundle), before);

  delete bundle.photoStorage; // simulate a bundle from before this feature existed
  const before2 = JSON.stringify(bundle);
  await resolveBundlePhotoRefs(bundle, { readAsset: null });
  assert.equal(JSON.stringify(bundle), before2);
});

test('onUnresolvable "skip" (default) drops an unresolvable location from the bundle entirely', async () => {
  const bundle = makeBundle({
    photoStorage: 'referenced',
    locations: {
      locations: [
        { id: 'loc1', name: 'Resolvable', photoRef: 'sha256-not-written', targets: [] },
        { id: 'loc2', name: 'No photo at all', targets: [] }
      ]
    }
  });
  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset: null }); // no dirHandle — nothing is resolvable

  const remaining = bundle.locations.locations;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'loc2'); // the one with no photoRef at all needed no resolution, so it stays
  assert.equal(anySkipped, true, 'the caller (auto-sync.js) uses this to warn that a peer\'s photo is still pending');
});

test('onUnresolvable "null" imports the record anyway, with photo set to null, and does not report anySkipped', async () => {
  const bundle = makeBundle({
    photoStorage: 'referenced',
    locations: { locations: [{ id: 'loc1', name: 'Unresolvable', photoRef: 'sha256-not-written', targets: [] }] }
  });
  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset: null, onUnresolvable: 'null' });

  assert.equal(bundle.locations.locations.length, 1);
  assert.equal(bundle.locations.locations[0].photo, null);
  assert.equal(anySkipped, false, 'the one-shot manual-sync path imports immediately, so there\'s nothing to warn about');
  assert.equal(bundle.locations.locations[0].photoRef, undefined);
});

test('a rifle-precision project with one unresolvable target photo is dropped whole under "skip"', async () => {
  const dir = makeFakeDirHandle();
  const bundle = makeBundle({
    photoStorage: 'referenced',
    riflePrecision: {
      projects: [{
        id: 'p1', name: 'Project', createdAt: '2020-01-01T00:00:00.000Z',
        targets: [
          { id: 't1', name: 'T1', photoRef: 'sha256-does-not-exist' },
          { id: 't2', name: 'T2' } // no photo — fine on its own
        ]
      }]
    }
  });
  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset: readAssetFrom(dir) });
  assert.equal(bundle.riflePrecision.projects.length, 0);
  assert.equal(anySkipped, true);
});

test('a rifle-precision project resolves fully when every target photo is available', async () => {
  const dir = makeFakeDirHandle();
  const bundle = makeBundle({
    riflePrecision: {
      projects: [{
        id: 'p1', name: 'Project', createdAt: '2020-01-01T00:00:00.000Z',
        targets: [{ id: 't1', name: 'T1', photo: makePhoto('x') }]
      }]
    }
  });
  await applyReferencedPhotoStorage(bundle, dir);
  await resolveBundlePhotoRefs(bundle, { readAsset: readAssetFrom(dir) });

  assert.equal(bundle.riflePrecision.projects.length, 1);
  assert.equal(bundle.riflePrecision.projects[0].targets[0].photo, makePhoto('x'));
});
