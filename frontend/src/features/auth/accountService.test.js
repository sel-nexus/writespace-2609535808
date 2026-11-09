/** Exercise account operations and verify persisted state through real helpers. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { login, register } from './accountService.js';
import { getUsers, setUsers, USERS_KEY } from '../../utils/storage.js';
import { getSession, SESSION_KEY } from '../../utils/auth.js';
const input = { displayName: 'Writer', username: 'writer', password: 'local', confirmPassword: 'local' };
const account = { id: 'one', displayName: 'Writer', username: 'writer', password: 'local', role: 'user', createdAt: '2026-01-01' };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('register', () => {
  it('persists UUID ISO regular account before a password-free session and preserves other records', () => {
    setUsers([account]);
    const result = register({ ...input, username: 'second' });
    expect(result.ok).toBe(true);
    expect(result.nextRoute).toBe('/blogs');
    const users = getUsers();
    expect(users[0]).toEqual(account);
    expect(users[1]).toEqual(result.user);
    expect(result.user.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(new Date(result.user.createdAt).toISOString()).toBe(result.user.createdAt);
    expect(result.user.role).toBe('user');
    expect(getSession()).toEqual({ userId: result.user.id, username: 'second', displayName: 'Writer', role: 'user' });
  });
  it.each(['displayName', 'username', 'password', 'confirmPassword'])('rejects missing %s without writes', (field) => {
    expect(register({ ...input, [field]: '' })).toMatchObject({ ok: false, fields: { [field]: 'This field is required.' } });
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it.each([undefined, null, 42, {}])('rejects invalid input %s', (value) => {
    expect(register(value).ok).toBe(false);
    expect(getUsers()).toEqual([]);
  });
  it('rejects mismatch reserved and exact duplicate names', () => {
    expect(register({ ...input, confirmPassword: 'other' }).fields.confirmPassword).toBe('Passwords must match.');
    expect(register({ ...input, username: 'admin' }).fields.username).toBe('This username is reserved.');
    setUsers([account]);
    expect(register(input).fields.username).toBe('This username is already taken.');
    expect(getUsers()).toEqual([account]);
    expect(getSession()).toBeNull();
  });
  it.each(['Admin', ' writer ', 'WRITER'])('does not normalize %s', (username) => {
    setUsers([account]);
    expect(register({ ...input, username }).ok).toBe(true);
    expect(getUsers()[1].username).toBe(username);
  });
  it('rereads duplicates after earlier account creation', () => {
    expect(register(input).ok).toBe(true);
    expect(register(input).fields.username).toBe('This username is already taken.');
    expect(getUsers()).toHaveLength(1);
  });
  it('handles UUID failure without writes', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('unavailable'); });
    expect(register(input)).toMatchObject({ ok: false, message: expect.stringContaining('could not be created') });
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it.each(['QuotaExceededError', 'SecurityError'])('does not attempt session after account save failure %s', (name) => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', name); });
    expect(register(input)).toMatchObject({ ok: false, message: expect.stringContaining('Account was not saved') });
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('retains committed account on session-only failure, then allows later login', () => {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === SESSION_KEY) throw new DOMException('blocked', 'SecurityError');
      write.call(this, key, value);
    });
    expect(register(input)).toMatchObject({ ok: false, accountCreated: true, message: expect.stringContaining('account was saved') });
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    vi.restoreAllMocks();
    expect(login(input).ok).toBe(true);
    expect(getSession().userId).toBe(getUsers()[0].id);
  });
  it('treats malformed users safely without repairing rejected registration', () => {
    localStorage.setItem(USERS_KEY, '{bad');
    expect(register({ ...input, username: 'admin' }).ok).toBe(false);
    expect(localStorage.getItem(USERS_KEY)).toBe('{bad');
  });
});

describe('login', () => {
  it('checks built-in admin first without reading user records', () => {
    setUsers([{ ...account, username: 'admin', password: 'admin' }]);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === USERS_KEY) throw Error('must not read');
      return read.call(this, key);
    });
    expect(login({ username: 'admin', password: 'admin' })).toMatchObject({ ok: true, nextRoute: '/admin' });
    expect(getSession()).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  });
  it.each(['user', 'admin'])('signs in stored %s and re-reads credentials after changes', (role) => {
    setUsers([{ ...account, role }]);
    expect(login(input)).toMatchObject({ ok: true, nextRoute: role === 'admin' ? '/admin' : '/blogs' });
    expect(getSession()).toEqual({ userId: 'one', username: 'writer', displayName: 'Writer', role });
    setUsers([{ ...account, password: 'changed' }]);
    expect(login(input).message).toBe('Invalid username or password.');
    expect(login({ ...input, password: 'changed' }).ok).toBe(true);
  });
  it.each([{ username: 'Writer', password: 'local' }, { username: ' writer', password: 'local' },
    { username: 'writer', password: 'LOCAL' }, { username: 'absent', password: 'local' }])('rejects exact credential miss %s', (credentials) => {
    setUsers([account]);
    expect(login(credentials).message).toBe('Invalid username or password.');
    expect(getSession()).toBeNull();
    expect(getUsers()).toEqual([account]);
  });
  it.each(['username', 'password'])('requires %s', (field) => {
    expect(login({ ...input, [field]: '' }).fields[field]).toBe('This field is required.');
    expect(getSession()).toBeNull();
  });
  it.each([null, undefined, {}, 12])('rejects malformed credentials %s', (value) => expect(login(value).ok).toBe(false));
  it('skips malformed individual records without repairing them', () => {
    setUsers([null, {}, { ...account, role: 'other' }]);
    const raw = localStorage.getItem(USERS_KEY);
    expect(login(input).message).toBe('Invalid username or password.');
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
  });
  it.each(['QuotaExceededError', 'SecurityError'])('does not claim sign-in on %s', (name) => {
    setUsers([account]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', name); });
    expect(login(input)).toMatchObject({ ok: false, message: expect.stringContaining('could not be saved') });
    expect(getSession()).toBeNull();
  });
});

it.each(['displayName', 'username', 'password', 'confirmPassword'])('rejects non-string registration field %s', (field) => {
  expect(register({ ...input, [field]: 42 })).toMatchObject({ ok: false, fields: { [field]: 'This field is required.' } });
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it.each(['username', 'password'])('rejects non-string login field %s', (field) => {
  expect(login({ ...input, [field]: 42 }).ok).toBe(false);
  expect(getSession()).toBeNull();
});
it('returns serialization failure without committing accounts or session', () => {
  vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw Error('cannot serialize'); });
  expect(register(input)).toMatchObject({ ok: false, reason: 'serialization' });
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
  expect(login({ username: 'admin', password: 'admin' })).toMatchObject({ ok: false, reason: 'serialization' });
  expect(getSession()).toBeNull();
});
it('preserves unrelated malformed records while adding a valid account', () => {
  setUsers([null, { unexpected: true }]);
  expect(register(input).ok).toBe(true);
  expect(getUsers().slice(0, 2)).toEqual([null, { unexpected: true }]);
});
it('treats unavailable user reads as an invalid login without false session', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
  expect(login(input).message).toBe('Invalid username or password.');
  expect(getSession()).toBeNull();
});
