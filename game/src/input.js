// Keyboard + mouse, in the game's own logical coordinates. Movement keys are
// polled every step; menu keys and clicks are edge-triggered actions, queued
// and consumed once, so a single press never fires twice.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;
export const ACTION_BANK = 16;
export const ACTION_UPGRADE_1 = 32;
export const ACTION_UPGRADE_2 = 64;
export const ACTION_UPGRADE_3 = 128;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let clicks = [];
  let mouse = { x: VIEW.width / 2, y: VIEW.height / 2 };
  let firing = false;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter' || event.code === 'NumpadEnter') queued |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
    if (event.code === 'Space') queued |= ACTION_DASH;
    if (event.code === 'KeyB') queued |= ACTION_BANK;
    if (event.code === 'Digit1') queued |= ACTION_UPGRADE_1;
    if (event.code === 'Digit2') queued |= ACTION_UPGRADE_2;
    if (event.code === 'Digit3') queued |= ACTION_UPGRADE_3;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => { mouse = toLogical(event); });
  canvas.addEventListener('mousedown', (event) => {
    mouse = toLogical(event);
    if (event.button === 0) {
      firing = true;
      clicks.push({ x: mouse.x, y: mouse.y });
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // A normalised movement vector from the held keys, { x, y }.
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const step = MOVE_KEYS[code];
        if (step) { x += step[0]; y += step[1]; }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    aim() {
      return mouse;
    },
    isFiring() {
      return firing;
    },
    // The queued edge actions since the last call; the queue empties.
    takeActions() {
      const out = queued;
      queued = 0;
      return out;
    },
    // The oldest unhandled click in logical coordinates, or null.
    takeClick() {
      return clicks.length > 0 ? clicks.shift() : null;
    },
    clearClicks() {
      clicks = [];
    },
  };
}
