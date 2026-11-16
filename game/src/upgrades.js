// The choice between waves. After every cleared wave the Keeper is offered
// three upgrades, each priced in embers, or the option to bank every ember
// instead: banked embers are gone as currency but each one adds a permanent
// +2% to all score from then on. Spend for power now, or invest in the score
// and fight the next wave as you are.
export const BANK_RATE = 0.02;
export const BANK_SCORE_PER_EMBER = 5;

// One upgrade: its id, display name, what it promises, its base price, and
// the change it makes to the player. Costs wobble a little per offer.
export const UPGRADE_POOL = [
  {
    id: 'rapid',
    name: 'Rapid Wicks',
    desc: '+18% fire rate. Your lantern throws sparks faster.',
    baseCost: 10,
    apply(p) { p.fireInterval *= 0.82; },
  },
  {
    id: 'heavy',
    name: 'Heavy Sparks',
    desc: '+1 damage per spark. Fewer hits to shatter anything.',
    baseCost: 12,
    apply(p) { p.damage += 1; },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    desc: '+12% move speed. Outrun the swarm a little longer.',
    baseCost: 8,
    apply(p) { p.speed *= 1.12; },
  },
  {
    id: 'iron',
    name: 'Iron Lantern',
    desc: '+1 max health and heal 1 now. A sturdier flame.',
    baseCost: 14,
    apply(p) { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); },
  },
  {
    id: 'dash',
    name: 'Long Fuse',
    desc: 'Dash recharges 30% faster. Dodge more, die less.',
    baseCost: 8,
    apply(p) { p.dashCooldown *= 0.7; },
  },
  {
    id: 'pierce',
    name: 'Piercing Flame',
    desc: 'Sparks pierce +1 enemy. One shot, a whole line of wisps.',
    baseCost: 16,
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'magnet',
    name: 'Magnet Core',
    desc: '+60% ember pickup radius. Embers fly to you from farther.',
    baseCost: 6,
    apply(p) { p.pickupRadius *= 1.6; p.emberMagnet *= 1.4; },
  },
  {
    id: 'twin',
    name: 'Twin Flame',
    desc: '+1 spark per shot. Twice the fire, same trigger pull.',
    baseCost: 20,
    apply(p) { p.projectiles += 1; },
  },
];

// Roll three distinct offers. A cost may sit a little above what the Keeper
// carries — an offer you cannot afford is a choice too.
export function rollUpgrades(rng, embers) {
  const pool = UPGRADE_POOL.slice();
  const offers = [];
  while (offers.length < 3 && pool.length > 0) {
    const i = rng.int(0, pool.length - 1);
    const def = pool.splice(i, 1)[0];
    const cost = Math.max(4, Math.round(def.baseCost * rng.range(0.9, 1.25)));
    offers.push({ ...def, cost, affordable: cost <= embers });
  }
  return offers;
}
