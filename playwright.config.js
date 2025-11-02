// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:4173';

module.exports = defineConfig({
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'api',
      testDir: 'tests/api'
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
