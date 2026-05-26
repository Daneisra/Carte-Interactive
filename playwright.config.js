// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:4173';
const isCi = Boolean(process.env.CI);

module.exports = defineConfig({
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: isCi
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'test-results/playwright-junit.xml' }]
      ]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCi ? 'retain-on-failure' : 'off'
  },
  projects: [
    {
      name: 'api',
      testDir: 'tests/api',
      // API specs mutate shared JSON and session fixtures.
      workers: 1
    },
    {
      name: 'chromium',
      testDir: 'tests/ui',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      testDir: 'tests/ui',
      use: { ...devices['Desktop Firefox'] }
    }
  ],
  webServer: {
    command: 'node tools/devServerWithStub.js',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
