/** Preserve local records and translate browser failures into safe results. */
export const POSTS_KEY = 'writespace_posts';
export const USERS_KEY = 'writespace_users';

/**
 * Read a stored array without repairing or deleting invalid data.
 * Args:
 *   key: Browser storage key containing a JSON array.
 * Returns:
 *   The stored array, or an empty array on missing, invalid, or unavailable data.
 */
export function readArray(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Serialize and commit one key without retries or exposing exception text.
 * Args:
 *   key: Destination browser storage key.
 *   value: Complete value to encode as JSON.
 * Returns:
 *   Success only after committing, or a serialization, quota, or unavailable failure.
 */
export function writeJson(key, value) {
  let raw;
  try {
    raw = JSON.stringify(value);
    if (raw === undefined) return { ok: false, reason: 'serialization' };
  } catch {
    return { ok: false, reason: 'serialization' };
  }

  try {
    window.localStorage.setItem(key, raw);
    return { ok: true };
  } catch (error) {
    const quota = error?.name === 'QuotaExceededError'
      || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}

/**
 * Load posts while preserving their stored order and individual records.
 * Returns:
 *   The stored posts array, or an empty array when it cannot be read.
 */
export function getPosts() {
  return readArray(POSTS_KEY);
}

/**
 * Commit the complete posts value to this browser profile.
 * Args:
 *   posts: Complete posts array to persist.
 * Returns:
 *   A classified storage result, never a premature success.
 */
export function setPosts(posts) {
  return writeJson(POSTS_KEY, posts);
}

/**
 * Load local accounts without filtering or repairing individual records.
 * Returns:
 *   The stored users array, or an empty array when it cannot be read.
 */
export function getUsers() {
  return readArray(USERS_KEY);
}

/**
 * Commit the complete accounts value to this browser profile.
 * Args:
 *   users: Complete users array to persist.
 * Returns:
 *   A classified storage result, never a premature success.
 */
export function setUsers(users) {
  return writeJson(USERS_KEY, users);
}
