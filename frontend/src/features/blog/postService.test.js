/** Verify fresh authorization, confirmation and the actual posts commit boundary. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { deletePost } from './postService.js';
import { getPosts, setPosts, POSTS_KEY } from '../../utils/storage.js';
import { setSession, SESSION_KEY } from '../../utils/auth.js';

const owner = { userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' };
const post = { id: 'note', title: 'Note', content: 'Text', createdAt: '2026-03-04T12:00:00.000Z', authorId: 'one', authorName: 'Writer' };
const other = { ...post, id: 'other', authorId: 'two', authorName: 'Other' };
beforeEach(() => { localStorage.clear(); setPosts([post, other]); setSession(owner); });
afterEach(() => vi.restoreAllMocks());

for (const session of [null, { ...owner, userId: 'two' }, { ...owner, role: 'invalid' }]) {
  it('denies absent, other-owner or invalid identity without writing or routing: ' + JSON.stringify(session), () => {
    if (session) setSession(session);
    else localStorage.removeItem(SESSION_KEY);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const result = deletePost('note', true);
    expect(result).toMatchObject({ ok: false, reason: 'denied' });
    expect(result.nextRoute).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  });
}
for (const id of ['unknown', undefined, null]) {
  it('returns safe missing result for ' + id, () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deletePost(id, true)).toEqual({ ok: false, reason: 'missing', message: 'Post not found' });
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  });
}
for (const confirmed of [false, undefined, null, 'true', 1]) {
  it('requires explicit true confirmation: ' + confirmed, () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deletePost('note', confirmed)).toEqual({ ok: false, reason: 'cancelled' });
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  });
}
for (const role of ['user', 'admin']) {
  it('persists only the selected removal for ' + role, () => {
    setSession({ ...owner, role, userId: role === 'admin' ? 'admin' : 'one' });
    expect(deletePost('note', true)).toEqual({ ok: true, removedId: 'note', nextRoute: '/blogs' });
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([other]);
  });
}
it('uses current ownership and preserves newly appended posts instead of a stale snapshot', () => {
  setPosts([{ ...post, authorId: 'two' }, other]);
  expect(deletePost('note', true).reason).toBe('denied');
  setPosts([post, other, { ...other, id: 'new' }]);
  expect(deletePost('note', true).ok).toBe(true);
  expect(getPosts()).toEqual([other, { ...other, id: 'new' }]);
});
for (const raw of [null, '{broken', '{}']) {
  it('never rewrites missing or corrupt posts storage: ' + raw, () => {
    if (raw === null) localStorage.removeItem(POSTS_KEY);
    else localStorage.setItem(POSTS_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deletePost('note', true).reason).toBe('missing');
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
}
it('fails safely when posts cannot be read', () => {
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === POSTS_KEY) throw Error('private detail');
    return original.call(this, key);
  });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(deletePost('note', true).reason).toBe('missing');
  expect(write).not.toHaveBeenCalled();
});
for (const [name, reason] of [['QuotaExceededError', 'quota'], ['SecurityError', 'unavailable']]) {
  it('reports ' + reason + ' without a route or a changed record array', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private detail', name); });
    const result = deletePost('note', true);
    expect(result).toMatchObject({ ok: false, reason });
    expect(result.nextRoute).toBeUndefined();
    expect(result.message).not.toContain('private detail');
    expect(getPosts()).toEqual([post, other]);
  });
}
it('returns serialization failure without writing or routing', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw Error('private detail'); });
  const result = deletePost('note', true);
  expect(result).toMatchObject({ ok: false, reason: 'serialization' });
  expect(result.nextRoute).toBeUndefined();
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post, other]);
});
