// The web build in a browser: every puzzle type opens and draws, and the main flows work with
// the mouse and the keyboard. Screenshots of each board go to e2e/results/.
import { expect, test, type Page } from '@playwright/test';

const EXAMPLES = [
  ['sudoku', 'Easy', 81],
  ['kakuro', 'Medium', 56],
  ['futoshiki', '7x7', 49],
  ['sumbrero', 'Simple', 16],
] as const;

async function open(page: Page, type: string, label: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId(`open-${type}-${label}`).click();
  await expect(page.getByTestId('board').locator('svg')).toBeVisible();
}

for (const [type, label, cells] of EXAMPLES) {
  test(`${type} ${label}: draws every cell`, async ({ page }, info) => {
    await open(page, type, label);
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(cells);
    await page.screenshot({ path: info.outputPath(`${type}.png`), fullPage: true });
  });
}

test('enters a value by clicking and typing, and undoes it', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'keyboard input is for desktop');
  await open(page, 'sudoku', 'Easy');
  await page.getByTestId('cell-1, 1').click();
  await expect(page.getByText('Cell 1, 1')).toBeVisible();
  await page.keyboard.press('4');
  await expect(page.getByText('Value: 4 (entered)')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByText('Value: 4 (entered)')).toHaveCount(0);
  // a value that clashes is a mistake, explained in red
  await page.keyboard.press('6');
  await expect(page.getByText(/breaks a rule together with cell\(s\) 2, 1/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('mistake.png') });
});

test('taps a cell and uses the number pad and notes', async ({ page }) => {
  await open(page, 'sudoku', 'Easy');
  await page.getByTestId('cell-1, 1').click();
  await page.getByTestId('notes').click();
  await page.getByTestId('pad-4').click();
  await page.getByTestId('pad-7').click();
  await expect(page.getByText(/^Notes mode/)).toBeVisible();
  await page.getByTestId('notes').click();
  await page.getByTestId('pad-7').click();
  await expect(page.getByText('Value: 7 (entered)')).toBeVisible();
});

test('reveals a hint in levels and solves', async ({ page }, info) => {
  await open(page, 'sudoku', 'Hard');
  await page.getByTestId('hint').click();
  await expect(page.getByText('Hint: which cell?')).toBeVisible();
  await page.getByText('Hint: which cell?').click();
  await expect(page.getByText(/^Hint: Look at cell/)).toBeVisible();
  await page.getByText('Allow guessing').locator('..').getByRole('switch').click();
  await page.getByTestId('solve').click();
  await expect(page.getByText(/^Solving|Solve$/).first()).toBeVisible();
  await expect(page.getByTestId('solve')).toHaveText('Solve');
  await page.screenshot({ path: info.outputPath('solved.png'), fullPage: true });
  if (info.project.name === 'phone') await page.getByText('Show groups and rules').click();
  await page.getByText('Grid', { exact: true }).click();
  await expect(page.getByText('81 cells: 81 filled, 0 open')).toBeVisible();
});

test('checks the entries against the solution', async ({ page }) => {
  await open(page, 'futoshiki', '7x7');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('notice')).toBeVisible();
  await expect(page.getByText(/Nothing is filled in yet/)).toBeVisible();
  await page.getByTestId('notice-close').click();
  await expect(page.getByTestId('notice')).toHaveCount(0);
});

test('opens several puzzles in tabs and closes them', async ({ page }) => {
  await open(page, 'sudoku', 'Easy');
  await page.getByText('Puzzles', { exact: true }).click();
  await page.getByTestId('open-kakuro-Simple').click();
  await expect(page.getByRole('tab', { name: 'Kakuro: Simple' })).toBeVisible();
  await page.getByLabel('Close Kakuro: Simple').click();
  await page.getByLabel('Close Sudoku: Easy').click();
  await expect(page.getByText('Sumbrero', { exact: true })).toBeVisible();
});
