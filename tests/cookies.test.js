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

test('a value is kept in localStorage, so it outlives a cookie expiry cap', () => {
  setCookie('kept', 'v');
  // Safari drops script-written cookies after seven days; simulate that.
  document.cookie = 'kept=; max-age=0';
  assert.equal(getCookie('kept'), 'v');
});

test('a value an earlier build left only in a cookie is read and carried into localStorage', () => {
  document.cookie = 'old=from-cookie; path=/; max-age=100';
  assert.equal(getCookie('old'), 'from-cookie');
  document.cookie = 'old=; max-age=0';
  assert.equal(getCookie('old'), 'from-cookie');
});

test('setCookie still writes the cookie, for a rollback to a cookie-only build', () => {
  setCookie('mirror', 'm');
  assert.match(document.cookie, /(^|; )mirror=m(;|$)/);
});

test('removeCookie clears both stores', () => {
  setCookie('both', '1');
  removeCookie('both');
  assert.equal(getCookie('both'), null);
  assert.equal(localStorage.getItem('pref:both'), null);
});

test('with localStorage refusing access, the cookie alone still works', () => {
  const saved = global.localStorage;
  global.localStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); }
  };
  try {
    setCookie('nostore', 'c');
    assert.equal(getCookie('nostore'), 'c');
    removeCookie('nostore');
    assert.equal(getCookie('nostore'), null);
  } finally {
    global.localStorage = saved;
  }
});
