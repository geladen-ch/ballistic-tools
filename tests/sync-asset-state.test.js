// The write-intent journal and content verification that make asset
// writes crash-safe — docs/plans/orphaned-storage-cleanup.md phase 2.
//
// The property under test throughout: nothing here ever opens an asset
// file to decide anything. A zero-byte or truncated asset is found by
// remembering that a write did not finish, not by measuring the file,
// because whether `getFile()` hydrates a cloud client's on-demand
// placeholder is not knowable across every platform this app supports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { writeAssetIfAbsent, readAssetFile } = await import('../src/sync/fs-folder.js');
const {
  initAssetState, resetAssetStateForTests, reloadAssetStateForTests,
  hasWriteIntent, isAssetBad, markAssetBad, markWriteIntent,
  getAssetState, recordAssetsSeen, getFirstSeenAt, pruneAssetState, listAssetState
} = await import('../src/sync/asset-state.js');
const { resolveBundlePhotoRefs, assetFileName } = await import('../src/sync/photo-assets.js');

// Same recursive fake as the other fs-folder suites. `getFile()` returns
// no `size` and no `lastModified` on purpose: nothing in this phase may
// depend on either, and leaving them out is what proves it.
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
            type: isBlob ? content.type : ''
          };
        },
        async createWritable() {
          return {
            async write(value) { entries[name].content = value; },
            async close() {}
          };
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

async function refFor(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256-${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

test.beforeEach(async () => {
  localStorage.clear();
  await resetAssetStateForTests();
});

test('a completed write clears its own intent and records the size', async () => {
  const dir = makeFakeDirHandle();
  const ref = await refFor('photo bytes');
  await writeAssetIfAbsent(dir, `${ref}.jpg`, new Blob(['photo bytes'], { type: 'image/jpeg' }));

  assert.equal(hasWriteIntent(ref), false, 'a finished write must leave no intent behind');
  const state = getAssetState(ref);
  assert.equal(state.bytes, new Blob(['photo bytes']).size);
  assert.ok(state.firstSeenAt);
});

test('an asset already present with no pending intent is left alone', async () => {
  const dir = makeFakeDirHandle();
  const ref = await refFor('original');
  await writeAssetIfAbsent(dir, `${ref}.jpg`, new Blob(['original'], { type: 'image/jpeg' }));
  await writeAssetIfAbsent(dir, `${ref}.jpg`, new Blob(['different bytes'], { type: 'image/jpeg' }));

  const file = await readAssetFile(dir, `${ref}.jpg`);
  assert.equal(await file.text(), 'original', 'write-once still holds for a file nothing is suspicious of');
});

test('a file left behind by an interrupted write is repaired on the next call', async () => {
  const dir = makeFakeDirHandle();
  const ref = await refFor('the real bytes');

  // Exactly what a process killed between getFileHandle(create: true) and
  // close() leaves behind: the file exists at its real name, empty, and
  // the intent that was recorded before it was created is still pending.
  await markWriteIntent(ref);
  await dir.getDirectoryHandle('assets', { create: true });
  const assets = await dir.getDirectoryHandle('assets');
  await assets.getFileHandle(`${ref}.jpg`, { create: true });

  await writeAssetIfAbsent(dir, `${ref}.jpg`, new Blob(['the real bytes'], { type: 'image/jpeg' }));

  const file = await readAssetFile(dir, `${ref}.jpg`);
  assert.equal(await file.text(), 'the real bytes', 'the empty file must be rewritten, not skipped as present');
  assert.equal(hasWriteIntent(ref), false);
});

test('a pending intent survives a reload, so the repair happens after a restart', async () => {
  const ref = await refFor('anything');
  await markWriteIntent(ref);
  await reloadAssetStateForTests();

  assert.equal(hasWriteIntent(ref), true, 'the journal is useless if it does not outlive the crash');
});

test('an intent has no time-based expiry', async () => {
  // An earlier draft expired intents after a day. That reopened the very
  // bug this phase closes: the file is named for a photo still in the
  // library, so cleanup treats it as referenced and never removes it,
  // while an expired intent means the next publish skips it as "present"
  // and ships a bundle pointing at broken bytes.
  const ref = await refFor('x');
  await markWriteIntent(ref);
  const state = getAssetState(ref);
  assert.ok(state.writeIntentAt);
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'expiresAt'), false);
  await reloadAssetStateForTests();
  assert.equal(hasWriteIntent(ref), true);
});

test('a ref marked bad is rewritten even though the file is present', async () => {
  const dir = makeFakeDirHandle();
  const ref = await refFor('good bytes');
  await writeAssetIfAbsent(dir, `${ref}.jpg`, new Blob(['good bytes'], { type: 'image/jpeg' }));

  // Something other than our own crash corrupted it, and a reader noticed.
  const assets = await dir.getDirectoryHandle('assets');
  const handle = await assets.getFileHandle(`${ref}.jpg`);
  const writable = await handle.createWritable();
  await writable.write('corrupted');
  await writable.close();
  await markAssetBad(ref);

  await writeAssetIfAbsent(dir, `${ref}.jpg`, new Blob(['good bytes'], { type: 'image/jpeg' }));
  const file = await readAssetFile(dir, `${ref}.jpg`);
  assert.equal(await file.text(), 'good bytes');
  assert.equal(isAssetBad(ref), false, 'a successful rewrite clears the mark');
});

test('a reader rejects an asset whose bytes do not hash to its name, and marks it', async () => {
  const ref = await refFor('what it should be');
  const bundle = {
    photoStorage: 'referenced',
    locations: { locations: [{ id: 'loc1', name: 'Range', photoRef: ref, targets: [] }] },
    riflePrecision: { projects: [] }
  };
  const readAsset = async () => ({
    arrayBuffer: async () => new TextEncoder().encode('something else entirely').buffer,
    type: 'image/jpeg'
  });

  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset, onUnresolvable: 'skip' });
  assert.equal(anySkipped, true, 'corrupt content must not be merged in as a photo');
  assert.equal(bundle.locations.locations.length, 0);
  assert.equal(isAssetBad(ref), true, 'the mark is what gets it repaired on the next publish');
});

