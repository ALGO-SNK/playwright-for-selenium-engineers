import { devices, expect, test, type PlaywrightTestConfig } from '@playwright/test';

const configurationContract = {
  projects: [
    {
      name: 'seed-test-data',
      testMatch: /global\.setup\.ts/,
      teardown: 'remove-test-data'
    },
    {
      name: 'remove-test-data',
      testMatch: /global\.teardown\.ts/
    },
    {
      name: 'desktop-chromium',
      dependencies: ['seed-test-data'],
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://127.0.0.1:4173/health',
    timeout: 120_000,
    reuseExistingServer: false
  }
} satisfies PlaywrightTestConfig;

test('models setup, dependency, and teardown as an explicit graph', () => {
  const setup = configurationContract.projects.find(
    project => project.name === 'seed-test-data'
  );
  const browser = configurationContract.projects.find(
    project => project.name === 'desktop-chromium'
  );

  expect(setup?.teardown).toBe('remove-test-data');
  expect(browser?.dependencies).toEqual(['seed-test-data']);
  expect(configurationContract.webServer.reuseExistingServer).toBe(false);
});

test('applies explicit context policy after a device descriptor', () => {
  const mobileIndia = {
    ...devices['iPhone 15'],
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    baseURL: 'https://qualitymart.test'
  };

  expect(mobileIndia.locale).toBe('en-IN');
  expect(mobileIndia.timezoneId).toBe('Asia/Kolkata');
  expect(mobileIndia.baseURL).toBe('https://qualitymart.test');
});
