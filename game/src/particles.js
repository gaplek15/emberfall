// The juice: pooled particles, floating damage numbers, expanding rings,
// screen shake and hit-stop. One fixed pool, no allocation in the hot loop,
// so the frame rate never pays for the fireworks.
const MAX_PARTICLES = 420;

export function createEffects() {
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', kind: 'spark', text: '', drag: 0, gravity: 0 });
  }
  let shakeTime = 0;
  let shakePower = 0;
  let freezeTimer = 0;
  let shakeX = 0;
  let shakeY = 0;

  function spawnOne() {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (!pool[i].active) return pool[i];
    }
    return null;
  }

  return {
    get shakeX() { return shakeX; },
    get shakeY() { return shakeY; },
    get frozen() { return freezeTimer > 0; },

    // A burst of sparks flying out of (x, y). count, speed and life vary.
    burst(x, y, color, count, speed, life = 0.55, size = 3) {
      for (let n = 0; n < count; n += 1) {
        const p = spawnOne();
        if (!p) return;
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.65);
        p.active = true;
        p.kind = 'spark';
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.maxLife = life * (0.6 + Math.random() * 0.8);
        p.life = p.maxLife;
        p.size = size * (0.6 + Math.random() * 0.8);
        p.color = color;
        p.drag = 3.2;
        p.gravity = 0;
      }
    },
    // Slow smoke that rises and fades, for deaths and the boss.
    smoke(x, y, count, color = 'rgba(120, 100, 130, 0.5)') {
      for (let n = 0; n < count; n += 1) {
        const p = spawnOne();
        if (!p) return;
        p.active = true;
        p.kind = 'smoke';
        p.x = x + (Math.random() - 0.5) * 20;
        p.y = y + (Math.random() - 0.5) * 20;
        p.vx = (Math.random() - 0.5) * 24;
        p.vy = -20 - Math.random() * 30;
        p.maxLife = 0.9 + Math.random() * 0.7;
        p.life = p.maxLife;
        p.size = 6 + Math.random() * 8;
        p.color = color;
        p.drag = 0.4;
        p.gravity = 0;
      }
    },
    // A thin ring that grows and fades: dashes, boss spawns, wave clears.
    ring(x, y, color, size = 60) {
      const p = spawnOne();
      if (!p) return;
      p.active = true;
      p.kind = 'ring';
      p.x = x; p.y = y;
      p.vx = 0; p.vy = 0;
      p.maxLife = 0.5;
      p.life = 0.5;
      p.size = size;
      p.color = color;
      p.drag = 0;
      p.gravity = 0;
    },
    // Floating text that rises and fades: damage numbers, +score, pickups.
    text(x, y, str, color = '#ffe9c4', size = 15) {
      const p = spawnOne();
      if (!p) return;
      p.active = true;
      p.kind = 'text';
      p.x = x; p.y = y;
      p.vx = 0; p.vy = -46;
      p.maxLife = 0.9;
      p.life = 0.9;
      p.size = size;
      p.color = color;
      p.text = str;
      p.drag = 0;
      p.gravity = 0;
    },
    // A short, sharp shake. Bigger hits shake harder.
    shake(power, time = 0.25) {
      shakePower = Math.max(shakePower, power);
      shakeTime = Math.max(shakeTime, time);
    },
    // Freeze the simulation briefly: the punch behind a big kill.
    hitStop(seconds) {
      freezeTimer = Math.max(freezeTimer, seconds);
    },
    // Spend frozen time. The world calls this from its own step so a
    // hit-stop ends even where nothing else advances the effects — a
    // screenshot staging loop, for example, would otherwise freeze forever.
    tickFreeze(dt) {
      if (freezeTimer > 0) freezeTimer -= dt;
    },
    update(dt) {
      if (freezeTimer > 0) freezeTimer -= dt;
      if (shakeTime > 0) {
        shakeTime -= dt;
        const s = shakePower * (shakeTime > 0 ? shakeTime / 0.25 : 0);
        shakeX = (Math.random() - 0.5) * 2 * s;
        shakeY = (Math.random() - 0.5) * 2 * s;
      } else {
        shakeX = 0;
        shakeY = 0;
        shakePower = 0;
      }
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = pool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.drag > 0) {
          const d = Math.max(0, 1 - p.drag * dt);
          p.vx *= d;
          p.vy *= d;
        }
        p.vy += p.gravity * dt;
        if (p.kind === 'smoke') p.size += 14 * dt;
      }
    },
    draw(ctx) {
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = pool[i];
        if (!p.active) continue;
        const t = p.life / p.maxLife;
        if (p.kind === 'spark') {
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * t), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'smoke') {
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'ring') {
          const grown = p.size * (1 + (1 - t) * 1.6);
          ctx.globalAlpha = t * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, grown, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'text') {
          ctx.globalAlpha = Math.min(1, t * 1.6);
          ctx.font = `700 ${p.size}px "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
