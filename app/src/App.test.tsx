// The app rendered: open puzzles from the start page, play with taps, close tabs.
// (Testing Library 14: render and fireEvent are async.)
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PUZZLE_TYPES, TECHNIQUE_GUIDE } from '@constraintpuzzler/core';

import App from '../App';
import { i18n } from './i18n';

async function openPuzzle(testID: string): Promise<void> {
  await render(<App />);
  await fireEvent.press(screen.getByTestId(testID));
  // the board only draws after it knows its size
  await fireEvent(screen.getByTestId('board'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 500, height: 500 } },
  });
}

describe('App', () => {
  it('lists every puzzle type on the start page, with the version', async () => {
    await render(<App />);
    for (const type of ['Sudoku', 'Kakuro', 'Futoshiki', 'Sumbrero']) {
      expect(screen.getByText(type)).toBeTruthy();
    }
    // (jest-expo's Constants mock does not evaluate app.config.ts, so no version number here)
    expect(screen.getByText(/^Version /)).toBeTruthy();
  });

  it('shows every type on the start page (preview, rule, examples), which opens its default example', async () => {
    await render(<App />);
    for (const type of Object.values(PUZZLE_TYPES)) {
      expect(screen.getByTestId(`preview-${type.name}`)).toBeTruthy();
      expect(screen.getByText(type.label)).toBeTruthy();
      expect(screen.getByText(i18n.t(`rule.${type.name}`))).toBeTruthy();
      for (const label of Object.keys(type.examples)) {
        expect(screen.getByTestId(`open-${type.name}-${label}`)).toBeTruthy();
      }
    }
    await fireEvent.press(screen.getByLabelText('Play Kakuro (Medium)'));
    expect(screen.getByRole('tab', { name: 'Kakuro: Medium', selected: true })).toBeTruthy();
  });

  it('switches the language on the start page, and back to the device language', async () => {
    await render(<App />);
    await fireEvent.press(screen.getByTestId('language-nl'));
    expect(await screen.findByText('Kies een puzzel')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Puzzels' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-sudoku-Easy'));
    expect(screen.getByRole('button', { name: 'Ongedaan maken' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Puzzels' }));
    // the device language (English under Jest)
    await fireEvent.press(screen.getByTestId('language-system'));
    expect(await screen.findByText('Pick a puzzle')).toBeTruthy();
  });

  it.each([
    ['sudoku', 'Easy'],
    ['kakuro', 'Medium'],
    ['futoshiki', '7x7'],
    ['sumbrero', 'Simple'],
    ['nonogram', 'Cup'],
    ['nonogram', 'Cherries'],
  ])(
    'opens the %s example %s in a tab and draws its cells',
    async (type: string, label: string) => {
      await openPuzzle(`open-${type}-${label}`);
      expect(screen.getByRole('tab', { selected: true })).toBeTruthy();
      expect(screen.getAllByTestId(/^cell-/).length).toBeGreaterThan(0);
    },
  );

  it('enters a value with the number pad and undoes it', async () => {
    await openPuzzle('open-sudoku-Easy');
    await fireEvent.press(screen.getByTestId('cell-1, 1'));
    expect(screen.getByText('Cell 1, 1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pad-4'));
    expect(screen.getByText('Value: 4 (entered)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Undo'));
    expect(screen.queryByText('Value: 4 (entered)')).toBeNull();
  });

  it('enters a colour in a nonogram with the colour pad', async () => {
    await openPuzzle('open-nonogram-Cherries');
    await fireEvent.press(screen.getByTestId('cell-1, 1'));
    await fireEvent.press(screen.getByLabelText('red (1)'));
    expect(screen.getByTestId('color-1, 1')).toBeTruthy();
    expect(screen.getByText('Value: red (entered)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pad-0'));
    expect(screen.getByTestId('blank-1, 1')).toBeTruthy();
  });

  it('draws colour symbols when they are switched on', async () => {
    await openPuzzle('open-nonogram-Cherries');
    await fireEvent.press(screen.getByTestId('cell-1, 1'));
    await fireEvent.press(screen.getByLabelText('red (1)'));
    expect(screen.queryByTestId('symbol-1, 1')).toBeNull();
    expect(screen.queryAllByTestId(/^clue-symbol-/)).toHaveLength(0);
    await fireEvent(screen.getByLabelText('Colour symbols'), 'valueChange', true);
    expect(screen.getByTestId('symbol-1, 1')).toBeTruthy();
    expect(screen.queryAllByTestId(/^clue-symbol-/).length).toBeGreaterThan(0);
  });

  it('offers colour symbols only for nonograms with several colours', async () => {
    await openPuzzle('open-nonogram-Cup');
    expect(screen.queryByLabelText('Colour symbols')).toBeNull();
  });

  it('shows a hint and closes the tab', async () => {
    await openPuzzle('open-sudoku-Easy');
    await fireEvent.press(screen.getByTestId('hint'));
    expect(screen.getByText('Hint: which cell?')).toBeTruthy();
    // the region of a rule, or of a cell with a single candidate left
    expect(screen.getByText(/^Hint: (Look at|In the highlighted area)/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close Sudoku: Easy'));
    expect(screen.getByText('Sumbrero')).toBeTruthy();
  });

  it('shows the rules of a puzzle type from the start page', async () => {
    await render(<App />);
    await fireEvent.press(screen.getByTestId('rules-kakuro'));
    expect(screen.getByText('Kakuro: rules and techniques')).toBeTruthy();
    expect(screen.getByText(`• ${PUZZLE_TYPES.kakuro.guide.rules[0]}`)).toBeTruthy();
    // a technique opens to show how it works
    const sums = TECHNIQUE_GUIDE.sumCombinations;
    expect(screen.queryByText(`• ${sums.steps[0]}`)).toBeNull();
    await fireEvent.press(screen.getByLabelText(sums.name));
    expect(screen.getByText(`• ${sums.steps[0]}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guide-close'));
    expect(screen.queryByTestId('guide')).toBeNull();
  });

  it('draws an example board for a technique with a pattern', async () => {
    await render(<App />);
    await fireEvent.press(screen.getByTestId('rules-sudoku'));
    expect(screen.queryByTestId('board-xWing')).toBeNull();
    await fireEvent.press(screen.getByLabelText(TECHNIQUE_GUIDE.xWing.name));
    expect(screen.getByTestId('board-xWing')).toBeTruthy();
    expect(screen.getByText(TECHNIQUE_GUIDE.xWing.board!.caption)).toBeTruthy();
  });

  it('explains the technique behind a hint', async () => {
    await openPuzzle('open-sudoku-Easy');
    await fireEvent.press(screen.getByTestId('guide-open'));
    expect(screen.getByText('Sudoku: rules and techniques')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guide-close'));
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByTestId('hint'));
    const link = screen.getByTestId('technique-link');
    await fireEvent.press(link);
    // the dialog opens at that technique
    const opened = Object.values(TECHNIQUE_GUIDE).find(
      (t) => screen.queryByText(`• ${t.steps[0]}`) !== null,
    );
    expect(opened).toBeDefined();
    expect(screen.getByText(`About this technique: ${opened?.name}`)).toBeTruthy();
  });

  it('solves in the background', async () => {
    await openPuzzle('open-kakuro-Simple');
    await fireEvent.press(screen.getByTestId('solve'));
    expect(await screen.findByText('Solve')).toBeTruthy();
    // on a narrow screen, the list of puzzle parts is folded away
    await fireEvent.press(screen.getByText('Show groups and rules'));
    await fireEvent.press(screen.getByText('Grid'));
    expect(screen.getByText('4 cells: 4 filled, 0 open')).toBeTruthy();
  });

  it('reports Check in a dialog', async () => {
    await openPuzzle('open-sudoku-Easy');
    await fireEvent.press(screen.getByTestId('check'));
    expect(await screen.findByTestId('notice')).toBeTruthy();
    expect(screen.getByText(/Nothing is filled in yet/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('notice-close'));
    expect(screen.queryByTestId('notice')).toBeNull();
  });
});
