/** Cover account authorization, exact validation and actual local persistence boundaries. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createUser, deleteUser, getManagedUsers, DEFAULT_ADMIN } from './userService.js';
import { getUsers, setUsers, setPosts, USERS_KEY, POSTS_KEY } from '../../utils/storage.js';
import { setSession, SESSION_KEY } from '../../utils/auth.js';

const admin = { userId: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const input = { displayName: 'New Writer', username: 'writer', password: 'demo-only', role: 'user' };
const target = { ...input, id: 'target', createdAt: '2026-03-04T12:00:00.000Z' };
const other = { ...target, id: 'other', username: 'other' };

beforeEach(() => {
  localStorage.clear();
  setSession(admin);
  setUsers([other]);
  setPosts([{ id: 'post', authorId: 'target', authorName: 'New Writer', content: 'Keep me' }]);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-id');
});
afterEach(() => vi.restoreAllMocks());

for (const identity of [null, { ...admin, role: 'user' }, { ...admin, role: 'unknown' }]) {
  it('denies create and delete before validation for ' + JSON.stringify(identity), () => {
    if (identity) setSession(identity);
    else localStorage.removeItem(SESSION_KEY);
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createUser(null)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(deleteUser('target', true)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(read.mock.calls.every(([key]) => key === SESSION_KEY)).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
}

for (const field of Object.keys(input)) {
  for (const value of [undefined, null, '', 42, false, {}, []]) {
    it('rejects missing or invalid ' + field + ' ' + JSON.stringify(value) + ' without writes', () => {
      const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(createUser({ ...input, [field]: value })).toMatchObject({ ok: false, fields: { [field]: 'This field is required.' } });
      expect(write).not.toHaveBeenCalled();
    });
  }
}
for (const value of [undefined, null, false, 12, 'input', []]) {
  it('handles invalid input envelope ' + JSON.stringify(value), () => {
    expect(Object.keys(createUser(value).fields)).toEqual(Object.keys(input));
  });
}
for (const role of ['Admin', 'USER', 'owner', ' user ']) {
  it('rejects unsupported role ' + role, () => {
    expect(createUser({ ...input, role }).fields.role).toBe('Choose Admin or user.');
  });
}
it('rejects reserved exact admin and exact duplicates even in incomplete stored records', () => {
  setUsers([null, 7, { username: 'writer' }]);
  const raw = localStorage.getItem(USERS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(createUser({ ...input, username: 'admin' }).fields.username).toBe('This username is reserved.');
  expect(createUser(input).fields.username).toBe('This username is already taken.');
  expect(localStorage.getItem(USERS_KEY)).toBe(raw);
  expect(write).not.toHaveBeenCalled();
});
for (const username of ['Admin', 'WRITER', ' writer ', ' ']) {
  it('preserves case and whitespace without normalization for ' + username, () => {
    setUsers([target]);
    const result = createUser({ ...input, username, displayName: ' ', password: ' ' });
    expect(result).toMatchObject({ ok: true, user: { username, displayName: ' ', password: ' ' } });
    expect(getUsers()[1]).toEqual(result.user);
  });
}
for (const role of ['user', 'admin']) {
  it('commits a UUID and ISO ' + role + ' account before reporting success without altering session/posts', () => {
    const posts = localStorage.getItem(POSTS_KEY);
    const session = localStorage.getItem(SESSION_KEY);
    const result = createUser({ ...input, role });
    expect(result).toMatchObject({ ok: true, user: { ...input, role, id: 'new-id' } });
    expect(new Date(result.user.createdAt).toISOString()).toBe(result.user.createdAt);
    expect(getUsers()).toEqual([other, result.user]);
    expect(localStorage.getItem(POSTS_KEY)).toBe(posts);
    expect(localStorage.getItem(SESSION_KEY)).toBe(session);
  });
}
for (const generation of ['uuid', 'date']) {
  it('catches ' + generation + ' generation failure without any write', () => {
    if (generation === 'uuid') vi.mocked(crypto.randomUUID).mockImplementation(() => { throw Error('private'); });
    else vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw Error('private'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createUser(input)).toMatchObject({ ok: false, reason: 'generation' });
    expect(write).not.toHaveBeenCalled();
  });
}

for (const id of ['admin', 'editor', 'reserved']) {
  it('protects built-in, current admin and reserved alias ' + id, () => {
    setUsers([target, { ...other, id: 'editor', role: 'admin' }, { ...other, id: 'reserved', username: 'admin' }]);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteUser(id, true)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(write).not.toHaveBeenCalled();
  });
}
for (const id of ['missing', undefined, null, {}, 7]) {
  it('rejects missing or invalid id ' + JSON.stringify(id), () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteUser(id, true)).toMatchObject({ ok: false, reason: 'missing' });
    expect(write).not.toHaveBeenCalled();
  });
}
for (const confirmed of [false, undefined, null, 1, 'true', {}]) {
  it('requires explicit boolean confirmation ' + JSON.stringify(confirmed), () => {
    setUsers([target]);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteUser('target', confirmed)).toEqual({ ok: false, reason: 'cancelled' });
    expect(getUsers()).toEqual([target]);
    expect(write).not.toHaveBeenCalled();
  });
}
for (const role of ['user', 'admin']) {
  it('removes only selected ' + role + ' record and preserves posts/session/unknown and duplicate records', () => {
    const selected = { ...target, role };
    setUsers([other, selected, null, { ...selected, username: 'duplicate-id' }, { unknown: true }]);
    const posts = localStorage.getItem(POSTS_KEY);
    const session = localStorage.getItem(SESSION_KEY);
    expect(deleteUser('target', true)).toEqual({ ok: true, removedUserId: 'target', postEffects: 'none' });
    expect(getUsers()).toEqual([other, null, { ...selected, username: 'duplicate-id' }, { unknown: true }]);
    expect(localStorage.getItem(POSTS_KEY)).toBe(posts);
    expect(localStorage.getItem(SESSION_KEY)).toBe(session);
  });
}

for (const operation of ['create', 'delete']) {
  for (const category of ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED', 'SecurityError', 'Error', 'serialization']) {
    it(operation + ' retains actual data on ' + category + ' failure', () => {
      setUsers([target, other]);
      const raw = localStorage.getItem(USERS_KEY);
      if (category === 'serialization') {
        vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw Error('private'); });
      } else {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', category); });
      }
      const result = operation === 'create' ? createUser({ ...input, username: 'new' }) : deleteUser('target', true);
      const reason = category === 'serialization' ? 'serialization'
        : ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(category) ? 'quota' : 'unavailable';
      expect(result).toMatchObject({ ok: false, reason });
      expect(result.message).not.toContain('private');
      expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    });
  }
}
it('re-reads session and current users for each action rather than caching prior state', () => {
  expect(createUser(input).ok).toBe(true);
  expect(createUser(input).fields.username).toBe('This username is already taken.');
  setUsers([target]);
  expect(deleteUser('new-id', true).reason).toBe('missing');
  setSession({ ...admin, userId: 'target' });
  expect(deleteUser('target', true).reason).toBe('forbidden');
  setSession({ ...admin, role: 'user' });
  expect(createUser(input).reason).toBe('forbidden');
});
for (const raw of [null, '{broken', '{}', 'null']) {
  it('shows default admin on invalid users ' + raw + ' without destructive repair', () => {
    if (raw === null) localStorage.removeItem(USERS_KEY);
    else localStorage.setItem(USERS_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(getManagedUsers()).toEqual([DEFAULT_ADMIN]);
    expect(deleteUser('target', true).reason).toBe('missing');
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });
}
it('safely deduplicates display records and excludes passwords without changing storage', () => {
  setUsers([null, 4, {}, { ...target, role: 'bad' }, target, { ...target, displayName: 'Duplicate' },
    { ...other, id: 'admin' }, { ...other, username: 'admin' }, other]);
  const raw = localStorage.getItem(USERS_KEY);
  expect(getManagedUsers()).toEqual([DEFAULT_ADMIN,
    { id: target.id, username: target.username, displayName: target.displayName, role: target.role, createdAt: target.createdAt },
    { id: other.id, username: other.username, displayName: other.displayName, role: other.role, createdAt: other.createdAt }]);
  expect(localStorage.getItem(USERS_KEY)).toBe(raw);
});
it('handles unavailable session/users reads safely without writes', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('private', 'SecurityError'); });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(getManagedUsers()).toEqual([DEFAULT_ADMIN]);
  expect(createUser(input).reason).toBe('forbidden');
  expect(deleteUser('target', true).reason).toBe('forbidden');
  expect(write).not.toHaveBeenCalled();
});
for (const raw of [null, '{broken', '{}']) {
  it('creates from the documented empty users fallback for ' + raw, () => {
    if (raw === null) localStorage.removeItem(USERS_KEY);
    else localStorage.setItem(USERS_KEY, raw);
    const result = createUser(input);
    expect(result.ok).toBe(true);
    expect(getUsers()).toEqual([result.user]);
  });
}
it('uses empty users fallback when only account reads are unavailable', () => {
  const original = Storage.prototype.getItem;
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === USERS_KEY) throw Error('private');
    return original.call(this, key);
  });
  expect(getManagedUsers()).toEqual([DEFAULT_ADMIN]);
  expect(deleteUser('target', true).reason).toBe('missing');
  const result = createUser(input);
  expect(result.ok).toBe(true);
  read.mockRestore();
  expect(getUsers()).toEqual([result.user]);
});
it('handles malformed display fields without destructive changes and omits unavailable dates', () => {
  setUsers([{ ...target, displayName: null }, { ...target, username: 9 }, { ...target, id: null },
    { ...other, createdAt: null }]);
  const raw = localStorage.getItem(USERS_KEY);
  expect(getManagedUsers()).toEqual([DEFAULT_ADMIN,
    { id: other.id, username: other.username, displayName: other.displayName, role: other.role, createdAt: '' }]);
  expect(localStorage.getItem(USERS_KEY)).toBe(raw);
});
