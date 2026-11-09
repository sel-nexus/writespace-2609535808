/** Verify actual browser records and safe read fallback through the read-only welcome. */
import { test, expect } from './fixtures.js';

test('reads actual local records and refreshes without mutating them', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_posts', JSON.stringify([{ id: 'p-1' }, { id: 'p-2' }]));
    localStorage.setItem('writespace_users', JSON.stringify([{ id: 'u-1' }]));
    localStorage.setItem('writespace_session', JSON.stringify({
      userId: 'u-1', username: 'writer', displayName: 'Local Writer', role: 'user',
    }));
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Stored posts: 2');
  await expect(page.getByRole('status')).toContainText('Stored users: 1');
  await expect(page.getByRole('status')).toContainText('Local session: Local Writer (user)');
  await page.evaluate(() => {
    const posts = JSON.parse(localStorage.getItem('writespace_posts'));
    posts.push({ id: 'p-3' });
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
  });
  await page.getByRole('button', { name: 'Refresh storage summary' }).click();
  await expect(page.getByRole('status')).toContainText('Stored posts: 3');
  const records = await page.evaluate(() => ({
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(records.posts).toEqual([{ id: 'p-1' }, { id: 'p-2' }, { id: 'p-3' }]);
  expect(records.users).toEqual([{ id: 'u-1' }]);
  expect(records.session).toEqual({ userId: 'u-1', username: 'writer', displayName: 'Local Writer', role: 'user' });
});

test('renders missing records as empty without creating keys', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Refresh storage summary' }).click();
  await expect(page.getByRole('status')).toContainText('Stored posts: 0');
  await expect(page.getByRole('status')).toContainText('Stored users: 0');
  await expect(page.getByRole('status')).toContainText('Local session: None');
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
  test(`falls back for ${label} without repairing actual storage`, async ({ page }) => {
    await page.addInitScript(({ posts, users, session }) => {
      localStorage.setItem('writespace_posts', posts);
      localStorage.setItem('writespace_users', users);
      localStorage.setItem('writespace_session', session);
    }, { posts, users, session });
    await page.goto('/');
    await page.getByRole('button', { name: 'Refresh storage summary' }).click();
    await expect(page.getByRole('status')).toContainText('Stored posts: 0');
    await expect(page.getByRole('status')).toContainText('Stored users: 0');
    await expect(page.getByRole('status')).toContainText('Local session: None');
    expect(await page.evaluate(() => [
      localStorage.getItem('writespace_posts'),
      localStorage.getItem('writespace_users'),
      localStorage.getItem('writespace_session'),
    ])).toEqual([posts, users, session]);
  });
}

test('stays usable when browser policy blocks localStorage access', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Blocked by browser policy', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Refresh storage summary' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to WriteSpace.' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Stored posts: 0');
  await expect(page.getByRole('status')).toContainText('Stored users: 0');
  await expect(page.getByRole('status')).toContainText('Local session: None');
});
