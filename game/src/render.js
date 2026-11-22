// Crown of Embers — canvas rendering. Everything is drawn with the 2D
// canvas: the felt table, the cards, the life totals, the turn banner and
// the title, win and loss screens. No images are loaded; every glyph is a
// path, so the game works offline from plain files.

import { VIEW_W, VIEW_H, LANES, ELEMENTS } from './config.js';

const GOLD = '#d9a441';
const CREAM = '#f7ead0';
const INK = '#241a12';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'center', weight = 'bold', font = 'Georgia, serif') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

// Element glyphs, drawn as paths so they read by shape as well as colour.
export function drawElementIcon(ctx, element, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color || ELEMENTS[element].color;
  ctx.strokeStyle = color || ELEMENTS[element].color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.lineCap = 'round';
  if (element === 'ember') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.9, -r * 0.1, r * 0.7, r * 0.9, 0, r);
    ctx.bezierCurveTo(-r * 0.7, r * 0.9, -r * 0.9, -r * 0.1, 0, -r);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.bezierCurveTo(r * 0.4, r * 0.1, r * 0.3, r * 0.6, 0, r * 0.7);
    ctx.bezierCurveTo(-r * 0.3, r * 0.6, -r * 0.4, r * 0.1, 0, -r * 0.3);
    ctx.fill();
  } else if (element === 'frost') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      ctx.lineTo(Math.cos(a + 0.5) * r * 0.8, Math.sin(a + 0.5) * r * 0.8);
      ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      ctx.lineTo(Math.cos(a - 0.5) * r * 0.8, Math.sin(a - 0.5) * r * 0.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // gale: three sweeping arcs
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.35 + i * 0.3), Math.PI * (0.15 + i * 0.5), Math.PI * (1.1 + i * 0.5));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCardBack(ctx, x, y, w, h) {
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = '#7a1f1f';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, x + 7, y + 7, w - 14, h - 14, 7);
  ctx.strokeStyle = 'rgba(217,164,65,0.7)';
  ctx.stroke();
  drawElementIcon(ctx, 'ember', x + w / 2, y + h / 2, Math.min(w, h) * 0.22, GOLD);
}

