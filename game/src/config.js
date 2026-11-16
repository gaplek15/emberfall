// EMBERFALL tuning: every number the game balances on lives here, so a tweak
// never means hunting through the simulation. The arena is a fixed logical
// 1280x720 field; the canvas scales it to the window.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WAVE_COUNT = 10;
export const BOSS_WAVES = [5, 10];
export const BEST_KEY = 'emberfall.best.score.v1';

// The player: a lantern keeper. Bullets are sparks thrown from the lantern.
export const PLAYER = {
  radius: 15,
  speed: 275,
  accel: 2600,
  friction: 6.5,
  maxHp: 5,
  fireInterval: 0.15,
  bulletSpeed: 660,
  bulletDamage: 1,
  bulletRadius: 5,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.2,
  pickupRadius: 96,
  emberMagnet: 170,
  invulnAfterHit: 0.9,
};

// Enemy kinds. score is the base kill value, embers what it drops.
export const ENEMY = {
  cinder:  { hp: 2,  speed: 78,  radius: 14, damage: 1, score: 50,  embers: 1, color: '#ff5a3c' },
  spitter: { hp: 3,  speed: 58,  radius: 15, damage: 1, score: 100, embers: 2, color: '#b678f0' },
  brute:   { hp: 11, speed: 46,  radius: 24, damage: 2, score: 200, embers: 4, color: '#e07b2e' },
};
// An elite is a kindled copy of a kind: tougher, faster, worth far more.
export const ELITE_MULT = { hp: 2.6, speed: 1.3, score: 4, embers: 4, radius: 1.25 };

export const BOSS = {
  5:  { name: 'ASHEN MAW',     hp: 230, speed: 52, radius: 46, score: 2000, embers: 24, color: '#e03a3a' },
  10: { name: 'CINDER TYRANT', hp: 420, speed: 58, radius: 54, score: 5000, embers: 40, color: '#ff2e63' },
};

export const PICKUP = {
  heart:  { radius: 13, color: '#ff5d8f' },
  spread: { radius: 13, color: '#ffd23c', duration: 12 },
  shield: { radius: 13, color: '#57e6c9', duration: 5 },
};

// The palette: ash, ember and lantern gold. Everything draws from these.
export const COLORS = {
  bgTop: '#171221',
  bgBottom: '#0b0810',
  grid: 'rgba(255, 150, 60, 0.05)',
  vignette: 'rgba(5, 3, 8, 0.55)',
  ember: '#ff9a3c',
  emberHot: '#ffc46b',
  emberDeep: '#ff5a3c',
  player: '#ffe9c4',
  playerGlow: '#ffb347',
  bullet: '#ffd98a',
  enemyBullet: '#ff6a4d',
  text: '#f5ead6',
  textDim: '#b9a98f',
  panel: 'rgba(20, 14, 28, 0.88)',
  panelEdge: 'rgba(255, 154, 60, 0.45)',
  hp: '#ff5d73',
  hpEmpty: 'rgba(255, 255, 255, 0.14)',
  bossBar: '#ff2e63',
};
