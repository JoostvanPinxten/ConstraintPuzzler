import unittest

from gui.settings import PuzzleSettings


class PuzzleSettingsTest(unittest.TestCase):
    def test_default_disallows_guessing(self):
        self.assertFalse(PuzzleSettings().allowGuessing)

    def test_change_emits_signal_once(self):
        settings = PuzzleSettings()
        received = []
        settings.allowGuessingChanged.connect(received.append)

        settings.allowGuessing = True
        settings.setAllowGuessing(True)  # unchanged: no second emission
        settings.setAllowGuessing(False)

        self.assertEqual(received, [True, False])
        self.assertFalse(settings.allowGuessing)


if __name__ == "__main__":
    unittest.main()
