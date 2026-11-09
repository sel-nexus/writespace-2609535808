/** Sequence exact local credentials and account/session persistence. */
import { getUsers, setUsers } from '../../utils/storage.js';
import { setSession } from '../../utils/auth.js';

/** Build a password-free session from an existing local account. */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

/** Persist a session before returning any authenticated destination. */
function signIn(session) {
  const result = setSession(session);
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: 'Sign-in could not be saved. Check browser storage and try again.' };
  }
  return { ok: true, session, nextRoute: session.role === 'admin' ? '/admin' : '/blogs' };
}

/**
 * Check built-in credentials first, then exact stored username/password pairs.
 * Args:
 *   input: Unnormalized username and password supplied by the login form.
 * Returns:
 *   A persisted session and role home, or a safe validation/storage error.
 */
export function login(input = {}) {
  const fields = {};
  for (const field of ['username', 'password']) {
    if (typeof input?.[field] !== 'string' || input[field].length === 0) fields[field] = 'This field is required.';
  }
  if (Object.keys(fields).length) return { ok: false, fields };
  if (input.username === 'admin' && input.password === 'admin') {
    return signIn({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  }
  const user = getUsers().find((record) => record && record.username === input.username && record.password === input.password
    && typeof record.id === 'string' && typeof record.displayName === 'string' && ['user', 'admin'].includes(record.role));
  if (!user) return { ok: false, message: 'Invalid username or password.', fields: {
    username: 'Invalid username or password.', password: 'Invalid username or password.',
  } };
  return signIn(sessionFor(user));
}

/**
 * Validate registration and commit an account before attempting its session.
 * Args:
 *   input: Display name, exact username, password and confirmation.
 * Returns:
 *   A new regular account and persisted session, field errors, or an explicit partial failure.
 * Notes:
 *   A failed session write never rolls back an already committed account.
 */
export function register(input = {}) {
  const fields = {};
  for (const field of ['displayName', 'username', 'password', 'confirmPassword']) {
    if (typeof input?.[field] !== 'string' || input[field].length === 0) fields[field] = 'This field is required.';
  }
  if (!fields.confirmPassword && input.password !== input.confirmPassword) fields.confirmPassword = 'Passwords must match.';
  if (input?.username === 'admin') fields.username = 'This username is reserved.';
  const users = getUsers();
  if (!fields.username && users.some((user) => user?.username === input.username)) fields.username = 'This username is already taken.';
  if (Object.keys(fields).length) return { ok: false, fields };
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName: input.displayName, username: input.username,
      password: input.password, role: 'user', createdAt: new Date().toISOString() };
  } catch {
    return { ok: false, message: 'Account could not be created in this browser. Please try again.' };
  }
  const saved = setUsers([...users, user]);
  if (!saved.ok) return { ok: false, reason: saved.reason, message: 'Account was not saved. Check browser storage and try again.' };
  const signedIn = signIn(sessionFor(user));
  if (!signedIn.ok) return { ...signedIn, accountCreated: true,
    message: 'Your account was saved, but sign-in did not complete. Try logging in when browser storage is available.' };
  return { ...signedIn, user };
}
