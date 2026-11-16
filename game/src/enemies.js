// The things that hunt the Keeper: three ordinary kinds, kindled elites, and
// two bosses. Each one is a small state machine — seek, keep range, telegraph
// and charge, or cycle boss attacks — driven only by the world it is handed,
// so the same code runs the live game and the screenshot autopilot.
import { BOSS, ELITE_MULT, ENEMY } from './config.js';

export const KIND_CINDER = 'cinder';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';
export const KIND_BOSS = 'boss';

// How far a spitter likes to sit from the Keeper, and how often it shoots.
const SPITTER_MIN_RANGE = 230;
const SPITTER_MAX_RANGE = 340;
const SPITTER_SHOT_EVERY = 2.3;
const SPITTER_BULLET_SPEED = 185;
// A brute only charges from inside this range, after a visible telegraph.
const BRUTE_CHARGE_RANGE = 250;
const BRUTE_TELEGRAPH = 0.5;
const BRUTE_CHARGE_TIME = 0.45;
const BRUTE_CHARGE_SPEED = 3.1;
const BRUTE_RECOVER = 0.7;

function baseStats(kind) {
  const s = ENEMY[kind];
  return { hp: s.hp, speed: s.speed, radius: s.radius, damage: s.damage, score: s.score, embers: s.embers, color: s.color };
}

export function createEnemy(kind, x, y, rng, wave, elite = false) {
  const s = baseStats(kind);
  const mult = elite ? ELITE_MULT : null;
  const enemy = {
    kind,
    x, y,
    vx: 0, vy: 0,
    hp: Math.round(s.hp * (mult ? mult.hp : 1) * (1 + (wave - 1) * 0.06)),
    maxHp: 0,
    radius: s.radius * (mult ? mult.radius : 1),
    speed: s.speed * (mult ? mult.speed : 1) * rng.range(0.92, 1.08),
    damage: s.damage,
    score: Math.round(s.score * (mult ? mult.score : 1)),
    embers: s.embers * (mult ? mult.embers : 1),
    color: s.color,
    elite,
    boss: false,
    name: elite ? `Kindled ${kind}` : kind,
    t: rng.range(0, Math.PI * 2),
    fireTimer: rng.range(1.2, SPITTER_SHOT_EVERY),
    state: 'chase',
    stateT: 0,
    chargeX: 0,
    chargeY: 0,
    flash: 0,
    wobble: rng.range(0, Math.PI * 2),
  };
  enemy.maxHp = enemy.hp;
  return enemy;
}

export function createBoss(wave, x, y) {
  const def = BOSS[wave];
  const boss = {
    kind: KIND_BOSS,
    x, y,
    vx: 0, vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed,
    damage: 2,
    score: def.score,
    embers: def.embers,
    color: def.color,
    elite: false,
    boss: true,
    name: def.name,
    t: 0,
    fireTimer: 2.0,
    state: 'chase',
    stateT: 0,
    chargeX: 0,
    chargeY: 0,
    flash: 0,
    wobble: 0,
    wave,
    spiralAngle: 0,
  };
  return boss;
}

function moveToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function moveAway(e, tx, ty, speed, dt) {
  const dx = e.x - tx;
  const dy = e.y - ty;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

// One behaviour step. `api` is the world: player, rng, time, and the two
// spawn calls an enemy may use (bullets, and the boss's summons).
export function updateEnemy(e, api, dt) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const p = api.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  if (e.kind === KIND_CINDER) {
    // A drifting wisp: it seeks the Keeper but wobbles side to side, so its
    // path is never a straight line at you.
    const wob = Math.sin(e.t * 2.2 + e.wobble) * 0.7;
    const mx = nx + -ny * wob;
    const my = ny + nx * wob;
    const len = Math.hypot(mx, my) || 1;
    e.x += (mx / len) * e.speed * dt;
    e.y += (my / len) * e.speed * dt;
    return;
  }

  if (e.kind === KIND_SPITTER) {
    // Keeps its distance and spits aimed ember bolts.
    if (dist < SPITTER_MIN_RANGE) moveAway(e, p.x, p.y, e.speed, dt);
    else if (dist > SPITTER_MAX_RANGE) moveToward(e, p.x, p.y, e.speed, dt);
    else {
      // Strafe sideways at range, so it never sits still.
      const side = Math.sin(e.t * 1.4 + e.wobble) > 0 ? 1 : -1;
      e.x += -ny * side * e.speed * 0.6 * dt;
      e.y += nx * side * e.speed * 0.6 * dt;
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 560) {
      e.fireTimer = SPITTER_SHOT_EVERY * api.rng.range(0.9, 1.15);
      api.spawnEnemyBullet(e.x, e.y, nx * SPITTER_BULLET_SPEED, ny * SPITTER_BULLET_SPEED);
    }
    return;
  }

  if (e.kind === KIND_BRUTE) {
    e.stateT -= dt;
    if (e.state === 'chase') {
      moveToward(e, p.x, p.y, e.speed, dt);
      if (dist < BRUTE_CHARGE_RANGE && e.stateT <= 0) {
        e.state = 'telegraph';
        e.stateT = BRUTE_TELEGRAPH;
      }
    } else if (e.state === 'telegraph') {
      // Shudders in place: the warning before the charge.
      e.x += Math.sin(e.t * 40) * 1.2;
      if (e.stateT <= 0) {
        e.state = 'charge';
        e.stateT = BRUTE_CHARGE_TIME;
        e.chargeX = nx;
        e.chargeY = ny;
      }
    } else if (e.state === 'charge') {
      e.x += e.chargeX * e.speed * BRUTE_CHARGE_SPEED * dt;
      e.y += e.chargeY * e.speed * BRUTE_CHARGE_SPEED * dt;
      if (e.stateT <= 0) {
        e.state = 'recover';
        e.stateT = BRUTE_RECOVER;
      }
    } else {
      if (e.stateT <= 0) e.state = 'chase';
    }
    return;
  }

  if (e.kind === KIND_BOSS) {
    updateBoss(e, api, dt, nx, ny, dist);
  }
}

// Bosses cycle attacks: chase, then a radial burst, then summons, then an
// aimed fan. The Tyrant (wave 10) adds a spiral while hurt, and enrages
// under a third of its health: faster, denser, angrier.
function updateBoss(e, api, dt, nx, ny, dist) {
  e.stateT -= dt;
  const enraged = e.hp < e.maxHp / 3;
  const speed = e.speed * (enraged ? 1.45 : 1);
  if (e.state === 'chase') {
    moveToward(e, api.player.x, api.player.y, speed, dt);
    if (e.stateT <= 0) {
      const roll = api.rng.next();
      if (e.wave === 10 && e.hp < (e.maxHp * 2) / 3 && roll < 0.3) {
        e.state = 'spiral';
        e.stateT = 3.2;
        e.spiralAngle = api.rng.angle();
      } else if (roll < 0.42) {
        e.state = 'radial';
        e.stateT = 0.4;
      } else if (roll < 0.7) {
        e.state = 'summon';
        e.stateT = 0.6;
      } else {
        e.state = 'fan';
        e.stateT = 0.5;
      }
    }
    return;
  }
  if (e.state === 'radial') {
    if (e.stateT <= 0) {
      const count = enraged ? 16 : 12;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + e.t;
        api.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 165, Math.sin(a) * 165);
      }
      api.onBossAttack('radial');
      e.state = 'chase';
      e.stateT = enraged ? 1.1 : 1.6;
    }
    return;
  }
  if (e.state === 'summon') {
    if (e.stateT <= 0) {
      for (let i = 0; i < 3; i += 1) {
        const a = api.rng.angle();
        api.spawnEnemy(KIND_CINDER, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, false);
      }
      api.onBossAttack('summon');
      e.state = 'chase';
      e.stateT = 2.0;
    }
    return;
  }
  if (e.state === 'fan') {
    if (e.stateT <= 0) {
      const base = Math.atan2(ny, nx);
      const shots = enraged ? 7 : 5;
      for (let i = 0; i < shots; i += 1) {
        const a = base + (i - (shots - 1) / 2) * 0.22;
        api.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 235, Math.sin(a) * 235);
      }
      api.onBossAttack('fan');
      e.state = 'chase';
      e.stateT = enraged ? 1.2 : 1.8;
    }
    return;
  }
  if (e.state === 'spiral') {
    // Slow drift while the spiral winds out: two rotating streams.
    moveToward(e, api.player.x, api.player.y, speed * 0.4, dt);
    e.spiralAngle += dt * 3.4;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = 0.12;
      for (const off of [0, Math.PI]) {
        const a = e.spiralAngle + off;
        api.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150);
      }
    }
    if (e.stateT <= 0) {
      e.state = 'chase';
      e.stateT = 1.4;
    }
  }
}
