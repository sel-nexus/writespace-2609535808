/** Verify writing controls, routed outcomes and actual browser persistence. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App.jsx';
import { getPosts, setPosts, POSTS_KEY } from '../../utils/storage.js';
import { setSession, SESSION_KEY } from '../../utils/auth.js';

const owner = { userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: 'note', title: 'Original', content: 'First\n  Second', createdAt: '2026-03-04T12:00:00.000Z',
  authorId: 'one', authorName: 'Writer',
};

/** Mount the actual application at a writing entry point. */
function mount(path = '/write') {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

/** Fill both user-visible text fields through normal input events. */
async function fill(title = 'New title', content = 'New content') {
  const events = userEvent.setup();
  await events.clear(screen.getByLabelText('Title'));
  await events.type(screen.getByLabelText('Title'), title);
  await events.clear(screen.getByLabelText('Content'));
  await events.type(screen.getByLabelText('Content'), content);
  return events;
}

beforeEach(() => { localStorage.clear(); setSession(owner); setPosts([post]); });
afterEach(() => vi.restoreAllMocks());

it('shows blank required fields, inherited shell/avatar, full-width tall textarea and live counter', async () => {
  mount();
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  expect(screen.getByText('Signed in as Writer')).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('');
  const textarea = screen.getByLabelText('Content');
  expect(textarea).toHaveClass('min-h-64', 'w-full', 'resize-y');
  expect(textarea).toBeRequired();
  expect(textarea).toHaveAttribute('aria-required', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('0 characters');
  await userEvent.setup().type(textarea, 'One{Enter}Two');
  expect(screen.getByRole('status')).toHaveTextContent('7 characters');
  await userEvent.setup().clear(textarea);
  expect(screen.getByRole('status')).toHaveTextContent('0 characters');
});

for (const path of ['/write', '/edit/note']) {
  it('validates adjacent associated errors without writes on ' + path, async () => {
    mount(path);
    const events = userEvent.setup();
    await events.clear(screen.getByLabelText('Title'));
    await events.clear(screen.getByLabelText('Content'));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await events.click(screen.getByRole('button', { name: /Publish Post|Save Changes/ }));
    expect(screen.getByText('Title is required.')).toHaveAttribute('id', 'title-error');
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-describedby', 'title-error');
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Content')).toHaveAttribute('aria-describedby', 'content-error content-counter');
    expect(screen.getByText('Content is required.')).toHaveAttribute('role', 'alert');
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post]);
    expect(window.location.pathname).toBe(path);
    const filled = await fill();
    await filled.click(screen.getByRole('button', { name: /Publish Post|Save Changes/ }));
    expect(window.location.pathname).toMatch(/^\/blog\//);
  });
  it('Cancel discards unsaved input without writes on ' + path, async () => {
    mount(path);
    const events = await fill();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await events.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.location.pathname).toBe(path === '/write' ? '/blogs' : '/blog/note');
    expect(write).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([post]);
  });
  for (const failure of ['QuotaExceededError', 'SecurityError', 'serialization']) {
    it('keeps failed ' + failure + ' input visible and permits explicit retry on ' + path, async () => {
      mount(path);
      const events = await fill();
      const original = JSON.stringify;
      const injection = failure === 'serialization'
        ? vi.spyOn(JSON, 'stringify').mockImplementation((value, ...args) => {
          if (Array.isArray(value) && value.some((entry) => entry?.title === 'New title')) throw Error('private detail');
          return original(value, ...args);
        })
        : vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private detail', failure); });
      await events.click(screen.getByRole('button', { name: /Publish Post|Save Changes/ }));
      expect(screen.getByRole('alert')).toHaveTextContent('The post was not saved.');
      expect(screen.getByRole('alert')).not.toHaveTextContent('private detail');
      expect(screen.getByLabelText('Title')).toHaveValue('New title');
      expect(screen.getByLabelText('Content')).toHaveValue('New content');
      expect(window.location.pathname).toBe(path);
      expect(getPosts()).toEqual([post]);
      injection.mockRestore();
      await events.click(screen.getByRole('button', { name: /Publish Post|Save Changes/ }));
      expect(window.location.pathname).toMatch(/^\/blog\//);
      expect(screen.getByRole('heading', { level: 1, name: 'New title' })).toBeInTheDocument();
    });
  }
}

it('publishes fresh session attribution, navigates after commit and rehydrates edit from storage', async () => {
  const view = mount();
  const events = await fill('Published', 'Text\n  More');
  setSession({ ...owner, userId: 'fresh', displayName: 'Fresh' });
  await events.click(screen.getByRole('button', { name: 'Publish Post' }));
  const saved = JSON.parse(localStorage.getItem(POSTS_KEY))[1];
  expect(saved).toMatchObject({ title: 'Published', content: 'Text\n  More', authorId: 'fresh', authorName: 'Fresh' });
  expect(window.location.pathname).toBe('/blog/' + saved.id);
  view.unmount();
  mount('/edit/' + saved.id);
  expect(screen.getByLabelText('Title')).toHaveValue('Published');
  expect(screen.getByLabelText('Content')).toHaveValue('Text\n  More');
  expect(screen.getByRole('status')).toHaveTextContent('11 characters');
});

for (const role of ['user', 'admin']) {
  it('preloads and edits as ' + role + ' without replacing original metadata', async () => {
    setSession({ ...owner, role, userId: role === 'admin' ? 'admin' : 'one', displayName: 'Changed name' });
    mount('/edit/note');
    expect(screen.getByLabelText('Title')).toHaveValue(post.title);
    expect(screen.getByLabelText('Content')).toHaveValue(post.content);
    const events = await fill();
    await events.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(getPosts()).toEqual([{ ...post, title: 'New title', content: 'New content' }]);
    expect(window.location.pathname).toBe('/blog/note');
    expect(screen.getByText('Writer')).toBeInTheDocument();
  });
}

it('denies another-author edit entry with no form or writes', () => {
  setSession({ ...owner, userId: 'two' });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount('/edit/note');
  expect(window.location.pathname).toBe('/blogs');
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

for (const change of ['owner', 'session', 'missing']) {
  it('rechecks ' + change + ' at submit without persisting stale form text', async () => {
    mount('/edit/note');
    const events = await fill();
    if (change === 'owner') setPosts([{ ...post, authorId: 'two' }]);
    else if (change === 'session') localStorage.removeItem(SESSION_KEY);
    else setPosts([]);
    const raw = localStorage.getItem(POSTS_KEY);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await events.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    if (change === 'missing') expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    else expect(window.location.pathname).toBe(change === 'session' ? '/login' : '/blogs');
  });
}

it('Cancel edit uses list fallback when the post disappears', async () => {
  mount('/edit/note');
  setPosts([]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
  expect(window.location.pathname).toBe('/blogs');
  expect(write).not.toHaveBeenCalled();
});

it('missing edit renders exact not-found and working back without writes', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount('/edit/unknown');
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(window.location.pathname).toBe('/blogs');
  expect(write).not.toHaveBeenCalled();
});

for (const path of ['/write', '/edit/note']) {
  it('guards guest writing deep link ' + path, () => {
    localStorage.removeItem(SESSION_KEY);
    mount(path);
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
}
