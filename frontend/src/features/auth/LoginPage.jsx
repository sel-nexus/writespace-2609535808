/** Present login with associated errors and honest local-storage feedback. */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getSession } from '../../utils/auth.js';
import { canAccessRoute } from '../../utils/permissions.js';
import { login } from './accountService.js';

const fields = [['username', 'Username', 'text', 'username'], ['password', 'Password', 'password', 'current-password']];
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Keep entered credentials until persistence succeeds, then enter the role home.
 * Returns:
 *   A guest form or the existing session's role-directed redirect.
 */
export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const decision = canAccessRoute(getSession(), '/login');

  /** Validate the submitted values and navigate only after a committed session. */
  function submit(event) {
    event.preventDefault();
    const result = login(form);
    setErrors(result.fields || {});
    setMessage(result.message || '');
    if (result.ok) navigate(result.nextRoute, { replace: true });
  }

  if (!decision.allow) return <Navigate to={decision.redirectTo} replace />;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-800 sm:py-20">
      <div className="mx-auto max-w-md">
        <Link to="/" className={'rounded text-xl font-semibold ' + focus}>
          WriteSpace
        </Link>
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="auth-heading">
          <h1 id="auth-heading" className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Log in to your local writing space.</p>
          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            {fields.map(([name, label, type, autocomplete]) => (
              <div key={name}>
                <label htmlFor={name} className="mb-2 block text-sm font-medium">{label}</label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  autoComplete={autocomplete}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? name + '-error' : undefined}
                  value={form[name]}
                  onChange={(event) => setForm({ ...form, [name]: event.target.value })}
                  className={'w-full rounded-lg border px-3 py-3 ' + focus
                    + (errors[name] ? ' border-red-600' : ' border-slate-300')}
                />
                {errors[name] && (
                  <p id={name + '-error'} role="alert" className="mt-2 text-sm text-red-700">{errors[name]}</p>
                )}
              </div>
            ))}
            {message && !Object.values(errors).includes(message) && (
              <p role="alert" className="text-sm leading-6 text-red-700">{message}</p>
            )}
            <button
              type="submit"
              className={'w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 ' + focus}
            >
              Login
            </button>
          </form>
          <p className="mt-6 text-sm text-slate-600">
            New to WriteSpace?{' '}
            <Link to="/register" className={'rounded text-indigo-700 underline ' + focus}>
              Register
            </Link>
          </p>
          <p className="mt-6 text-sm text-slate-600">Demo admin: username <strong>admin</strong>, password <strong>admin</strong>.</p>
          <p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
            Browser-only demo. Credentials are stored in plaintext locally. Do not use real passwords or sensitive data.
            Client-side checks are not security controls.
          </p>
        </section>
      </div>
    </main>
  );
}

LoginPage.propTypes = {};
