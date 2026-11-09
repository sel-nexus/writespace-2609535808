/** Exercise form validation, responsive semantics and fresh authorization with real local records. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App.jsx';
import UserManagement from './UserManagement.jsx';
import UserRow from './UserRow.jsx';
import { setSession, SESSION_KEY } from '../../utils/auth.js';
import { getUsers, setUsers, setPosts, USERS_KEY, POSTS_KEY } from '../../utils/storage.js';

const admin = { userId: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const writer = { id: 'writer', username: 'writer', displayName: 'Writer', password: 'NEVER-RENDER',
  role: 'user', createdAt: '2026-03-04T12:00:00.000Z' };
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };

/** Mount the actual app route without introducing a second router. */
function mount() {
  window.history.replaceState({}, '', '/users');
  return render(<App />);
}
/** Fill the normal labeled provisioning fields with exact strings. */
async function fill(actor, role = 'user', username = 'new-writer') {
  await actor.type(screen.getByLabelText('Display Name (required)'), 'New Writer');
  await actor.type(screen.getByLabelText('Username (required)'), username);
  await actor.type(screen.getByLabelText('Password (required)'), 'demo-only');
  await actor.selectOptions(screen.getByLabelText('Role (required)'), role);
}
/** Select desktop account actions through semantic row headers. */
function row(name = 'Writer') {
  return within(screen.getByRole('table')).getAllByRole('rowheader')
    .find((header) => within(header).queryByText(name, { exact: true }))
    .closest('tr');
}
beforeEach(() => {
  localStorage.clear();
  setSession(admin);
  setUsers([writer, editor]);
  setPosts([{ id: 'post', title: 'Preserved post', authorId: 'writer', authorName: 'Writer',
    content: 'Preserve this', createdAt: '2026-03-04T12:00:00.000Z' }]);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-id');
});
afterEach(() => vi.restoreAllMocks());

