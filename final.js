// final.js — the proven snake algorithm: greedy BFS to food, gated by the
// classic tail-reachability safety check (a move is safe iff after it the head
// can still reach its own tail, so the snake can loop forever).
// Submission: parallel runs at several move budgets, each submitted once the
// server-side virtual play time (moves*125ms + 1.5s) has elapsed.
const { makeRng, initialState, tick, CHAR } = require('./perfect.js');

const W = 20, H = 20;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const REV = { up: 'down', down: 'up', left: 'right', right: 'left' };
const K = (x, y) => x + ',' + y;

// pure move (no RNG): null on death; grows on eat; food set to null when eaten
function advancePure(st, dir) {
  const d = DIRS[dir], head = st.snake[0];
  const nx = head.x + d[0], ny = head.y + d[1];
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) return null;
  const eats = st.food && st.food.x === nx && st.food.y === ny;
  const check = eats ? st.snake : st.snake.slice(0, -1);
  if (check.some((b) => b.x === nx && b.y === ny)) return null;
  const snake = eats ? [{ x: nx, y: ny }, ...st.snake] : [{ x: nx, y: ny }, ...st.snake.slice(0, -1)];
  return { ...st, snake, food: eats ? null : st.food };
}

// can the head reach cell `tail` without crossing `walls`?
function reachable(head, tail, walls) {
  if (head.x === tail.x && head.y === tail.y) return true;
  const seen = new Set([K(head.x, head.y)]);
  const q = [head];
  while (q.length) {
    const c = q.shift();
    for (const d of Object.values(DIRS)) {
      const nx = c.x + d[0], ny = c.y + d[1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const k = K(nx, ny);
      if (seen.has(k) || walls.has(k)) continue;
      if (nx === tail.x && ny === tail.y) return true;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return false;
}

// number of free cells reachable from head (freedom metric for tie-breaks)
function freeCount(head, walls) {
  const seen = new Set([K(head.x, head.y)]);
  const q = [head];
  while (q.length) {
    const c = q.shift();
    for (const d of Object.values(DIRS)) {
      const nx = c.x + d[0], ny = c.y + d[1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const k = K(nx, ny);
      if (seen.has(k) || walls.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen.size;
}

// is moving `dir` safe? (after the move, head can still reach the tail)
function safeAfter(st, dir) {
  const nxt = advancePure(st, dir);
  if (!nxt) return false;
  const tail = nxt.snake[nxt.snake.length - 1];
  const walls = new Set(nxt.snake.slice(0, -1).map((c) => K(c.x, c.y)));
  return reachable(nxt.snake[0], tail, walls);
}

// direction of the first BFS step toward food (conservative: all body blocked);
// null when no path exists
function foodDir(head, walls, food) {
  if (!food) return null;
  // food adjacent to head
  if (Math.abs(food.x - head.x) + Math.abs(food.y - head.y) === 1) {
    return food.x === head.x + 1 ? 'right' : food.x === head.x - 1 ? 'left' : food.y === head.y + 1 ? 'down' : 'up';
  }
  const prev = new Map([[K(head.x, head.y), null]]);
  const q = [{ x: head.x, y: head.y }];
  while (q.length) {
    const c = q.shift();
    for (const [name, d] of Object.entries(DIRS)) {
      const nx = c.x + d[0], ny = c.y + d[1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const k = K(nx, ny);
      if (prev.has(k)) continue;
      if (nx === food.x && ny === food.y) {
        // walk the parent chain up to the cell adjacent to the head
        const hk = K(head.x, head.y);
        let cur = K(c.x, c.y);
        let guard = 0;
        while (prev.get(cur) !== hk && guard++ < 1000) cur = prev.get(cur);
        const p = cur.split(',').map(Number);
        if (p[0] === head.x) return p[1] === head.y - 1 ? 'up' : 'down';
        return p[0] === head.x + 1 ? 'right' : 'left';
      }
      if (walls.has(k)) continue;
      prev.set(k, K(c.x, c.y));
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

// greedy chaser for `budget` ticks, then suicide; returns moves/score/status/len
function plan(seed, budget) {
  const rng = makeRng(seed);
  let st = initialState(rng);
  const moves = [];
  for (let t = 0; t < budget && st.status === 'playing'; t++) {
    const head = st.snake[0];
    const walls = new Set(st.snake.map((c) => K(c.x, c.y)));
    let chosen = null;
    // 1) chase the food if the first step is safe
    const fd = foodDir(head, walls, st.food);
    if (fd && safeAfter(st, fd)) chosen = fd;
    // 2) fallback: any safe direction, prefer the one with most free space
    if (!chosen) {
      let best = null, bestScore = -1;
      for (const d of Object.keys(DIRS)) {
        if (d === REV[st.direction]) continue;
        const nxt = advancePure(st, d);
        if (!nxt) continue;
        const tail = nxt.snake[nxt.snake.length - 1];
        const nwalls = new Set(nxt.snake.slice(0, -1).map((c) => K(c.x, c.y)));
        if (!reachable(nxt.snake[0], tail, nwalls)) continue;
        const fs = freeCount(nxt.snake[0], nwalls);
        if (fs > bestScore) { bestScore = fs; best = d; }
      }
      chosen = best;
    }
    // 3) last resort: any non-fatal move
    if (!chosen) {
      for (const d of Object.keys(DIRS)) {
        if (d === REV[st.direction]) continue;
        if (advancePure(st, d)) { chosen = d; break; }
      }
    }
    if (!chosen) chosen = st.direction;
    st = { ...st, queuedDirection: chosen };
    moves.push(CHAR[chosen]);
    st = tick(st, rng);
  }
  // suicide: push up until dead (wall at y=0 guarantees death within 19 moves)
  for (let i = 0; i < 20 && st.status === 'playing'; i++) {
    st = { ...st, queuedDirection: 'up' };
    moves.push('U');
    st = tick(st, rng);
  }
  return { moves: moves.join(''), score: st.score, status: st.status, len: moves.length };
}

module.exports = { plan };