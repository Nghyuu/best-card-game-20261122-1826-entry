// Crown of Embers — self-test. Pure engine checks, no DOM: the same
// module runs under Node (node game/src/test.js) and in the browser
// (?test=1), where the result is drawn on the canvas.

import { newGame, startPlay, playCreature, playSpell, resolveCombat, endPlayerTurn, startPlayerTurn } from './engine.js';
import { planAiTurn } from './ai.js';

// The tests build hands directly from card ids through the engine's own
// makeCard, imported here to keep the engine's construction in one place.
import { makeCard } from './engine.js';

function fresh(seed = 7) {
  const s = newGame(seed);
  startPlay(s);
  return s;
}

function giveHand(state, side, ids) {
  side.hand = ids.map((id) => makeCard(id));
}

const tests = [
  ['deck and opening hand', (t) => {
    const s = fresh();
    t.eq(s.player.deck.length, 22, 'deck 27 minus 5 drawn');
    t.eq(s.player.hand.length, 5, 'opening hand of 5');
    t.eq(s.phase, 'play', 'starts in play phase');
    t.eq(s.energy, 1, 'starts with 1 energy');
  }],
  ['play a creature spends energy and fills a lane', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp']);
    s.energy = 3;
    const r = playCreature(s, s.player, 0, 1);
    t.ok(r.ok, 'play succeeds');
    t.eq(s.energy, 2, 'energy spent');
    t.eq(s.player.board[1].id, 'ember-imp', 'creature in lane 2');
    t.eq(s.player.hand.length, 0, 'hand shrinks');
  }],
  ['a creature cannot be played into an occupied lane', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp', 'frost-sprite']);
    s.energy = 5;
    playCreature(s, s.player, 0, 0);
    const r = playCreature(s, s.player, 0, 0);
    t.ok(!r.ok, 'second play refused');
  }],
  ['a creature cannot be played without the energy', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['phoenix']);
    s.energy = 1;
    const r = playCreature(s, s.player, 0, 0);
    t.ok(!r.ok, 'phoenix needs 5 energy');
    t.eq(s.player.board[0], null, 'lane stays empty');
  }],
  ['resonance: same-element ally grants +1/+1', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp', 'cinder-hound']);
    s.energy = 5;
    playCreature(s, s.player, 0, 0);
    playCreature(s, s.player, 0, 1);
    const hound = s.player.board[1];
    // hound 3 +1 resonance (ember ally on board) +1 surge (second ember
    // card this turn); surge touches attack only, so health stays 2+1.
    t.eq(hound.atk, 5, 'hound 3+1 resonance+1 surge attack');
    t.eq(hound.hp, 3, 'hound 2+1 health');
  }],
  ['surge: two of one element in a turn grants +1 attack', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp', 'ember-imp']);
    s.energy = 5;
    playCreature(s, s.player, 0, 0);
    playCreature(s, s.player, 0, 1);
    t.eq(s.player.board[0].atk, 3, 'first imp surged to 3');
    // second imp: base 2 +1 resonance (ember ally) +1 surge = 4.
    t.eq(s.player.board[1].atk, 4, 'second imp 2+1 resonance+1 surge');
  }],
  ['gale lark draws a card when played', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['gale-lark']);
    const before = s.player.hand.length;
    s.energy = 3;
    playCreature(s, s.player, 0, 0);
    t.eq(s.player.hand.length, before - 1 + 1, 'hand: played one, drew one');
  }],
  ['combat hits the rival face through an open lane', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp']);
    s.energy = 3;
    playCreature(s, s.player, 0, 0);
    resolveCombat(s, s.player);
    t.eq(s.enemy.hp, 18, 'imp deals 2 to the face');
  }],
  ['combat trades with the opposing creature', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['cinder-hound']);
    giveHand(s, s.enemy, ['glacier-knight']);
    s.energy = 5;
    playCreature(s, s.player, 0, 1);
    s.enemy.board[1] = s.enemy.hand[0];
    resolveCombat(s, s.player);
    t.eq(s.enemy.board[1], null, 'knight (3 hp) dies to 3 damage');
    t.eq(s.enemy.hp, 20, 'no face damage when a creature blocks');
  }],
  ['element advantage adds +1 attack', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp']); // ember beats gale
    giveHand(s, s.enemy, ['storm-kite']);
    s.energy = 5;
    playCreature(s, s.player, 0, 0);
    s.enemy.board[0] = s.enemy.hand[0]; // storm kite 2 hp
    resolveCombat(s, s.player);
    t.eq(s.enemy.board[0], null, 'imp 2+1 advantage kills the 2-health kite');
  }],
  ['ember blast destroys a creature', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-blast']);
    giveHand(s, s.enemy, ['glacier-knight']);
    s.energy = 5;
    s.enemy.board[2] = s.enemy.hand[0];
    const r = playSpell(s, s.player, 0, { lane: 2 });
    t.ok(r.ok, 'blast casts');
    t.eq(s.enemy.board[2], null, 'knight (3 hp) dies to 3 damage');
  }],
  ['ember blast can hit the rival face for 2', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-blast']);
    s.energy = 5;
    playSpell(s, s.player, 0, { face: 'enemy' });
    t.eq(s.enemy.hp, 18, 'face takes 2');
  }],
  ['mend heals but never above maximum', (t) => {
    const s = fresh();
    s.player.hp = 19;
    giveHand(s, s.player, ['mend']);
    s.energy = 5;
    playSpell(s, s.player, 0, null);
    t.eq(s.player.hp, 20, 'heal caps at max life');
  }],
  ['rally gives a friendly creature +2 attack', (t) => {
    const s = fresh();
    giveHand(s, s.player, ['ember-imp', 'rally']);
    s.energy = 5;
    playCreature(s, s.player, 0, 0);
    const r = playSpell(s, s.player, 0, { lane: 0 });
    t.ok(r.ok, 'rally casts');
    t.eq(s.player.board[0].atk, 4, 'imp 2+2 attack');
  }],
  ['reducing the rival to 0 life wins the game', (t) => {
    const s = fresh();
    s.enemy.hp = 2;
    giveHand(s, s.player, ['ember-imp']);
    s.energy = 3;
    playCreature(s, s.player, 0, 0);
    resolveCombat(s, s.player);
    t.eq(s.phase, 'won', 'phase becomes won');
    t.eq(s.over.winner, 'player', 'player is the winner');
  }],
  ['the AI plans a playable turn', (t) => {
    const s = fresh();
    s.enemy.hand = ['cinder-hound', 'ember-blast', 'mend'].map((id) => makeCard(id));
    s.enemy.hp = 20;
    s.energyMax = 4;
    const plan = planAiTurn(s);
    t.ok(plan.length >= 1, 'AI finds at least one action');
    t.ok(plan.every((a) => s.enemy.hand.some((c) => c.uid === a.uid)), 'every action names a card in hand');
  }],
  ['turns advance energy and draw a card', (t) => {
    const s = fresh();
    const deckBefore = s.player.deck.length;
    endPlayerTurn(s);
    t.eq(s.phase, 'ai', 'after end turn the rival acts');
    startPlayerTurn(s);
    t.eq(s.turn, 2, 'turn counter advances');
    t.eq(s.energy, 2, 'energy grows to 2');
    t.eq(s.player.deck.length, deckBefore - 1, 'drew one card');
  }],
  ['a full game can be played to a conclusion', (t) => {
    const s = fresh(99);
    let guard = 0;
    while (!s.over && guard++ < 60) {
      if (s.phase === 'play') {
        // play the first affordable creature into the first open lane
        let acted = false;
        for (let i = 0; i < s.player.hand.length && !acted; i++) {
          const card = s.player.hand[i];
          if (card.kind === 'creature' && card.cost <= s.energy) {
            for (let lane = 0; lane < 3; lane++) {
              if (!s.player.board[lane]) {
                playCreature(s, s.player, i, lane);
                acted = true;
                break;
              }
            }
          }
        }
        endPlayerTurn(s);
      }
      if (s.phase === 'ai') {
        const plan = planAiTurn(s);
        for (const a of plan) {
          const idx = s.enemy.hand.findIndex((c) => c.uid === a.uid);
          if (idx < 0) continue;
          if (a.type === 'creature') playCreature(s, s.enemy, idx, a.lane);
          else playSpell(s, s.enemy, idx, a.target);
          if (s.over) break;
        }
        if (!s.over) {
          resolveCombat(s, s.enemy);
          startPlayerTurn(s);
        }
      }
      if (s.phase === 'combat') { /* resolved inside endPlayerTurn */ }
    }
    t.ok(s.over, 'the game ends within 60 turns, winner: ' + (s.over && s.over.winner));
  }],
];

export function runTests() {
  const results = [];
  for (const [name, fn] of tests) {
    const failures = [];
    const t = {
      ok(cond, msg) { if (!cond) failures.push(msg || 'expected truthy'); },
      eq(a, b, msg) { if (a !== b) failures.push(`${msg || 'expected equal'} (got ${a}, want ${b})`); },
    };
    try {
      fn(t);
    } catch (e) {
      failures.push('threw: ' + e.message);
    }
    results.push({ name, pass: failures.length === 0, failures });
  }
  return results;
}

// Node entry: `node game/src/test.js` prints the suite and exits non-zero
// on any failure.
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('test.js')) {
  const results = runTests();
  let passed = 0;
  for (const r of results) {
    console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.pass ? '' : '  → ' + r.failures.join('; ')));
    if (r.pass) passed++;
  }
  console.log(`${passed}/${results.length} tests passed`);
  process.exit(passed === results.length ? 0 : 1);
}
