/** Configure the static frontend and isolated source-only unit tests. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Resolve serving settings for the selected build mode. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      host: env.VITE_HOST || '127.0.0.1',
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
    },
    preview: {
      host: env.VITE_HOST || '127.0.0.1',
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      setupFiles: ['./src/test/setup.js'],
      minWorkers: 1,
      maxWorkers: 1,
      fileParallelism: false,
      restoreMocks: true,
    },
  };
});