// A face-up card. opts: selected, hover, dimmed (unaffordable), tiny.
export function drawCard(ctx, card, x, y, w, h, opts = {}) {
  const el = ELEMENTS[card.element];
  const lift = opts.hover ? -14 : 0;
  y += lift;
  ctx.save();
  if (opts.dimmed) ctx.globalAlpha = 0.55;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = opts.selected ? 22 : 10;
  ctx.shadowOffsetY = 4;
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = opts.selected ? '#ffd23e' : el.dark;
  ctx.lineWidth = opts.selected ? 4 : 2;
  ctx.stroke();
  // header band with the name left-aligned and the cost gem at the
  // top-right corner, so the two never overlap even on small cards.
  rr(ctx, x + 3, y + 3, w - 6, h * 0.2, 8);
  ctx.fillStyle = el.color;
  ctx.fill();
  const name = card.name.length > 16 ? card.name.slice(0, 15) + '…' : card.name;
  const nameSize = Math.max(8, Math.min(w * 0.085, (w - 40) / (name.length * 0.6)));
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${nameSize}px Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x + 10, y + h * 0.13, w - 40);
  // cost gem, top-right
  ctx.beginPath();
  ctx.arc(x + w - 16, y + 16, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#2b4c7e';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, String(card.cost), x + w - 16, y + 17, 15, '#fff');
  // art
  const artY = y + h * 0.48;
  drawElementIcon(ctx, card.element, x + w / 2, artY, w * 0.26);
  if (!opts.compact && card.kind === 'creature') {
    ctx.textAlign = 'center';
    ctx.font = `italic ${Math.max(10, w * 0.07)}px Georgia, serif`;
    ctx.fillStyle = '#5a4632';
    ctx.fillText(card.text, x + w / 2, y + h * 0.72, w - 12);
  } else if (!opts.compact) {
    ctx.textAlign = 'center';
    ctx.font = `italic ${Math.max(10, w * 0.068)}px Georgia, serif`;
    ctx.fillStyle = '#5a4632';
    const words = card.text.split(' ');
    let line = '';
    let ly = y + h * 0.68;
    for (const word of words) {
      const trial = line ? line + ' ' + word : word;
      if (ctx.measureText(trial).width > w - 14 && line) {
        ctx.fillText(line, x + w / 2, ly);
        ly += 13;
        line = word;
      } else line = trial;
    }
    ctx.fillText(line, x + w / 2, ly);
    text(ctx, 'SPELL', x + w / 2, y + h * 0.86, 11, el.dark);
  }
  // attack / health pips
  if (card.kind === 'creature') {
    ctx.beginPath();
    ctx.arc(x + 18, y + h - 18, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#c0392b';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, String(card.atk), x + 18, y + h - 17, 15, '#fff');
    ctx.beginPath();
    ctx.arc(x + w - 18, y + h - 18, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#2e7d32';
    ctx.fill();
    ctx.stroke();
    text(ctx, String(card.hp), x + w - 18, y + h - 17, 15, '#fff');
  }
  ctx.restore();
}

// Geometry shared with input handling: every clickable rect.
export function layout(state) {
  const handN = state.player.hand.length;
  const cardW = 132;
  const cardH = 186;
  const gap = 10;
  const totalW = handN * cardW + (handN - 1) * gap;
  const startX = (VIEW_W - totalW) / 2;
  const handCards = state.player.hand.map((card, i) => ({
    card, index: i,
    x: startX + i * (cardW + gap), y: VIEW_H - cardH - 12, w: cardW, h: cardH,
  }));
  const laneW = 300;
  const laneGap = 26;
  const lanesX = (VIEW_W - (LANES * laneW + (LANES - 1) * laneGap)) / 2;
  const lanes = Array.from({ length: LANES }, (_, i) => ({
    index: i,
    x: lanesX + i * (laneW + laneGap), y: 168, w: laneW, h: 268,
    cx: lanesX + i * (laneW + laneGap) + laneW / 2,
  }));
  return {
    handCards,
    lanes,
    endTurn: { x: VIEW_W - 190, y: VIEW_H - 66, w: 168, h: 48 },
    enemyFace: { x: VIEW_W / 2 - 130, y: 14, w: 260, h: 46 },
    playerFace: { x: 24, y: VIEW_H - 120, w: 200, h: 56 },
    mute: { x: VIEW_W - 46, y: 14, w: 32, h: 32 },
    lanesY: 168,
  };
}

function drawHpBar(ctx, x, y, w, h, hp, maxHp, label, color) {
  rr(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  const frac = Math.max(0, hp / maxHp);
  if (frac > 0) {
    rr(ctx, x + 2, y + 2, (w - 4) * frac, h - 4, 5);
    ctx.fillStyle = color;
    ctx.fill();
  }
  text(ctx, `${label}  ${Math.max(0, hp)} / ${maxHp}`, x + w / 2, y + h / 2 + 1, 15, '#fff');
}

function drawEnergy(ctx, x, y, energy, max) {
  for (let i = 0; i < max; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 24, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = i < energy ? '#3f9de0' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = '#bfe6f7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  text(ctx, 'Energy', x - 8, y, 13, '#cfe8ff', 'right');
}

function drawBoardCreature(ctx, card, cx, cy, w, h, side) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  drawCard(ctx, card, x, y, w, h, { compact: true });
  if (side === 'enemy') {
    ctx.save();
    ctx.globalAlpha = 0.12;
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }
}

export function drawTable(ctx, state, ui) {
  // felt
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 80, VIEW_W / 2, VIEW_H / 2, 760);
  g.addColorStop(0, '#2c5d3a');
  g.addColorStop(1, '#122b1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, VIEW_W - 16, VIEW_H - 16);

  const L = layout(state);

  // enemy header: name, life, hand/deck counts
  text(ctx, 'THE ASHEN RIVAL', VIEW_W / 2, 34, 17, '#e8d9b0');
  drawHpBar(ctx, L.enemyFace.x, L.enemyFace.y + 30, L.enemyFace.w, 20, state.enemy.hp, state.enemy.maxHp, '♥', '#c0392b');
  text(ctx, `Hand ${state.enemy.hand.length}   Deck ${state.enemy.deck.length}`, VIEW_W / 2 + 190, 40, 13, '#b9c9a8', 'left');
  // enemy hand as card backs
  const backs = Math.min(state.enemy.hand.length, 7);
  for (let i = 0; i < backs; i++) {
    drawCardBack(ctx, VIEW_W / 2 - backs * 26 + i * 52, 84, 46, 64);
  }

  // lanes
  for (const lane of L.lanes) {
    const hot = ui.targeting && ui.targeting.lane === lane.index;
    rr(ctx, lane.x, lane.y, lane.w, lane.h, 12);
    ctx.fillStyle = hot ? 'rgba(255,210,62,0.22)' : 'rgba(0,0,0,0.28)';
    ctx.fill();
    ctx.strokeStyle = hot ? '#ffd23e' : 'rgba(217,164,65,0.45)';
    ctx.lineWidth = hot ? 3 : 1.5;
    ctx.stroke();
    text(ctx, `LANE ${lane.index + 1}`, lane.cx, lane.y + 16, 12, '#d8c9a0');
    const foe = state.enemy.board[lane.index];
    if (foe) drawBoardCreature(ctx, foe, lane.cx, lane.y + 81, 84, 118, 'enemy');
    const mine = state.player.board[lane.index];
    if (mine) drawBoardCreature(ctx, mine, lane.cx, lane.y + 207, 84, 118, 'player');
    if (ui.hoverLane === lane.index && ui.selected !== null && state.phase === 'play') {
      rr(ctx, lane.x + 2, lane.y + 2, lane.w - 4, lane.h - 4, 10);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // turn banner
  const banner =
    state.phase === 'play' ? `YOUR TURN — Turn ${state.turn}` :
    state.phase === 'ai' ? 'RIVAL’S TURN…' :
    state.phase === 'combat' ? 'COMBAT!' : '';
  if (banner) text(ctx, banner, VIEW_W / 2, 452, 15, '#ffe9a8');

  // player hand
  for (const slot of L.handCards) {
    const affordable = slot.card.cost <= state.energy;
    drawCard(ctx, slot.card, slot.x, slot.y, slot.w, slot.h, {
      selected: ui.selected === slot.index,
      hover: ui.hoverCard === slot.index,
      dimmed: state.phase === 'play' && !affordable,
    });
  }

  // player status + energy + end turn
  drawHpBar(ctx, L.playerFace.x, L.playerFace.y, L.playerFace.w, 24, state.player.hp, state.player.maxHp, '♥ YOU', '#c0392b');
  drawEnergy(ctx, 250, L.playerFace.y + 40, state.energy, state.energyMax);
  text(ctx, `Deck ${state.player.deck.length}`, 250, L.playerFace.y + 66, 12, '#b9c9a8', 'left');
  const et = L.endTurn;
  rr(ctx, et.x, et.y, et.w, et.h, 8);
  ctx.fillStyle = state.phase === 'play' ? '#b8860b' : '#5a5a5a';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, state.phase === 'play' ? 'END TURN  ⏎' : '…', et.x + et.w / 2, et.y + et.h / 2 + 1, 16, '#fff');

  // targeting hint
  if (ui.targeting) {
    const hint =
      ui.targeting.id === 'ember-blast' ? 'Choose a rival creature — or the rival’s life total.' :
      ui.targeting.id === 'rally' ? 'Choose one of your creatures.' : '';
    text(ctx, hint, VIEW_W / 2, 486, 15, '#ffd23e');
  } else if (ui.selected !== null) {
    const card = state.player.hand[ui.selected];
    if (card && card.kind === 'creature') text(ctx, 'Click a lane to play ' + card.name + ' — Esc to cancel.', VIEW_W / 2, 486, 14, '#ffe9a8');
  }

  // log, last three lines — in the empty strip left of the hand, above
  // the life bar, so it never overlaps the HUD.
  ctx.textAlign = 'left';
  ctx.font = '13px Georgia, serif';
  const lines = state.log.slice(-3);
  lines.forEach((line, i) => {
    ctx.fillStyle = `rgba(232,217,176,${0.95 - i * 0.25})`;
    ctx.fillText(line, 24, 524 + i * 18);
  });

  // floaters (damage numbers)
  for (const f of ui.floaters || []) {
    const age = (Date.now() - f.born) / 900;
    if (age >= 1) continue;
    ctx.globalAlpha = 1 - age;
    text(ctx, f.text, f.x, f.y - age * 46, 26, f.color);
    ctx.globalAlpha = 1;
  }

  // mute button
  const m = L.mute;
  rr(ctx, m.x, m.y, m.w, m.h, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  text(ctx, ui.muted ? '✕' : '♪', m.x + 16, m.y + 17, 15, '#e8d9b0');
}

export function drawTitle(ctx, state) {
  const g = ctx.createRadialGradient(VIEW_W / 2, 300, 60, VIEW_W / 2, 360, 700);
  g.addColorStop(0, '#3a2a12');
  g.addColorStop(1, '#120d06');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, VIEW_W - 16, VIEW_H - 16);
  drawElementIcon(ctx, 'ember', VIEW_W / 2, 118, 44);
  text(ctx, 'CROWN OF EMBERS', VIEW_W / 2, 208, 58, '#f3d98b');
  text(ctx, 'A duel of cards in three lanes', VIEW_W / 2, 258, 20, '#d8c9a0', 'center', 'normal', 'italic');
  // sample cards fanned
  const samples = [
    { id: 'phoenix', name: 'Phoenix', kind: 'creature', element: 'ember', cost: 5, atk: 6, hp: 5, text: 'Returns from its own ash.' },
    { id: 'winter-warden', name: 'Winter Warden', kind: 'creature', element: 'frost', cost: 3, atk: 3, hp: 5, text: 'Guards the frozen gate.' },
    { id: 'tempest-roc', name: 'Tempest Roc', kind: 'creature', element: 'gale', cost: 3, atk: 4, hp: 4, text: 'Its wings are weather.' },
  ];
  samples.forEach((c, i) => drawCard(ctx, c, VIEW_W / 2 - 234 + i * 168, 300, 132, 186));
  text(ctx, 'Ember beats Gale · Gale beats Frost · Frost beats Ember', VIEW_W / 2, 528, 16, '#e8d9b0');
  text(ctx, 'Play cards with energy, strike across the lanes, take the rival to 0 life.', VIEW_W / 2, 556, 15, '#c9b98d', 'center', 'normal');
  text(ctx, '▶  CLICK OR PRESS ENTER TO BEGIN', VIEW_W / 2, 612, 20, '#ffd23e');
  text(ctx, 'Mouse to play · 1–5 select a card · Enter ends the turn · Esc cancels', VIEW_W / 2, 652, 13, '#9a8f78', 'center', 'normal');
}

export function drawEnd(ctx, state) {
  const won = state.phase === 'won';
  ctx.fillStyle = 'rgba(10,8,4,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  rr(ctx, VIEW_W / 2 - 330, 150, 660, 420, 16);
  ctx.fillStyle = won ? '#20301c' : '#33160f';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, won ? 'VICTORY' : 'DEFEAT', VIEW_W / 2, 220, 52, won ? '#ffd23e' : '#e0705a');
  text(ctx, won ? 'The Ember Crown is yours.' : 'The court falls silent.', VIEW_W / 2, 272, 19, '#e8d9b0', 'center', 'normal', 'italic');
  const s = state.stats;
  const lines = [
    `Turns played: ${s.turns}`,
    `Cards played: ${s.cardsPlayed}`,
    `Damage dealt: ${s.damageDealt}`,
    `Surges triggered: ${s.surges}`,
    `Life remaining: ${Math.max(0, state.player.hp)} / ${state.player.maxHp}`,
  ];
  lines.forEach((line, i) => text(ctx, line, VIEW_W / 2, 330 + i * 30, 17, '#f0e6cc', 'center', 'normal'));
  text(ctx, '▶  PRESS ENTER TO PLAY AGAIN', VIEW_W / 2, 520, 18, '#ffd23e');
}
