/** Decide local route and mutation access without claiming server security. */

/**
 * Decide whether a session may enter a known route.
 * Args:
 *   session: Current local identity, or null for a guest.
 *   path: Route pathname, excluding search and hash.
 * Returns:
 *   An allow decision or the role-correct redirect destination.
 */
export function canAccessRoute(session, path) {
  const authenticated = session?.role === 'user' || session?.role === 'admin';
  const adminRoute = path === '/admin' || path === '/users';
  const protectedRoute = adminRoute || path === '/blogs' || path === '/write'
    || /^\/(blog|edit)\/[^/]+\/?$/.test(path);
  if ((path === '/login' || path === '/register') && authenticated) {
    return { allow: false, redirectTo: session.role === 'admin' ? '/admin' : '/blogs' };
  }
  if (protectedRoute && !authenticated) return { allow: false, redirectTo: '/login' };
  if (adminRoute && session.role !== 'admin') return { allow: false, redirectTo: '/blogs' };
  return { allow: true };
}

/**
 * Permit a post mutation only to a supported role and its owner or an admin.
 * Args:
 *   session: Current local identity.
 *   post: Existing post with author attribution.
 * Returns:
 *   Whether the caller may edit or delete the post.
 */
export function canMutatePost(session, post) {
  if (!session || !post) return false;
  return session.role === 'admin'
    || (session.role === 'user' && typeof session.userId === 'string' && session.userId === post.authorId);
}

/**
 * Protect the built-in identity and the acting administrator from deletion.
 * Args:
 *   session: Current local identity.
 *   target: Existing account selected for deletion.
 * Returns:
 *   Whether an administrator may remove this account without affecting posts.
 */
export function canDeleteUser(session, target) {
  if (session?.role !== 'admin' || !target || typeof target.id !== 'string') return false;
  return target.id !== 'admin' && target.username !== 'admin' && target.id !== session.userId;
}
