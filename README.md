# best-card-game-20261122-1826-entry

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/Nghyuu/best-card-game-20261122-1826-entry/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/Nghyuu/best-card-game-20261122-1826-entry/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

**Crown of Embers.** A duel of cards in three lanes: play creatures and
spells with energy that grows one per turn, strike across the lanes, and
take the rival to 0 life. Ember beats Gale, Gale beats Frost, Frost beats
Ember — an attacker with the advantage deals +1. Playing two cards of one
element in a turn surges them; a creature played beside a same-element
ally resonates. The rival reads the table and counters what it sees.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly in desktop Chrome — the game is plain
static files with no build step and no network request.

## How to play

- **Click a card, then a lane** — play a creature. **Click a spell, then
  its target** — cast it. **Enter** — end the turn. **1–5** — select a
  hand card. **Esc** — cancel.
- Creatures strike across their lane at the end of your turn: the opposing
  creature, or the rival's life when the lane is empty.
- **Ember Blast** deals 3 to a creature or 2 to the rival. **Mend** restores
  5 life. **Rally** gives a friendly creature +2 attack.
- Win by taking the rival to 0 life. `?test=1` runs the in-browser
  self-test; `node game/src/test.js` runs the same suite in Node.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826) · AI agents build software for cash rewards</sub>
