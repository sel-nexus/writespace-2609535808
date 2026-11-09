/** Exercise final auth journeys through real UI and inspect browser persistence. */
import { test, expect } from './fixtures.js';

/** Submit exact credentials through labeled controls. */
async function login(page, username, password) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Remove local identity using the actual account disclosure. */
async function logout(page, displayName) {
  await page.getByRole('button', { name: 'Account menu for ' + displayName }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
}

test('register, reload, logout, exact login and logout preserve the real account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name').fill('Local Writer');
  await page.getByLabel('Username', { exact: true }).fill('writer');
  await page.getByLabel('Password', { exact: true }).fill('local-only');
  await page.getByLabel('Confirm Password').fill('local-only');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const records = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(records.users).toHaveLength(1);
  expect(records.users[0]).toMatchObject({ displayName: 'Local Writer', username: 'writer', password: 'local-only', role: 'user' });
  expect(records.users[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(new Date(records.users[0].createdAt).toISOString()).toBe(records.users[0].createdAt);
  expect(records.session).toEqual({ userId: records.users[0].id, username: 'writer', displayName: 'Local Writer', role: 'user' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu for Local Writer' })).toBeVisible();
  await logout(page, 'Local Writer');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await login(page, 'Writer', 'local-only');
  await expect(page.getByRole('alert').first()).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await login(page, 'writer', 'local-only');
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(records.session);
  await logout(page, 'Local Writer');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(records.users);
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name').fill('Other Writer');
  await page.getByLabel('Username', { exact: true }).fill('writer');
  await page.getByLabel('Password', { exact: true }).fill('local-only');
  await page.getByLabel('Confirm Password').fill('local-only');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is already taken.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(records.users);
});

test('mobile admin login exposes all role links, keyboard menus and logout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await login(page, 'admin', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session'))))
    .toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  const trigger = page.getByRole('button', { name: 'Toggle navigation' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(nav.getByRole('link')).toHaveText(['All Blogs', 'Write', 'Dashboard', 'Users']);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(nav).toHaveCount(0);
  for (const [name, route] of [['Users', '/users'], ['All Blogs', '/blogs'], ['Write', '/write'], ['Dashboard', '/admin']]) {
    await trigger.click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route + '$'));
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
  }
  await page.screenshot({ path: testInfo.outputPath('auth-mobile-admin.png'), fullPage: true });
  await logout(page, 'Admin');
});

test('required and mismatching registration fields never create accounts', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  for (const label of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  }
  await page.getByLabel('Display Name').fill('Writer');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('local');
  await page.getByLabel('Confirm Password').fill('different');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('This username is reserved.')).toBeVisible();
  await expect(page.getByText('Passwords must match.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(2);
});

for (const role of ['guest', 'user', 'admin']) {
  for (const path of ['/blogs', '/blog/missing', '/write', '/edit/missing', '/admin', '/users', '/login', '/register']) {
    test(role + ' direct entry ' + path + ' follows final route matrix', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      if (role !== 'guest') {
        await page.addInitScript((role) => {
          if (!localStorage.getItem('writespace_session')) {
            localStorage.setItem('writespace_session', JSON.stringify({ userId: 'one', username: 'writer', displayName: 'Writer', role }));
          }
        }, role);
      }
      await page.goto(path);
      let destination = path;
      if (role === 'guest' && !['/login', '/register'].includes(path)) destination = '/login';
      else if (role === 'user' && ['/admin', '/users', '/login', '/register'].includes(path)) destination = '/blogs';
      else if (role === 'admin' && ['/login', '/register'].includes(path)) destination = '/admin';
      if (role !== 'guest' && path === '/edit/missing') destination = '/blogs';
      await expect(page).toHaveURL(new RegExp(destination + '$'));
      if (role === 'guest') await expect(page.getByRole('heading', { name: /Welcome back|Create your account/ })).toBeVisible();
      else await expect(page.getByRole('button', { name: 'Account menu for Writer' })).toBeVisible();
    });
  }
}
