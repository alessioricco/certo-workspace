# Tower of Hanoi in the terminal

Build a terminal Tower of Hanoi puzzle in Python, using only the standard
library.

## Rules

- Three rods, `A`, `B` and `C`. At the start every disk is on `A`, the
  largest at the bottom. The player chooses how many disks, from 1 to 10
  (3 when they just press Enter).
- A move takes the top disk of one rod and puts it on another rod. A disk
  can't go on top of a smaller one. An invalid move is refused with a
  short reason and doesn't count.
- The puzzle is solved when every disk is on `C`. Show the number of
  moves so far and the fewest possible, `2^n - 1`.
- Commands: two rod letters such as `A C` (or `ac`, case and spaces don't
  matter) to move, `solve` to watch the remaining moves played one by one,
  `reset` to start again, `help`, and `quit`.
- Draw the rods and disks in ASCII after every move, the disks' widths
  following their sizes and the rods lined up.

## Files

- `hanoi_logic.py`: the rules, with no input or printing.
  - `min_moves(n)` returns `2^n - 1`.
  - `solve(n, source="A", target="C", spare="B")` returns the moves that
    take `n` disks from `source` to `target`, as a list of
    `(from_rod, to_rod)` pairs.
  - A class `HanoiGame(n)` with `rods` (a dict from `"A"`, `"B"`, `"C"` to
    a list of disk sizes, bottom first), `moves` (the count so far),
    `move(from_rod, to_rod)`, which raises `ValueError` for an invalid
    move, and `is_solved()`.
- `hanoi.py`: the game, played with `python hanoi.py`. When input ends
  (Ctrl-D) or on Ctrl-C, it says goodbye and exits without a traceback.
- `test_hanoi_logic.py`: pytest tests with exactly these cases, copied as
  written (they are worked out already, don't change them):

  | Call | Expected result |
  | --- | --- |
  | `min_moves(1)` | `1` |
  | `min_moves(3)` | `7` |
  | `solve(2)` | `[("A", "B"), ("A", "C"), ("B", "C")]` |
  | `len(solve(5))` | `31` |
  | `HanoiGame(3).rods` | `{"A": [3, 2, 1], "B": [], "C": []}` |
  | `HanoiGame(3).move("B", "C")` (an empty rod) | raises `ValueError` |
  | on `HanoiGame(3)`, `move("A", "C")` then `move("A", "C")` (a larger disk on a smaller one) | the second raises `ValueError`, and `moves` stays `1` |
  | on `HanoiGame(4)`, every move of `solve(4)` | `is_solved()` is `True` and `moves` is `15` |
- `README.md`: how to play and how to run the tests.

## Done when

- `python -m pytest` passes.
- `python hanoi.py` starts a game.
