// The simulation: one fixed 1/60 s step, everything the game is. The Keeper
// moves, dashes and shoots; bullets meet enemies; enemies hunt, spit and
// charge; embers fly and are collected; waves arrive, clear, and offer their
// choice. The renderer only ever reads this state — it never writes it.
import { COLORS, PLAYER, STEP, VIEW, WAVE_COUNT } from './config.js';
import { createBoss, createEnemy, KIND_BOSS, KIND_CINDER, updateEnemy } from './enemies.js';
import { buildWave, spawnPoint, waveTitle } from './waves.js';
import { BANK_RATE, BANK_SCORE_PER_EMBER, rollUpgrades } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;

const BULLET_LIFE = 1.1;
const EMBER_VALUE = 1;
const COMBO_WINDOW = 2.5;

function freshPlayer() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height / 2 + 120,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    fireTimer: 0,
    damage: PLAYER.bulletDamage,
    pierce: 0,
    projectiles: 1,
    dashTimer: 0,
    dashCd: 0,
    dashCooldown: PLAYER.dashCooldown,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    spreadTimer: 0,
    shieldTimer: 0,
    pickupRadius: PLAYER.pickupRadius,
    emberMagnet: PLAYER.emberMagnet,
  };
}

export function createWorld(rng, effects, audio) {
  const state = {
    player: freshPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    emberDrops: [],
    pickups: [],
    wave: 0,
    waveState: 'idle',
    spawnQueue: [],
    spawnTimer: 0,
    waveTime: 0,
    boss: null,
    score: 0,
    scoreMult: 1,
    banked: 0,
    embers: 0,
    kills: 0,
    time: 0,
    offers: [],
    banner: '',
    bannerT: 0,
    combo: 0,
    comboT: 0,
    runOver: false,
    victory: false,
    shotsFired: 0,
    shotsHit: 0,
    pilot: null,
  };

  const world = {
    state,
    get player() { return state.player; },
    get time() { return state.time; },
    rng,

    setPilot(fn) { state.pilot = fn; },

    reset() {
      state.player = freshPlayer();
      state.bullets.length = 0;
      state.enemyBullets.length = 0;
      state.enemies.length = 0;
      state.emberDrops.length = 0;
      state.pickups.length = 0;
      state.wave = 0;
      state.waveState = 'idle';
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.waveTime = 0;
      state.boss = null;
      state.score = 0;
      state.scoreMult = 1;
      state.banked = 0;
      state.embers = 0;
      state.kills = 0;
      state.time = 0;
      state.offers = [];
      state.banner = '';
      state.bannerT = 0;
      state.combo = 0;
      state.comboT = 0;
      state.runOver = false;
      state.victory = false;
      state.shotsFired = 0;
      state.shotsHit = 0;
    },

    beginRun() {
      world.reset();
      world.startWave(1);
    },

    startWave(n) {
      state.wave = n;
      state.waveState = 'fighting';
      state.waveTime = 0;
      const built = buildWave(n, rng);
      state.spawnQueue = built.queue;
      state.spawnTimer = 0;
      state.banner = waveTitle(n);
      state.bannerT = 2.4;
      if (built.boss) {
        const boss = createBoss(built.boss, VIEW.width / 2, 130);
        state.enemies.push(boss);
        state.boss = boss;
        effects.ring(boss.x, boss.y, COLORS.bossBar, 160);
        effects.shake(6, 0.4);
        audio.roar();
      }
    },

    // The wave is cleared; the Keeper chooses. Called by the UI.
    nextWave() {
      state.offers = [];
      world.startWave(state.wave + 1);
    },

    buyUpgrade(offer) {
      if (state.waveState !== 'upgrade' || state.embers < offer.cost) return false;
      state.embers -= offer.cost;
      offer.apply(state.player);
      audio.upgrade();
      effects.text(state.player.x, state.player.y - 30, offer.name, COLORS.emberHot, 18);
      world.nextWave();
      return true;
    },

    bankEmbers() {
      if (state.waveState !== 'upgrade' || state.embers <= 0) return false;
      state.banked += state.embers;
      state.scoreMult += state.embers * BANK_RATE;
      state.score += state.embers * BANK_SCORE_PER_EMBER;
      state.embers = 0;
      audio.upgrade();
      world.nextWave();
      return true;
    },

    // What an enemy uses to shoot back at the Keeper.
    spawnEnemyBullet(x, y, vx, vy) {
      state.enemyBullets.push({ x, y, vx, vy, life: 6, radius: 6 });
    },
    // What a boss uses to summon help.
    spawnEnemy(kind, x, y, elite) {
      state.enemies.push(createEnemy(kind, x, y, rng, state.wave, elite));
    },
    onBossAttack() {
      effects.shake(3, 0.2);
    },

    step(dt, ctrl) {
      if (state.runOver || state.waveState === 'upgrade') return 0;
      if (effects.frozen) {
        effects.tickFreeze(dt);
        return 0;
      }
      if (state.pilot) ctrl = state.pilot(state);
      if (!ctrl) return 0;
      let events = 0;
      state.time += dt;
      state.waveTime += dt;
      if (state.bannerT > 0) state.bannerT -= dt;
      if (state.comboT > 0) {
        state.comboT -= dt;
        if (state.comboT <= 0) state.combo = 0;
      }
      const p = state.player;

      events |= stepPlayer(dt, ctrl);
      events |= stepBullets(dt);
      events |= stepEnemies(dt);
      events |= stepEnemyBullets(dt);
      events |= stepEmbers(dt);
      events |= stepPickups(dt);
      events |= stepSpawns(dt);
      events |= checkWaveEnd();
      return events;
    },
  };

  function stepPlayer(dt, ctrl) {
    const p = state.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.spreadTimer > 0) p.spreadTimer -= dt;
    if (p.shieldTimer > 0) p.shieldTimer -= dt;
    p.fireTimer -= dt;

    const mx = ctrl.mx || 0;
    const my = ctrl.my || 0;
    p.angle = Math.atan2((ctrl.aimY || 0) - p.y, (ctrl.aimX || 0) - p.x);

    if (ctrl.dash && p.dashCd <= 0 && (mx !== 0 || my !== 0)) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCd = p.dashCooldown;
      p.dashX = mx;
      p.dashY = my;
      p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.06);
      effects.ring(p.x, p.y, COLORS.playerGlow, 46);
      audio.dash();
    }
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashX * PLAYER.dashSpeed;
      p.vy = p.dashY * PLAYER.dashSpeed;
    } else {
      p.vx += mx * PLAYER.accel * dt;
      p.vy += my * PLAYER.accel * dt;
      const damp = Math.max(0, 1 - PLAYER.friction * dt);
      p.vx *= damp;
      p.vy *= damp;
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > p.speed) {
        p.vx = (p.vx / spd) * p.speed;
        p.vy = (p.vy / spd) * p.speed;
      }
    }
    p.x = Math.min(VIEW.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
    p.y = Math.min(VIEW.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));

    if (ctrl.firing && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      const shots = p.spreadTimer > 0 ? p.projectiles + 2 : p.projectiles;
      for (let i = 0; i < shots; i += 1) {
        const off = (i - (shots - 1) / 2) * 0.1;
        const a = p.angle + off;
        state.bullets.push({
          x: p.x + Math.cos(a) * (p.radius + 6),
          y: p.y + Math.sin(a) * (p.radius + 6),
          vx: Math.cos(a) * PLAYER.bulletSpeed,
          vy: Math.sin(a) * PLAYER.bulletSpeed,
          life: BULLET_LIFE,
          pierce: p.pierce,
          damage: p.damage,
          radius: PLAYER.bulletRadius,
        });
      }
      state.shotsFired += 1;
      audio.shoot();
      effects.burst(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, COLORS.bullet, 2, 90, 0.18, 2);
    }
    return 0;
  }

  function stepBullets(dt) {
    let events = 0;
    const bullets = state.bullets;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          const rr = e.radius + b.radius;
          if (Math.abs(e.x - b.x) < rr && Math.abs(e.y - b.y) < rr && Math.hypot(e.x - b.x, e.y - b.y) < rr) {
            e.hp -= b.damage;
            e.flash = 0.09;
            state.shotsHit += 1;
            effects.burst(b.x, b.y, e.color, 4, 160, 0.3, 2.5);
            effects.text(b.x, b.y - 10, String(b.damage), '#fff', 13);
            audio.hit();
            if (e.hp <= 0) killEnemy(j);
            if (b.pierce > 0) b.pierce -= 1;
            else dead = true;
            break;
          }
        }
      }
      if (dead) {
        bullets[i] = bullets[bullets.length - 1];
        bullets.pop();
      }
    }
    return events;
  }

  function killEnemy(index) {
    const e = state.enemies[index];
    state.enemies[index] = state.enemies[state.enemies.length - 1];
    state.enemies.pop();
    state.kills += 1;
    const waveMult = 1 + 0.1 * (state.wave - 1);
    const gained = Math.round(e.score * waveMult * state.scoreMult);
    state.score += gained;
    effects.text(e.x, e.y - e.radius - 6, `+${gained}`, COLORS.emberHot, e.boss ? 22 : 15);
    effects.burst(e.x, e.y, e.color, e.boss ? 46 : e.elite ? 26 : 14, e.boss ? 320 : 220, 0.7, 3.5);
    effects.smoke(e.x, e.y, e.boss ? 12 : 4);
    audio.die(e.boss || e.elite);
    if (e.elite) effects.hitStop(0.05);
    if (e.boss) {
      effects.hitStop(0.14);
      effects.shake(10, 0.5);
      effects.ring(e.x, e.y, e.color, 200);
      state.boss = null;
    } else if (e.elite) {
      effects.shake(5, 0.3);
    }
    // Embers scatter out, then drift back to the Keeper.
    for (let i = 0; i < e.embers; i += 1) {
      const a = rng.angle();
      const v = rng.range(60, 190);
      state.emberDrops.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rng.range(0, 6), value: EMBER_VALUE });
    }
    // Pickups: elites always drop one; others sometimes, when it matters.
    const dropRoll = rng.next();
    const p = state.player;
    if (e.elite || e.boss) {
      dropPickup(e.x, e.y, e.boss ? 'heart' : rng.pick(['heart', 'spread', 'shield']));
    } else if (dropRoll < 0.05 && p.hp < p.maxHp) {
      dropPickup(e.x, e.y, 'heart');
    } else if (dropRoll < 0.12) {
      dropPickup(e.x, e.y, 'spread');
    } else if (dropRoll < 0.17) {
      dropPickup(e.x, e.y, 'shield');
    }
  }

  function dropPickup(x, y, kind) {
    state.pickups.push({ kind, x, y, t: 0, life: 14 });
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      updateEnemy(e, world, dt);
      e.x = Math.min(VIEW.width - e.radius, Math.max(e.radius, e.x));
      e.y = Math.min(VIEW.height - e.radius, Math.max(e.radius, e.y));
      const rr = e.radius + p.radius - 2;
      if (Math.hypot(e.x - p.x, e.y - p.y) < rr) {
        hurtPlayer(e.damage, e);
        // Shove the enemy back so one touch is not a chain of touches.
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.x = p.x + Math.cos(a) * rr;
        e.y = p.y + Math.sin(a) * rr;
      }
    }
    return 0;
  }

  function stepEnemyBullets(dt) {
    const p = state.player;
    const list = state.enemyBullets;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const b = list[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20;
      if (!dead && Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius - 2) {
        hurtPlayer(1, null);
        dead = true;
      }
      if (dead) {
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
    return 0;
  }

  function hurtPlayer(damage, from) {
    const p = state.player;
    if (p.invuln > 0 || p.shieldTimer > 0 || p.dashTimer > 0 || state.runOver) return;
    p.hp -= damage;
    p.invuln = PLAYER.invulnAfterHit;
    state.combo = 0;
    state.comboT = 0;
    effects.shake(8, 0.35);
    effects.burst(p.x, p.y, COLORS.hp, 16, 240, 0.6, 3);
    audio.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      state.runOver = true;
      effects.burst(p.x, p.y, COLORS.playerGlow, 60, 380, 1.1, 4);
      effects.smoke(p.x, p.y, 14);
      effects.shake(12, 0.6);
      audio.gameOver();
    }
  }

  function stepEmbers(dt) {
    const p = state.player;
    const list = state.emberDrops;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const m = list[i];
      m.t += dt;
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.emberMagnet) {
        const pull = 620 * (1 - d / (p.emberMagnet + 60));
        m.vx += (dx / d) * pull * dt * 6;
        m.vy += (dy / d) * pull * dt * 6;
      } else {
        const damp = Math.max(0, 1 - 2.4 * dt);
        m.vx *= damp;
        m.vy *= damp;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (d < p.pickupRadius * 0.55) {
        state.embers += m.value;
        state.combo += 1;
        state.comboT = COMBO_WINDOW;
        state.score += 2;
        effects.burst(m.x, m.y, COLORS.ember, 3, 90, 0.25, 2);
        audio.pickup(state.combo);
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
    return 0;
  }

  function stepPickups(dt) {
    const p = state.player;
    const list = state.pickups;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const pk = list[i];
      pk.t += dt;
      pk.life -= dt;
      if (pk.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < p.pickupRadius * 0.6) {
        if (pk.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 1);
          effects.text(p.x, p.y - 26, '+1 HP', '#ff8fb0', 16);
          audio.heart();
        } else if (pk.kind === 'spread') {
          p.spreadTimer = 12;
          effects.text(p.x, p.y - 26, 'SPREAD SHOT!', '#ffd23c', 16);
          audio.upgrade();
        } else {
          p.shieldTimer = 5;
          effects.text(p.x, p.y - 26, 'SHIELD!', '#57e6c9', 16);
          audio.upgrade();
        }
        effects.ring(p.x, p.y, '#ffffff', 50);
        list.splice(i, 1);
      }
    }
    return 0;
  }

  function stepSpawns(dt) {
    if (state.waveState !== 'fighting') return 0;
    state.spawnTimer -= dt;
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].delay <= state.waveTime) {
      const item = state.spawnQueue.shift();
      const at = spawnPoint(rng, state.player);
      state.enemies.push(createEnemy(item.kind, at.x, at.y, rng, state.wave, item.elite));
    }
    return 0;
  }

  function checkWaveEnd() {
    if (state.runOver) return state.victory ? EVENT_VICTORY : EVENT_OVER;
    if (state.waveState !== 'fighting') return 0;
    if (state.spawnQueue.length > 0 || state.enemies.length > 0) return 0;
    // The wave is clear.
    const bonus = 250 * state.wave;
    state.score += bonus;
    if (state.wave >= WAVE_COUNT) {
      state.runOver = true;
      state.victory = true;
      state.waveState = 'done';
      audio.victory();
      return EVENT_VICTORY;
    }
    state.waveState = 'upgrade';
    state.offers = rollUpgrades(rng, state.embers);
    state.banner = `WAVE ${state.wave} CLEAR  +${bonus}`;
    state.bannerT = 2.0;
    audio.waveClear();
    return EVENT_WAVE_CLEAR;
  }

  return world;
}
