# EMBERFALL

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/gaplek15/emberfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/gaplek15/emberfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Entry for make.fun's ["Make the best game" bounty](https://make.fun/bounty/best-game-01) ($1,000 in USDC).

A top-down arena shooter about ember and choice. You are the last Lantern
Keeper in a field of ash: ember-wisps swarm you in waves, and every one you
shatter drops embers. Embers are the whole game — spend them between waves on
one of three upgrades, or bank them all for a permanent score multiplier.
Spend now and survive; bank everything and chase the leaderboard.

Survive 10 waves. The Ashen Maw waits at wave 5, the Cinder Tyrant at wave 10.
Beat them both and the field is yours.

## How to play

- **Move** — WASD / arrow keys
- **Aim** — mouse
- **Shoot** — hold left mouse button
- **Dash** — Space (brief invulnerability, 2.2 s cooldown)
- **Pause** — P or Esc
- **Mute** — M
- **Between waves** — pick 1 of 3 upgrades (keys 1/2/3 or click), or press B to
  bank all your embers for +2% score each, forever.

Ember drops drift toward you when you get close. Pickups: hearts heal,
spread-shot triples your fire for a while, shields make you untouchable.

## The loop

Title → waves 1–10 (a boss every 5th wave) → upgrade choice after every wave
→ victory after the wave-10 boss, or game over → restart. Best score is kept
in your browser.

## Tech

Plain ES modules on a 2D canvas, no libraries, no network requests, no
external assets — every picture is drawn in code and every sound is
synthesised with WebAudio. Simulation runs on a fixed 60 Hz step, separate
from rendering. Deterministic screenshot scenes: `?shot=title|play|boss|
victory&seed=N` (sets `window.__shotReady` when painted).

Play it locally: `node serve.ts`, then open http://localhost:8080.

## Entry

Built for the make.fun bounty "Make the best game" (best-game-01).
`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the kit's `vendor/makefun-game.ts`.
