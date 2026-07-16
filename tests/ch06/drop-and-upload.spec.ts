import { expect, test } from '@playwright/test';

test('setInputFiles uploads an in-memory file without an operating-system chooser', async ({ page }) => {
  await page.setContent(`
    <label>
      Upload catalog
      <input type="file" accept="text/csv">
    </label>
    <output aria-label="Upload result">No file</output>
    <script>
      const input = document.querySelector('input');
      const result = document.querySelector('output');
      input.addEventListener('change', async () => {
        const file = input.files[0];
        result.textContent = file.name + ': ' + await file.text();
      });
    </script>
  `);

  await page.getByLabel('Upload catalog').setInputFiles({
    name: 'catalog.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,name\nKB-01,Wireless keyboard')
  });

  await expect(page.getByLabel('Upload result')).toHaveText(
    'catalog.csv: sku,name\nKB-01,Wireless keyboard'
  );
});

test('drop dispatches external drag events with files and clipboard-like data', async ({ page }) => {
  await page.setContent(`
    <main>
      <div data-testid="drop-zone">Drop catalog here</div>
      <output aria-label="Drop result">Waiting</output>
    </main>
    <script>
      const zone = document.querySelector('[data-testid="drop-zone"]');
      const result = document.querySelector('output');

      zone.addEventListener('dragover', event => event.preventDefault());
      zone.addEventListener('drop', async event => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        const source = event.dataTransfer.getData('text/plain');
        result.textContent = source + ' | ' + file.name + ' | ' + await file.text();
      });
    </script>
  `);

  await page.getByTestId('drop-zone').drop({
    files: {
      name: 'catalog.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('sku,name\nKB-01,Wireless keyboard')
    },
    data: {
      'text/plain': 'QualityMart import'
    }
  });

  await expect(page.getByLabel('Drop result')).toHaveText(
    'QualityMart import | catalog.csv | sku,name\nKB-01,Wireless keyboard'
  );
});
