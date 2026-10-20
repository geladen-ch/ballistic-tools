// Every form field takes its label from the "fields.<id>" translation key
// (see unit-field.js), so renaming a field id silently leaves a raw key on
// screen unless the translation is renamed with it. This scans src/ for
// field ids handed to the field builders, and for literal 'fields.*'
// keys, and checks each has an English translation (locale parity is
// i18n.test.js's job).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const en = JSON.parse(readFileSync(join(SRC, 'locales/en.json'), 'utf8'));

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'vendor' ? [] : jsFiles(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

test('every field id given to a labelled field builder, and every literal fields.* key, has an English label', () => {
  const missing = new Set();
  for (const file of jsFiles(SRC)) {
    const text = readFileSync(file, 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n');
    const ids = [
      ...[...text.matchAll(/\b(?:unitField|largeStepperField)\(\{\s*id:\s*'([A-Za-z0-9]+)'/g)].map((m) => m[1]),
      ...[...text.matchAll(/\b(?:presetUnitField|persistedUnitField)\('([A-Za-z0-9]+)'/g)].map((m) => m[1]),
      ...[...text.matchAll(/'fields\.([A-Za-z0-9]+)'/g)].map((m) => m[1])
    ];
    for (const id of ids) if (!(id in en.fields)) missing.add(`${file.slice(SRC.length)}: fields.${id}`);
  }
  assert.deepEqual([...missing], []);
});
