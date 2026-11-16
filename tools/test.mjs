// Playtest harness for EMBERFALL: loads the game in headless Chromium,
// collects console/page errors and every network request, captures the four
// deterministic shots into screenshots/, and plays the live game with
// scripted keyboard and mouse through start, combat, pause and restart.
// Usage: node tools/test.mjs [port]   (serve.ts must already run on [port])
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const port = Number(process.argv[2] || 8080);
const base = `http://127.0.0.1:${port}`;
const shots = ['play', 'title', 'boss', 'victory'];
const failures = [];

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader'],
});

function watch(page) {
  const errors = [];
  const requests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console: ' + msg.text());
  });
  page.on('pageerror', (err) => errors.push('pageerror: ' + String(err)));
  page.on('request', (req) => requests.push(req.url()));
  page.on('requestfailed', (req) => errors.push('requestfailed: ' + req.url()));
  return { errors, requests };
}

async function checkShot(name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const { errors, requests } = watch(page);
  await page.goto(`${base}/?shot=${name}&seed=1`, { waitUntil: 'load', timeout: 30000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  } catch {
    errors.push('timeout waiting for __shotReady');
  }
  const info = await page.evaluate(() => {
    const w = window.__emberfall.world.state;
    return {
      ready: window.__shotReady === true,
      wave: w.wave,
      waveState: w.waveState,
      score: w.score,
      kills: w.kills,
      enemies: w.enemies.length,
      boss: !!w.boss,
      victory: w.victory,
      runOver: w.runOver,
    };
  });
  const shotName = { play: '1-play.jpg', title: '2-title.jpg', boss: '3-boss.jpg', victory: '4-victory.jpg' }[name];
  await page.screenshot({ path: `screenshots/${shotName}`, type: 'jpeg', quality: 82 });
  const external = requests.filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('http://localhost'));
  console.log(`shot=${name} ${JSON.stringify(info)} errors=${errors.length} requests=${requests.length} external=${external.length}`);
  for (const e of errors) console.log('  ' + e);
  for (const u of external) console.log('  external: ' + u);
  if (!info.ready || errors.length > 0 || external.length > 0) failures.push(name);
  await page.close();
}

async function checkLive() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const { errors, requests } = watch(page);
  await page.goto(base + '/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  // Start the game with a click, then fight: hold the mouse down and move.
  await page.mouse.click(640, 360);
  await page.waitForTimeout(500);
  await page.mouse.move(900, 300);
  await page.mouse.down();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);
  const mid = await page.evaluate(() => {
    const w = window.__emberfall.world.state;
    return { wave: w.wave, score: w.score, kills: w.kills, hp: w.player.hp, enemies: w.enemies.length, bullets: w.bullets.length, embers: w.embers, waveState: w.waveState };
  });
  console.log('live mid-fight:', JSON.stringify(mid));
  // Pause, resume, then force a game over through the debug handle and restart.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(400);
  const paused = await page.evaluate(() => window.__emberfall.world.state.waveState);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.evaluate(() => {
    const w = window.__emberfall.world;
    w.state.player.hp = 1;
    w.state.player.invuln = 0;
    w.state.player.shieldTimer = 0;
    w.spawnEnemyBullet(w.state.player.x - 5, w.state.player.y, 10, 0);
  });
  await page.waitForTimeout(1200);
  const over = await page.evaluate(() => {
    const w = window.__emberfall.world.state;
    return { runOver: w.runOver, victory: w.victory };
  });
  console.log('live after fatal hit:', JSON.stringify(over), 'waveState paused check:', paused);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const restarted = await page.evaluate(() => {
    const w = window.__emberfall.world.state;
    return { wave: w.wave, runOver: w.runOver, score: w.score, hp: w.player.hp };
  });
  console.log('live after restart:', JSON.stringify(restarted));
  const external = requests.filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('http://localhost'));
  console.log('live errors=', errors.length, 'requests=', requests.length, 'external=', external.length);
  for (const e of errors) console.log('  ' + e);
  for (const u of external) console.log('  external: ' + u);
  if (errors.length > 0 || external.length > 0) failures.push('live-errors');
  if (!mid || mid.score === 0 && mid.kills === 0 && mid.enemies === 0) failures.push('live-no-combat');
  if (!over.runOver) failures.push('live-no-gameover');
  if (restarted.runOver || restarted.wave !== 1) failures.push('live-no-restart');
  await page.close();
}

await checkLive();
for (const name of shots) await checkShot(name);
await browser.close();
console.log(failures.length === 0 ? 'ALL OK' : 'FAILURES: ' + failures.join(', '));
process.exit(failures.length === 0 ? 0 : 1);
