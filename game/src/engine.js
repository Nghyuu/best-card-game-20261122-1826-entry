// Crown of Embers — the game engine: state, turns, combat, spells.
// Pure logic, no DOM: the same module runs in the browser and in Node
// for the self-test. All randomness comes from the seeded RNG on the state.

import {
  LANES, START_HP, START_HAND, MAX_HAND, MAX_ENERGY,
  DECK_LIST, defOf, elementAdvantage, makeRng, shuffle,
} from './config.js';

let nextUid = 1;

export function makeCard(defId) {
  const d = defOf(defId);
  return {
    uid: nextUid++,
    id: d.id, name: d.name, kind: d.kind, element: d.element,
    cost: d.cost, atk: d.atk ?? 0, hp: d.hp ?? 0, maxHp: d.hp ?? 0,
    target: d.target ?? null, text: d.text,
  };
}

function makeSide() {
  return { hp: START_HP, maxHp: START_HP, deck: [], hand: [], board: Array(LANES).fill(null), discard: [] };
}

export function newGame(seed = 1) {
  const rng = makeRng(seed);
  const state = {
    seed, rng,
    phase: 'title', // title | play | combat | ai | won | lost
    turn: 1,
    energy: 1, energyMax: 1,
    player: makeSide(),
    enemy: makeSide(),
    selected: null, // hand index of the selected card, or null
    targeting: null, // { cardIndex, kind } while a spell awaits a target
    log: [],
    stats: { cardsPlayed: 0, damageDealt: 0, turns: 0, surges: 0 },
    elementsPlayed: [], // elements played this turn (for Surge)
    over: null, // { winner: 'player' | 'enemy', reason }
    fx: [], // transient visual events the renderer consumes
  };
  state.player.deck = shuffle(DECK_LIST, rng).map(makeCard);
  state.enemy.deck = shuffle(DECK_LIST, rng).map(makeCard);
  for (let i = 0; i < START_HAND; i++) {
    drawCard(state, state.player);
    drawCard(state, state.enemy);
  }
  return state;
}

export function log(state, text) {
  state.log.push(text);
  if (state.log.length > 40) state.log.shift();
}

export function drawCard(state, side) {
  if (side.deck.length === 0) return null;
  const card = side.deck.pop();
  if (side.hand.length >= MAX_HAND) {
    side.discard.push(card);
    return null;
  }
  side.hand.push(card);
  return card;
}

export function startPlay(state) {
  state.phase = 'play';
  state.energyMax = 1;
  state.energy = 1;
  state.turn = 1;
  log(state, 'The duel begins. Your move — play a card, then End Turn.');
}

// A creature may be played into a lane that is empty on your side.
export function canPlayCreature(state, side, handIndex, lane) {
  const card = side.hand[handIndex];
  if (!card || card.kind !== 'creature') return { ok: false, why: 'not a creature' };
  if (card.cost > state.energy && side === state.player) return { ok: false, why: 'not enough energy' };
  if (side.board[lane]) return { ok: false, why: 'lane is occupied' };
  return { ok: true };
}

export function playCreature(state, side, handIndex, lane) {
  const check = canPlayCreature(state, side, handIndex, lane);
  if (!check.ok) return check;
  const card = side.hand.splice(handIndex, 1)[0];
  if (side === state.player) state.energy -= card.cost;
  // Resonance: a friendly creature of the same element already on the
  // table lends the newcomer +1 attack and +1 health.
  const sameElementAlly = side.board.some((c) => c && c.element === card.element);
  if (sameElementAlly) {
    card.atk += 1; card.hp += 1; card.maxHp += 1;
    log(state, `${card.name} resonates with its element (+1/+1).`);
  }
  side.board[lane] = card;
  state.fx.push({ type: 'summon', lane, side: side === state.player ? 'player' : 'enemy', at: Date.now() });
  if (side === state.player) {
    state.stats.cardsPlayed++;
    state.elementsPlayed.push(card.element);
    if (card.id === 'gale-lark') {
      const drawn = drawCard(state, state.player);
      if (drawn) log(state, 'Gale Lark draws a card.');
    }
    checkSurge(state, side);
  }
  log(state, `${side === state.player ? 'You play' : 'Rival plays'} ${card.name} in lane ${lane + 1}.`);
  return { ok: true, card };
}

// Playing two cards of the same element in one turn surges them: every
// friendly creature of that element gains +1 attack for the rest of the game.
export function checkSurge(state, side) {
  const counts = {};
  for (const el of state.elementsPlayed) counts[el] = (counts[el] || 0) + 1;
  for (const [el, n] of Object.entries(counts)) {
    if (n >= 2 && !state['surge_' + el]) {
      state['surge_' + el] = true;
      state.stats.surges++;
      for (const c of side.board) if (c && c.element === el) c.atk += 1;
      log(state, `Surge! Your ${el} creatures gain +1 attack.`);
    }
  }
}

export function canPlaySpell(state, side, handIndex) {
  const card = side.hand[handIndex];
  if (!card || card.kind !== 'spell') return { ok: false, why: 'not a spell' };
  if (card.cost > state.energy && side === state.player) return { ok: false, why: 'not enough energy' };
  if (card.id === 'rally' && !side.board.some((c) => c)) return { ok: false, why: 'no friendly creature' };
  return { ok: true };
}

