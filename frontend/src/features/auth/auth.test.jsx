/** Verify accessible forms, persisted outcomes and role navigation. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import { getSession, setSession, SESSION_KEY } from '../../utils/auth.js';
import { getUsers, setUsers } from '../../utils/storage.js';
const user = { id: 'one', username: 'writer', displayName: 'Writer', password: 'local', role: 'user' };
/** Expose final destinations only in the test harness. */
function Destination() {
  const { pathname } = useLocation();
  return <p role="status">{pathname}</p>;
}
/** Render both implemented forms with test-only role-home destinations. */
function mount(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}
/** Fill registration using user-visible associated labels. */
async function fillRegistration(events, username = 'writer', confirmation = 'local') {
  await events.type(screen.getByLabelText('Display Name'), 'Writer');
  await events.type(screen.getByLabelText('Username'), username);
  await events.type(screen.getByLabelText('Password', { exact: true }), 'local');
  await events.type(screen.getByLabelText('Confirm Password'), confirmation);
}
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it.each(['/login', '/register'])('associates required field alerts at %s without writes', async (path) => {
  mount(path);
  await userEvent.setup().click(screen.getByRole('button', { name: path === '/login' ? 'Login' : 'Create Account' }));
  for (const label of path === '/login' ? ['Username', 'Password'] : ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    const input = screen.getByLabelText(label, { exact: true });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    const alert = document.getElementById(input.getAttribute('aria-describedby'));
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('This field is required.');
  }
  expect(getSession()).toBeNull();
  expect(getUsers()).toEqual([]);
});

it('shows exact invalid login errors associated with both fields and retains input', async () => {
  mount();
  const events = userEvent.setup();
  await events.type(screen.getByLabelText('Username'), 'unknown');
  await events.type(screen.getByLabelText('Password'), 'wrong');
  await events.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Invalid username or password.');
  expect(screen.getByLabelText('Username')).toHaveValue('unknown');
  expect(screen.getByLabelText('Password')).toHaveValue('wrong');
  expect(getSession()).toBeNull();
});

it.each(['user', 'admin'])('logs in stored %s only after session commit', async (role) => {
  setUsers([{ ...user, role }]);
  mount();
  const events = userEvent.setup();
  await events.type(screen.getByLabelText('Username'), 'writer');
  await events.type(screen.getByLabelText('Password'), 'local');
  await events.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByRole('status')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
  expect(getSession()).toEqual({ userId: 'one', username: 'writer', displayName: 'Writer', role });
});

it('shows exact demo hints and signs in built-in admin', async () => {
  mount();
  expect(screen.getByText(/Demo admin:/)).toHaveTextContent('username admin, password admin');
  expect(screen.getByText(/Credentials are stored in plaintext/)).toBeInTheDocument();
  const events = userEvent.setup();
  await events.type(screen.getByLabelText('Username'), 'admin');
  await events.type(screen.getByLabelText('Password'), 'admin');
  await events.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByRole('status')).toHaveTextContent('/admin');
  expect(getSession().userId).toBe('admin');
});

it('registers a regular account and persists its password-free session', async () => {
  mount('/register');
  const events = userEvent.setup();
  await fillRegistration(events);
  await events.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('status')).toHaveTextContent('/blogs');
  expect(getUsers()).toHaveLength(1);
  expect(getUsers()[0]).toMatchObject({ username: 'writer', displayName: 'Writer', password: 'local', role: 'user' });
  expect(getUsers()[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(getSession()).toEqual({ userId: getUsers()[0].id, username: 'writer', displayName: 'Writer', role: 'user' });
});

it.each([['admin', 'local', 'This username is reserved.'], ['writer', 'other', 'Passwords must match.'],
  ['writer', 'local', 'This username is already taken.']])('rejects registration %s/%s with associated alerts', async (username, confirm, error) => {
  if (error.includes('taken')) setUsers([user]);
  mount('/register');
  const events = userEvent.setup();
  await fillRegistration(events, username, confirm);
  await events.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(error);
  const input = screen.getByLabelText(error.includes('match') ? 'Confirm Password' : 'Username');
  expect(input).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(getSession()).toBeNull();
  expect(getUsers()).toHaveLength(error.includes('taken') ? 1 : 0);
});

it.each(['/login', '/register'])('retains all form values when storage write fails at %s', async (path) => {
  setUsers([user]);
  mount(path);
  const events = userEvent.setup();
  if (path === '/register') await fillRegistration(events, 'second');
  else {
    await events.type(screen.getByLabelText('Username'), 'writer');
    await events.type(screen.getByLabelText('Password'), 'local');
  }
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  await events.click(screen.getByRole('button', { name: path === '/login' ? 'Login' : 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/not saved|could not be saved/);
  expect(screen.getByLabelText('Username')).toHaveValue(path === '/login' ? 'writer' : 'second');
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('local');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(getSession()).toBeNull();
});

it('explains partial registration and retains fields with no account rollback', async () => {
  mount('/register');
  const events = userEvent.setup();
  await fillRegistration(events);
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === SESSION_KEY) throw new DOMException('blocked', 'SecurityError');
    write.call(this, key, value);
  });
  await events.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Your account was saved, but sign-in did not complete.');
  expect(screen.getByLabelText('Display Name')).toHaveValue('Writer');
  expect(screen.getByLabelText('Confirm Password')).toHaveValue('local');
  expect(getUsers()).toHaveLength(1);
  expect(getSession()).toBeNull();
});

for (const path of ['/login', '/register']) {
  it.each(['user', 'admin'])('redirects existing %s from ' + path, (role) => {
    setSession({ userId: 'one', username: 'writer', displayName: 'Writer', role });
    mount(path);
    expect(screen.getByRole('status')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
}
it('rechecks session on a fresh form render', () => {
  const view = mount();
  expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  setSession({ userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' });
  view.rerender(
    <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('/blogs');
});
it('links between auth forms and back to public discovery', async () => {
  mount();
  const events = userEvent.setup();
  await events.click(screen.getByRole('link', { name: 'Register' }));
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  await events.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  await events.click(screen.getByRole('link', { name: 'WriteSpace' }));
  expect(screen.getByRole('status')).toHaveTextContent('/');
});
