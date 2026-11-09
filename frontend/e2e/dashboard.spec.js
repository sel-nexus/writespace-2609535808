/** Exercise administrator overview journeys with real clicks and stored-record assertions. */
import { test, expect } from './fixtures.js';

const posts = [2, 6, 1, 5, 3, 4].map((day) => ({
  id: 'post-' + day, title: 'Story ' + day, content: 'Original text ' + day,
  createdAt: `2026-03-0${day}T12:00:00.000Z`, authorId: 'writer', authorName: 'Writer',
}));
const users = [
  { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo-only', role: 'user' },
  { id: 'editor', username: 'editor', displayName: 'Editor', password: 'demo-only', role: 'admin' },
];

/** Seed only records once; enter through actual built-in admin login. */
async function enter(page, initialPosts = posts) {
  await page.addInitScript(({ initialPosts, users }) => {
    if (sessionStorage.getItem('dashboard-seeded')) return;
    localStorage.removeItem('writespace_session');
    localStorage.setItem('writespace_posts', JSON.stringify(initialPosts));
    localStorage.setItem('writespace_users', JSON.stringify(users));
    sessionStorage.setItem('dashboard-seeded', 'true');
  }, { initialPosts, users });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

/** Read actual committed records, independent from the rendered overview. */
async function records(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

/** Select the semantic value paired with a case-sensitive metric label. */
function metric(page, label) {
  return page.getByText(label, { exact: true }).locator('..').locator('dd');
}

/** Find a recent post row by its title rather than by an implementation test id. */
function row(page, title = 'Story 6') {
  return page.getByRole('region', { name: 'Recent Posts' }).getByRole('listitem').filter({
    has: page.getByRole('link', { name: title, exact: true }),
  });
}

/** Return to overview through the public logo and role-directed dashboard link. */
async function overview(page) {
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('admin login, edit/save, cancellation, confirmed delete and quick actions preserve actual records', async ({ page }) => {
  await enter(page);
  await expect(metric(page, 'Total Posts')).toHaveText('6');
  await expect(metric(page, 'Total Users')).toHaveText('3');
  await expect(metric(page, 'Total Admins')).toHaveText('2');
  await expect(metric(page, 'Total users')).toHaveText('—');
  await expect(page.getByText('Not defined in this demo')).toBeVisible();
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('listitem')).toHaveCount(5);
  expect(await recent.getByRole('link', { name: /^Story [1-6]$/ }).allTextContents())
    .toEqual(['Story 6', 'Story 5', 'Story 4', 'Story 3', 'Story 2']);
  expect(await records(page)).toEqual(posts);
  await row(page).getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(/\/edit\/post-6$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Story 6');
  await page.getByLabel('Title', { exact: true }).fill('Admin revision');
  await page.getByLabel('Content', { exact: true }).fill('Revised text\n  Second line');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page).toHaveURL(/\/blog\/post-6$/);
  const revised = posts.map((post) => post.id === 'post-6'
    ? { ...post, title: 'Admin revision', content: 'Revised text\n  Second line' } : post);
  expect(await records(page)).toEqual(revised);
  await expect(page.getByText('Writer', { exact: true })).toBeVisible();
  await overview(page);
  await expect(row(page, 'Admin revision')).toBeVisible();
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await row(page, 'Admin revision').getByRole('button', { name: 'Delete' }).click();
  expect(await records(page)).toEqual(revised);
  await expect(metric(page, 'Total Posts')).toHaveText('6');
  page.once('dialog', async (dialog) => dialog.accept());
  await row(page, 'Admin revision').getByRole('button', { name: 'Delete' }).click();
  const remaining = revised.filter((post) => post.id !== 'post-6');
  await expect(metric(page, 'Total Posts')).toHaveText('5');
  expect(await records(page)).toEqual(remaining);
  await expect(row(page, 'Story 1')).toBeVisible();
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await expect(page).toHaveURL(/\/write$/);
  await page.getByLabel('Title', { exact: true }).fill('Discarded quick action');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await records(page)).toEqual(remaining);
  await overview(page);
  await expect(page.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  // Users is a later slice: existing unknown-route fallback returns to public discovery.
  await expect(page).toHaveURL(/\/$/);
  expect(await records(page)).toEqual(remaining);
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(metric(page, 'Total Posts')).toHaveText('5');
});

test('failed delete reports a safe error and does not change the overview or stored records', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'writespace_posts') throw new DOMException('private detail', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  page.once('dialog', async (dialog) => dialog.accept());
  await row(page).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toContainText('The post could not be deleted.');
  await expect(page.getByRole('alert')).not.toContainText('private detail');
  expect(await records(page)).toEqual(posts);
  await expect(metric(page, 'Total Posts')).toHaveText('6');
  await expect(row(page)).toBeVisible();
  page.once('dialog', async (dialog) => dialog.dismiss());
  await row(page).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await records(page)).toEqual(posts);
});

test('empty overview and mobile navigation stay usable and capture a screenshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page, []);
  await expect(page.getByText('No posts yet.')).toBeVisible();
  await expect(metric(page, 'Total Posts')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'All Blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await overview(page);
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await expect(page).toHaveURL(/\/write$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await records(page)).toEqual([]);
});
