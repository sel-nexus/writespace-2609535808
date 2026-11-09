/** Verify fresh authorization, confirmation and the actual posts commit boundary. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPost, editPost, validatePost, deletePost } from './postService.js';
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

/** Exercise publishing branches using real storage and explicit browser failures. */
for (const input of [undefined, null, {}, { title: 1, content: [] }, { title: ' ', content: '\t' }]) {
  it('rejects invalid text without writes: ' + JSON.stringify(input), () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(validatePost(input)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
    for (const result of [createPost(input), editPost('note', input)]) {
      expect(result).toMatchObject({ ok: false, reason: 'validation', fields: validatePost(input) });
      expect(result.nextRoute).toBeUndefined();
    }
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  });
}
for (const field of ['title', 'content']) {
  it('reports only missing ' + field, () => {
    const result = createPost({ title: 'T', content: 'C', [field]: '' });
    expect(Object.keys(result.fields)).toEqual([field]);
  });
}
for (const role of ['user', 'admin']) {
  it('creates UUID/ISO and fresh ' + role + ' attribution ignoring supplied metadata', () => {
    const current = { ...owner, role, userId: 'fresh', displayName: 'Fresh' };
    setSession(current);
    const result = createPost({ title: ' T ', content: 'C\n  D', id: 'fake', authorId: 'fake', authorName: 'Fake' });
    expect(result.ok).toBe(true);
    expect(result.post.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(new Date(result.post.createdAt).toISOString()).toBe(result.post.createdAt);
    expect(result.post).toMatchObject({ title: ' T ', content: 'C\n  D', authorId: 'fresh', authorName: 'Fresh' });
    expect(result.nextRoute).toBe('/blog/' + result.post.id);
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post, other, result.post]);
  });
  it('edits as ' + role + ' preserving attribution, date, identity and unrelated entries', () => {
    setSession({ ...owner, role, userId: role === 'admin' ? 'admin' : 'one', displayName: 'New name' });
    setPosts([post, other, null, { unknown: true }]);
    const result = editPost('note', { title: 'New', content: ' Text ', id: 'fake', createdAt: 'fake', authorName: 'Fake' });
    expect(result).toEqual({ ok: true, post: { ...post, title: 'New', content: ' Text ' }, nextRoute: '/blog/note' });
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([result.post, other, null, { unknown: true }]);
  });
}
for (const raw of [null, 'broken', '{}', '{"role":"invalid"}']) {
  it('denies fresh missing/invalid session: ' + raw, () => {
    if (raw === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    for (const result of [createPost({ title: 'T', content: 'C' }), editPost('note', { title: 'T', content: 'C' })]) {
      expect(result.reason).toBe('denied');
      expect(result.nextRoute).toBeUndefined();
    }
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  });
}
it('rejects changed ownership and missing identities before writing', () => {
  setPosts([{ ...post, authorId: 'two' }, other]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(editPost('note', {}).reason).toBe('denied');
  for (const id of ['unknown', undefined, null]) expect(editPost(id, {}).reason).toBe('missing');
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([{ ...post, authorId: 'two' }, other]);
});
for (const raw of [null, 'broken', '{}']) {
  it('uses empty fallback for create but never rewrites missing edit: ' + raw, () => {
    if (raw === null) localStorage.removeItem(POSTS_KEY);
    else localStorage.setItem(POSTS_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(editPost('note', {}).reason).toBe('missing');
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    const result = createPost({ title: 'T', content: 'C' });
    expect(getPosts()).toEqual([result.post]);
  });
}
for (const operation of ['create', 'edit']) {
  for (const failure of ['QuotaExceededError', 'SecurityError', 'serialization']) {
    it(operation + ' safely reports ' + failure + ' without commit or route', () => {
      const write = vi.spyOn(Storage.prototype, 'setItem');
      if (failure === 'serialization') {
        vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw Error('private detail'); });
      } else write.mockImplementation(() => { throw new DOMException('private detail', failure); });
      const result = operation === 'create'
        ? createPost({ title: 'T', content: 'C' }) : editPost('note', { title: 'T', content: 'C' });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(failure === 'serialization' ? failure : failure === 'SecurityError' ? 'unavailable' : 'quota');
      expect(result.message).not.toContain('private detail');
      expect(result.nextRoute).toBeUndefined();
      if (failure === 'serialization') expect(write).not.toHaveBeenCalled();
      expect(getPosts()).toEqual([post, other]);
    });
  }
}
for (const source of ['uuid', 'date']) {
  it('catches ' + source + ' generation failure without writes', () => {
    if (source === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('private detail'); });
    else vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw Error('private detail'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const result = createPost({ title: 'T', content: 'C' });
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(result.message).not.toContain('private detail');
    expect(result.nextRoute).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  });
}
for (const key of [SESSION_KEY, POSTS_KEY]) {
  it('handles inaccessible ' + key + ' without an edit write', () => {
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (requested) {
      if (requested === key) throw Error('private detail');
      return read.call(this, requested);
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(editPost('note', {}).reason).toBe(key === SESSION_KEY ? 'denied' : 'missing');
    if (key === SESSION_KEY) expect(createPost({ title: 'T', content: 'C' }).reason).toBe('denied');
    expect(write).not.toHaveBeenCalled();
  });
}
