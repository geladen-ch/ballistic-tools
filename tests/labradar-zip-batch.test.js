import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from '../src/vendor/fflate/fflate.js';
import { openTrackBatch } from '../src/labradar/zip-batch.js';

// A minimal fake File/Blob — openTrackBatch() only ever calls
// .arrayBuffer() on what it's given, so a real File isn't needed.
function fakeFile(buf) {
  return { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

test('openTrackBatch surfaces only .csv entries, in original zip order, decoded as text', async () => {
  const zipped = zipSync({
    'SR0001/TRK/Shot0001 Track.csv': strToU8('Time (s);Vel (m/s);Dist (m);SNR\n0;800;0;-\n'),
    'SR0001/SR0001.lbr': strToU8('not a csv at all'),
    'SR0001/SR0001 Report.csv': strToU8('Shot ID;V0\n0001;768\n')
  });

  const entries = await openTrackBatch(fakeFile(zipped));
  const names = entries.map((e) => e.filename);
  assert.deepEqual(names.sort(), ['SR0001/SR0001 Report.csv', 'SR0001/TRK/Shot0001 Track.csv']);

  const track = entries.find((e) => e.filename.endsWith('Shot0001 Track.csv'));
  assert.ok(track.text.includes('Time (s);Vel (m/s);Dist (m);SNR'));
});

test('openTrackBatch on a zip with no .csv entries at all returns an empty array, not an error', async () => {
  const zipped = zipSync({ 'readme.txt': strToU8('hello') });
  const entries = await openTrackBatch(fakeFile(zipped));
  assert.deepEqual(entries, []);
});

test('openTrackBatch matches .csv case-insensitively', async () => {
  const zipped = zipSync({ 'Shot0001 Track.CSV': strToU8('x') });
  const entries = await openTrackBatch(fakeFile(zipped));
  assert.equal(entries.length, 1);
});
