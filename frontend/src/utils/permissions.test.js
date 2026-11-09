/** Verify every role/route and local mutation safeguard. */
import { describe, expect, it } from 'vitest';
import { canAccessRoute, canMutatePost, canDeleteUser } from './permissions.js';
const user = { userId: 'one', role: 'user' };
const admin = { userId: 'boss', role: 'admin' };
const routes = ['/', '/login', '/register', '/blogs', '/blog/one', '/write', '/edit/one', '/admin', '/users', '/unknown'];
describe('route matrix', () => {
  for (const session of [null, user, admin]) {
    for (const path of routes) {
      it('decides ' + (session?.role || 'guest') + ' at ' + path, () => {
        let expected = { allow: true };
        if (['/login', '/register'].includes(path) && session) {
          expected = { allow: false, redirectTo: session.role === 'admin' ? '/admin' : '/blogs' };
        } else if (!session && ['/blogs', '/blog/one', '/write', '/edit/one', '/admin', '/users'].includes(path)) {
          expected = { allow: false, redirectTo: '/login' };
        } else if (session?.role === 'user' && ['/admin', '/users'].includes(path)) {
          expected = { allow: false, redirectTo: '/blogs' };
        }
        expect(canAccessRoute(session, path)).toEqual(expected);
      });
    }
  }
  it('fails closed for unsupported roles on protected routes', () => {
    expect(canAccessRoute({ role: 'other' }, '/write')).toEqual({ allow: false, redirectTo: '/login' });
  });
});
it.each([
  [null, { authorId: 'one' }, false], [user, null, false], [user, { authorId: 'one' }, true],
  [user, { authorId: 'other' }, false], [admin, { authorId: 'other' }, true], [{ role: 'other', userId: 'one' }, { authorId: 'one' }, false],
  [{ role: 'user' }, {}, false],
])('checks post mutation %#', (session, post, expected) => expect(canMutatePost(session, post)).toBe(expected));
it.each([
  [null, { id: 'one' }, false], [user, { id: 'other' }, false], [admin, null, false], [admin, {}, false],
  [admin, { id: 'admin' }, false], [admin, { id: 'other', username: 'admin' }, false],
  [admin, { id: 'boss' }, false], [admin, { id: 'one', username: 'writer' }, true],
  [admin, { id: 'other', username: 'Admin' }, true],
])('checks account deletion %#', (session, target, expected) => expect(canDeleteUser(session, target)).toBe(expected));
