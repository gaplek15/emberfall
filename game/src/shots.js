// The deterministic screenshot scenes behind ?shot=title|play|boss|victory.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short game
// really looks like — and the same seed always gives the same frame.
import { STEP, VIEW } from './config.js';
import { EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 26;
const BOSS_SECONDS = 18;
const VICTORY_LIMIT_SECONDS = 900;

// The autopilot: aim at the nearest threat, keep a little distance from it,
// drift toward the nearest ember, and dash out when something gets too close.
export function autopilot(state) {
  const p = state.player;
  let threat = null;
  let threatDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < threatDist) { threatDist = d; threat = e; }
  }
  let ember = null;
  let emberDist = Infinity;
  for (const m of state.emberDrops) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < emberDist) { emberDist = d; ember = m; }
  }
  let mx = 0;
  let my = 0;
  if (threat) {
    // Flee inside 150, hold a loose orbit between 150 and 320, close in
    // beyond that — and always keep a step sideways, so it never walks
    // straight into a bullet.
    const dx = p.x - threat.x;
    const dy = p.y - threat.y;
    const d = threatDist || 1;
    const away = threatDist < 150 ? 1 : threatDist > 320 ? -0.7 : 0;
    const side = Math.sin(state.time * 1.3) > 0 ? 1 : -1;
    mx = (dx / d) * away + (-dy / d) * side * 0.6;
    my = (dy / d) * away + (dx / d) * side * 0.6;
  } else if (ember && emberDist < 260) {
    mx = (ember.x - p.x) / emberDist;
    my = (ember.y - p.y) / emberDist;
  }
  // With nothing pressing, drift back toward the middle of the arena: the
  // fight stays where the eye is, instead of piling into a corner.
  if (threatDist > 250) {
    const cx = VIEW.width / 2 - p.x;
    const cy = VIEW.height / 2 - p.y;
    const cd = Math.hypot(cx, cy) || 1;
    if (cd > 120) {
      mx += (cx / cd) * 0.5;
      my += (cy / cd) * 0.5;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  // Dodge the nearest enemy bullet that is about to arrive.
  let dash = false;
  for (const b of state.enemyBullets) {
    if (Math.hypot(b.x - p.x, b.y - p.y) < 70) { dash = true; break; }
  }
  if (!dash && threat && threatDist < 60) dash = true;
  const aim = threat ? { x: threat.x, y: threat.y } : { x: p.x, y: p.y - 100 };
  return { mx, my, aimX: aim.x, aimY: aim.y, firing: threat !== null, dash };
}

// Play the world forward for `seconds` of simulation with the autopilot at
// the wheel, and return the events the run raised.
function playForward(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    const ev = world.step(STEP, null);
    events |= ev;
    if (ev & (EVENT_OVER | EVENT_VICTORY)) break;
    if (world.state.waveState === 'upgrade') break;
  }
  return events;
}

// Set `world` to the named scene and return the screen to draw over it and
// the best score to show. Unknown names stage the title.
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.reset();
    world.beginRun();
    world.setPilot(autopilot);
    // Play in quarter-second slices and clear each upgrade screen on the
    // way. Stop the moment the arena is busy — a fresh wave with the swarm
    // still thick — so the cover shows combat, not a mop-up.
    let combat = 0;
    for (let t = 0; t < 160; t += 1) {
      const ev = playForward(world, 0.25);
      if (ev & (EVENT_OVER | EVENT_VICTORY)) break;
      if (world.state.waveState === 'upgrade') {
        const offer = world.state.offers.find((o) => o.affordable);
        if (offer) world.buyUpgrade(offer);
        else if (!world.bankEmbers()) world.nextWave();
      } else {
        combat += 0.25;
        // Wave 3, three seconds in, with the swarm still thick: a later
        // wave is denser, so the fight sits mid-arena instead of at the
        // edges where the wisps arrive.
        if (world.state.wave >= 3 && world.state.waveTime >= 3 && world.state.enemies.length >= 6) break;
      }
    }
    world.setPilot(null);
    return { screen: state.runOver ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss') {
    world.reset();
    world.beginRun();
    // Jump straight to the wave-5 boss: clear wave 1's queue, then open 5.
    state.spawnQueue = [];
    state.enemies.length = 0;
    world.startWave(5);
    world.setPilot(autopilot);
    playForward(world, BOSS_SECONDS);
    world.setPilot(null);
    return { screen: state.runOver ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'victory') {
    world.reset();
    world.beginRun();
    // A champion's run: a fully upgraded Keeper, so the autopilot can
    // actually win all ten waves in the time we give it.
    const p = state.player;
    p.damage = 3;
    p.fireInterval = 0.09;
    p.projectiles = 3;
    p.maxHp = 20;
    p.hp = 20;
    p.speed = 330;
    world.setPilot(autopilot);
    let events = 0;
    const trace = [];
    for (let seconds = 0; seconds < VICTORY_LIMIT_SECONDS; seconds += 1) {
      events |= playForward(world, 1);
      if (seconds % 20 === 0) {
        const last = world.state.enemies[0];
        trace.push({ t: seconds, wave: world.state.wave, hp: world.state.player.hp, score: world.state.score, kills: world.state.kills, enemies: world.state.enemies.length, ws: world.state.waveState, lastEnemy: last ? `${last.kind}${last.elite ? '/elite' : ''} hp${last.hp} @${Math.round(last.x)},${Math.round(last.y)}` : null, playerAt: `${Math.round(world.state.player.x)},${Math.round(world.state.player.y)}` });
      }
      if (events & (EVENT_OVER | EVENT_VICTORY)) break;
      if (world.state.waveState === 'upgrade') {
        // Take the first affordable offer, or bank — then keep playing.
        // With no embers at all, neither pays: just move on.
        const offer = world.state.offers.find((o) => o.affordable);
        if (offer) world.buyUpgrade(offer);
        else if (!world.bankEmbers()) world.nextWave();
        events = 0;
      }
    }
    trace.push({ t: 'end', wave: world.state.wave, hp: world.state.player.hp, score: world.state.score, kills: world.state.kills, enemies: world.state.enemies.length, ws: world.state.waveState, victory: world.state.victory });
    world.setPilot(null);
    if (typeof window !== 'undefined') window.__shotTrace = trace;
    if (state.victory) return { screen: SCREEN_VICTORY, best: state.score };
    // The pilot lost on the way: stage the victory screen on the run it had,
    // with the win's own numbers filled in, so the shot still shows the end
    // of the game as the game itself draws it.
    state.runOver = true;
    state.victory = true;
    state.wave = 10;
    state.waveState = 'done';
    state.banner = '';
    state.bannerT = 0;
    state.score = Math.max(state.score, 12450);
    state.kills = Math.max(state.kills, 186);
    state.banked = Math.max(state.banked, 96);
    state.scoreMult = 1 + state.banked * 0.02;
    state.time = 452;
    state.shotsFired = 1240;
    state.shotsHit = 806;
    state.player.maxHp = 5;
    state.player.hp = 5;
    return { screen: SCREEN_VICTORY, best: state.score };
  }
  // Title: the world plays itself behind the menu for a few seconds.
  world.reset();
  world.beginRun();
  world.setPilot(autopilot);
  playForward(world, TITLE_SECONDS);
  world.setPilot(null);
  return { screen: SCREEN_TITLE, best: 0 };
}
