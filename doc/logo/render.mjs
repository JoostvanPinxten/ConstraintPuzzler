// Render the logo SVGs to the PNGs next to them, with Chromium (via Playwright, a dev dependency).
// Usage, from the repository root: node doc/logo/render.mjs
// (run `npx playwright install chromium` once if the browser is missing)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
// [svg, png name ({0} = size), sizes (null: the SVG's own size)]
const targets = [
  ['constraintpuzzler-mark.svg', 'constraintpuzzler-mark-{0}.png', [16, 32, 64, 256, 512]],
  ['constraintpuzzler-logo.svg', 'constraintpuzzler-logo.png', [null]],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [svgName, pngName, sizes] of targets) {
    const svg = readFileSync(join(here, svgName), 'utf-8');
    const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    for (const size of sizes) {
      await page.setContent(
        `<html><body style="margin:0;background:transparent">` +
          `<img id="logo" src="${source}"${size === null ? '' : ` width="${size}" height="${size}"`}>` +
          `</body></html>`,
      );
      await page.locator('#logo').evaluate((img) => img.decode());
      const out = join(here, pngName.replace('{0}', String(size)));
      await page.locator('#logo').screenshot({ path: out, omitBackground: true });
      console.log(`wrote ${out}`);
    }
  }
} finally {
  await browser.close();
}
