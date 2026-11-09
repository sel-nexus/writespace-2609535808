/** Verify dashboard counts, routed controls and persistence under success and rejection. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../../App.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import { StatCard } from './StatCard.jsx';
import { ProtectedRoute } from '../../components/ProtectedRoute.jsx';
import { getPosts, setPosts, setUsers, POSTS_KEY, USERS_KEY } from '../../utils/storage.js';
import { setSession, SESSION_KEY } from '../../utils/auth.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const writer = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const posts = [2, 6, 1, 5, 3, 4].map((day) => ({
  id: 'post-' + day, title: 'Story ' + day, content: 'Text ' + day,
  createdAt: `2026-03-0${day}T12:00:00.000Z`, authorId: 'writer', authorName: 'Writer',
}));
const users = [
  { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user' },
  { id: 'editor', username: 'editor', displayName: 'Editor', password: 'demo', role: 'admin' },
];

/** Mount the actual route wiring without a second router. */
function mount(path = '/admin') {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Read a metric's semantic value without depending on other cards' numbers. */
function metric(label) {
  return screen.getByText(label, { exact: true }).closest('dl').querySelector('dd');
}

/** Resolve a recent row through its navigable post title. */
function row(title = 'Story 6') {
  return screen.getByRole('link', { name: title, exact: true }).closest('li');
}

beforeEach(() => {
  localStorage.clear();
  setSession(admin);
  setPosts(posts);
  setUsers(users);
});
afterEach(() => vi.restoreAllMocks());

it('StatCard pairs exact labels with counts and omits an absent description', () => {
  const view = render(<StatCard label="Total Posts" value={6} />);
  expect(metric('Total Posts')).toHaveTextContent('6');
  expect(view.container.querySelector('dt')).toHaveTextContent('Total Posts');
  expect(view.container.querySelector('p')).toBeNull();
  view.rerender(<StatCard label="Total Posts" value={0} />);
  expect(metric('Total Posts')).toHaveTextContent('0');
});

it('StatCard renders undefined values and explanations as escaped text', () => {
  const view = render(<StatCard label="Total users" value="—" description="Not defined in this demo" />);
  expect(metric('Total users')).toHaveTextContent('—');
  expect(screen.getByText('Not defined in this demo')).toBeInTheDocument();
  view.rerender(<StatCard label="<script>label</script>" value="—" description="<img src=x>" />);
  expect(screen.getByText('<img src=x>')).toBeInTheDocument();
  expect(view.container.querySelector('script, img')).toBeNull();
});

it('shows four exact labels, coherent built-in counts and five newest copied posts without writes', () => {
  const raw = localStorage.getItem(POSTS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Dashboard statistics' }).querySelectorAll('dt')).toHaveLength(4);
  expect(metric('Total Posts')).toHaveTextContent('6');
  expect(metric('Total Users')).toHaveTextContent('3');
  expect(metric('Total Admins')).toHaveTextContent('2');
  expect(metric('Total users')).toHaveTextContent('—');
  expect(screen.getByText('Not defined in this demo')).toBeInTheDocument();
  const recent = screen.getByRole('region', { name: 'Recent Posts' });
  expect(within(recent).getAllByRole('listitem').map((node) => within(node).getAllByRole('link')[0].textContent))
    .toEqual(['Story 6', 'Story 5', 'Story 4', 'Story 3', 'Story 2']);
  expect(within(recent).getAllByRole('link', { name: 'Edit', exact: true })).toHaveLength(5);
  expect(within(recent).getAllByRole('button', { name: 'Delete', exact: true })).toHaveLength(5);
  expect(within(row()).getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(within(row()).getByText('Mar 06, 2026')).toHaveAttribute('datetime', posts[1].createdAt);
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  expect(write).not.toHaveBeenCalled();
});

it('counts a stored built-in representation once without rewriting user records', () => {
  setUsers([...users, { id: 'admin', username: 'admin', role: 'admin' }]);
  const raw = localStorage.getItem(USERS_KEY);
  mount();
  expect(metric('Total Users')).toHaveTextContent('3');
  expect(metric('Total Admins')).toHaveTextContent('2');
  expect(localStorage.getItem(USERS_KEY)).toBe(raw);
});

for (const state of ['empty', 'malformed', 'wrong shape', 'unavailable']) {
  it('handles ' + state + ' records with zero posts and only the built-in account, without repair', () => {
    if (state === 'empty') { localStorage.removeItem(POSTS_KEY); localStorage.removeItem(USERS_KEY); }
    else if (state === 'unavailable') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if ([POSTS_KEY, USERS_KEY].includes(key)) throw new DOMException('private detail', 'SecurityError');
        return original.call(this, key);
      });
    } else {
      localStorage.setItem(POSTS_KEY, state === 'malformed' ? '{broken' : '{}');
      localStorage.setItem(USERS_KEY, state === 'malformed' ? '{broken' : '{}');
    }
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(metric('Total Posts')).toHaveTextContent('0');
    expect(metric('Total Users')).toHaveTextContent('1');
    expect(metric('Total Admins')).toHaveTextContent('1');
    expect(screen.getByText('No posts yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
    expect(write).not.toHaveBeenCalled();
  });
}

it('renders single-post escaped title, invalid date and stored admin author avatar', () => {
  setPosts([{ ...posts[0], title: '<script>story</script>', createdAt: 'invalid', authorId: 'editor' }]);
  mount();
  const entry = row('<script>story</script>');
  expect(within(entry).getByText('Date unavailable')).not.toHaveAttribute('datetime');
  expect(within(entry).getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
  expect(entry.querySelector('script')).toBeNull();
  expect(metric('Total Posts')).toHaveTextContent('1');
});

it('navigates inline Edit and post title links without writes', async () => {
  mount();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(within(row()).getByRole('link', { name: 'Edit', exact: true }));
  expect(window.location.pathname).toBe('/edit/post-6');
  expect(screen.getByLabelText('Title')).toHaveValue('Story 6');
  expect(getPosts()).toEqual(posts);
  expect(write).not.toHaveBeenCalled();
});

it('opens a recent post detail through its title', async () => {
  mount();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Story 6' }));
  expect(window.location.pathname).toBe('/blog/post-6');
  expect(screen.getByRole('heading', { name: 'Story 6' })).toBeInTheDocument();
});

it('quick write navigates to the existing form without saving', async () => {
  mount();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Write New Post' }));
  expect(window.location.pathname).toBe('/write');
  expect(screen.getByLabelText('Title')).toHaveValue('');
  expect(write).not.toHaveBeenCalled();
});

it('Manage Users uses the intended destination without inventing a production placeholder', async () => {
  render(
    <MemoryRouter initialEntries={['/admin']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/users" element={<p>Test destination reached</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.setup().click(screen.getByRole('link', { name: 'Manage Users' }));
  expect(screen.getByText('Test destination reached')).toBeInTheDocument();
  expect(getPosts()).toEqual(posts);
});

it('cancel leaves actual storage, overview order and counts unchanged without writes', async () => {
  mount();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
  expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
  expect(write).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual(posts);
  expect(metric('Total Posts')).toHaveTextContent('6');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/admin');
});

it('confirmed shared deletion commits only the selected record and refills the five-post overview', async () => {
  const view = mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
  const remaining = posts.filter((post) => post.id !== 'post-6');
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual(remaining);
  expect(screen.queryByRole('link', { name: 'Story 6' })).not.toBeInTheDocument();
  expect(row('Story 1')).toBeInTheDocument();
  expect(metric('Total Posts')).toHaveTextContent('5');
  expect(metric('Total Users')).toHaveTextContent('3');
  expect(window.location.pathname).toBe('/admin');
  view.unmount();
  mount();
  expect(metric('Total Posts')).toHaveTextContent('5');
  expect(getPosts()).toEqual(remaining);
});

for (const failure of ['QuotaExceededError', 'SecurityError', 'serialization']) {
  it('preserves displayed and persisted posts on ' + failure + ', with safe feedback and explicit retry', async () => {
    mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const original = JSON.stringify;
    const injection = failure === 'serialization'
      ? vi.spyOn(JSON, 'stringify').mockImplementation((value, ...args) => {
        if (Array.isArray(value) && value.some((entry) => entry?.id?.startsWith('post-'))) throw Error('private detail');
        return original(value, ...args);
      })
      : vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private detail', failure); });
    await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The post could not be deleted. Please check browser storage and try again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('private detail');
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual(posts);
    expect(metric('Total Posts')).toHaveTextContent('6');
    expect(row()).toBeInTheDocument();
    injection.mockRestore();
    vi.mocked(window.confirm).mockReturnValue(false);
    await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getPosts()).toEqual(posts);
    vi.mocked(window.confirm).mockReturnValue(true);
    await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
    expect(metric('Total Posts')).toHaveTextContent('5');
  });
}

for (const identity of ['guest', 'user', 'owner']) {
  it('denies a fresh ' + identity + ' identity changed during confirmation without any write', async () => {
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (identity === 'guest') localStorage.removeItem(SESSION_KEY);
      else setSession({ ...writer, userId: identity === 'owner' ? 'writer' : 'other' });
      return true;
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
    expect(write.mock.calls.filter(([key]) => key === POSTS_KEY)).toEqual([]);
    expect(getPosts()).toEqual(posts);
    expect(screen.getByRole('alert')).toHaveTextContent('You are not allowed to delete this post.');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Write New Post' })).not.toBeInTheDocument();
    expect(metric('Total Posts')).toHaveTextContent('6');
  });
}

it('shared service reads fresh posts and does not restore a concurrent addition from the page snapshot', async () => {
  mount();
  const added = { ...posts[0], id: 'added', title: 'Added story' };
  vi.spyOn(window, 'confirm').mockImplementation(() => { setPosts([...posts, added]); return true; });
  await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
  expect(getPosts()).toEqual([...posts.filter((post) => post.id !== 'post-6'), added]);
  expect(metric('Total Posts')).toHaveTextContent('6');
});

it('missing post fails without writing or falsely refreshing the overview', async () => {
  mount();
  setPosts([]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(within(row()).getByRole('button', { name: 'Delete' }));
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([]);
  expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
  expect(metric('Total Posts')).toHaveTextContent('6');
});

for (const identity of [null, writer, admin]) {
  it('routes /admin correctly for ' + (identity?.role ?? 'guest'), () => {
    if (identity) setSession(identity);
    else localStorage.removeItem(SESSION_KEY);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(window.location.pathname).toBe(identity?.role === 'admin' ? '/admin' : identity ? '/blogs' : '/login');
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' }) !== null).toBe(identity?.role === 'admin');
    expect(write).not.toHaveBeenCalled();
  });
}

for (const identity of [null, writer, admin]) {
  it('requiredRole enforces admin even on a non-admin pathname for ' + (identity?.role ?? 'guest'), () => {
    if (identity) setSession(identity);
    else localStorage.removeItem(SESSION_KEY);
    render(
      <MemoryRouter initialEntries={['/restricted']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/restricted" element={
            <ProtectedRoute requiredRole="admin">
              <p>Allowed admin</p>
            </ProtectedRoute>
          } />
          <Route path="/blogs" element={<p>User destination</p>} />
          <Route path="/login" element={<p>Guest destination</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(identity?.role === 'admin' ? 'Allowed admin' : identity ? 'User destination' : 'Guest destination'))
      .toBeInTheDocument();
  });
}
