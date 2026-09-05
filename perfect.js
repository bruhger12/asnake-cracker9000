// perfect.js — compute a provably-perfect moves string (U/D/L/R per tick) for
// a run seed: score 394 = full board, the maximum possible in the game.
//
// Strategy: the snake's body is always a contiguous arc of a Hamiltonian cycle
// over the 20x20 grid. If the head sweeps the cycle BACKWARD, its next cell is
// never occupied until the body wraps the entire cycle (len = 400) — i.e. it is
// provably impossible to self-collide before filling the board. Every food
// spawns on an empty cell, which is always ahead in the sweep, so all 394 foods
// get eaten. The final step into a full board ends the game at score 394.
//
// Engine below replicates the site's bundle byte-for-byte:
//   page-Iap2L7pY.js — LCG p(), spawn c(), queue d(), tick f().

const W = 20, H = 20;
const DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const CHAR = { up: 'U', down: 'D', left: 'L', right: 'R' };
const same = (a, b) => a.x === b.x && a.y === b.y;

function makeRng(seed) {
  let t = seed >>> 0;
  return () => ((t = (Math.imul(t, 1664525) + 1013904223) >>> 0), t / 4294967296);
}

function spawnFood(w, h, snake, rng) {
  const cells = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const cell = { x, y };
    if (!snake.some((s) => same(s, cell))) cells.push(cell);
  }
  return cells.length === 0 ? { x: -1, y: -1 } : cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
}

function initialState(rng) {
  const snake = [{ x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }];
  return { width: 20, height: 20, snake, direction: 'left', queuedDirection: 'left', food: spawnFood(20, 20, snake, rng), score: 0, status: 'playing' };
}

// one tick: apply queuedDirection, check wall/self, eat + respawn food
function tick(state, rng) {
  if (state.status === 'game-over') return state;
  const n = state.queuedDirection, r = DIR[n], head = state.snake[0];
  const s = { x: head.x + r.x, y: head.y + r.y };
  const eat = same(s, state.food);
  const body = eat ? state.snake : state.snake.slice(0, -1);
  const wall = s.x < 0 || s.x >= state.width || s.y < 0 || s.y >= state.height;
  const hit = body.some((c) => same(c, s));
  if (wall || hit) return { ...state, direction: n, queuedDirection: n, status: 'game-over' };
  const snake = eat ? [s, ...state.snake] : [s, ...state.snake.slice(0, -1)];
  return { ...state, snake, direction: n, queuedDirection: n, food: eat ? spawnFood(state.width, state.height, snake, rng) : state.food, score: eat ? state.score + 1 : state.score };
}

// Hamiltonian cycle over 20x20: row 0 full, rows 1..19 snake between x=1..19,
// return up column 0 — visits every cell exactly once, closes the loop.
function buildCycle() {
  const cyc = [];
  for (let y = 0; y < H; y++) {
    if (y === 0) { for (let x = 0; x < W; x++) cyc.push({ x, y }); }
    else if (y % 2 === 0) { for (let x = 1; x < W; x++) cyc.push({ x, y }); }
    else { for (let x = W - 1; x >= 1; x--) cyc.push({ x, y }); }
  }
  for (let y = H - 1; y >= 1; y--) cyc.push({ x: 0, y });
  return cyc;
}

// compute the perfect moves string for a seed; returns {moves, score, status, ticks}
function solve(seed) {
  const rng = makeRng(seed);
  let st = initialState(rng);
  const cyc = buildCycle();
  const idxOf = new Map(cyc.map((c, i) => [`${c.x}:${c.y}`, i]));
  const moves = [];
  let guard = 0;
  while (st.status !== 'game-over' && guard < 200000) {
    let dir;
    if (st.score >= 394) {
      // board full: only the vacating tail cell is safe — turn into the mid-body
      // (or a wall at a corner) so the run ends in game-over at score 394.
      const cur = st.queuedDirection;
      dir = (cur === 'left' || cur === 'right') ? 'up' : 'left';
    } else {
      const head = st.snake[0];
      const hi = idxOf.get(`${head.x}:${head.y}`);
      const t = cyc[(hi - 1 + cyc.length) % cyc.length]; // backward along cycle
      const dx = t.x - head.x, dy = t.y - head.y;
      dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
    }
    st = { ...st, queuedDirection: dir };
    moves.push(CHAR[dir]);
    st = tick(st, rng);
    guard++;
  }
  return { moves: moves.join(''), score: st.score, status: st.status, ticks: moves.length };
}

// sweep the cycle backward T ticks, then run into the top wall — guaranteed
// game-over under any replay semantics, with score >= 1 for T >= 400.
function sweepAndDie(seed, T) {
  const rng = makeRng(seed);
  let st = initialState(rng);
  const cyc = buildCycle();
  const idxOf = new Map(cyc.map((c, i) => [`${c.x}:${c.y}`, i]));
  const moves = [];
  for (let i = 0; i < T && st.status !== 'game-over'; i++) {
    const head = st.snake[0];
    const hi = idxOf.get(`${head.x}:${head.y}`);
    const t = cyc[(hi - 1 + cyc.length) % cyc.length];
    const dx = t.x - head.x, dy = t.y - head.y;
    const dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
    st = { ...st, queuedDirection: dir };
    moves.push(CHAR[dir]);
    st = tick(st, rng);
  }
  for (let i = 0; i < 25 && st.status !== 'game-over'; i++) {
    st = { ...st, queuedDirection: 'up' };
    moves.push('U');
    st = tick(st, rng);
  }
  return { moves: moves.join(''), score: st.score, status: st.status };
}

module.exports = { solve, sweepAndDie, tick, initialState, makeRng, CHAR };

const seed = Number(process.argv[2]) || 1337;
const t0 = Date.now();
const sol = solve(seed);
console.log(`seed ${seed}: score ${sol.score} ${sol.status} | ${sol.ticks} ticks | ${sol.moves.length} chars | ${Date.now() - t0}ms`);
console.log('prefix:', sol.moves.slice(0, 40));
console.log('suffix:', sol.moves.slice(-40));