/** Manage browser-local demo accounts with accessible validation and safe mutations. */
import { useEffect, useState } from 'react';
import { getSession } from '../../utils/auth.js';
import { createUser, deleteUser, getManagedUsers } from './userService.js';
import UserRow from './UserRow.jsx';

const initialForm = { displayName: '', username: '', password: '', role: 'user' };
const labels = { displayName: 'Display Name', username: 'Username', password: 'Password', role: 'Role' };
const fieldStyle = 'mt-2 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 '
  + 'focus:outline-none focus:ring-2 focus:ring-indigo-500';

/**
 * Load account snapshots and update them only after successful persistence.
 * Returns:
 *   An admin creation form, responsive account list and explicit demo limitations.
 */
export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(getSession);
  const [form, setForm] = useState(initialForm);
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(function loadAccounts() {
    setUsers(getManagedUsers());
    setSession(getSession());
  }, []);

  /** Submit exact values; preserve all input and displayed records on failure. */
  function submit(event) {
    event.preventDefault();
    const result = createUser(form);
    setSession(getSession());
    setFields(result.fields ?? {});
    setError(result.message ?? '');
    setSuccess('');
    if (result.ok) {
      setUsers(getManagedUsers());
      setForm(initialForm);
      setSuccess('Account created successfully.');
    }
  }

  /** Confirm explicitly and let the service re-read authorization after the dialog. */
  function remove(id) {
    const confirmed = window.confirm('Delete this account? Their posts will be preserved.');
    const result = deleteUser(id, confirmed);
    setSession(getSession());
    setError(result.message ?? '');
    setSuccess('');
    if (result.ok) {
      setUsers(getManagedUsers());
      setSuccess('Account deleted. Their posts were preserved.');
    }
  }

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 px-4 py-10 font-sans text-slate-800 sm:px-6">
      <div className="mx-auto min-w-0 max-w-6xl space-y-8">
        <header>
          <h1 className="font-editorial text-3xl sm:text-4xl">User Management</h1>
          <p className="mt-2 text-slate-600">Create and manage accounts in this browser profile.</p>
        </header>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Local demo only: passwords are stored in plaintext in browser localStorage. Do not use real passwords or sensitive data.
          Accounts are not synchronized across devices. Client-side role checks are not security controls.
        </p>
        <section aria-labelledby="create-account-heading" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 id="create-account-heading" className="text-xl font-semibold">Create Account</h2>
          <form noValidate onSubmit={submit} className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">
            {Object.keys(labels).map((field) => (
              <div key={field} className="min-w-0">
                <label htmlFor={`account-${field}`} className="text-sm font-medium">{labels[field]} (required)</label>
                {field === 'role' ? (
                  <select
                    id={`account-${field}`}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fields[field])}
                    aria-describedby={fields[field] ? `${field}-error` : undefined}
                    value={form[field]}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    className={fieldStyle}
                  >
                    <option value="user">user</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <input
                    id={`account-${field}`}
                    type={field === 'password' ? 'password' : 'text'}
                    autoComplete={field === 'password' ? 'new-password' : 'off'}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fields[field])}
                    aria-describedby={fields[field] ? `${field}-error` : undefined}
                    value={form[field]}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    className={fieldStyle}
                  />
                )}
                {fields[field] && (
                  <p id={`${field}-error`} role="alert" className="mt-2 text-sm text-red-700">{fields[field]}</p>
                )}
              </div>
            ))}
            <button
              type="submit"
              disabled={session?.role !== 'admin'}
              className={'rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 '
                + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:justify-self-start'}
            >
              Create Account
            </button>
          </form>
        </section>
        {error && (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        )}
        <p role="status" aria-live="polite" className="text-sm text-green-800">{success}</p>
        <section aria-labelledby="accounts-heading" className="min-w-0">
          <h2 id="accounts-heading" className="text-xl font-semibold">Local Accounts</h2>
          <div className="mt-4 hidden rounded-lg border border-slate-200 bg-white sm:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Local accounts</caption>
              <thead className="text-slate-600">
                <tr>
                  {['Display Name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                    <th key={label} scope="col" className="p-4 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} session={session} onDelete={remove} />
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-label="Local account cards" className="mt-4 grid min-w-0 gap-4 sm:hidden">
            {users.map((user) => (
              <UserRow key={user.id} user={user} session={session} onDelete={remove} mobile />
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

UserManagement.propTypes = {};
