/** Configure single-worker browser journeys against an environment-selected URL. */
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const baseURL = env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const target = new URL(baseURL);
const port = Number(env.PLAYWRIGHT_PORT || target.port || 5173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host ${target.hostname} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
