/** Verify validated session reads and non-destructive session mutation failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_KEY, clearSession, getSession, setSession } from './auth.js';

const session = { userId: 'user-1', username: 'writer', displayName: 'Writer', role: 'user' };

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('session reads', () => {
  it.each(['admin', 'user'])('round-trips a valid %s session through the exact key', (role) => {
    const value = { ...session, role };
    expect(setSession(value)).toEqual({ ok: true });
    expect(window.localStorage.getItem(SESSION_KEY)).toBe(JSON.stringify(value));
    expect(getSession()).toEqual(value);
  });

  it('accepts string fields without inventing trimming or nonempty validation', () => {
    const value = { userId: '', username: '', displayName: '', role: 'user', extra: 'keep' };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    expect(getSession()).toEqual(value);
  });

  it('returns null for a missing key without writing', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(getSession()).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['{broken', '', 'null', '[]', '{}', '"session"', '42', 'true'])('rejects %j without destructive repair', (raw) => {
    window.localStorage.setItem(SESSION_KEY, raw);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(getSession()).toBeNull();
    expect(window.localStorage.getItem(SESSION_KEY)).toBe(raw);
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    { ...session, userId: 1 },
    { ...session, username: null },
    { ...session, displayName: false },
    { ...session, role: 'owner' },
    { ...session, role: null },
    { username: 'writer', displayName: 'Writer', role: 'user' },
    { userId: 'u', displayName: 'Writer', role: 'user' },
    { userId: 'u', username: 'writer', role: 'user' },
    { userId: 'u', username: 'writer', displayName: 'Writer' },
  ])('fails closed for invalid identity fields: %j', (value) => {
    const raw = JSON.stringify(value);
    window.localStorage.setItem(SESSION_KEY, raw);
    expect(getSession()).toBeNull();
    expect(window.localStorage.getItem(SESSION_KEY)).toBe(raw);
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    expect(getSession()).toBeNull();
  });

  it('returns null when accessing localStorage throws or it is absent', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('private', 'SecurityError');
    });
    expect(getSession()).toBeNull();
    getter.mockReturnValue(undefined);
    expect(getSession()).toBeNull();
  });
});

describe('session writes', () => {
  it.each([undefined, () => {}, Symbol('session')])('returns serialization for an unencodable value', (value) => {
    setSession(session);
    expect(setSession(value)).toEqual({ ok: false, reason: 'serialization' });
    expect(getSession()).toEqual(session);
  });

  it('returns serialization for cyclic sessions and throwing serializers', () => {
    const cyclic = { ...session };
    cyclic.self = cyclic;
    expect(setSession(cyclic)).toEqual({ ok: false, reason: 'serialization' });
    expect(setSession({ toJSON() { throw new Error('private'); } })).toEqual({ ok: false, reason: 'serialization' });
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    ['QuotaExceededError', 'quota'],
    ['NS_ERROR_DOM_QUOTA_REACHED', 'quota'],
    ['SecurityError', 'unavailable'],
    ['Error', 'unavailable'],
  ])('returns %s write failure without replacing the previous session', (name, reason) => {
    setSession(session);
    const error = new Error('private');
    error.name = name;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw error; });
    expect(setSession({ ...session, role: 'admin' })).toEqual({ ok: false, reason });
    expect(getSession()).toEqual(session);
  });

  it('returns unavailable when the localStorage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private'); });
    expect(setSession(session)).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('session removal', () => {
  it('clears only the session key and is idempotent', () => {
    setSession(session);
    window.localStorage.setItem('writespace_posts', '[1]');
    window.localStorage.setItem('writespace_users', '[2]');
    expect(clearSession()).toEqual({ ok: true });
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(getSession()).toBeNull();
    expect(clearSession()).toEqual({ ok: true });
    expect(window.localStorage.getItem('writespace_posts')).toBe('[1]');
    expect(window.localStorage.getItem('writespace_users')).toBe('[2]');
  });

  it.each(['SecurityError', 'QuotaExceededError', 'Error'])('returns unavailable when removal throws %s and preserves session', (name) => {
    setSession(session);
    const error = new Error('private');
    error.name = name;
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw error; });
    expect(clearSession()).toEqual({ ok: false, reason: 'unavailable' });
    expect(getSession()).toEqual(session);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable when the storage getter throws or storage is absent', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private'); });
    expect(clearSession()).toEqual({ ok: false, reason: 'unavailable' });
    getter.mockReturnValue(undefined);
    expect(clearSession()).toEqual({ ok: false, reason: 'unavailable' });
  });
});
