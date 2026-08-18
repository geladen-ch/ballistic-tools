import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { setCookie, getCookie, removeCookie } = await import('../src/cookies.js');

test('getCookie returns null when nothing is set', () => {
  assert.equal(getCookie('nope'), null);
});

test('setCookie/getCookie round-trip a value', () => {
  setCookie('a', 'hello');
  assert.equal(getCookie('a'), 'hello');
});

test('values are URI-encoded, so JSON and special characters survive intact', () => {
  const value = JSON.stringify({ distance: 'yd', note: 'a=b;c' });
  setCookie('json', value);
  assert.equal(getCookie('json'), value);
});

test('setting one cookie does not clobber another', () => {
  setCookie('x', '1');
  setCookie('y', '2');
  assert.equal(getCookie('x'), '1');
  assert.equal(getCookie('y'), '2');
});

test('removeCookie deletes the cookie', () => {
  setCookie('z', 'gone-soon');
  assert.equal(getCookie('z'), 'gone-soon');
  removeCookie('z');
  assert.equal(getCookie('z'), null);
});
