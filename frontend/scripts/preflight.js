/** Capture representative rendered structure and style evidence for human review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const evidence = [];
await mkdir('../ui-evidence', { recursive: true });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(baseURL);
    await capture('landing-empty');
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await capture('login-validation');
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('heading', { name: 'Admin Dashboard' }).waitFor();
    await capture('dashboard-empty');
    await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
    await page.getByRole('heading', { name: 'User Management' }).waitFor();
    await capture('accounts');
    if (width === 390) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await capture('navigation-open');
      await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    } else {
      await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    }
    await page.getByLabel('Title', { exact: true }).fill('A room for ideas');
    await page.getByLabel('Content', { exact: true }).fill('First line.\n\nA second thought worth keeping.');
    await capture('writing');
    await page.getByRole('button', { name: 'Publish Post' }).click();
    await page.getByRole('heading', { name: 'A room for ideas' }).waitFor();
    await capture('reading-populated');
    await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await page.getByRole('heading', { name: 'WriteSpace', exact: true }).waitFor();
    await page.getByRole('region', { name: 'Latest from the Blog' }).getByRole('heading', { name: 'A room for ideas' }).waitFor();
    await capture('landing-populated');
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();

    /** Save accessibility structure, styles, HTML and a screenshot for this state. */
    async function capture(state) {
      const styles = await page.evaluate(() => ({
        bodyFont: getComputedStyle(document.body).fontFamily,
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        headings: [...document.querySelectorAll('h1,h2')].map((element) => ({
          text: element.textContent,
          size: getComputedStyle(element).fontSize,
          lineHeight: getComputedStyle(element).lineHeight,
        })),
        textareaHeight: document.querySelector('textarea')?.getBoundingClientRect().height,
      }));
      evidence.push(`## ${width} ${state}\n${await page.locator('body').ariaSnapshot()}\nSTYLES ${JSON.stringify(styles)}\nHTML ${await page.content()}`);
      await page.screenshot({ path: `../ui-evidence/${width}-${state}.png`, fullPage: true });
    }
  }
  await writeFile('../ui-preflight.txt', evidence.join('\n\n'), 'utf8');
  console.log('Preflight captured 15 representative states with accessibility, styles, HTML and screenshots.');
} finally {
  await browser.close();
}
