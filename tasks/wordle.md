# Wordle in the terminal

Build a terminal Wordle game in Python, using only the standard library.

## Rules

- The game picks a secret five-letter word. The player has six guesses.
- After each guess, show a mark for every letter:
  - `correct`: right letter, right place;
  - `present`: the letter is in the word, but in another place;
  - `absent`: the letter is not in the word.
- Repeated letters: a letter gets `correct` or `present` only as many times
  as it appears in the answer, and `correct` marks are given first. For
  example, guessing `SPEED` when the answer is `ABIDE` marks the first `E`
  as `present` and the second `E` as `absent`.
- Guesses are case-insensitive. A guess that isn't five letters is rejected
  and doesn't use up a turn.
- The player wins when every letter is `correct`. After six wrong guesses,
  the game shows the answer.

## Files

- `wordle_logic.py`: the rules, with no input or printing. A function
  `score_guess(guess, answer)` takes two five-letter words and returns a
  list of five marks. Also a list of at least 50 common five-letter words.
- `wordle.py`: the game, played with `python wordle.py`. When input ends
  (Ctrl-D) or on Ctrl-C, it says goodbye and exits without a traceback.
- `test_wordle_logic.py`: pytest tests for `score_guess` with exactly these
  cases, copied as written (they are worked out already, don't change
  them):

  | Call | Expected result |
  | --- | --- |
  | `score_guess("SPEED", "ABIDE")` | `["absent", "absent", "present", "absent", "present"]` |
  | `score_guess("ALLEY", "LLAMA")` | `["present", "correct", "present", "absent", "absent"]` |
  | `score_guess("CRANE", "CRANE")` | `["correct", "correct", "correct", "correct", "correct"]` |
  | `score_guess("MOUSY", "CRANE")` | `["absent", "absent", "absent", "absent", "absent"]` |
  | `score_guess("crane", "CRANE")` | `["correct", "correct", "correct", "correct", "correct"]` |
- `README.md`: how to play and how to run the tests.

## Done when

- `python -m pytest` passes.
- `python wordle.py` starts a game.
