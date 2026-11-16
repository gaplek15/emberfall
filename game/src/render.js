// Everything the eye sees: the ash field, the Keeper, the swarm, the HUD and
// every screen. The renderer only reads world state — it never writes it —
// and every picture is drawn in code: pre-rendered glow sprites, vector
// shapes, no image files anywhere.
import { COLORS, VIEW } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
// The upgrade cards' rectangles, so clicks land on what the eye sees. The
// main loop uses these same numbers for hit-testing.
export const UPGRADE_LAYOUT = {
  cards: [
    { x: 170, y: 300, w: 280, h: 210 },
    { x: 500, y: 300, w: 280, h: 210 },
    { x: 830, y: 300, w: 280, h: 210 },
  ],
  bank: { x: 440, y: 540, w: 400, h: 64 },
};

// Drifting ash motes: fixed positions from a fixed seed, so the background
// is the same on every load and every screenshot.
const MOTES = (() => {
  const rng = createRandom(1337);
  const list = [];
  for (let i = 0; i < 70; i += 1) {
    list.push({ x: rng.range(0, VIEW.width), y: rng.range(0, VIEW.height), r: rng.range(1, 2.6), s: rng.range(4, 16), p: rng.range(0, Math.PI * 2) });
  }
  return list;
})();

function makeGlow(color) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function createRenderer(canvas, effects) {
  const ctx = canvas.getContext('2d');
  const glowOrange = makeGlow('rgba(255, 154, 60, 0.85)');
  const glowRed = makeGlow('rgba(255, 60, 60, 0.8)');
  const glowPurple = makeGlow('rgba(182, 120, 240, 0.8)');
  const glowGold = makeGlow('rgba(255, 196, 107, 0.9)');
  const glowTeal = makeGlow('rgba(87, 230, 201, 0.8)');

  function drawGlow(sprite, x, y, size, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawBackground(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, COLORS.bgTop);
    grad.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 80; x < VIEW.width; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.height); ctx.stroke();
    }
    for (let y = 80; y < VIEW.height; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW.width, y); ctx.stroke();
    }
    // Ash motes drifting down, slow and endless.
    ctx.fillStyle = 'rgba(255, 190, 120, 0.35)';
    for (const m of MOTES) {
      const y = (m.y + time * m.s) % (VIEW.height + 8);
      ctx.globalAlpha = 0.18 + 0.16 * Math.sin(time * 0.7 + m.p);
      ctx.beginPath();
      ctx.arc(m.x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(state) {
    for (const m of state.emberDrops) {
      const flicker = 0.75 + 0.25 * Math.sin(m.t * 9);
      drawGlow(glowOrange, m.x, m.y, 26 * flicker, 0.8);
      ctx.fillStyle = COLORS.emberHot;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.t * 3) * 3;
      const blink = pk.life < 3 ? (Math.sin(pk.t * 12) > 0 ? 1 : 0.35) : 1;
      ctx.globalAlpha = blink;
      const y = pk.y + bob;
      if (pk.kind === 'heart') {
        drawGlow(glowRed, pk.x, y, 52);
        drawHeart(pk.x, y, 11, '#ff5d8f');
      } else if (pk.kind === 'spread') {
        drawGlow(glowGold, pk.x, y, 52);
        ctx.fillStyle = '#ffd23c';
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.arc(pk.x + i * 9, y + Math.abs(i) * 4, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        drawGlow(glowTeal, pk.x, y, 52);
        ctx.strokeStyle = '#57e6c9';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pk.x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pk.x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.2, y, x, y + s * 0.9);
    ctx.fill();
  }

  function drawEnemy(e, time) {
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : e.color;
    if (e.kind === 'cinder') {
      drawGlow(glowRed, e.x, e.y, e.radius * 5, 0.8);
      ctx.fillStyle = body;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + e.t * 0.8;
        const r = i % 2 === 0 ? e.radius + 7 : e.radius - 2;
        const px = e.x + Math.cos(a) * r;
        const py = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // A hot core, so the wisp reads at a glance even shrunk small.
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0d0d';
      ctx.beginPath(); ctx.arc(e.x - 4, e.y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 4, e.y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'spitter') {
      drawGlow(glowPurple, e.x, e.y, e.radius * 5, 0.8);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.radius - 4);
      ctx.lineTo(e.x + e.radius, e.y);
      ctx.lineTo(e.x, e.y + e.radius + 4);
      ctx.lineTo(e.x - e.radius, e.y);
      ctx.closePath();
      ctx.fill();
      const open = Math.max(0.3, 1 - e.fireTimer / 2.3);
      ctx.fillStyle = '#2a1140';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4 + open * 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'brute') {
      drawGlow(glowOrange, e.x, e.y, e.radius * 4.6, 0.75);
      ctx.fillStyle = body;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const px = e.x + Math.cos(a) * e.radius;
        const py = e.y + Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 16, 4, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x - 10, e.y - 6); ctx.lineTo(e.x + 2, e.y + 4); ctx.lineTo(e.x + 12, e.y - 8); ctx.stroke();
      ctx.fillStyle = '#2a0e02';
      ctx.beginPath(); ctx.arc(e.x - 7, e.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 7, e.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      if (e.state === 'telegraph') {
        ctx.strokeStyle = 'rgba(255, 90, 60, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 8 + Math.sin(e.t * 30) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.kind === 'boss') {
      drawGlow(glowRed, e.x, e.y, e.radius * 4.6, 0.7);
      // Horns / crown spikes.
      ctx.fillStyle = flash ? '#fff' : '#7d1f2e';
      for (let i = -2; i <= 2; i += 1) {
        const a = -Math.PI / 2 + i * 0.42;
        const bx = e.x + Math.cos(a) * e.radius * 0.85;
        const by = e.y + Math.sin(a) * e.radius * 0.85;
        const tx = e.x + Math.cos(a) * (e.radius + 20);
        const ty = e.y + Math.sin(a) * (e.radius + 20);
        ctx.beginPath();
        ctx.moveTo(bx - 8, by + 6);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx + 8, by - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      // A slow-turning inner ring and a burning core.
      ctx.strokeStyle = 'rgba(255, 196, 107, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.62, e.t * 0.9, e.t * 0.9 + Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#ffdf9e';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.28 + Math.sin(e.t * 5) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0505';
      ctx.beginPath(); ctx.arc(e.x - 14, e.y - 8, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 14, e.y - 8, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    if (e.elite) {
      ctx.strokeStyle = 'rgba(255, 196, 107, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 9, time * 1.6, time * 1.6 + Math.PI * 1.4);
      ctx.stroke();
    }
    // A small health bar over anything hurt and anything elite or boss.
    if ((e.hp < e.maxHp && !e.boss) || e.elite) {
      const w = e.radius * 2;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 13, w, 5);
      ctx.fillStyle = e.elite ? '#ffc46b' : '#ff5d73';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 13, w * frac, 5);
    }
  }

  function drawPlayer(state, time) {
    const p = state.player;
    const blink = p.invuln > 0 && p.dashTimer <= 0 ? (Math.sin(time * 30) > 0 ? 1 : 0.35) : 1;
    ctx.globalAlpha = blink;
    drawGlow(glowGold, p.x, p.y, 150, 0.9);
    // A faint ring always marks the Keeper, so the eye finds it at once.
    ctx.strokeStyle = 'rgba(255, 233, 196, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
    // Dash recharge ring under the Keeper.
    if (p.dashCd > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = COLORS.playerGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCd / p.dashCooldown));
      ctx.stroke();
    }
    // The lantern: a warm body, a flame heart, a handle arc.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, 9, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    const flick = 1 + Math.sin(time * 11) * 0.12;
    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 11 * flick);
    ctx.bezierCurveTo(p.x + 7, p.y - 2, p.x + 4, p.y + 7, p.x, p.y + 7);
    ctx.bezierCurveTo(p.x - 4, p.y + 7, p.x - 7, p.y - 2, p.x, p.y - 11 * flick);
    ctx.fill();
    // A short aim tick toward the mouse.
    ctx.strokeStyle = 'rgba(255, 233, 196, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * (p.radius + 4), p.y + Math.sin(p.angle) * (p.radius + 4));
    ctx.lineTo(p.x + Math.cos(p.angle) * (p.radius + 14), p.y + Math.sin(p.angle) * (p.radius + 14));
    ctx.stroke();
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = 'rgba(87, 230, 201, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, time * 2, time * 2 + Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBullets(state) {
    ctx.lineCap = 'round';
    for (const b of state.bullets) {
      const len = Math.hypot(b.vx, b.vy) || 1;
      const tx = (b.vx / len) * 24;
      const ty = (b.vy / len) * 24;
      drawGlow(glowGold, b.x, b.y, 26, 0.85);
      ctx.strokeStyle = COLORS.bullet;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x - tx, b.y - ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - tx * 0.6, b.y - ty * 0.6);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const b of state.enemyBullets) {
      drawGlow(glowRed, b.x, b.y, 26, 0.8);
      ctx.fillStyle = COLORS.enemyBullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd9c9';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(state, view) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(String(state.score).padStart(6, '0'), 24, 46);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(view.best, state.score)}`, 24, 68);
    if (state.combo > 2) {
      ctx.fillStyle = COLORS.emberHot;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`EMBER CHAIN x${state.combo}`, 24, 90);
    }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(state.wave > 0 ? `WAVE ${state.wave} / 10` : 'EMBERFALL', VIEW.width / 2, 40);
    // Boss bar under the wave line.
    if (state.boss) {
      const b = state.boss;
      const w = 420;
      const frac = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(VIEW.width / 2 - w / 2, 52, w, 12);
      ctx.fillStyle = COLORS.bossBar;
      ctx.fillRect(VIEW.width / 2 - w / 2, 52, w * frac, 12);
      ctx.fillStyle = COLORS.text;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(b.name, VIEW.width / 2, 82);
    }
    // Embers, top right.
    ctx.textAlign = 'right';
    drawGlow(glowOrange, VIEW.width - 118, 34, 34, 0.9);
    ctx.fillStyle = COLORS.emberHot;
    ctx.beginPath();
    ctx.arc(VIEW.width - 118, 34, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`${state.embers}`, VIEW.width - 96, 43);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`BANKED ${state.banked}  ·  SCORE x${state.scoreMult.toFixed(2)}`, VIEW.width - 24, 66);
    // Hearts, bottom left. More than ten hearts are shown as ten plus a count.
    const heartsShown = Math.min(p.maxHp, 10);
    for (let i = 0; i < heartsShown; i += 1) {
      const x = 34 + i * 30;
      const y = VIEW.height - 32;
      if (i < p.hp) drawHeart(x, y, 11, COLORS.hp);
      else {
        ctx.fillStyle = COLORS.hpEmpty;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (p.maxHp > 10) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`+${p.maxHp - 10}`, 34 + heartsShown * 30, VIEW.height - 27);
    }
    // Active effects and dash, bottom right.
    ctx.textAlign = 'right';
    ctx.font = `700 15px ${FONT}`;
    let line = VIEW.height - 28;
    if (p.spreadTimer > 0) {
      ctx.fillStyle = '#ffd23c';
      ctx.fillText(`SPREAD ${Math.ceil(p.spreadTimer)}s`, VIEW.width - 24, line);
      line -= 22;
    }
    if (p.shieldTimer > 0) {
      ctx.fillStyle = '#57e6c9';
      ctx.fillText(`SHIELD ${Math.ceil(p.shieldTimer)}s`, VIEW.width - 24, line);
      line -= 22;
    }
    ctx.fillStyle = p.dashCd <= 0 ? COLORS.playerGlow : COLORS.textDim;
    ctx.fillText(p.dashCd <= 0 ? 'DASH READY  [SPACE]' : `DASH ${p.dashCd.toFixed(1)}s`, VIEW.width - 24, line);
    // Wave banner, centre, fading with its timer.
    if (state.bannerT > 0 && state.banner) {
      const a = Math.min(1, state.bannerT / 0.6);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.emberHot;
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(state.banner, VIEW.width / 2, 190);
      ctx.globalAlpha = 1;
    }
    // Low health: the edges of the world burn.
    if (p.hp > 0 && p.hp <= 2 && state.waveState === 'fighting') {
      const pulse = 0.16 + 0.1 * Math.sin(state.time * 5);
      const vg = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.78);
      vg.addColorStop(0, 'rgba(255, 40, 60, 0)');
      vg.addColorStop(1, `rgba(255, 40, 60, ${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (view.muted) {
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText('MUTED  [M]', 24, VIEW.height - 56);
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  function drawTitle(state, view) {
    ctx.fillStyle = 'rgba(8, 5, 12, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    drawGlow(glowOrange, VIEW.width / 2, 218, 260, 0.55);
    ctx.fillStyle = COLORS.emberHot;
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText('EMBERFALL', VIEW.width / 2, 250);
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Hold the light. Spend the embers. Survive ten waves.', VIEW.width / 2, 292);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText('WASD move  ·  mouse aim  ·  hold click to shoot  ·  SPACE dash  ·  P pause  ·  M mute', VIEW.width / 2, 336);
    ctx.fillText('Embers buy upgrades between waves — or bank them for +2% score each, forever.', VIEW.width / 2, 364);
    ctx.fillStyle = COLORS.emberHot;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', VIEW.width / 2, 440);
    if (view.best > 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `600 17px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${view.best}`, VIEW.width / 2, 478);
    }
  }

  function drawUpgrade(state, view) {
    ctx.fillStyle = 'rgba(8, 5, 12, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.emberHot;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('THE EMBERS ARE YOURS', VIEW.width / 2, 130);
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText(`Wave ${state.wave} clear. You carry ${state.embers} embers — spend them, or bank them all.`, VIEW.width / 2, 168);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText('Pick one upgrade, or bank every ember for a permanent +2% score each.', VIEW.width / 2, 196);
    state.offers.forEach((offer, i) => {
      const r = UPGRADE_LAYOUT.cards[i];
      const ok = offer.affordable;
      panel(r.x, r.y, r.w, r.h);
      ctx.fillStyle = ok ? COLORS.emberHot : COLORS.textDim;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 30);
      ctx.fillStyle = COLORS.text;
      ctx.font = `700 21px ${FONT}`;
      ctx.fillText(offer.name, r.x + r.w / 2, r.y + 64);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `500 15px ${FONT}`;
      wrapText(offer.desc, r.x + 20, r.y + 96, r.w - 40, 20);
      ctx.fillStyle = ok ? COLORS.emberHot : '#8a7a68';
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText(`${offer.cost} EMBERS`, r.x + r.w / 2, r.y + r.h - 24);
      if (!ok) {
        ctx.fillStyle = '#8a7a68';
        ctx.font = `600 13px ${FONT}`;
        ctx.fillText('NOT ENOUGH EMBERS', r.x + r.w / 2, r.y + r.h - 48);
      }
    });
    const b = UPGRADE_LAYOUT.bank;
    const canBank = state.embers > 0;
    panel(b.x, b.y, b.w, b.h);
    ctx.fillStyle = canBank ? COLORS.text : COLORS.textDim;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(`[B]  BANK ALL ${state.embers} EMBERS  →  +${Math.round(state.embers * 2)}% SCORE, FOREVER`, b.x + b.w / 2, b.y + 40);
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  function drawStats(state, view, title, subtitle) {
    ctx.fillStyle = 'rgba(8, 5, 12, 0.88)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.emberHot;
    ctx.font = `800 54px ${FONT}`;
    ctx.fillText(title, VIEW.width / 2, 190);
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(subtitle, VIEW.width / 2, 228);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
    const rows = [
      ['SCORE', String(state.score)],
      ['BEST', String(Math.max(view.best, state.score))],
      ['WAVE REACHED', `${Math.min(state.wave, 10)} / 10`],
      ['WISPS SHATTERED', String(state.kills)],
      ['EMBERS BANKED', `${state.banked}  (x${state.scoreMult.toFixed(2)} score)`],
      ['TIME', `${minutes}:${seconds}`],
      ['ACCURACY', `${accuracy}%`],
    ];
    ctx.font = `600 19px ${FONT}`;
    rows.forEach((row, i) => {
      const y = 290 + i * 32;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(row[0], VIEW.width / 2 - 16, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(row[1], VIEW.width / 2 + 16, y);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.emberHot;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('PRESS ENTER OR CLICK TO PLAY AGAIN', VIEW.width / 2, 560);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 5, 12, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 54px ${FONT}`;
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('P or click to keep going  ·  M to mute', VIEW.width / 2, 372);
  }

  function drawWorld(state, time) {
    drawBackground(time);
    drawEmbers(state);
    drawPickups(state);
    for (const e of state.enemies) drawEnemy(e, time);
    if (!state.runOver || state.victory) drawPlayer(state, time);
    drawBullets(state);
  }

  return {
    draw(state, screen, view) {
      const time = state.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.translate(effects.shakeX, effects.shakeY);
      drawWorld(state, time);
      effects.draw(ctx);
      ctx.restore();
      // The HUD stays steady while the world shakes.
      drawHud(state, view);
      if (screen === SCREEN_TITLE) drawTitle(state, view);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(state, view);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawStats(state, view, 'THE LIGHT GOES OUT', `The swarm takes wave ${state.wave}.`);
      else if (screen === SCREEN_VICTORY) drawStats(state, view, 'THE FIELD IS YOURS', 'Ten waves. Two bosses. The light holds.');
      // A soft vignette over everything, for depth.
      const vg = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
      vg.addColorStop(0, 'rgba(5, 3, 8, 0)');
      vg.addColorStop(1, COLORS.vignette);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    },
  };
}
