import { expect, test } from '@playwright/test';

test.describe('suite-level use override', () => {
  test.use({
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width: 390, height: 844 }
  });

  test('uses the most specific browser options', async ({ page }) => {
    await page.setContent('<main><h1>Configuration locale</h1></main>');

    const environment = await page.evaluate(() => ({
      language: navigator.language,
      width: window.innerWidth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }));

    expect(environment).toEqual({
      language: 'fr-FR',
      width: 390,
      timezone: 'Europe/Paris'
    });
  });
});
