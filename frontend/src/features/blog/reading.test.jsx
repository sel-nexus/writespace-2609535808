/** Exercise list, card and detail behavior through rendered controls and real storage. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Home from './Home.jsx';
import BlogCard from './BlogCard.jsx';
import ReadBlog from './ReadBlog.jsx';
import App from '../../App.jsx';
import { getPosts, setPosts, POSTS_KEY } from '../../utils/storage.js';
import { setSession, SESSION_KEY } from '../../utils/auth.js';

const owner = { userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: 'note', title: 'A note', content: '<script>alert("no")</script>\n  Second line\n\n' + 'x'.repeat(150),
  createdAt: '2026-03-04T12:00:00.000Z', authorId: 'one', authorName: 'Writer',
};
const other = { ...post, id: 'other', title: 'Older note', createdAt: '2026-03-03T12:00:00.000Z', authorId: 'two', authorName: 'Other' };

/** Mount only reading destinations while allowing real list/detail navigation. */
function mount(path = '/blog/note') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/blogs" element={<Home />} />
        <Route path="/blog/:id" element={<ReadBlog />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => { localStorage.clear(); setSession(owner); setPosts([other, post]); window.history.replaceState({}, '', '/'); });
afterEach(() => vi.restoreAllMocks());

it('sorts all posts on a copy, cycles accents and exposes the responsive grid', () => {
  const posts = [other, post, { ...post, id: 'third', title: 'Third', createdAt: '2026-03-02' },
    { ...post, id: 'fourth', title: 'Fourth', createdAt: '2026-03-01' },
    { ...post, id: 'fifth', title: 'Fifth', createdAt: '2026-02-28' }];
  setPosts(posts);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount('/blogs');
  expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent))
    .toEqual(['A note', 'Older note', 'Third', 'Fourth', 'Fifth']);
  expect(screen.getByLabelText('Blog posts')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  screen.getAllByRole('article').forEach((node, index) => {
    expect(node).toHaveClass(['border-t-indigo-500', 'border-t-violet-500', 'border-t-pink-500', 'border-t-teal-500'][index % 4]);
  });
  expect(getPosts()).toEqual(posts);
  expect(write).not.toHaveBeenCalled();
});
for (const raw of [null, 'broken', '{}', '[]']) {
  it('shows exact empty copy and write destination without repairing ' + raw, () => {
    if (raw === null) localStorage.removeItem(POSTS_KEY);
    else localStorage.setItem(POSTS_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount('/blogs');
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('href', '/write');
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });
}
it('renders safe empty state for inaccessible posts storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
  mount('/blogs');
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
});
it('shows exact 120-character escaped excerpt, date, author, avatar and title navigation', async () => {
  mount('/blogs');
  const card = screen.getAllByRole('article')[0];
  expect(card.querySelector('p').textContent).toBe(post.content.slice(0, 120));
  expect(within(card).getByText('Writer')).toBeInTheDocument();
  expect(within(card).getByText('Mar 04, 2026')).toBeInTheDocument();
  expect(within(card).getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(card.querySelector('script')).toBeNull();
  await userEvent.setup().click(within(card).getByRole('link', { name: 'A note', exact: true }));
  expect(screen.getByRole('heading', { level: 1, name: 'A note' })).toBeInTheDocument();
});
for (const [session, editable] of [[owner, true], [{ ...owner, userId: 'two' }, false], [{ ...owner, role: 'admin' }, true], [null, false]]) {
  it('card edit affordance follows current reader permission ' + JSON.stringify(session), () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BlogCard post={post} session={session} />
      </MemoryRouter>,
    );
    const edit = screen.queryByRole('link', { name: 'Edit A note' });
    if (editable) expect(edit).toHaveAttribute('href', '/edit/note');
    else expect(edit).not.toBeInTheDocument();
  });
}
it('card handles short content, invalid date, default props and built-in admin attribution', () => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BlogCard post={{ ...post, content: 'Short', createdAt: 'invalid', authorId: 'admin', authorName: 'Admin' }} />
    </MemoryRouter>,
  );
  expect(screen.getByText('Short')).toBeInTheDocument();
  expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
});
it('detail preserves full whitespace and escaping and links edit/back with visible focus', () => {
  mount();
  const content = screen.getByRole('article').querySelector('p.whitespace-pre-wrap');
  expect(content.textContent).toBe(post.content);
  expect(content).toHaveClass('whitespace-pre-wrap', 'break-words');
  expect(content.querySelector('script')).toBeNull();
  expect(screen.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/note');
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('focus-visible:ring-2');
  expect(screen.getByText('Mar 04, 2026')).toBeInTheDocument();
  expect(screen.getByText('Writer')).toBeInTheDocument();
});
it('another author sees only the back action and can return to the list', async () => {
  setSession({ ...owner, userId: 'two' });
  mount();
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
});
it('unknown id renders not-found and a working back link', async () => {
  mount('/blog/unknown');
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
});
it('detail shows built-in admin avatar and safe invalid date without mutating storage', () => {
  setPosts([{ ...post, authorId: 'admin', authorName: 'Admin', createdAt: 'invalid' }]);
  mount();
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
  expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});
it('serialization failure remains on detail with a safe error and unchanged storage', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mount();
  const raw = localStorage.getItem(POSTS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const stringify = JSON.stringify;
  vi.spyOn(JSON, 'stringify').mockImplementation((value, ...args) => {
    if (Array.isArray(value) && value.some((entry) => entry?.id === 'other')) throw Error('private detail');
    return stringify(value, ...args);
  });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('The post could not be deleted');
  expect(screen.getByRole('heading', { name: 'A note' })).toBeInTheDocument();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  expect(write).not.toHaveBeenCalled();
});
for (const role of ['user', 'admin']) {
  it('confirmed ' + role + ' deletion persists then navigates and reloads list data', async () => {
    setSession({ ...owner, role, userId: role === 'admin' ? 'admin' : 'one' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = mount();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([other]);
    view.unmount();
    mount('/blogs');
    expect(screen.queryByRole('link', { name: 'A note', exact: true })).not.toBeInTheDocument();
  });
}
it('native confirmation cancellation never writes or navigates and refreshes changed text', async () => {
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    setPosts([other, { ...post, content: 'Fresh text' }]);
    return false;
  });
  mount();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(write).toHaveBeenCalledTimes(1); // External change inside the dialog, not deletion.
  expect(getPosts()).toEqual([other, { ...post, content: 'Fresh text' }]);
  expect(screen.getByText('Fresh text')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'A note' })).toBeInTheDocument();
});
it('plain cancellation leaves raw storage unchanged with zero writes', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount();
  const raw = localStorage.getItem(POSTS_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  expect(screen.getByRole('heading', { name: 'A note' })).toBeInTheDocument();
});
for (const change of ['session', 'owner', 'missing']) {
  it('rechecks ' + change + ' after confirmation and refreshes denied/missing UI without deleting', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'session') localStorage.removeItem(SESSION_KEY);
      else if (change === 'owner') setPosts([other, { ...post, authorId: 'two' }]);
      else setPosts([other]);
      return true;
    });
    mount();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent(change === 'missing' ? 'Post not found' : 'not allowed');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(getPosts()).toHaveLength(change === 'missing' ? 1 : 2);
  });
}
for (const errorName of ['QuotaExceededError', 'SecurityError']) {
  it('failed ' + errorName + ' save stays on detail, re-reads state and can retry explicitly', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    setPosts([other, { ...post, title: 'Fresh title' }]);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('secret', errorName); });
    const events = userEvent.setup();
    await events.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The post could not be deleted');
    expect(screen.getByRole('alert')).not.toHaveTextContent('secret');
    expect(screen.getByRole('heading', { name: 'Fresh title' })).toBeInTheDocument();
    expect(getPosts()).toHaveLength(2);
    write.mockRestore();
    await events.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    expect(getPosts()).toEqual([other]);
  });
}
for (const path of ['/blogs', '/blog/note']) {
  it('actual App guards guest reading deep link ' + path, () => {
    localStorage.removeItem(SESSION_KEY);
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
}
it('actual App composes navbar and reading routes through real title/back clicks', async () => {
  window.history.replaceState({}, '', '/blogs');
  render(<App />);
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  const events = userEvent.setup();
  await events.click(screen.getByRole('link', { name: 'A note', exact: true }));
  expect(window.location.pathname).toBe('/blog/note');
  await events.click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(window.location.pathname).toBe('/blogs');
});
it('actual App retains unknown public fallback and logout warning', () => {
  window.history.replaceState({ usr: { logoutWarning: 'Local session remains.' } }, '', '/');
  const view = render(<App />);
  expect(screen.getByRole('alert')).toHaveTextContent('Local session remains.');
  view.unmount();
  window.history.replaceState({}, '', '/unknown');
  render(<App />);
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeInTheDocument();
});
