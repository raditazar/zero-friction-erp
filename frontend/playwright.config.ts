import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]],
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /(mobile|android-to-approve)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: /(mobile|android-to-approve)\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: /(mobile|android-to-approve)\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile ergonomics: iOS Safari (WebKit) and Android Chrome.
    {
      name: 'iphone',
      testMatch: /(mobile|android-to-approve)\.spec\.ts/,
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'pixel',
      testMatch: /(mobile|android-to-approve)\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        // Optional local override when the pinned Chromium build is not downloaded.
        ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
      },
    },
  ],
});
