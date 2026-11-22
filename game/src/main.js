// Crown of Embers — bootstrap and game loop. Owns the canvas, the frame
// loop, the AI turn's staged execution, the ?shot= staging used for the
// screenshots, and the ?test=1 self-test display.

import { VIEW_W, VIEW_H } from './config.js';
import {
  newGame, startPlay, endPlayerTurn, startPlayerTurn, resolveCombat,
  playCreature, playSpell, checkEnd, makeCard,
} from './engine.js';
import { planAiTurn, aiDraw } from './ai.js';
import { createInput } from './input.js';
import { drawTable, drawTitle, drawEnd, layout } from './render.js';
import { sfx, ensureAudio } from './audio.js';
import { runTests } from './test.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot');
const testMode = params.get('test') === '1';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

let state = newGame(seed);
const ui = {
  selected: null, targeting: null, hoverCard: null, hoverLane: null,
  floaters: [], muted: false, queue: [], lastFx: 0,
};

// The input handler closes over the state object it was built with, so a
// fresh game needs a fresh handler — rebind() swaps in new closures.
const inputCallbacks = {
  onRestart() {
    state = newGame(seed + Math.floor(Math.random() * 1000));
    ui.selected = null;
    ui.targeting = null;
    ui.floaters = [];
    ui.queue = [];
    rebind();
    startPlay(state);
    sfx.turn();
  },
  onEndTurn() {
    if (!endPlayerTurn(state)) return;
    sfx.turn();
    pushFloaters();
    ui.queue.push({ at: performance.now() + 900, fn: runAiTurn });
  },
  onAction() {
    pushFloaters();
  },
};

const input = createInput(state, ui, inputCallbacks);

function rebind() {
  const fresh = createInput(state, ui, inputCallbacks);
  input.click = fresh.click;
  input.keyDown = fresh.keyDown;
  input.mouseMove = fresh.mouseMove;
}

// Turn the engine's fx events into floating damage numbers on the table.
function pushFloaters() {
  const L = layout(state);
  for (const fx of state.fx.slice(ui.lastFx)) {
    if (fx.type === 'damage' || fx.type === 'face') {
      const lane = L.lanes[fx.lane ?? 1];
      const isPlayer = fx.side === 'player';
      ui.floaters.push({
        x: fx.type === 'face' ? VIEW_W / 2 : lane.cx,
        y: fx.type === 'face' ? (isPlayer ? 130 : 560) : (isPlayer ? 240 : 330),
        text: '-' + fx.amount,
        color: '#ff6b4a',
        born: Date.now(),
      });
      if (fx.type === 'damage') sfx.hit();
    }
  }
  ui.lastFx = state.fx.length;
  ui.floaters = ui.floaters.filter((f) => Date.now() - f.born < 900);
}

// The rival's turn, staged so each move is visible: draw, play its cards
// one at a time, strike, then hand the turn back.
function runAiTurn() {
  if (state.over) return;
  aiDraw(state);
  const plan = planAiTurn(state);
  let delay = 500;
  for (const action of plan) {
    ui.queue.push({
      at: performance.now() + delay,
      fn: () => {
        const idx = state.enemy.hand.findIndex((c) => c.uid === action.uid);
        if (idx < 0) return;
        if (action.type === 'creature') {
          const r = playCreature(state, state.enemy, idx, action.lane);
          if (r.ok) sfx.playCard();
        } else {
          const r = playSpell(state, state.enemy, idx, action.target);
          if (r.ok) sfx.playCard();
        }
        pushFloaters();
      },
    });
    delay += 650;
  }
  ui.queue.push({
    at: performance.now() + delay + 300,
    fn: () => {
      if (state.over) return;
      resolveCombat(state, state.enemy);
      pushFloaters();
      if (state.over) { if (state.phase === 'won') sfx.win(); else sfx.lose(); return; }
      startPlayerTurn(state);
      sfx.turn();
    },
  });
}

