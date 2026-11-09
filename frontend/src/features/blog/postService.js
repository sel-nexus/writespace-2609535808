/** Commit post changes only after fresh local authorization and validation. */
import { getPosts, setPosts } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { canMutatePost } from '../../utils/permissions.js';

/**
 * Validate required plain-text fields without normalizing the saved text.
 * Args:
 *   input: Submitted title and content; attribution fields are ignored.
 * Returns:
 *   Adjacent-field messages for missing, whitespace-only or non-string values.
 */
export function validatePost(input) {
  const fields = {};
  if (typeof input?.title !== 'string' || !input.title.trim()) fields.title = 'Title is required.';
  if (typeof input?.content !== 'string' || !input.content.trim()) fields.content = 'Content is required.';
  return fields;
}

/**
 * Commit a complete array before returning a detail destination.
 * Args:
 *   posts: Fresh records including the proposed change.
 *   post: Changed record to return only after persistence succeeds.
 * Returns:
 *   A committed post and route, or a safe classified storage failure.
 */
function savePost(posts, post) {
  const result = setPosts(posts);
  if (!result.ok) {
    return { ...result, message: 'The post was not saved. Please check browser storage and try again.' };
  }
  return { ok: true, post, nextRoute: `/blog/${post.id}` };
}

/**
 * Publish submitted text using only the current session's attribution.
 * Args:
 *   input: Required title and content; other properties are never trusted.
 * Returns:
 *   A committed post and detail route, or validation, access or safe save errors.
 */
export function createPost(input) {
  const session = getSession();
  if (!session) return { ok: false, reason: 'denied', message: 'Please sign in before saving a post.' };
  const fields = validatePost(input);
  if (Object.keys(fields).length) return { ok: false, reason: 'validation', fields };
  let post;
  try {
    post = {
      id: crypto.randomUUID(), title: input.title, content: input.content,
      createdAt: new Date().toISOString(), authorId: session.userId, authorName: session.displayName,
    };
  } catch {
    return { ok: false, reason: 'unavailable', message: 'The post was not saved. Please try again in a supported browser.' };
  }
  return savePost([...getPosts(), post], post);
}

/**
 * Replace only text after resolving fresh ownership and current identity.
 * Args:
 *   id: Existing post identity.
 *   input: Required replacement title and content; identity fields are ignored.
 * Returns:
 *   A committed post with original attribution, or a failure without a route.
 */
export function editPost(id, input) {
  const session = getSession();
  const posts = getPosts();
  const index = posts.findIndex((entry) => entry?.id === id);
  if (index === -1) return { ok: false, reason: 'missing', message: 'Post not found' };
  if (!canMutatePost(session, posts[index])) {
    return { ok: false, reason: 'denied', message: 'You are not allowed to edit this post.' };
  }
  const fields = validatePost(input);
  if (Object.keys(fields).length) return { ok: false, reason: 'validation', fields };
  const post = { ...posts[index], title: input.title, content: input.content };
  posts[index] = post;
  return savePost(posts, post);
}

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
