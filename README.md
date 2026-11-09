# Shellfall

Pixel artillery on a world you can blow apart, flood, freeze and set on fire, one grain at a time.

Turn-based tank artillery in the spirit of the classics, built on a falling-sand world:
every pixel is a grain of dirt, rock, sand, water, lava, oil, gas, ice or metal, and
everything reacts. One tank type; the variety is in the shells and the chemistry.

The whole game is one self-contained file, `index.html` (about 370 KB, plain JavaScript,
no build step). It was written to run as a claude.ai Artifact, but it plays solo in any
modern browser.

## Play it

```bash
npm run serve
```

Then open http://localhost:8765/. Solo play, missions and expeditions work anywhere.
Online play (live and day games) needs the page running as a claude.ai Artifact, because it
uses the Artifact platform's `room`, `db` and `user` capabilities (see below).

Controls: drag on the field to aim, `A`/`D` to drive, `Q`/`E` to change shells, `Space` to fire
(again mid-air to split), `R` to undo driving, `F` to fast-forward other crews' turns,
`T` for thermal vision, `P` for photo mode, `Esc` to pause.

## What's in it

- **World**: falling-sand simulation in 32x32 chunks with chemistry (lava and water make
  obsidian and steam, gas ignites, gunpowder chains, acid eats down, electricity runs through
  water and metal), a heat grid, wind field, weather, day and night.
- **Maps**: per-land palettes and layered rock, mesas, arches, carved caves, fossils, gem veins
  worth cash, a landmark per land (lighthouse, windmill, radio mast, shrine, stilt hut, giant
  skeleton), props that burn, and a deadly floor of lava, deep water or void.
  Twelve hand-picked named maps plus a map of the day.
- **Modes**: match, King of the Hill, Demolition, Expedition (co-op descent to a boss), 8 missions.
- **Crews**: a recurring bot cast (Rusty, Sarge, Mortimer, Dot, Hal, Brick, Nell, Gus) with fixed
  temperaments, portraits, radio chatter and grudges that persist on the device.
- **Feel**: kill cam and slow motion, highlight reel, ghost trail of your last shot, squash and
  stretch, synthesized sound and a theme tune.
- **Rendering**: WebGL2 with a limited per-land palette, dithered light, emissive glow, water
  reflections and thermal vision; a 2D canvas fallback when WebGL2 is missing. Quality adjusts
  itself to keep the frame rate up.

## How it works

**Deterministic simulation.** Everything that changes the world runs in a fixed 60 Hz `tick()`
using only deterministic math: a seeded RNG (`rnd()`), table-free sine and cosine (`dsin`/`dcos`),
and `+ - * / sqrt floor`. `Math.random` is only used for looks. Rendering, particles, sound and
camera never feed back into the simulation. `snapshot()`/`restore()` capture the whole
simulation state (used by the kill cam and replays), and `serializeWorld()`/`loadWorld()` turn
it into a compact string.

**Commands.** Every player action is a command: `round`, `turn` (drive steps, angle, power,
weapon), `worm`, `split`. A command applied at the same tick produces the same world everywhere,
so online play only ever sends commands.

**Live online play** (`NET`, uses `room`): the host runs the game and publishes recent commands in
its room presence (capped under 4 KB); joiners replay them in lockstep and never run ahead of the
host. Late joiners download the world in 3 KB chunks over a second room. There is no turn timer;
after 20 seconds the host may hand a missing player's turn to a bot.

**Day games** (`DAY`, uses `db` and `user`): turn-based play over hours or days.

- `games/{code}`: the game card (players, seat order, rules, status, whose turn, standings).
- `games/{code}/moves/m000001...`: one document per command, in order.
- `games/{code}/state/ckpt`: a checkpoint of the world after the latest settled turn (~50-80 KB).
- `games/{code}/kits/{uid}`: each player's shop order for the next round.
- `games/{code}/lock/turn` and `/lock/seat`: short leases so only one copy plays a bot's turn,
  starts a round or edits the seats.

Opening a game loads the checkpoint and replays the moves after it. While someone is aiming the
world holds still, so a turn can wait any length of time and every copy still agrees. Your own
shot is sent once it has landed (so a mid-air split travels with it), then you save the next
checkpoint. Bots move whenever anyone has the game open. A player who leaves keeps their tank as a
bot until the round ends. The day game manager (Play with friends) lists your games and lets you
resume, leave, end, hide or delete them.

**Capabilities declared** when published as an Artifact: `room`, `db`, `user`, `downloads`
(photo mode saves PNGs). Only people with more than view-only access to the Artifact can write to
`db`, so friends need that access to play day games.

## Working on it

`index.html` is organized in sections (search for the `// ====` banners): materials and themes,
rules, terrain generation, the sand simulation, tanks, weapons and explosions, weather, state
and serialization, rounds and turns, bots, the main tick, `NET`, `DAY`, effects, rendering
(camera, overlay, `GLR` WebGL renderer, quality), sound and music, HUD, menus and boot.

After editing, keep the file ASCII-only (some hosts mangle other characters) and check it parses:

```bash
npm run normalize
```

`window.__shellfall` exposes test hooks (stepping the simulation, state hashes, aiming helpers).

## Tests

Browser tests drive the real page with Playwright, against the local server.

```bash
npm install
npx playwright install chromium
npm run test:quick
npm test
```

`test:quick` runs the core checks in about 6 minutes; `npm test` runs everything (much longer
with software WebGL). Each test prints what it measured; logs and screenshots land in
`tests/output/`. Live and day games are tested against stand-ins for the platform:
`tests/mocks/mockroom.js` (room presence over BroadcastChannel) and `tests/mocks/mockdb.js`
(the db and user capabilities on localStorage, with live updates and leases).

## Known gaps

- Day games have only been tested against the mock database, not the real one at scale.
- A day-game player can fire, see the result, close the tab before the shot is sent, and retry.
- Players in a day game can technically write any move; it's built for friends, not strangers.
- Only tested in Chromium. Phones, real GPUs, the Google Fonts and the audio haven't been checked
  on real hardware.
- No push notifications for "your turn".
