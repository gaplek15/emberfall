// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade, paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|boss|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import {
  ACTION_BANK,
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_UPGRADE_1,
  ACTION_UPGRADE_2,
  ACTION_UPGRADE_3,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './particles.js';
import {
  UPGRADE_LAYOUT,
  createRenderer,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_VICTORY,
} from './render.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const status = document.getElementById('status');
const effects = createEffects();
const audio = createAudio();
const world = createWorld(createRandom(seed), effects, audio);
const renderer = createRenderer(canvas, effects);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // Let the transient effects (rings, bursts, floating text) settle for half
  // a second before painting: in shot mode nothing else advances them, and a
  // frame frozen at full blast reads as clutter.
  for (let i = 0; i < 30; i += 1) effects.update(STEP);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // A dash pressed this frame, waiting for the next simulation step. The
  // action queue is eaten once per frame, so the step reads it from here.
  let dashQueued = false;

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startAttract() {
    world.beginRun();
    world.setPilot(autopilot);
  }

  function startGame() {
    audio.unlock();
    audio.startMusic();
    world.setPilot(null);
    world.beginRun();
    input.clearClicks();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Hold the light.');
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(victory ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pointIn(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function handleUpgradeClick(point) {
    const offers = world.state.offers;
    for (let i = 0; i < offers.length; i += 1) {
      if (pointIn(UPGRADE_LAYOUT.cards[i], point)) {
        if (world.buyUpgrade(offers[i])) screen = SCREEN_PLAY;
        return;
      }
    }
    if (pointIn(UPGRADE_LAYOUT.bank, point)) {
      if (world.bankEmbers()) screen = SCREEN_PLAY;
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.unlock();
      audio.toggleMute();
    }
    if (screen === SCREEN_TITLE) {
      if (actions & (ACTION_CONFIRM | ACTION_DASH)) startGame();
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & (ACTION_CONFIRM | ACTION_DASH)) startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM | ACTION_DASH)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_UPGRADE_1 && world.buyUpgrade(world.state.offers[0])) screen = SCREEN_PLAY;
      else if (actions & ACTION_UPGRADE_2 && world.buyUpgrade(world.state.offers[1])) screen = SCREEN_PLAY;
      else if (actions & ACTION_UPGRADE_3 && world.buyUpgrade(world.state.offers[2])) screen = SCREEN_PLAY;
      else if (actions & ACTION_BANK && world.bankEmbers()) screen = SCREEN_PLAY;
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
    if (actions & ACTION_DASH) dashQueued = true;
  }

  function handleClicks() {
    let click = input.takeClick();
    while (click) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
        audio.unlock();
        startGame();
        return;
      }
      if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        return;
      }
      if (screen === SCREEN_UPGRADE) handleUpgradeClick(click);
      click = input.takeClick();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The world plays itself behind the menu; keep the demo going when
      // the pilot dies or reaches an upgrade choice.
      if (world.state.runOver) startAttract();
      else if (world.state.waveState === 'upgrade') {
        const offer = world.state.offers.find((o) => o.affordable);
        if (offer) world.buyUpgrade(offer);
        else world.bankEmbers();
      }
      world.step(STEP, null);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    const aim = input.aim();
    const ctrl = {
      mx: dir.x,
      my: dir.y,
      aimX: aim.x,
      aimY: aim.y,
      firing: input.isFiring(),
      dash: dashQueued,
    };
    dashQueued = false;
    const events = world.step(STEP, ctrl);
    if (events & EVENT_VICTORY) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WAVE_CLEAR) screen = SCREEN_UPGRADE;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    effects.update(dt);
    handleActions();
    handleClicks();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      let guard = 0;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY) && guard < 40) {
        step();
        accumulator -= STEP;
        guard += 1;
      }
      if (guard >= 40) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, muted: audio.muted });
  }

  // Leaving the tab pauses a running game rather than letting the swarm
  // feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  startAttract();
  announce('EMBERFALL. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// A small handle for automated play-tests: the live world state, read-only
// from outside. The game never reads it back.
window.__emberfall = { world, effects, audio };

if (shot) runShot(shot);
else runGame();
