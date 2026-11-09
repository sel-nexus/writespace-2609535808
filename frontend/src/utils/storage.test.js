/** Exercise the real storage helpers against browser storage and failure boundaries. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  POSTS_KEY, USERS_KEY, getPosts, getUsers, readArray, setPosts, setUsers, writeJson,
} from './storage.js';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe.each([
  ['posts', POSTS_KEY, getPosts, setPosts],
  ['users', USERS_KEY, getUsers, setUsers],
])('%s persistence', (_label, key, read, write) => {
  it('round-trips arrays using the exact key without changing unrelated data', () => {
    window.localStorage.setItem('unrelated', 'keep');
    const values = [{ id: 'second' }, null, { id: 'first', unknown: true }];
    expect(write(values)).toEqual({ ok: true });
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify(values));
    expect(read()).toEqual(values);
    expect(window.localStorage.getItem('unrelated')).toBe('keep');
  });

  it('round-trips an empty array', () => {
    expect(write([])).toEqual({ ok: true });
    expect(read()).toEqual([]);
    expect(window.localStorage.getItem(key)).toBe('[]');
  });

  it('returns an empty array for a missing key without writing', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(read()).toEqual([]);
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['{broken', '', 'null', '{}', '"text"', '12', 'true'])('falls back for %j without destructive repair', (raw) => {
    window.localStorage.setItem(key, raw);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(read()).toEqual([]);
    expect(window.localStorage.getItem(key)).toBe(raw);
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('falls back when getItem fails and preserves existing data', () => {
    window.localStorage.setItem(key, '[1]');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new DOMException('private diagnostic', 'SecurityError');
    });
    expect(read()).toEqual([]);
    expect(window.localStorage.getItem(key)).toBe('[1]');
  });

  it('falls back when the storage getter is inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('private diagnostic', 'SecurityError');
    });
    expect(read()).toEqual([]);
    expect(write([])).toEqual({ ok: false, reason: 'unavailable' });
  });

  it.each([undefined, () => {}, Symbol('value')])('rejects values that stringify to undefined', (value) => {
    window.localStorage.setItem(key, '[1]');
    expect(write(value)).toEqual({ ok: false, reason: 'serialization' });
    expect(window.localStorage.getItem(key)).toBe('[1]');
  });

  it('rejects cyclic values without replacing the stored record', () => {
    const cyclic = [];
    cyclic.push(cyclic);
    window.localStorage.setItem(key, '[1]');
    expect(write(cyclic)).toEqual({ ok: false, reason: 'serialization' });
    expect(window.localStorage.getItem(key)).toBe('[1]');
  });

  it.each([
    ['QuotaExceededError', 'quota'],
    ['NS_ERROR_DOM_QUOTA_REACHED', 'quota'],
    ['SecurityError', 'unavailable'],
    ['Error', 'unavailable'],
  ])('classifies %s writes without false success or data loss', (name, reason) => {
    window.localStorage.setItem(key, '[1]');
    const error = new Error('private diagnostic');
    error.name = name;
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw error; });
    expect(write([2])).toEqual({ ok: false, reason });
    expect(window.localStorage.getItem(key)).toBe('[1]');
    expect(set).toHaveBeenCalledTimes(1);
  });
});

describe('narrow reusable utilities', () => {
  it('reads and writes an arbitrary JSON key', () => {
    expect(writeJson('custom', [1])).toEqual({ ok: true });
    expect(readArray('custom')).toEqual([1]);
    expect(writeJson('object', { retained: true })).toEqual({ ok: true });
    expect(JSON.parse(window.localStorage.getItem('object'))).toEqual({ retained: true });
    expect(readArray('object')).toEqual([]);
  });

  it('classifies a throwing serializer as serialization even if it throws a quota error', () => {
    const value = { toJSON() { throw new DOMException('private', 'QuotaExceededError'); } };
    expect(writeJson('custom', value)).toEqual({ ok: false, reason: 'serialization' });
    expect(window.localStorage.getItem('custom')).toBeNull();
  });

  it('rejects bigint values as serialization failures', () => {
    expect(writeJson('custom', 1n)).toEqual({ ok: false, reason: 'serialization' });
  });

  it('handles unavailable storage and non-Error thrown values', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined);
    expect(readArray('custom')).toEqual([]);
    expect(writeJson('custom', [])).toEqual({ ok: false, reason: 'unavailable' });
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw null; });
    expect(writeJson('custom', [])).toEqual({ ok: false, reason: 'unavailable' });
  });
});
