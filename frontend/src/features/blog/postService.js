/** Commit post deletion only after fresh local authorization and confirmation. */
import { getPosts, setPosts } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { canMutatePost } from '../../utils/permissions.js';

/**
 * Remove one selected post without trusting a page's identity or data snapshot.
 * Args:
 *   id: Existing post identity to remove.
 *   confirmed: Explicit native-dialog approval; only true permits persistence.
 * Returns:
 *   A safe failure without a route, or a committed removal and list destination.
 */
export function deletePost(id, confirmed) {
  const session = getSession();
  const posts = getPosts();
  const post = posts.find((entry) => entry?.id === id);
  if (!post) return { ok: false, reason: 'missing', message: 'Post not found' };
  if (!canMutatePost(session, post)) {
    return { ok: false, reason: 'denied', message: 'You are not allowed to delete this post.' };
  }
  if (confirmed !== true) return { ok: false, reason: 'cancelled' };
  const result = setPosts(posts.filter((entry) => entry?.id !== id));
  if (!result.ok) {
    return { ...result, message: 'The post could not be deleted. Please check browser storage and try again.' };
  }
  return { ok: true, removedId: id, nextRoute: '/blogs' };
}
