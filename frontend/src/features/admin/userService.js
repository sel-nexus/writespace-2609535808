/** Provision and remove local accounts without touching sessions or posts. */
import { getSession } from '../../utils/auth.js';
import { getUsers, setUsers } from '../../utils/storage.js';
import { canDeleteUser } from '../../utils/permissions.js';

export const DEFAULT_ADMIN = Object.freeze({
  id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin', createdAt: '',
});

/**
 * Build a password-free display list, including the default admin exactly once.
 * Returns:
 *   Renderable accounts deduplicated by id, without modifying stored records.
 */
export function getManagedUsers() {
  const seen = new Set(['admin']);
  const accounts = [DEFAULT_ADMIN];
  for (const user of getUsers()) {
    if (!user || typeof user.id !== 'string' || seen.has(user.id) || user.username === 'admin') continue;
    if (typeof user.username !== 'string' || typeof user.displayName !== 'string') continue;
    if (!['admin', 'user'].includes(user.role)) continue;
    seen.add(user.id);
    accounts.push({ id: user.id, username: user.username, displayName: user.displayName,
      role: user.role, createdAt: typeof user.createdAt === 'string' ? user.createdAt : '' });
  }
  return accounts;
}

/**
 * Validate exact account fields after checking the current admin session.
 * Args:
 *   input: Unnormalized display name, username, plaintext demo password and role.
 * Returns:
 *   The committed account, field errors, or a safe access/generation/storage error.
 */
export function createUser(input = {}) {
  if (getSession()?.role !== 'admin') {
    return { ok: false, reason: 'forbidden', message: 'Only administrators can create accounts.' };
  }
  const fields = {};
  for (const field of ['displayName', 'username', 'password', 'role']) {
    if (typeof input?.[field] !== 'string' || input[field].length === 0) fields[field] = 'This field is required.';
  }
  if (!fields.role && !['admin', 'user'].includes(input.role)) fields.role = 'Choose Admin or user.';
  if (input?.username === 'admin') fields.username = 'This username is reserved.';
  const users = getUsers();
  if (!fields.username && users.some((user) => user?.username === input.username)) {
    fields.username = 'This username is already taken.';
  }
  if (Object.keys(fields).length) return { ok: false, fields };
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName: input.displayName, username: input.username,
      password: input.password, role: input.role, createdAt: new Date().toISOString() };
  } catch {
    return { ok: false, reason: 'generation', message: 'Account could not be created in this browser. Please try again.' };
  }
  const result = setUsers([...users, user]);
  if (!result.ok) {
    return { ...result, message: 'Account was not saved. Check browser storage and try again.' };
  }
  return { ok: true, user };
}

/**
 * Recheck identity and remove only the selected account after explicit confirmation.
 * Args:
 *   id: Exact account id selected by the caller.
 *   confirmed: Only boolean true permits a write.
 * Returns:
 *   A committed removal, or a safe denial, missing, cancellation or storage result.
 * Notes:
 *   Posts and sessions are never deleted or reassigned.
 */
export function deleteUser(id, confirmed) {
  const session = getSession();
  if (session?.role !== 'admin') {
    return { ok: false, reason: 'forbidden', message: 'Only administrators can delete accounts.' };
  }
  const users = getUsers();
  if (id === 'admin' || id === session.userId) {
    return { ok: false, reason: 'forbidden', message: 'The default admin and your own account cannot be deleted.' };
  }
  const index = typeof id === 'string' ? users.findIndex((user) => user?.id === id) : -1;
  if (index < 0) return { ok: false, reason: 'missing', message: 'Account not found.' };
  if (!canDeleteUser(session, users[index])) {
    return { ok: false, reason: 'forbidden', message: 'The default admin and your own account cannot be deleted.' };
  }
  if (confirmed !== true) return { ok: false, reason: 'cancelled' };
  const result = setUsers(users.filter((_, position) => position !== index));
  if (!result.ok) return { ...result, message: 'Account could not be deleted. Check browser storage and try again.' };
  return { ok: true, removedUserId: id, postEffects: 'none' };
}
