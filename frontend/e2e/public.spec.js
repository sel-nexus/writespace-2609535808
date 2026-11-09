/** Exercise public discovery using real browser records and shared error capture. */
import { test, expect } from './fixtures.js';

const posts = [
  { id: 'old', title: 'An older thought', content: 'An older note.', createdAt: '2025-01-01T12:00:00Z', authorId: 'writer-1', authorName: 'Local Writer' },
  { id: 'middle', title: 'Finding a rhythm', content: 'A small daily practice.', createdAt: '2026-03-02T12:00:00Z', authorId: 'writer-1', authorName: 'Local Writer' },
  { id: 'new', title: 'Room for a new idea', content: 'A'.repeat(120) + 'This must not appear in the preview.', createdAt: '2026-03-04T12:00:00Z', authorId: 'writer-1', authorName: 'Local Writer' },
  { id: 'second', title: 'The quiet page', content: 'A quiet place to begin.', createdAt: '2026-03-03T12:00:00Z', authorId: 'writer-1', authorName: 'Local Writer' },
];

for (const [name, destination] of [['Login', '/login'], ['Get Started', '/register'], ['Start Reading', '/login'], ['Get Started Free', '/register']]) {
  test(`guest enters through ${name}`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
    await page.getByRole('link', { name, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
  });
}

test('guest sees newest three previews and selecting one opens login', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((records) => localStorage.setItem('writespace_posts', JSON.stringify(records)), posts);
  await page.reload();
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Room for a new idea', 'The quiet page', 'Finding a rhythm']);
  await expect(latest.getByText('A'.repeat(120), { exact: true })).toBeVisible();
  await expect(latest.getByText('Mar 04, 2026')).toBeVisible();
  await expect(latest.getByText(/This must not appear/)).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  await latest.getByRole('link', { name: 'Room for a new idea' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

for (const [role, destination] of [['user', '/blogs'], ['admin', '/admin']]) {
  test(`${role} keeps session across reload and enters role dashboard`, async ({ page }) => {
    await page.goto('/');
    const session = { userId: 'writer-1', username: 'writer', displayName: 'Local Writer', role };
    await page.evaluate((record) => localStorage.setItem('writespace_session', JSON.stringify(record)), session);
    await page.reload();
    const nav = page.getByRole('navigation', { name: 'Public navigation' });
    await expect(nav.getByText('Local Writer')).toBeVisible();
    await expect(nav.getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Login' })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    await nav.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
  });

  test(`${role} starts reading at blogs`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((role) => localStorage.setItem('writespace_session', JSON.stringify({ userId: 'writer-1', username: 'writer', displayName: 'Local Writer', role })), role);
    await page.reload();
    await page.getByRole('link', { name: 'Start Reading' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
  });

  test(`${role} selects a preview and reads the actual stored content`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ role, records }) => {
      localStorage.setItem('writespace_session', JSON.stringify({ userId: 'writer-1', username: 'writer', displayName: 'Local Writer', role }));
      localStorage.setItem('writespace_posts', JSON.stringify(records));
    }, { role, records: posts });
    await page.reload();
    await page.getByRole('link', { name: 'Room for a new idea' }).click();
    await expect(page).toHaveURL(/\/blog\/new$/);
    await expect(page.getByText(posts[2].content, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  });
}

for (const [name, destination] of [['Home', '/'], ['All Blogs', '/login'], ['Login', '/login'], ['Register', '/register']]) {
  test(`guest footer ${name} reaches its public or guarded destination`, async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} WriteSpace`);
    await footer.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
  });
}

for (const [device, width, height, columns] of [['mobile', 390, 844, 1], ['tablet', 768, 1024, 2], ['desktop', 1440, 900, 3]]) {
  test(`public discovery is readable and keyboard accessible on ${device}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
    await page.evaluate((records) => localStorage.setItem('writespace_posts', JSON.stringify(records)), posts);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'WriteSpace' })).toBeFocused();
    const geometry = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[aria-labelledby="latest-heading"] article')];
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        columns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
        sticky: getComputedStyle(document.querySelector('header')).position,
      };
    });
    expect(geometry).toEqual({ overflow: false, columns, sticky: 'sticky' });
    await page.getByRole('heading', { name: 'Latest from the Blog' }).scrollIntoViewIfNeeded();
    expect(await page.locator('header').evaluate((header) => Math.round(header.getBoundingClientRect().top))).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`public-${device}.png`), fullPage: true });
    await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });
}
