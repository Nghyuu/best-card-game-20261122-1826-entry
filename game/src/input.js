// Crown of Embers — input: mouse and keyboard, hit-tested against the
// renderer's layout. The game never reads the keyboard for anything but
// its own shortcuts; every click target is a rect the renderer draws.

import { layout } from './render.js';
import { canPlayCreature, canPlaySpell, playCreature, playSpell, log } from './engine.js';
import { sfx, ensureAudio, toggleMute } from './audio.js';

function inside(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function createInput(state, ui, callbacks) {
  // callbacks: { onPlay, onEndTurn, onRestart, onAction }
  // onAction() is called after any successful state change so the driver
  // can re-render and play sounds.

  function pickLane(x, y) {
    const L = layout(state);
    return L.lanes.find((lane) => inside(lane, x, y)) || null;
  }

  function pickHand(x, y) {
    const L = layout(state);
    return L.handCards.find((slot) => inside(slot, x, y)) || null;
  }

  function click(x, y) {
    ensureAudio();
    if (state.phase === 'title') {
      callbacks.onRestart();
      return;
    }
    if (state.phase === 'won' || state.phase === 'lost') {
      callbacks.onRestart();
      return;
    }
    if (state.phase !== 'play') return;
    const L = layout(state);

    if (inside(L.mute, x, y)) {
      ui.muted = toggleMute();
      return;
    }
    if (inside(L.endTurn, x, y)) {
      callbacks.onEndTurn();
      return;
    }

    // Targeting a spell: a click on a valid target resolves it.
    if (ui.targeting) {
      const spell = state.player.hand[ui.targeting.cardIndex];
      if (!spell) { ui.targeting = null; return; }
      if (spell.id === 'ember-blast') {
        const lane = pickLane(x, y);
        if (lane && state.enemy.board[lane.index]) {
          const r = playSpell(state, state.player, ui.targeting.cardIndex, { lane: lane.index });
          if (r.ok) { sfx.hit(); ui.targeting = null; ui.selected = null; callbacks.onAction(); }
          return;
        }
        if (inside(L.enemyFace, x, y)) {
          const r = playSpell(state, state.player, ui.targeting.cardIndex, { face: 'enemy' });
          if (r.ok) { sfx.hit(); ui.targeting = null; ui.selected = null; callbacks.onAction(); }
          return;
        }
        // clicked elsewhere: cancel targeting
        ui.targeting = null;
        ui.selected = null;
        return;
      }
      if (spell.id === 'rally') {
        const lane = pickLane(x, y);
        if (lane && state.player.board[lane.index]) {
          const r = playSpell(state, state.player, ui.targeting.cardIndex, { lane: lane.index });
          if (r.ok) { sfx.playCard(); ui.targeting = null; ui.selected = null; callbacks.onAction(); }
          return;
        }
        ui.targeting = null;
        ui.selected = null;
        return;
      }
    }

    // A selected creature: click a lane to play it.
    if (ui.selected !== null) {
      const card = state.player.hand[ui.selected];
      const lane = pickLane(x, y);
      if (card && card.kind === 'creature' && lane) {
        const r = playCreature(state, state.player, ui.selected, lane.index);
        if (r.ok) {
          sfx.playCard();
          ui.selected = null;
          callbacks.onAction();
        } else {
          log(state, 'Cannot play there: ' + r.why + '.');
        }
        return;
      }
      // clicked another hand card: reselect
      const slot = pickHand(x, y);
      if (slot) { selectCard(slot.index); return; }
      ui.selected = null;
      return;
    }

    // Nothing selected: pick a hand card, or start a spell's targeting.
    const slot = pickHand(x, y);
    if (slot) selectCard(slot.index);
  }

  function selectCard(index) {
    const card = state.player.hand[index];
    if (!card) return;
    if (card.kind === 'spell') {
      if (card.id === 'mend') {
        const r = playSpell(state, state.player, index, null);
        if (r.ok) { sfx.heal(); callbacks.onAction(); }
        return;
      }
      const check = canPlaySpell(state, state.player, index);
      if (!check.ok) { log(state, 'Cannot cast: ' + check.why + '.'); return; }
      ui.selected = index;
      ui.targeting = { cardIndex: index, id: card.id };
      sfx.select();
      return;
    }
    const affordable = card.cost <= state.energy;
    if (!affordable) { log(state, card.name + ' costs ' + card.cost + ' energy — you have ' + state.energy + '.'); return; }
    ui.selected = index;
    ui.targeting = null;
    sfx.select();
  }

  function keyDown(key) {
    ensureAudio();
    if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
      if (key === 'Enter' || key === ' ') callbacks.onRestart();
      return;
    }
    if (state.phase !== 'play') return;
    if (key === 'Enter') { callbacks.onEndTurn(); return; }
    if (key === 'Escape') { ui.selected = null; ui.targeting = null; return; }
    if (key >= '1' && key <= '7') {
      const index = Number(key) - 1;
      if (index < state.player.hand.length) selectCard(index);
    }
  }

  function mouseMove(x, y) {
    const L = layout(state);
    const slot = L.handCards.find((s) => inside(s, x, y));
    ui.hoverCard = slot ? slot.index : null;
    const lane = L.lanes.find((l) => inside(l, x, y));
    ui.hoverLane = lane ? lane.index : null;
  }

  return { click, keyDown, mouseMove };
}