// Staged states for the screenshots: deterministic, built from the same
// engine calls a real game would make.
function stageShot(name) {
  state = newGame(seed);
  if (name === 'title') return; // phase is already 'title'
  startPlay(state);
  if (name === 'table') {
    state.turn = 5;
    state.stats.turns = 5;
    state.energyMax = 5;
    state.energy = 5;
    state.player.hp = 14;
    state.enemy.hp = 17;
    state.player.board[0] = makeCard('cinder-hound');
    state.player.board[1] = null;
    state.player.board[2] = makeCard('tempest-roc');
    state.enemy.board[0] = makeCard('glacier-knight');
    state.enemy.board[1] = makeCard('flame-herald');
    state.enemy.board[2] = null;
    state.player.hand = ['phoenix', 'ember-blast', 'frost-sprite', 'rally', 'mend'].map(makeCard);
    state.enemy.hand = ['cinder-hound', 'storm-kite', 'gale-lark', 'ember-imp', 'winter-warden'].map(makeCard);
    state.player.deck = state.player.deck.slice(0, 12);
    state.enemy.deck = state.enemy.deck.slice(0, 12);
    state.log.push('Turn 5 — 5 energy. Your move.');
    state.log.push('Rival plays Flame Herald in lane 2.');
    state.log.push('Your Tempest Roc hits the rival for 4.');
    ui.selected = 0; // the Phoenix, affordable at 5 energy, lanes highlighted
    return;
  }
  if (name === 'win') {
    state.turn = 8;
    state.stats.turns = 8;
    state.stats.cardsPlayed = 14;
    state.stats.damageDealt = 23;
    state.stats.surges = 2;
    state.enemy.hp = 0;
    checkEnd(state);
    return;
  }
  if (name === 'loss') {
    state.turn = 7;
    state.stats.turns = 7;
    state.stats.cardsPlayed = 11;
    state.stats.damageDealt = 15;
    state.stats.surges = 1;
    state.player.hp = 0;
    checkEnd(state);
  }
}

function frame(now) {
  // run due queued actions (AI turn staging)
  while (ui.queue.length && ui.queue[0].at <= now) {
    const item = ui.queue.shift();
    item.fn();
  }
  ui.floaters = ui.floaters.filter((f) => Date.now() - f.born < 900);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.phase === 'title') drawTitle(ctx, state);
  else if (state.phase === 'won' || state.phase === 'lost') {
    drawTable(ctx, state, ui);
    drawEnd(ctx, state);
  } else {
    drawTable(ctx, state, ui);
  }
  requestAnimationFrame(frame);
}

// Debug hook for the screenshot/play-test driver: read-only access to the
// live game state (phase, life totals, turn). Harmless in the shipped game.
window.__game = {
  get state() { return state; },
  get ui() { return ui; },
};

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * VIEW_W,
    y: ((e.clientY - r.top) / r.height) * VIEW_H,
  };
}

canvas.addEventListener('click', (e) => {
  const p = toCanvas(e);
  input.click(p.x, p.y);
});
canvas.addEventListener('mousemove', (e) => {
  const p = toCanvas(e);
  input.mouseMove(p.x, p.y);
});
window.addEventListener('keydown', (e) => {
  if (['Enter', ' ', 'Escape'].includes(e.key)) e.preventDefault();
  input.keyDown(e.key);
});

// Self-test mode: run the suite, paint the result, expose it for the driver.
if (testMode) {
  const results = runTests();
  window.__testResults = results;
  const passed = results.filter((r) => r.pass).length;
  ctx.fillStyle = '#122b1a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#f7ead0';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Crown of Embers — self-test ${passed}/${results.length}`, 40, 50);
  ctx.font = '16px Georgia, serif';
  results.forEach((r, i) => {
    ctx.fillStyle = r.pass ? '#7ec850' : '#ff6b4a';
    ctx.fillText((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : ' → ' + r.failures.join('; ')), 40, 90 + i * 26);
  });
  document.title = passed === results.length ? 'TESTS PASS' : 'TESTS FAIL';
} else if (shot) {
  stageShot(shot);
  requestAnimationFrame(frame);
} else {
  requestAnimationFrame(frame);
}
