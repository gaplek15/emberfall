// What each wave is made of. Counts grow with the wave, new kinds join in
// over the first few waves, an elite shows up from wave 4, and every fifth
// wave belongs to a boss. Spawns are a timed queue, so a wave arrives in
// drips rather than all at once.
import { BOSS_WAVES, VIEW } from './config.js';
import { KIND_BRUTE, KIND_CINDER, KIND_SPITTER } from './enemies.js';

// A point on a random arena edge, kept away from the Keeper.
export function spawnPoint(rng, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = rng.int(0, 3);
    let x;
    let y;
    if (edge === 0) { x = rng.range(40, VIEW.width - 40); y = 36; }
    else if (edge === 1) { x = rng.range(40, VIEW.width - 40); y = VIEW.height - 36; }
    else if (edge === 2) { x = 36; y = rng.range(40, VIEW.height - 40); }
    else { x = VIEW.width - 36; y = rng.range(40, VIEW.height - 40); }
    if (Math.hypot(x - player.x, y - player.y) > 300) return { x, y };
  }
  return { x: 60, y: 60 };
}

// The spawn queue for wave n: [{ kind, delay, elite }], delays in seconds
// from the wave's start, plus the boss kind on a boss wave (null otherwise).
export function buildWave(n, rng) {
  const queue = [];
  let delay = 0.4;
  const add = (kind, elite = false) => {
    queue.push({ kind, delay, elite });
    delay += rng.range(0.3, 0.7);
  };

  if (BOSS_WAVES.includes(n)) {
    // A boss wave is the boss, plus a thin trickle of cinders to keep the
    // arena from going quiet while you circle it.
    for (let i = 0; i < 4; i += 1) add(KIND_CINDER);
    return { queue, boss: n };
  }

  const cinders = 5 + 2 * n;
  const spitters = n >= 2 ? Math.min(6, n - 1) : 0;
  const brutes = n >= 3 ? Math.min(5, Math.floor(n / 2)) : 0;
  const elites = n >= 4 ? (n >= 8 ? 2 : 1) : 0;

  for (let i = 0; i < cinders; i += 1) add(KIND_CINDER);
  for (let i = 0; i < spitters; i += 1) add(KIND_SPITTER);
  for (let i = 0; i < brutes; i += 1) add(KIND_BRUTE);
  for (let i = 0; i < elites; i += 1) {
    const kind = rng.pick([KIND_CINDER, KIND_SPITTER, KIND_BRUTE]);
    add(kind, true);
  }

  // Shuffle the queue (keeping the delays in order) so the mix is not
  // "all cinders, then all spitters".
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const tmp = queue[i].kind;
    const tmpElite = queue[i].elite;
    queue[i].kind = queue[j].kind;
    queue[i].elite = queue[j].elite;
    queue[j].kind = tmp;
    queue[j].elite = tmpElite;
  }
  return { queue, boss: null };
}

// The wave banner the HUD shows when a wave begins.
export function waveTitle(n) {
  if (n === 5) return 'WAVE 5 — THE ASHEN MAW';
  if (n === 10) return 'WAVE 10 — THE CINDER TYRANT';
  return `WAVE ${n}`;
}
