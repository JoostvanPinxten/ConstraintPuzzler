// The web build in a browser: every puzzle type opens and draws, and the main flows work with
// the mouse and the keyboard. Screenshots of each board go to e2e/results/.
import { expect, test, type Page } from '@playwright/test';

const EXAMPLES = [
  ['sudoku', 'Easy', 81],
  ['kakuro', 'Medium', 56],
  ['futoshiki', '7x7', 49],
  ['jidoku', 'Medium', 81],
  ['sumbrero', 'Simple', 16],
  ['nonogram', 'Cup', 100],
  ['nonogram', 'Cherries', 100],
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

test('dragging over or double-clicking the board selects no text', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'mouse gestures are for desktop');
  await open(page, 'sudoku', 'Easy');
  const box = await page.getByTestId('board').boundingBox();
  if (box === null) throw new Error('no board');
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 5 });
  await page.mouse.up();
  await page.getByTestId('cell-2, 1').dblclick();
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('');
  await expect(page.getByText('Cell 2, 1')).toBeVisible();
});

test('a right click on the board opens no browser menu, but zooming still works', async ({
  page,
}) => {
  await open(page, 'sudoku', 'Easy');
  const cell = page.getByTestId('cell-2, 1');
  // the default action of an event the app cancels does not happen
  const cancelled = (type: 'contextmenu' | 'wheel' | 'keydown') =>
    cell.evaluate((element, type) => {
      const event =
        type === 'contextmenu'
          ? new MouseEvent(type, { bubbles: true, cancelable: true, button: 2 })
          : type === 'wheel'
            ? new WheelEvent(type, { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 })
            : new KeyboardEvent(type, { bubbles: true, cancelable: true, ctrlKey: true, key: '+' });
      return !element.dispatchEvent(event);
    }, type);
  expect(await cancelled('contextmenu')).toBe(true);
  // Ctrl + wheel and Ctrl + plus zoom the page
  expect(await cancelled('wheel')).toBe(false);
  expect(await cancelled('keydown')).toBe(false);
});

test('nothing stops a pinch on the board from zooming the page', async ({ page }, info) => {
  // a synthesized pinch zooms no page in Playwright, so this checks what would block one
  test.skip(info.project.name !== 'phone', 'pinching is for touch screens');
  await open(page, 'sudoku', 'Easy');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale/);
  const cell = page.getByTestId('cell-2, 1');
  // touch-action of the cell and everything around it lets a pinch zoom
  const touchActions = await cell.evaluate((element) => {
    const values: string[] = [];
    for (let e: Element | null = element; e !== null; e = e.parentElement) {
      values.push(getComputedStyle(e).touchAction);
    }
    return values;
  });
  for (const value of touchActions) expect(value).toMatch(/^(auto|manipulation|.*pinch-zoom.*)$/);
  // and a two-finger move is not cancelled
  const cancelled = await cell.evaluate((element) => {
    const touch = (id: number, x: number) =>
      new Touch({ identifier: id, target: element, clientX: x, clientY: 100 });
    const touches = [touch(1, 100), touch(2, 140)];
    const init = {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches: touches,
    };
    element.dispatchEvent(new TouchEvent('touchstart', init));
    const move = !element.dispatchEvent(new TouchEvent('touchmove', init));
    element.dispatchEvent(new TouchEvent('touchend', { ...init, touches: [], targetTouches: [] }));
    return move;
  });
  expect(cancelled).toBe(false);
});

test('the clues and lines drawn over the cells let clicks through', async ({ page }) => {
  await open(page, 'kakuro', 'Medium');
  const overlays = await page
    .getByTestId('board')
    .locator('svg text, svg polyline, svg polygon')
    .evaluateAll((els) =>
      els
        .filter((e) => e.closest('[data-testid^="cell-"]') === null && e.closest('defs') === null)
        .map((e) => getComputedStyle(e).pointerEvents),
    );
  expect(overlays.length).toBeGreaterThan(0);
  expect(overlays.filter((value) => value !== 'none')).toEqual([]);
});

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
  await expect(page.getByLabel('Notes mode on')).toBeVisible();
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
