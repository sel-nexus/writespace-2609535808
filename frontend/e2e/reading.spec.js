/** Exercise seeded reading and native deletion against real browser storage. */
import { test, expect } from './fixtures.js';

const session = { userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' };
const posts = [
  { id: 'older', title: 'Older story', content: 'An older story.', createdAt: '2026-03-03T12:00:00.000Z', authorId: 'two', authorName: 'Other' },
  { id: 'newest', title: 'Newest story', content: '<b>Plain text</b>\n  Second line\n\n' + 'x'.repeat(150),
    createdAt: '2026-03-04T12:00:00.000Z', authorId: 'one', authorName: 'Writer' },
];
const users = [
  { id: 'one', displayName: 'Writer', username: 'writer', password: 'demo-only', role: 'user', createdAt: '2026-03-01T12:00:00.000Z' },
  { id: 'two', displayName: 'Other', username: 'other', password: 'demo-only', role: 'user', createdAt: '2026-03-01T12:00:00.000Z' },
];

/** Seed once per browser tab so reload cannot recreate deleted records. */
async function seed(page, identity = session) {
  await page.addInitScript(({ posts, users, identity }) => {
    if (sessionStorage.getItem('reading-seeded')) return;
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
    localStorage.setItem('writespace_users', JSON.stringify(users));
    localStorage.setItem('writespace_session', JSON.stringify(identity));
    sessionStorage.setItem('reading-seeded', 'true');
  }, { posts, users, identity });
}

/** Read persisted records rather than inferring deletion from hidden UI. */
async function records(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

test('reader navigates newest-first summaries, full escaped text, other author and reload', async ({ page }) => {
  await seed(page);
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Newest story', 'Older story']);
  const card = page.getByRole('article').first();
  expect(await card.locator('p').first().textContent()).toBe(posts[1].content.slice(0, 120));
  await expect(card.getByText('Mar 04, 2026')).toBeVisible();
  await expect(card.getByRole('img', { name: 'User avatar' })).toBeVisible();
  await page.getByRole('link', { name: 'Newest story', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/newest$/);
  const content = page.locator('article p.whitespace-pre-wrap');
  expect(await content.textContent()).toBe(posts[1].content);
  await expect(content.locator('b')).toHaveCount(0);
  expect(await content.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
  await page.reload();
  expect(await content.textContent()).toBe(posts[1].content);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: 'Older story', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  expect(await records(page)).toEqual(posts);
});

for (const role of ['user', 'admin']) {
  test(role + ' confirms eligible deletion and reload does not restore the record', async ({ page }) => {
    await seed(page, role === 'admin' ? { userId: 'admin', username: 'admin', displayName: 'Admin', role } : session);
    await page.goto('/blogs');
    const title = role === 'admin' ? 'Older story' : 'Newest story';
    const removedId = role === 'admin' ? 'older' : 'newest';
    await page.getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/' + removedId);
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    const remaining = posts.filter((post) => post.id !== removedId);
    expect(await records(page)).toEqual(remaining);
    await page.reload();
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
    expect(await records(page)).toEqual(remaining);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(users);
  });
}

test('cancelled native deletion stays on detail and leaves persisted data unchanged across reload', async ({ page }) => {
  await seed(page);
  await page.goto('/blogs');
  await page.getByRole('link', { name: 'Newest story', exact: true }).click();
  page.once('dialog', async (dialog) => { await dialog.dismiss(); });
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blog\/newest$/);
  expect(await records(page)).toEqual(posts);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Newest story' })).toBeVisible();
  expect(await records(page)).toEqual(posts);
});

test('unknown post direct entry renders not-found and back navigates to persisted list', async ({ page }) => {
  await seed(page);
  await page.goto('/blog/unknown');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
  expect(await records(page)).toEqual(posts);
});

test('mobile reading has one column, no overflow and real menu/title/back navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto('/blogs');
  const grid = page.getByLabel('Blog posts');
  expect(await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Newest story', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Newest story' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'All Blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: 'Older story', exact: true }).click();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  expect(await records(page)).toEqual(posts);
});
