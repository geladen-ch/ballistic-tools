import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  isFileSystemAccessSupported, pickFolder, getPersistedFolderHandle, forgetFolder,
  verifyPermission, listBackupFiles, readFile, writeOwnBackupFile, writeAssetIfAbsent, readAssetFile
} = await import('../src/sync/fs-folder.js');

// Recursive fake — a directory's `entries` map holds `{ kind: 'file',
// content }` (content a string or a Blob, whatever was actually written)
// or `{ kind: 'directory', children: {} }`, so getDirectoryHandle() can
// hand back another one of these scoped to that subtree (needed for
// Phase 7's assets/ subfolder).
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
    }
  };
}

test('isFileSystemAccessSupported reflects whether window.showDirectoryPicker exists', () => {
  global.window = {};
  assert.equal(isFileSystemAccessSupported(), false);
  global.window = { showDirectoryPicker: () => {} };
  assert.equal(isFileSystemAccessSupported(), true);
});

test('pickFolder persists the handle from showDirectoryPicker, readable back via getPersistedFolderHandle', async () => {
  const fakeHandle = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => fakeHandle };

  const returned = await pickFolder();
  assert.equal(returned, fakeHandle);

  const persisted = await getPersistedFolderHandle();
  assert.equal(persisted, fakeHandle);
});

test('getPersistedFolderHandle returns null when nothing has been picked yet', async () => {
  await forgetFolder();
  assert.equal(await getPersistedFolderHandle(), null);
});

test('forgetFolder removes a previously persisted handle', async () => {
  global.window = { showDirectoryPicker: async () => makeFakeDirHandle() };
  await pickFolder();
  await forgetFolder();
  assert.equal(await getPersistedFolderHandle(), null);
});

test('verifyPermission returns true immediately when already granted, without prompting', async () => {
  let requestCalled = false;
  const handle = {
    queryPermission: async () => 'granted',
    requestPermission: async () => { requestCalled = true; return 'granted'; }
  };
  assert.equal(await verifyPermission(handle), true);
  assert.equal(requestCalled, false);
});

test('verifyPermission returns false without prompting when allowPrompt is not set', async () => {
  const handle = { queryPermission: async () => 'prompt', requestPermission: async () => 'granted' };
  assert.equal(await verifyPermission(handle), false);
});

test('verifyPermission prompts and reflects the result when allowPrompt is true', async () => {
  const granted = { queryPermission: async () => 'prompt', requestPermission: async () => 'granted' };
  assert.equal(await verifyPermission(granted, { allowPrompt: true }), true);

  const denied = { queryPermission: async () => 'prompt', requestPermission: async () => 'denied' };
  assert.equal(await verifyPermission(denied, { allowPrompt: true }), false);
});

test('listBackupFiles returns only backup-*.json files, ignoring directories and unrelated files', async () => {
  const dir = makeFakeDirHandle({
    'backup-device-a.json': { kind: 'file', content: '{}' },
    'backup-device-b.json': { kind: 'file', content: '{}' },
    'notes.txt': { kind: 'file', content: 'hi' },
    'subfolder': { kind: 'directory' }
  });
  const names = await listBackupFiles(dir);
  assert.deepEqual(names.sort(), ['backup-device-a.json', 'backup-device-b.json']);
});

test('readFile returns a named file\'s text content', async () => {
  const dir = makeFakeDirHandle({ 'backup-device-a.json': { kind: 'file', content: '{"hello":"world"}' } });
  assert.equal(await readFile(dir, 'backup-device-a.json'), '{"hello":"world"}');
});

test('writeOwnBackupFile writes to backup-<deviceId>.json, creating it if absent', async () => {
  const dir = makeFakeDirHandle();
  await writeOwnBackupFile(dir, 'my-device-id', '{"content":true}');
  assert.equal(await readFile(dir, 'backup-my-device-id.json'), '{"content":true}');
});

test('writeOwnBackupFile overwrites an existing file for the same device', async () => {
  const dir = makeFakeDirHandle({ 'backup-my-device-id.json': { kind: 'file', content: 'old' } });
  await writeOwnBackupFile(dir, 'my-device-id', 'new');
  assert.equal(await readFile(dir, 'backup-my-device-id.json'), 'new');
});

test('writeAssetIfAbsent creates the assets/ subfolder and writes the file into it', async () => {
  const dir = makeFakeDirHandle();
  const blob = new Blob(['photo bytes'], { type: 'image/jpeg' });
  await writeAssetIfAbsent(dir, 'sha256-abc.jpg', blob);

  const file = await readAssetFile(dir, 'sha256-abc.jpg');
  const text = await file.text();
  assert.equal(text, 'photo bytes');
});

test('writeAssetIfAbsent does not overwrite an asset that already exists', async () => {
  const dir = makeFakeDirHandle();
  await writeAssetIfAbsent(dir, 'sha256-abc.jpg', new Blob(['original'], { type: 'image/jpeg' }));
  await writeAssetIfAbsent(dir, 'sha256-abc.jpg', new Blob(['different bytes'], { type: 'image/jpeg' }));

  const file = await readAssetFile(dir, 'sha256-abc.jpg');
  assert.equal(await file.text(), 'original');
});

test('readAssetFile throws when the asset (or the assets folder itself) does not exist', async () => {
  const dir = makeFakeDirHandle();
  await assert.rejects(() => readAssetFile(dir, 'sha256-nope.jpg'));

  await writeAssetIfAbsent(dir, 'sha256-abc.jpg', new Blob(['x'], { type: 'image/jpeg' }));
  await assert.rejects(() => readAssetFile(dir, 'sha256-other.jpg'));
});

test('writing an asset does not disturb the backup-*.json files at the folder root', async () => {
  const dir = makeFakeDirHandle({ 'backup-device-a.json': { kind: 'file', content: '{}' } });
  await writeAssetIfAbsent(dir, 'sha256-abc.jpg', new Blob(['x'], { type: 'image/jpeg' }));

  assert.deepEqual(await listBackupFiles(dir), ['backup-device-a.json']);
  assert.equal(await readFile(dir, 'backup-device-a.json'), '{}');
});
