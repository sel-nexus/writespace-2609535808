/** Exercise provisioning, role login and account removal through real browser-local records. */
import { test, expect } from './fixtures.js';

/** Sign in from public navigation using exact local credentials. */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Use the account menu and verify the actual session key is cleared. */
async function logout(page) {
  await page.getByRole('button', { name: /^Account menu for / }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
}

/** Fill required fields and provision the selected local role. */
async function provision(page, username, role, displayName) {
  await page.getByLabel('Display Name (required)').fill(displayName);
  await page.getByLabel('Username (required)').fill(username);
  await page.getByLabel('Password (required)').fill('demo-only');
  await page.getByLabel('Role (required)').selectOption(role);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByText('Account created successfully.')).toBeVisible();
}

/** Read real arrays and session without deriving state from the rendered page. */
async function records(page) {
  return page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users') || '[]'),
    posts: JSON.parse(localStorage.getItem('writespace_posts') || '[]'),
    session: JSON.parse(localStorage.getItem('writespace_session') || 'null'),
  }));
}

/** Select a visible desktop row using its account identity. */
function row(page, displayName) {
  return page.getByRole('table', { name: 'Local accounts' }).getByRole('row').filter({
    has: page.getByRole('rowheader').filter({ has: page.getByText(displayName, { exact: true }) }),
  });
}

test('admin provisions both roles; created writer publishes; created admin protects self and deletes writer without post cascade',
  async ({ page }, testInfo) => {
    await page.goto('/');
    await login(page);
    await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    const builtIn = row(page, 'Admin').getByRole('button', { name: 'Delete' });
    await expect(builtIn).toBeDisabled();
    await expect(builtIn).toHaveAttribute('title', 'Default admin cannot be deleted');
    await provision(page, 'local-writer', 'user', 'Local Writer');
    await provision(page, 'local-editor', 'admin', 'Local Editor');
    const provisioned = await records(page);
    expect(provisioned.users).toHaveLength(2);
    for (const account of provisioned.users) {
      expect(account.id).toMatch(/^[a-f0-9-]{36}$/);
      expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
      expect(account.password).toBe('demo-only');
    }
    expect(provisioned.users.map((account) => account.role)).toEqual(['user', 'admin']);
    expect(provisioned.session.userId).toBe('admin');
    await expect(page.locator('main')).not.toContainText('demo-only');
    await page.screenshot({ path: testInfo.outputPath('users-desktop.png'), fullPage: true });
    await logout(page);
    await login(page, 'local-writer', 'demo-only');
    await expect(page).toHaveURL(/\/blogs$/);
    expect((await records(page)).session.userId).toBe(provisioned.users[0].id);
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Preserved writer story');
    await page.getByLabel('Content', { exact: true }).fill('This post survives account deletion.');
    await page.getByRole('button', { name: 'Publish Post' }).click();
    const published = (await records(page)).posts;
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ authorId: provisioned.users[0].id, authorName: 'Local Writer' });
    await logout(page);
    await login(page, 'local-editor', 'demo-only');
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
    await expect(row(page, 'Local Editor').getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect(row(page, 'Local Editor')).toContainText('You cannot delete your own administrator account.');
    await expect(row(page, 'Admin').getByRole('button', { name: 'Delete' })).toBeDisabled();
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss();
    });
    await row(page, 'Local Writer').getByRole('button', { name: 'Delete' }).click();
    expect((await records(page)).users).toEqual(provisioned.users);
    page.once('dialog', async (dialog) => dialog.accept());
    await row(page, 'Local Writer').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Account deleted. Their posts were preserved.')).toBeVisible();
    const final = await records(page);
    expect(final.users).toEqual([provisioned.users[1]]);
    expect(final.posts).toEqual(published);
    expect(final.session.userId).toBe(provisioned.users[1].id);
    await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'All Blogs' }).click();
    await page.getByRole('link', { name: 'Preserved writer story', exact: true }).click();
    await expect(page.getByText('Local Writer', { exact: true })).toBeVisible();
    expect((await records(page)).posts).toEqual(published);
    await logout(page);
    await login(page, 'local-writer', 'demo-only');
    await expect(page.getByText('Invalid username or password.').first()).toBeVisible();
  });

test('mobile cards remain usable with long identity, cancellation, deletion and screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await provision(page, 'long-' + 'x'.repeat(100), 'user', 'Writer ' + 'W'.repeat(100));
  const before = await records(page);
  const cards = page.getByRole('list', { name: 'Local account cards' });
  await expect(cards).toBeVisible();
  await expect(page.getByRole('table', { name: 'Local accounts' })).toBeHidden();
  await expect(cards.getByRole('listitem')).toHaveCount(2);
  await expect(cards.getByRole('button', { name: 'Delete' }).first()).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('users-mobile.png'), fullPage: true });
  page.once('dialog', async (dialog) => dialog.dismiss());
  await cards.getByRole('button', { name: 'Delete' }).last().click();
  expect(await records(page)).toEqual(before);
  page.once('dialog', async (dialog) => dialog.accept());
  await cards.getByRole('button', { name: 'Delete' }).last().click();
  expect((await records(page)).users).toEqual([]);
  await expect(cards.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test('duplicate and reserved validation retain input and actual accounts', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await provision(page, 'writer', 'user', 'Writer');
  const before = await records(page);
  for (const username of ['admin', 'writer']) {
    await page.getByLabel('Display Name (required)').fill('Unsaved');
    await page.getByLabel('Username (required)').fill(username);
    await page.getByLabel('Password (required)').fill('demo-only');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByLabel('Username (required)')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Username (required)')).toHaveAttribute('aria-describedby', 'username-error');
    await expect(page.getByLabel('Username (required)')).toHaveValue(username);
    expect(await records(page)).toEqual(before);
  }
});

test('failed local writes preserve form and displayed accounts; cancelled deletion makes no change', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await provision(page, 'writer', 'user', 'Writer');
  const before = await records(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'writespace_users') throw new DOMException('private detail', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByLabel('Display Name (required)').fill('Unsaved Writer');
  await page.getByLabel('Username (required)').fill('unsaved-writer');
  await page.getByLabel('Password (required)').fill('demo-only');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toContainText('Account was not saved.');
  await expect(page.getByLabel('Password (required)')).toHaveValue('demo-only');
  await expect(page.getByLabel('Username (required)')).toHaveValue('unsaved-writer');
  expect(await records(page)).toEqual(before);
  page.once('dialog', async (dialog) => dialog.accept());
  await row(page, 'Writer').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toContainText('Account could not be deleted.');
  await expect(page.getByRole('alert')).not.toContainText('private detail');
  await expect(row(page, 'Writer')).toBeVisible();
  expect(await records(page)).toEqual(before);
  page.once('dialog', async (dialog) => dialog.dismiss());
  await row(page, 'Writer').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await records(page)).toEqual(before);
});
