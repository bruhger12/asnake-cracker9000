# asnake-cracker9000

computes provably-optimal move strings for the snake game at
https://asnake.tx24.dev/ — the one where the snake's body spells `ASNAKE`.

no dependencies, no npm install. just node 22+.

## what it does

given a run's seed, it computes the moves string (one of `U`/`D`/`L`/`R` per
tick) that maximizes the score:

- `perfect.js` — the full-board solver. score 394 is the maximum possible
  (400 cells − the 6 starting cells = 394 foods). the snake sweeps a
  Hamiltonian cycle backward, which provably never self-collides before the
  board is full, so every food gets eaten. ~60ms per seed.
- `final.js` — the greedy planner for bounded budgets. bfs to the food, gated
  by the classic tail-reachability check (a move is safe iff after it the head
  can still reach its own tail, so the snake can loop forever). ~0.4s per
  seed. the plan survives to the budget on every seed and ends game-over.

the game engine inside `perfect.js` is a byte-for-byte replica of the site's
own client code (same lcg, same spawn, same queued-input semantics), so the
computed scores are exactly what the site itself would produce.

## files

| file | what it is |
|---|---|
| `perfect.js` | the engine replica + the 394 full-board solver |
| `final.js` | `plan(seed, budget)` — greedy planner with the tail-reachability safety gate |

## how to use

```bash
node perfect.js <seed>              # full-board 394 solve for a seed (~60ms)
node -e "const {plan}=require('./final.js'); const p=plan(<seed>, <budget>); console.log(p.score, p.len, p.status)"
```

`plan()` returns `{ moves, score, status, len }` — moves is the string.

## what it deliberately doesn't do

no submission code. no api calls. no leaderboard. no discord. getting a run's
seed and doing something with the moves string is left entirely to you — that
part can be used for nefarious things, so it stays out of this repo.

## requirements

- node 22+ (`node --version`)
- that's it