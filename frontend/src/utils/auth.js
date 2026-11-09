/** Read validated local sessions and persist or clear their single storage key. */
import { writeJson } from './storage.js';

export const SESSION_KEY = 'writespace_session';

/**
 * Read only sessions with the required identity strings and supported role.
 * Returns:
 *   A validated session, or null when missing, invalid, or unavailable.
 * Notes:
 *   This validates local shape, not identity or authorization security.
 */
export function getSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const session = JSON.parse(raw);
    if (!session || Array.isArray(session) || typeof session !== 'object') return null;
    if (typeof session.userId !== 'string'
      || typeof session.username !== 'string'
      || typeof session.displayName !== 'string'
      || (session.role !== 'admin' && session.role !== 'user')) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Persist a caller-provided session without claiming secure authentication.
 * Args:
 *   session: Complete session to serialize and store.
 * Returns:
 *   Success after commit, or a classified storage failure.
 */
export function setSession(session) {
  return writeJson(SESSION_KEY, session);
}

/**
 * Remove only the session key; remain idempotent if it is already absent.
 * Returns:
 *   Success after removal, or unavailable when browser access/removal fails.
 */
export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