test('a reader accepts an asset whose bytes do hash to its name', async () => {
  const ref = await refFor('genuine photo bytes');
  const bundle = {
    photoStorage: 'referenced',
    locations: { locations: [{ id: 'loc1', name: 'Range', photoRef: ref, targets: [] }] },
    riflePrecision: { projects: [] }
  };
  const readAsset = async () => ({
    arrayBuffer: async () => new TextEncoder().encode('genuine photo bytes').buffer,
    type: 'image/jpeg'
  });

  const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset });
  assert.equal(anySkipped, false);
  assert.equal(bundle.locations.locations.length, 1);
  assert.ok(bundle.locations.locations[0].photo.startsWith('data:image/jpeg;base64,'));
  assert.equal(isAssetBad(ref), false);
});

test('a zero-byte asset is rejected under both unresolvable postures', async () => {
  const ref = await refFor('real content');
  const readAsset = async () => ({
    arrayBuffer: async () => new ArrayBuffer(0),
    type: 'image/jpeg'
  });

  const skipBundle = {
    photoStorage: 'referenced',
    locations: { locations: [{ id: 'a', name: 'A', photoRef: ref, targets: [] }] },
    riflePrecision: { projects: [] }
  };
  await resolveBundlePhotoRefs(skipBundle, { readAsset, onUnresolvable: 'skip' });
  assert.equal(skipBundle.locations.locations.length, 0);

  const nullBundle = {
    photoStorage: 'referenced',
    locations: { locations: [{ id: 'a', name: 'A', photoRef: ref, targets: [] }] },
    riflePrecision: { projects: [] }
  };
  await resolveBundlePhotoRefs(nullBundle, { readAsset, onUnresolvable: 'null' });
  assert.equal(nullBundle.locations.locations.length, 1);
  assert.equal(nullBundle.locations.locations[0].photo, null, 'imported without its photo, never with broken bytes');
});

test('first-seen starts a ref\'s clock once and never restarts it', async () => {
  await recordAssetsSeen(['sha256-aaa', 'sha256-bbb']);
  const first = getFirstSeenAt('sha256-aaa');
  assert.ok(first);

  await recordAssetsSeen(['sha256-aaa']);
  assert.equal(getFirstSeenAt('sha256-aaa'), first, 'a later sighting must not reset the age clock');
});

test('pruning drops state for refs that have left the folder', async () => {
  await recordAssetsSeen(['sha256-aaa', 'sha256-bbb', 'sha256-ccc']);
  const removed = await pruneAssetState(['sha256-bbb']);

  assert.equal(removed, 2);
  assert.deepEqual(listAssetState().map((s) => s.id), ['sha256-bbb']);
  await reloadAssetStateForTests();
  assert.deepEqual(listAssetState().map((s) => s.id), ['sha256-bbb'], 'the prune must be durable');
});

test('initAssetState is safe to call repeatedly', async () => {
  await recordAssetsSeen(['sha256-aaa']);
  await initAssetState();
  await initAssetState();
  assert.equal(listAssetState().length, 1);
});