it('wires /users with Navbar for admin and redirects guests/users correctly', () => {
  const view = mount();
  expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  view.unmount();
  localStorage.removeItem(SESSION_KEY);
  const guest = mount();
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
  guest.unmount();
  setSession({ ...admin, role: 'user' });
  mount();
  expect(window.location.pathname).toBe('/blogs');
  expect(screen.queryByRole('heading', { name: 'User Management' })).toBeNull();
});
it('renders required accessible fields, explicit plaintext limitations and responsive table/cards without credentials', () => {
  const raw = localStorage.getItem(USERS_KEY);
  mount();
  for (const label of ['Display Name', 'Username', 'Password', 'Role']) {
    const field = screen.getByLabelText(label + ' (required)');
    expect(field).toBeRequired();
    expect(field).toHaveAttribute('aria-required', 'true');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  }
  expect(screen.getByLabelText('Password (required)')).toHaveAttribute('type', 'password');
  expect(screen.getByText(/passwords are stored in plaintext/)).toHaveTextContent('Client-side role checks are not security controls.');
  const table = screen.getByRole('table');
  expect(table.parentElement).toHaveClass('hidden', 'sm:block');
  expect(table).toHaveClass('table-fixed', 'w-full');
  expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(5);
  expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(3);
  expect(screen.getByRole('list', { name: 'Local account cards' })).toHaveClass('sm:hidden', 'min-w-0');
  expect(screen.getAllByText('Mar 04, 2026')).toHaveLength(4);
  expect(within(row()).getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(within(row('Editor')).getByRole('status')).toHaveTextContent('Admin');
  expect(document.body.textContent).not.toContain('NEVER-RENDER');
  expect(localStorage.getItem(USERS_KEY)).toBe(raw);
});
it('shows adjacent field alerts on empty submit with aria-invalid and describedby', async () => {
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  for (const [label, id] of [['Display Name', 'displayName'], ['Username', 'username'], ['Password', 'password']]) {
    const field = screen.getByLabelText(label + ' (required)');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', id + '-error');
    expect(document.getElementById(id + '-error')).toHaveAttribute('role', 'alert');
  }
  expect(getUsers()).toEqual([writer, editor]);
});
for (const role of ['user', 'admin']) {
  it('creates ' + role + ' account and resets only after commit with live success', async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor, role);
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(getUsers()[2]).toMatchObject({ id: 'new-id', username: 'new-writer', password: 'demo-only', role });
    expect(screen.getByLabelText('Username (required)')).toHaveValue('');
    expect(screen.getByText('Account created successfully.')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByText('New Writer')).toHaveLength(2);
    expect(document.body.textContent).not.toContain('demo-only');
  });
}
for (const username of ['admin', 'writer']) {
  it('retains input on reserved or duplicate username ' + username, async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor, 'user', username);
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Username (required)')).toHaveValue(username);
    expect(screen.getByLabelText('Username (required)')).toHaveAttribute('aria-describedby', 'username-error');
    expect(getUsers()).toEqual([writer, editor]);
  });
}
for (const failure of ['QuotaExceededError', 'SecurityError', 'serialization', 'generation']) {
  it('retains form and accounts on ' + failure + ' failure without success or private error details', async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor);
    const raw = localStorage.getItem(USERS_KEY);
    if (failure === 'serialization') {
      const stringify = JSON.stringify;
      vi.spyOn(JSON, 'stringify').mockImplementation((value, ...args) => {
        if (Array.isArray(value) && value.some((record) => record?.id === 'new-id')) throw Error('private');
        return stringify(value, ...args);
      });
    }
    else if (failure === 'generation') vi.mocked(crypto.randomUUID).mockImplementation(() => { throw Error('private'); });
    else vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', failure); });
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByRole('alert')).not.toHaveTextContent('private');
    expect(screen.getByLabelText('Password (required)')).toHaveValue('demo-only');
    expect(screen.getByLabelText('Username (required)')).toHaveValue('new-writer');
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
    expect(screen.queryByText('Account created successfully.')).toBeNull();
    expect(screen.getAllByText('Writer')).toHaveLength(2);
  });
}
it('checks fresh auth on submit and disables subsequent creation after a role change', async () => {
  mount();
  const actor = userEvent.setup();
  await fill(actor);
  setSession({ ...admin, role: 'user' });
  await actor.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Only administrators can create accounts.');
  expect(screen.getByRole('button', { name: 'Create Account' })).toBeDisabled();
  expect(getUsers()).toEqual([writer, editor]);
});
it('disables built-in and active-admin deletion with exact explanatory tooltip and description', () => {
  mount();
  const builtIn = within(row('Admin')).getByRole('button', { name: 'Delete' });
  expect(builtIn).toBeDisabled();
  expect(builtIn).toHaveAttribute('title', 'Default admin cannot be deleted');
  expect(builtIn).toHaveAccessibleDescription('Default admin cannot be deleted');
  const self = within(row('Editor')).getByRole('button', { name: 'Delete' });
  expect(self).toBeDisabled();
  expect(self).toHaveAccessibleDescription('You cannot delete your own administrator account.');
});
for (const mobile of [false, true]) {
  it('supports ' + (mobile ? 'mobile card' : 'desktop row') + ' cancellation and confirmed deletion without post effects', async () => {
    mount();
    const posts = localStorage.getItem(POSTS_KEY);
    const findDelete = () => mobile
      ? within(within(screen.getByRole('list', { name: 'Local account cards' }))
        .getByText(writer.displayName, { exact: true }).closest('li')).getByRole('button', { name: 'Delete' })
      : within(row()).getByRole('button', { name: 'Delete' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.click(findDelete());
    expect(confirm).toHaveBeenCalledWith('Delete this account? Their posts will be preserved.');
    expect(write).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([writer, editor]);
    confirm.mockReturnValue(true);
    await userEvent.click(findDelete());
    expect(getUsers()).toEqual([editor]);
    expect(localStorage.getItem(POSTS_KEY)).toBe(posts);
    expect(screen.queryByText('Writer')).toBeNull();
    expect(screen.getByText('Account deleted. Their posts were preserved.')).toBeInTheDocument();
  });
}
it('keeps displayed accounts on failed delete and clears failure when cancelled', async () => {
  mount();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', 'QuotaExceededError'); });
  await userEvent.click(within(row()).getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Account could not be deleted.');
  expect(screen.getAllByText('Writer')).toHaveLength(2);
  expect(getUsers()).toEqual([writer, editor]);
  confirm.mockReturnValue(false);
  await userEvent.click(within(row()).getByRole('button', { name: 'Delete' }));
  expect(screen.queryByRole('alert')).toBeNull();
});
for (const state of ['guest', 'user', 'self', 'missing']) {
  it('rechecks ' + state + ' state after confirmation without deleting stale data', async () => {
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (state === 'guest') localStorage.removeItem(SESSION_KEY);
      if (state === 'user') setSession({ ...admin, role: 'user' });
      if (state === 'self') setSession({ ...admin, userId: 'writer' });
      if (state === 'missing') setUsers([editor]);
      return true;
    });
    await userEvent.click(within(row()).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByText('Writer')).toHaveLength(2);
    expect(getUsers()).toEqual(state === 'missing' ? [editor] : [writer, editor]);
  });
}
it('renders only default admin for unavailable/malformed records without repair', () => {
  localStorage.setItem(USERS_KEY, '{broken');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const view = render(<UserManagement />);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
  expect(write).not.toHaveBeenCalled();
  view.unmount();
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === USERS_KEY) throw Error('private');
    return original.call(this, key);
  });
  render(<UserManagement />);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
  expect(write).not.toHaveBeenCalled();
});
it('escapes account markup and handles unavailable dates and nonadmin controls in isolated cards', () => {
  const onDelete = vi.fn();
  const view = render(
    <ul>
      <UserRow
        user={{ ...writer, displayName: '<script>unsafe</script>', createdAt: 'bad' }}
        session={null}
        onDelete={onDelete}
        mobile
      />
    </ul>
  );
  expect(screen.getByText('<script>unsafe</script>')).toBeInTheDocument();
  expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  expect(view.container.querySelector('script')).toBeNull();
});
