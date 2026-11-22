// Crown of Embers — the rival AI. It reads the table and counters what it
// sees, so its choices can be predicted and played around: it kills what
// it can kill, guards its own life when low, and spends its energy on the
// best lane it can find. No hidden information: every move is logged.
//
// Planning runs against a virtual copy of the hand and board and addresses
// cards by uid, so the driver's real hand never shifts under a plan.

import { elementAdvantage } from './config.js';
import { drawCard } from './engine.js';

// Plan one full AI turn. Returns an ordered list of actions the driver
// executes with a pause between them, so each move is visible:
//   { type: 'creature', uid, lane }
//   { type: 'spell', uid, target }
export function planAiTurn(state) {
  const me = state.enemy;
  const foe = state.player;
  const vhand = me.hand.slice();
  const vboard = me.board.slice();
  let vhp = me.hp;
  let budget = state.energyMax; // the rival's energy mirrors yours this turn
  const actions = [];

  const take = (uid) => {
    const i = vhand.findIndex((c) => c.uid === uid);
    if (i >= 0) return vhand.splice(i, 1)[0];
    return null;
  };

  // 1. Survival first: mend when hurt and able.
  const mend = vhand.find((c) => c.id === 'mend');
  if (mend && vhp <= 9 && budget >= 2) {
    actions.push({ type: 'spell', uid: mend.uid, target: null });
    take(mend.uid);
    budget -= 2;
    vhp = Math.min(me.maxHp, vhp + 5);
  }

  // 2. Removal: a blast that kills your creature is always worth it.
  const blast = vhand.find((c) => c.id === 'ember-blast');
  if (blast && budget >= 2) {
    const killable = foe.board
      .map((c, lane) => ({ c, lane }))
      .filter(({ c }) => c && c.hp <= 3)
      .sort((a, b) => b.c.atk - a.c.atk)[0];
    if (killable) {
      actions.push({ type: 'spell', uid: blast.uid, target: { lane: killable.lane } });
      take(blast.uid);
      budget -= 2;
    }
  }

  // 3. Creatures, best lane first. Value: stats per cost, plus a bonus for
  // killing the creature across the lane, for an open lane (it hits your
  // life at the end of the turn), and for resonance with a same-element
  // ally already on the table.
  let guard = 0;
  while (guard++ < 6) {
    let best = null;
    for (const card of vhand) {
      if (card.kind !== 'creature' || card.cost > budget) continue;
      for (let lane = 0; lane < 3; lane++) {
        if (vboard[lane]) continue;
        const foeCard = foe.board[lane];
        let value = (card.atk + card.hp) / card.cost;
        if (foeCard) {
          const dmg = card.atk + elementAdvantage(card.element, foeCard.element);
          if (dmg >= foeCard.hp) value += 1.5; // it kills
          else value += 0.4; // it trades down
        } else {
          value += 0.8; // open lane: free damage to your life
        }
        if (vboard.some((c) => c && c.element === card.element)) value += 0.5;
        if (!best || value > best.value) best = { value, uid: card.uid, lane, card };
      }
    }
    if (!best || best.value < 1.6) break;
    actions.push({ type: 'creature', uid: best.uid, lane: best.lane });
    take(best.uid);
    budget -= best.card.cost;
    vboard[best.lane] = best.card;
  }

  // 4. Rally the strongest creature when energy is left over.
  const rally = vhand.find((c) => c.id === 'rally');
  if (rally && budget >= 1) {
    const strong = vboard
      .map((c, lane) => ({ c, lane }))
      .filter(({ c }) => c)
      .sort((a, b) => b.c.atk - a.c.atk)[0];
    if (strong && strong.c.atk >= 3) {
      actions.push({ type: 'spell', uid: rally.uid, target: { lane: strong.lane } });
      take(rally.uid);
      budget -= 1;
    }
  }

  // 5. A leftover blast goes to your face when it ends the game, or when
  // the rival has nothing better to spend its last energy on.
  const blast2 = vhand.find((c) => c.id === 'ember-blast');
  if (blast2 && budget >= 2) {
    if (foe.hp <= 2 || actions.length === 0) {
      actions.push({ type: 'spell', uid: blast2.uid, target: { face: 'enemy' } });
      take(blast2.uid);
      budget -= 2;
    }
  }

  return actions;
}

// The rival draws at the start of its turn, like you do.
export function aiDraw(state) {
  drawCard(state, state.enemy);
}
