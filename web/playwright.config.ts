import { defineConfig } from '@playwright/test';

/**
 * Smoke tests run against the permanent dev server (scripts/dev-service.sh).
 * PZ_CHROMIUM points at a system Chromium when Playwright's own browser is not installed.
 */
const executablePath = process.env.PZ_CHROMIUM;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: process.env.PZ_BASE_URL ?? 'http://localhost:10099/pizzelator/',
    launchOptions: executablePath === undefined ? {} : { executablePath },
    acceptDownloads: true,
  },
});
