// Take the README screenshots of the web build with Chromium (Playwright, a dev dependency).
// Usage, from the repository root:
//   npm run export:web -w @constraintpuzzler/app && node doc/screenshots.mjs
// (run `npx playwright install chromium` once if the browser is missing)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const port = 8091;
const base = `http://localhost:${port}`;
const viewport = { width: 1200, height: 730 };
const thumbnailWidth = 570;

// [image, thumbnail, what to show]
const shots = [
  [
    'sudokuExample.png',
    'sudokuExampleThumb.png',
    async (page) => {
      await page.getByTestId('open-sudoku-Easy').click();
      // the row in the list of groups and rules ("Block 1  Constraint Group")
      await page.getByRole('button', { name: /^Block 1\s/ }).click();
    },
  ],
  [
    'kakuroExample.png',
    'kakuroExampleThumbnail.png',
    async (page) => {
      await page.getByTestId('open-kakuro-Medium').click();
      // follow the solver for a few steps, so the candidates are narrowed down
      for (let i = 0; i < 10; i++) await page.getByTestId('step').click();
      await page.getByTestId('cell-6, 4').click();
    },
  ],
];

const server = spawn(process.execPath, [join(root, 'e2e', 'serve.mjs'), String(port)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', (code) => reject(new Error(`the server stopped (${code})`)));
});

const browser = await chromium.launch();
try {
  for (const [image, thumbnail, show] of shots) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(base);
    await show(page);
    // the candidates make the screenshot show how the solver thinks
    await page.getByRole('switch', { name: 'Show hints' }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    const out = join(here, image);
    await page.screenshot({ path: out });
    console.log(`wrote ${out}`);

    // the thumbnail: the image scaled down by the browser
    const scale = thumbnailWidth / viewport.width;
    const small = await browser.newPage({
      viewport: { width: thumbnailWidth, height: Math.round(viewport.height * scale) },
    });
    const source = `data:image/png;base64,${readFileSync(out).toString('base64')}`;
    await small.setContent(
      `<body style="margin:0"><img src="${source}" style="width:${thumbnailWidth}px;display:block"></body>`,
    );
    await small.locator('img').evaluate((img) => img.decode());
    const thumbOut = join(here, thumbnail);
    await small.screenshot({ path: thumbOut });
    console.log(`wrote ${thumbOut}`);
    await small.close();
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
