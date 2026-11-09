/** Verify final landing read fallback and persistence using actual browser records. */
import { test, expect } from './fixtures.js';

test('hydrates full records across reload without rewriting any keys', async ({ page }) => {
  await page.goto('/');
  const records = {
    posts: [{ id: 'p-1', title: 'A persisted thought', content: 'Still here after reload.', createdAt: '2026-03-04T12:00:00Z', authorId: 'u-1', authorName: 'Local Writer' }],
    users: [{ id: 'u-1', displayName: 'Local Writer', username: 'writer', password: 'demo-only', role: 'user', createdAt: '2026-03-01T12:00:00Z' }],
    session: { userId: 'u-1', username: 'writer', displayName: 'Local Writer', role: 'user' },
  };
  await page.evaluate((records) => {
    localStorage.setItem('writespace_posts', JSON.stringify(records.posts));
    localStorage.setItem('writespace_users', JSON.stringify(records.users));
    localStorage.setItem('writespace_session', JSON.stringify(records.session));
  }, records);
  await page.reload();
  await expect(page.getByRole('link', { name: 'A persisted thought' })).toBeVisible();
  await expect(page.getByText('Still here after reload.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toContainText('Local Writer');
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('link', { name: 'A persisted thought' })).toBeVisible();
  expect(await page.evaluate(() => ({
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }))).toEqual(records);
});

test('renders missing records as the final guest empty landing without creating keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await page.reload();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  expect(await page.evaluate(() => [
    localStorage.getItem('writespace_posts'),
    localStorage.getItem('writespace_users'),
    localStorage.getItem('writespace_session'),
  ])).toEqual([null, null, null]);
});

for (const [label, posts, users, session] of [
  ['corrupt JSON', '{broken', '[broken', '{broken'],
  ['invalid shapes', '{}', 'null', '{"userId":1,"username":"writer","displayName":"Writer","role":"user"}'],
]) {
  test(`falls back for ${label} without repairing browser records`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ posts, users, session }) => {
      localStorage.setItem('writespace_posts', posts);
      localStorage.setItem('writespace_users', users);
      localStorage.setItem('writespace_session', session);
    }, { posts, users, session });
    await page.reload();
    await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Public navigation' });
    await expect(nav.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Go to Dashboard' })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
    await page.reload();
    await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(await page.evaluate(() => [
      localStorage.getItem('writespace_posts'),
      localStorage.getItem('writespace_users'),
      localStorage.getItem('writespace_session'),
    ])).toEqual([posts, users, session]);
  });
}

test('renders a usable final guest landing when browser policy denies storage', async ({ page }) => {
  // Explicit browser-policy failure injection; application modules remain real.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Blocked by browser policy', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await page.reload();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  expect(await page.evaluate(() => {
    try { window.localStorage.getItem('writespace_posts'); return 'allowed'; }
    catch (error) { return error.name; }
  })).toBe('SecurityError');
});
