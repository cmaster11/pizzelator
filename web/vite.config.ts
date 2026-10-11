import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** The permanent dev server port; see `scripts/dev-service.sh`. */
const DEV_PORT = 10099;

/** GitHub Pages serves the site under this path; the dev server uses it too. */
const BASE = '/pizzelator/';

/** Extra dev server hosts, such as a reverse proxy's, from `PZ_ALLOWED_HOSTS`. */
const ALLOWED_HOSTS = (process.env.PZ_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter((host) => host !== '');

export default defineConfig({
  plugins: [react()],
  base: BASE,
  server: {
    host: '0.0.0.0',
    port: DEV_PORT,
    strictPort: true,
    // Vite rejects a Host header it does not know, which is what a reverse proxy sends.
    allowedHosts: ALLOWED_HOSTS,
  },
  worker: {
    format: 'es',
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'mantine', test: /node_modules[\\/]@mantine/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
