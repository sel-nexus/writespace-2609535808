/** Exercise actual writing journeys and inspect persisted browser records. */
import { test, expect } from './fixtures.js';

const session = { userId: 'one', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: 'note', title: 'Original story', content: 'Original text', createdAt: '2026-03-04T12:00:00.000Z',
  authorId: 'one', authorName: 'Writer',
};

/**
 * Seed real local records once, never restoring them during reload.
 * Args:
 *   page: Browser page receiving the initial records before navigation.
 *   identity: Local reader allowed to enter writing routes.
 *   posts: Initial committed posts, including an empty collection for the Home invitation.
 */
async function seed(page, identity = session, posts = [post]) {
  await page.addInitScript(({ identity, posts }) => {
    if (sessionStorage.getItem('writing-seeded')) return;
    localStorage.setItem('writespace_session', JSON.stringify(identity));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
    sessionStorage.setItem('writing-seeded', 'true');
  }, { identity, posts });
}

/** Read actual committed records rather than treating rendered text as storage. */
async function records(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

/** Fill normal labeled fields, including plain-text whitespace. */
async function fill(page, title, content) {
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Content', { exact: true }).fill(content);
}

test('register, publish, reload, edit and cancel preserve actual records', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name').fill('Local Writer');
  await page.getByLabel('Username', { exact: true }).fill('local-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password').fill('demo-only');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await fill(page, 'Published story', 'First line\n  Second line');
  await expect(page.getByRole('status')).toHaveText('24 characters');
  const textarea = page.getByLabel('Content', { exact: true });
  expect(await textarea.evaluate((node) => parseFloat(getComputedStyle(node).minHeight))).toBeGreaterThanOrEqual(256);
  await page.getByRole('button', { name: 'Publish Post' }).click();
  const saved = (await records(page))[0];
  const identity = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(saved).toMatchObject({ title: 'Published story', content: 'First line\n  Second line', authorId: identity.userId, authorName: 'Local Writer' });
  expect(saved.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
  await expect(page).toHaveURL(new RegExp('/blog/' + saved.id + '$'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Published story' })).toBeVisible();
  expect(await records(page)).toEqual([saved]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(saved.title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(saved.content);
  await fill(page, 'Revised story', 'Revised text');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const revised = { ...saved, title: 'Revised story', content: 'Revised text' };
  expect(await records(page)).toEqual([revised]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await fill(page, 'Discarded title', 'Discarded text');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(new RegExp('/blog/' + saved.id + '$'));
  expect(await records(page)).toEqual([revised]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Revised story' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await fill(page, 'Never published', 'Unsaved');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await records(page)).toEqual([revised]);
});

test('named card Edit link preloads the owner post without saving on entry or input', async ({ page }) => {
  await seed(page);
  await page.goto('/blogs');
  const raw = await page.evaluate(() => localStorage.getItem('writespace_posts'));
  expect(await records(page)).toEqual([post]);
  await page.getByRole('article').getByRole('link', { name: 'Edit Original story', exact: true }).click();
  await expect(page).toHaveURL(/\/edit\/note$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(post.title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(post.content);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(raw);
  await fill(page, 'Card revision', 'Changed through card edit');
  expect(await records(page)).toEqual([post]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(raw);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page).toHaveURL(/\/blog\/note$/);
  expect(await records(page)).toEqual([{ ...post, title: 'Card revision', content: 'Changed through card edit' }]);
});

test('empty Home main Write invitation opens a blank form without saving before publish', async ({ page }) => {
  await seed(page, session, []);
  await page.goto('/blogs');
  const raw = await page.evaluate(() => localStorage.getItem('writespace_posts'));
  expect(await records(page)).toEqual([]);
  const main = page.getByRole('main');
  await expect(main.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await main.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(raw);
  await fill(page, 'First Home story', 'Published from the empty invitation');
  expect(await records(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(raw);
  await page.getByRole('button', { name: 'Publish Post' }).click();
  const saved = (await records(page))[0];
  expect(saved).toMatchObject({
    title: 'First Home story', content: 'Published from the empty invitation', authorId: session.userId, authorName: session.displayName,
  });
  expect(await records(page)).toEqual([saved]);
  await expect(page).toHaveURL(new RegExp('/blog/' + saved.id + '$'));
});

test('admin edits another author without replacing attribution or creation metadata', async ({ page }) => {
  await seed(page, { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  await page.goto('/blogs');
  await page.getByRole('link', { name: post.title, exact: true }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await fill(page, 'Admin revision', 'Edited by administrator');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  expect(await records(page)).toEqual([{ ...post, title: 'Admin revision', content: 'Edited by administrator' }]);
  await expect(page.getByText('Writer', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
});

test('other-author edit deep link redirects to blogs without changing storage', async ({ page }) => {
  await seed(page, { ...session, userId: 'two', displayName: 'Other' });
  await page.goto('/edit/note');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  expect(await records(page)).toEqual([post]);
  await page.getByRole('link', { name: post.title, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('missing edit entry renders exact not-found and back navigates without writes', async ({ page }) => {
  await seed(page);
  await page.goto('/edit/unknown');
  await expect(page.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await records(page)).toEqual([post]);
});

for (const mode of ['create', 'edit']) {
  test(mode + ' validation and injected write failure keep unsaved input visible', async ({ page }) => {
    await seed(page);
    await page.goto('/blogs');
    if (mode === 'create') {
      await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    } else {
      await page.getByRole('link', { name: post.title, exact: true }).click();
      await page.getByRole('link', { name: 'Edit', exact: true }).click();
    }
    await fill(page, ' ', ' ');
    const submit = page.getByRole('button', { name: mode === 'create' ? 'Publish Post' : 'Save Changes' });
    await submit.click();
    await expect(page.getByText('Title is required.')).toBeVisible();
    await expect(page.getByText('Content is required.')).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('aria-describedby', 'title-error');
    expect(await records(page)).toEqual([post]);
    await fill(page, 'Unsaved title', 'Unsaved content');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'writespace_posts') throw new DOMException('private detail', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('The post was not saved.');
    await expect(page.getByRole('alert')).not.toContainText('private detail');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved title');
    await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Unsaved content');
    await expect(page).toHaveURL(mode === 'create' ? /\/write$/ : /\/edit\/note$/);
    expect(await records(page)).toEqual([post]);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(mode === 'create' ? /\/blogs$/ : /\/blog\/note$/);
    expect(await records(page)).toEqual([post]);
  });
}
