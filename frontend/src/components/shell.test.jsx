/** Verify role navigation, keyboard disclosures, logout and session rechecks. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { setSession, getSession, SESSION_KEY } from '../utils/auth.js';
import { setUsers, getUsers } from '../utils/storage.js';
import App from '../App.jsx';
const session = { userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' };
/** Display destination and logout state without future feature pages. */
function Destination() {
  const { pathname, state } = useLocation();
  return (
    <>
      <p role="status">{pathname}</p>
      {state?.logoutWarning && <p role="alert">{state.logoutWarning}</p>}
    </>
  );
}
/** Keep the shell mounted across test-only destination transitions. */
function mountNavbar() {
  return render(
    <MemoryRouter initialEntries={['/blogs']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar />
      <Routes>
        <Route path="*" element={<Destination />} />
      </Routes>
      <button type="button">Outside</button>
    </MemoryRouter>,
  );
}
beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/'); });
afterEach(() => vi.restoreAllMocks());
it('renders no account shell for a guest', () => {
  mountNavbar();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
for (const role of ['user', 'admin']) {
  it('offers desktop and mobile destinations for ' + role, async () => {
    setSession({ ...session, role });
    mountNavbar();
    const desktop = screen.getByLabelText('Desktop destinations');
    const expected = role === 'admin' ? ['All Blogs', 'Write', 'Dashboard', 'Users'] : ['All Blogs', 'Write'];
    expect(within(desktop).getAllByRole('link').map((link) => link.textContent)).toEqual(expected);
    const events = userEvent.setup();
    await events.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(mobile).getAllByRole('link').map((link) => link.textContent)).toEqual(expected);
    expect(within(mobile).getByRole('link', { name: 'All Blogs' })).toHaveFocus();
    await events.click(within(mobile).getByRole('link', { name: 'Write' }));
    expect(screen.getByRole('status')).toHaveTextContent('/write');
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeInTheDocument();
  });
}
it('toggles mobile menu closed and restores trigger focus on Escape', async () => {
  setSession(session);
  mountNavbar();
  const events = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Toggle navigation' });
  await events.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await events.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await events.click(trigger);
  await events.click(trigger);
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
});
it('opens account disclosure, focuses Logout, closes with Escape or trigger and excludes mobile menu', async () => {
  setSession(session);
  mountNavbar();
  const events = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Account menu for Writer' });
  await events.click(trigger);
  expect(screen.getByRole('button', { name: 'Logout' })).toHaveFocus();
  await events.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await events.click(trigger);
  await events.click(trigger);
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  await events.click(screen.getByRole('button', { name: 'Toggle navigation' }));
  await events.click(trigger);
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
});
it('does not consume unrelated keys and closes disclosures when focus leaves', async () => {
  setSession(session);
  mountNavbar();
  const events = userEvent.setup();
  await events.click(screen.getByRole('button', { name: 'Account menu for Writer' }));
  await events.keyboard('x');
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  await events.tab();
  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
});
it('logout clears only the session and returns public with no warning', async () => {
  setSession(session);
  setUsers([{ id: 'one' }]);
  mountNavbar();
  const events = userEvent.setup();
  await events.click(screen.getByRole('button', { name: 'Account menu for Writer' }));
  await events.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('status')).toHaveTextContent('/');
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  expect(getUsers()).toEqual([{ id: 'one' }]);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('failed logout returns public with warning and preserves readable identity', async () => {
  setSession(session);
  mountNavbar();
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw Error('blocked'); });
  const events = userEvent.setup();
  await events.click(screen.getByRole('button', { name: 'Account menu for Writer' }));
  await events.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('status')).toHaveTextContent('/');
  expect(screen.getByRole('alert')).toHaveTextContent('You may still be signed in');
  expect(getSession()).toEqual(session);
});
it('failed removal with unreadable session does not claim a readable-session warning', async () => {
  setSession(session);
  mountNavbar();
  const events = userEvent.setup();
  await events.click(screen.getByRole('button', { name: 'Account menu for Writer' }));
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw Error('blocked'); });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
  await events.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('status')).toHaveTextContent('/');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
for (const role of ['guest', 'user', 'admin']) {
  for (const path of ['/blogs', '/blog/one', '/write', '/edit/one', '/admin', '/users']) {
    it('guards ' + path + ' for ' + role, () => {
      if (role !== 'guest') setSession({ ...session, role });
      render(
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path={path} element={<ProtectedRoute><p>Allowed content</p></ProtectedRoute>} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>,
      );
      const denied = role === 'guest' || (role === 'user' && ['/admin', '/users'].includes(path));
      if (denied) expect(screen.getByRole('status')).toHaveTextContent(role === 'guest' ? '/login' : '/blogs');
      else expect(screen.getByText('Allowed content')).toBeInTheDocument();
    });
  }
}
it('renders nested outlet and rechecks identity after persisted removal', () => {
  setSession(session);
  /** Compose a nested guard for rerendering the same route. */
  function Tree({ tick }) {
    return (
      <MemoryRouter initialEntries={['/write']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<ProtectedRoute key={tick} />}>
            <Route path="/write" element={<p>Nested content</p>} />
          </Route>
          <Route path="/login" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    );
  }
  const view = render(<Tree tick={0} />);
  expect(screen.getByText('Nested content')).toBeInTheDocument();
  localStorage.removeItem(SESSION_KEY);
  view.rerender(<Tree tick={1} />);
  expect(screen.getByRole('status')).toHaveTextContent('/login');
});
it('actual App wires login and registration while preserving unknown fallback', async () => {
  window.history.replaceState({}, '', '/login');
  render(<App />);
  const events = userEvent.setup();
  await events.click(screen.getByRole('link', { name: 'Register' }));
  expect(window.location.pathname).toBe('/register');
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
});
it('actual App displays public logout warning from route state', () => {
  window.history.replaceState({ usr: { logoutWarning: 'Local session remains.' } }, '', '/');
  render(<App />);
  expect(screen.getByRole('alert')).toHaveTextContent('Local session remains.');
  expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeInTheDocument();
});

it('preserves the real unknown-route fallback', async () => {
  window.history.replaceState({}, '', '/unknown');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'WriteSpace', level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});
it('guards real App deep links for guests', () => {
  window.history.replaceState({}, '', '/users');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
});
