// Crown of Embers — configuration and card catalogue.
// Every card is an original design for this game: three elements in a
// triangle (Ember beats Gale, Gale beats Frost, Frost beats Ember), three
// lanes, and energy that grows one per turn. No card is copied from any
// published game.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const LANES = 3;
export const START_HP = 20;
export const START_HAND = 5;
export const MAX_HAND = 7;
export const MAX_ENERGY = 10;

export const ELEMENTS = {
  ember: { name: 'Ember', color: '#e4572e', dark: '#8f2d12', light: '#ffb199' },
  frost: { name: 'Frost', color: '#4ea8de', dark: '#1d5c86', light: '#bfe6f7' },
  gale: { name: 'Gale', color: '#8e6cc8', dark: '#4a2f7d', light: '#d9ccf5' },
};

// Ember > Gale > Frost > Ember. An attacker with the advantage deals +1.
export const BEATS = { ember: 'gale', gale: 'frost', frost: 'ember' };

export function elementAdvantage(attacker, defender) {
  return BEATS[attacker] === defender ? 1 : 0;
}

// kind: 'creature' fights in a lane; 'spell' resolves at once and leaves.
// target: where a spell may be aimed — 'enemy-creature', 'enemy-face',
// 'own-creature', 'self' (no aim needed), or 'any-creature'.
export const CARD_DEFS = [
  { id: 'ember-imp', name: 'Ember Imp', kind: 'creature', element: 'ember', cost: 1, atk: 2, hp: 1, text: 'Quick and hot-headed.' },
  { id: 'frost-sprite', name: 'Frost Sprite', kind: 'creature', element: 'frost', cost: 1, atk: 1, hp: 2, text: 'Cold to the touch.' },
  { id: 'gale-lark', name: 'Gale Lark', kind: 'creature', element: 'gale', cost: 1, atk: 1, hp: 1, text: 'Draw a card when played.' },
  { id: 'cinder-hound', name: 'Cinder Hound', kind: 'creature', element: 'ember', cost: 2, atk: 3, hp: 2, text: 'Leaves pawprints of ash.' },
  { id: 'glacier-knight', name: 'Glacier Knight', kind: 'creature', element: 'frost', cost: 2, atk: 2, hp: 3, text: 'A wall that walks.' },
  { id: 'storm-kite', name: 'Storm Kite', kind: 'creature', element: 'gale', cost: 2, atk: 2, hp: 2, text: 'Rides the high wind.' },
  { id: 'flame-herald', name: 'Flame Herald', kind: 'creature', element: 'ember', cost: 3, atk: 4, hp: 3, text: 'Announces the fire.' },
  { id: 'winter-warden', name: 'Winter Warden', kind: 'creature', element: 'frost', cost: 3, atk: 3, hp: 5, text: 'Guards the frozen gate.' },
  { id: 'tempest-roc', name: 'Tempest Roc', kind: 'creature', element: 'gale', cost: 3, atk: 4, hp: 4, text: 'Its wings are weather.' },
  { id: 'phoenix', name: 'Phoenix', kind: 'creature', element: 'ember', cost: 5, atk: 6, hp: 5, text: 'Returns from its own ash.' },
  { id: 'ember-blast', name: 'Ember Blast', kind: 'spell', element: 'ember', cost: 2, target: 'enemy', text: 'Deal 3 damage to a creature, or 2 to the rival.' },
  { id: 'mend', name: 'Mend', kind: 'spell', element: 'frost', cost: 2, target: 'self', text: 'Restore 5 life.' },
  { id: 'rally', name: 'Rally', kind: 'spell', element: 'gale', cost: 1, target: 'own-creature', text: 'Give a friendly creature +2 attack.' },
];

export const DECK_LIST = [
  'ember-imp', 'ember-imp', 'frost-sprite', 'frost-sprite', 'gale-lark', 'gale-lark',
  'cinder-hound', 'cinder-hound', 'glacier-knight', 'glacier-knight', 'storm-kite', 'storm-kite',
  'flame-herald', 'flame-herald', 'winter-warden', 'winter-warden', 'tempest-roc', 'tempest-roc',
  'phoenix', 'phoenix', 'ember-blast', 'ember-blast', 'ember-blast',
  'mend', 'mend', 'rally', 'rally',
];

export function defOf(id) {
  const d = CARD_DEFS.find((c) => c.id === id);
  if (!d) throw new Error('unknown card ' + id);
  return d;
}

// Deterministic RNG (mulberry32) so staged screenshots and tests replay.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
