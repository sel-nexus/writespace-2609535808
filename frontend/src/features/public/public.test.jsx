/** Exercise public discovery through real local storage and routed user actions. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../../App.jsx';
import { Avatar, getAvatar } from '../../components/Avatar.jsx';
import { SESSION_KEY, setSession } from '../../utils/auth.js';
import { POSTS_KEY, setPosts } from '../../utils/storage.js';
import LandingPage from './LandingPage.jsx';
import { PublicNavbar } from './PublicNavbar.jsx';

const session = { userId: 'writer-1', username: 'writer', displayName: 'Local Writer', role: 'user' };

/** Build a complete local post record with a controllable creation date. */
function post(id, createdAt, content = 'A short thought.') {
  return { id, title: `Story ${id}`, content, createdAt, authorId: session.userId, authorName: session.displayName };
}

/** Display test-only destinations without adding future routes to the app. */
function Destination() {
  const location = useLocation();
  return (
    <p role="status">
      Destination: {location.pathname}
    </p>
  );
}

/** Mount a public component with a test-only route destination harness. */
function renderPublic(element) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={element} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('PublicNavbar', () => {
  it.each([['Login', '/login'], ['Get Started', '/register'], ['WriteSpace', '/']])('offers guest %s linking to %s', async (label, path) => {
    renderPublic(<PublicNavbar />);
    const nav = screen.getByRole('navigation', { name: 'Public navigation' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
    const link = within(nav).getByRole('link', { name: label });
    expect(link).toHaveAttribute('href', path);
    await userEvent.setup().click(link);
    if (path !== '/') expect(screen.getByRole('status')).toHaveTextContent(`Destination: ${path}`);
    else expect(nav).toBeInTheDocument();
  });

  it.each([['user', '/blogs', 'User avatar'], ['admin', '/admin', 'Admin avatar']])('shows %s identity and dashboard destination', async (role, path, avatar) => {
    renderPublic(<PublicNavbar session={{ ...session, role }} />);
    expect(screen.getByText('Local Writer')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: avatar })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByRole('status')).toHaveTextContent(`Destination: ${path}`);
  });
});

describe('Avatar and getAvatar', () => {
  it.each([['admin', 'Admin avatar', 'bg-violet-600'], ['user', 'User avatar', 'bg-indigo-500'], ['unknown', 'User avatar', 'bg-indigo-500'], ['toString', 'User avatar', 'bg-indigo-500'], [undefined, 'User avatar', 'bg-indigo-500']])('renders a static SVG for role %s', (role, label, color) => {
    render(getAvatar(role));
    const avatar = screen.getByRole('img', { name: label });
    expect(avatar).toHaveClass(color, 'rounded-full');
    expect(avatar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(avatar.querySelector('path')).toHaveAttribute('d');
    expect(avatar.querySelector('img')).toBeNull();
  });

  it('defaults the component itself to the user book', () => {
    render(<Avatar />);
    expect(screen.getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  });
});

describe('LandingPage', () => {
  it('shows exact public copy, locality caveat, empty state and current-year footer', () => {
    renderPublic(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeInTheDocument();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast', 'Latest from the Blog']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Local describes location, not confidentiality/)).toBeInTheDocument();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveClass('bg-slate-800');
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace`)).toBeInTheDocument();
    expect(localStorage.getItem(POSTS_KEY)).toBeNull();
  });

  it.each([['Start Reading', '/login'], ['Get Started Free', '/register']])('routes guest hero %s to %s', async (name, path) => {
    renderPublic(<LandingPage />);
    await userEvent.setup().click(screen.getByRole('link', { name }));
    expect(screen.getByRole('status')).toHaveTextContent(`Destination: ${path}`);
  });

  it.each(['user', 'admin'])('routes authenticated %s reading to blogs and preserves registration CTA', async (role) => {
    setSession({ ...session, role });
    renderPublic(<LandingPage />);
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
    await userEvent.setup().click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('status')).toHaveTextContent('Destination: /blogs');
  });

  it.each([['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']])('gives footer %s its exact destination', async (name, path) => {
    renderPublic(<LandingPage />);
    const link = within(screen.getByRole('navigation', { name: 'Footer navigation' })).getByRole('link', { name });
    expect(link).toHaveAttribute('href', path);
    await userEvent.setup().click(link);
    if (path !== '/') expect(screen.getByRole('status')).toHaveTextContent(`Destination: ${path}`);
    else expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('sorts a copy newest first, caps at three, and renders exact 120-character escaped previews and dates', () => {
    const content = '<script>not HTML</script>' + 'x'.repeat(150);
    const posts = [post('old', '2025-01-01'), post('middle', '2026-03-02'), post('new', '2026-03-04', content), post('second', '2026-03-03')];
    setPosts(posts);
    const raw = localStorage.getItem(POSTS_KEY);
    renderPublic(<LandingPage />);
    const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
    expect(within(latest).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Story new', 'Story second', 'Story middle']);
    expect(within(latest).queryByText('Story old')).not.toBeInTheDocument();
    expect(within(latest).getByText(content.slice(0, 120))).toBeInTheDocument();
    expect(latest.querySelector('script')).toBeNull();
    expect(within(latest).getByText('Mar 04, 2026')).toHaveAttribute('datetime', '2026-03-04');
    expect(screen.queryByText('No posts yet — check back soon!')).not.toBeInTheDocument();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  });

  it.each([['guest', '/login'], ['user', '/blog/one'], ['admin', '/blog/one']])('routes %s preview clicks correctly', async (role, path) => {
    if (role !== 'guest') setSession({ ...session, role });
    setPosts([post('one', '2026-03-04')]);
    renderPublic(<LandingPage />);
    expect(screen.getByText('A short thought.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Story one' }));
    expect(screen.getByRole('status')).toHaveTextContent(`Destination: ${path}`);
  });

  it('renders an invalid post date without an invalid time attribute', () => {
    setPosts([post('one', 'invalid')]);
    renderPublic(<LandingPage />);
    expect(screen.getByText('Date unavailable')).not.toHaveAttribute('datetime');
  });

  it.each(['{broken', '{}', 'null'])('renders corrupt or wrong-shaped posts as empty without rewriting %s', (raw) => {
    localStorage.setItem(POSTS_KEY, raw);
    localStorage.setItem(SESSION_KEY, '{broken');
    renderPublic(<LandingPage />);
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    expect(localStorage.getItem(SESSION_KEY)).toBe('{broken');
  });

  it('remains a guest empty landing when browser reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    renderPublic(<LandingPage />);
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
  });
});

describe('App composition', () => {
  it('renders the actual landing in its only browser router and preserves unknown-route fallback', async () => {
    window.history.replaceState({}, '', '/unknown');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'WriteSpace' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByText('Your local storage')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh storage summary' })).not.toBeInTheDocument();
  });
});