// target: { lane } for a creature, { face: 'enemy' } for the rival's life,
// or null for self-targeting spells.
export function playSpell(state, side, handIndex, target) {
  const check = canPlaySpell(state, side, handIndex);
  if (!check.ok) return check;
  const card = side.hand[handIndex];
  if (card.id === 'ember-blast') {
    if (!target || (target.lane === undefined && target.face !== 'enemy')) {
      return { ok: false, why: 'needs a target' };
    }
  }
  if (card.id === 'rally') {
    if (!target || target.lane === undefined || !side.board[target.lane]) {
      return { ok: false, why: 'needs a friendly creature' };
    }
  }
  side.hand.splice(handIndex, 1);
  if (side === state.player) {
    state.energy -= card.cost;
    state.stats.cardsPlayed++;
  }
  if (card.id === 'ember-blast') {
    if (target.face === 'enemy') {
      damageFace(state, state.enemy, 2, side);
      log(state, `${side === state.player ? 'Your' : "Rival's"} Ember Blast hits the rival for 2.`);
    } else {
      const victim = state.enemy.board[target.lane];
      if (!victim) return { ok: false, why: 'no creature there' };
      damageCreature(state, state.enemy, target.lane, 3, side);
      log(state, `${side === state.player ? 'Your' : "Rival's"} Ember Blast burns ${victim.name} for 3.`);
    }
  } else if (card.id === 'mend') {
    const healed = Math.min(5, side.maxHp - side.hp);
    side.hp += healed;
    log(state, `${side === state.player ? 'You mend' : 'Rival mends'} ${healed} life.`);
  } else if (card.id === 'rally') {
    const ally = side.board[target.lane];
    ally.atk += 2;
    log(state, `${ally.name} rallies to ${ally.atk} attack.`);
  }
  side.discard.push(card);
  state.fx.push({ type: 'spell', id: card.id, at: Date.now() });
  return { ok: true, card };
}

export function damageCreature(state, side, lane, amount, bySide) {
  const c = side.board[lane];
  if (!c) return;
  c.hp -= amount;
  state.fx.push({ type: 'damage', lane, side: side === state.player ? 'player' : 'enemy', amount, at: Date.now() });
  if (bySide === state.player) state.stats.damageDealt += amount;
  if (c.hp <= 0) {
    side.discard.push(c);
    side.board[lane] = null;
    log(state, `${c.name} is destroyed.`);
  }
}

export function damageFace(state, side, amount, bySide) {
  side.hp -= amount;
  state.fx.push({ type: 'face', side: side === state.player ? 'player' : 'enemy', amount, at: Date.now() });
  if (bySide === state.player) state.stats.damageDealt += amount;
  checkEnd(state);
}

export function checkEnd(state) {
  if (state.over) return state.over;
  if (state.enemy.hp <= 0) {
    state.over = { winner: 'player', reason: 'The rival falls to 0 life.' };
    state.phase = 'won';
    log(state, 'Victory! The Ember Crown is yours.');
  } else if (state.player.hp <= 0) {
    state.over = { winner: 'enemy', reason: 'You fall to 0 life.' };
    state.phase = 'lost';
    log(state, 'Defeat. The court falls silent.');
  }
  return state.over;
}

// End of the active side's turn: each of its creatures strikes across its
// lane — the opposing creature, or the opposing life total when the lane
// is empty. Element advantage adds +1 attack against a creature.
export function resolveCombat(state, attacker) {
  const defender = attacker === state.player ? state.enemy : state.player;
  const who = attacker === state.player ? 'Your' : "Rival's";
  for (let lane = 0; lane < LANES; lane++) {
    const c = attacker.board[lane];
    if (!c) continue;
    const foe = defender.board[lane];
    if (foe) {
      const bonus = elementAdvantage(c.element, foe.element);
      const dmg = c.atk + bonus;
      if (bonus) log(state, `${c.name} has the element advantage (+1).`);
      damageCreature(state, defender, lane, dmg, attacker);
      log(state, `${who} ${c.name} strikes ${foe.name} for ${dmg}.`);
    } else {
      damageFace(state, defender, c.atk, attacker);
      log(state, `${who} ${c.name} hits the rival for ${c.atk}.`);
    }
    if (state.over) return;
  }
}

export function endPlayerTurn(state) {
  if (state.phase !== 'play') return false;
  state.selected = null;
  state.targeting = null;
  state.phase = 'combat';
  state.elementsPlayed = [];
  for (const el of ['ember', 'frost', 'gale']) state['surge_' + el] = false;
  resolveCombat(state, state.player);
  if (state.over) return true;
  state.phase = 'ai';
  return true;
}

export function startPlayerTurn(state) {
  state.turn++;
  state.stats.turns = state.turn;
  state.energyMax = Math.min(MAX_ENERGY, state.energyMax + 1);
  state.energy = state.energyMax;
  drawCard(state, state.player);
  state.phase = 'play';
  log(state, `Turn ${state.turn} — ${state.energy} energy. Your move.`);
}
