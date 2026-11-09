# How Shellfall works

The technical notes behind the game: the simulation, the netcode, how day games are stored, and
the renderer. For playing and hosting, see the [README](../README.md) and [HOSTING.md](HOSTING.md).

## Simulation and netcode

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

**Firebase.** Off claude.ai the same `NET` and `DAY` code runs on `FB`, an adapter that offers
the same room, db and user interface on Firebase Realtime Database (see above). Leases use
database transactions.

**Capabilities declared** when published as an Artifact: `room`, `db`, `user`, `downloads`
(photo mode saves PNGs). Only people with more than view-only access to the Artifact can write to
`db`, so friends need that access to play day games.

## Rendering

WebGL2 with a limited per-land palette, dithered light, emissive glow, water reflections and
thermal vision; a 2D canvas fallback when WebGL2 is missing. Quality adjusts itself to keep the
frame rate up.

- **Terrain** is uploaded as a texture of material ids plus a variation byte per grain (grass tops,
  glowing moss and roots, bone in rock, painted metal and wood). The terrain shader colours each
  grain from its material and land, then snaps the result to the land's palette through a 32 x 32 x 32
  colour lookup table, so every land stays inside a small set of colours.
- **Light** is stepped in luminance only and broken up with a Bayer ordered dither, which gives the
  pixel-art banding without colour shifts.
- **Glow** from lava, fire, sparks and shells is drawn to its own buffer, blurred and added back.
- **The deadly floor** (lava, water or void) has its own shader.
- Only the 32-row bands of the world that changed are re-uploaded each frame.

## Working on the code

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

The Firebase path is tested against the real Firebase emulators (Java 11 or later needed). In
one terminal:

```bash
npm run emulators
```

and in another:

```bash
npm run test:firebase
```

It plays a live game and a day game between separate browsers, leaves, ends and deletes, and
checks that the rules turn away a stranger and a player rewriting an old move.

## Known gaps

- Day games have been tested against the mock database and the Firebase emulator, not against
  the real claude.ai database or a live Firebase project at scale.
- A day-game player can fire, see the result, close the tab before the shot is sent, and retry.
- Players in a day game can technically write any move; it's built for friends, not strangers.
  On Firebase, anyone with a game's code can join it, and a player can still delete moves (needed
  to delete a game).
- Firebase Spark limits: 100 simultaneous connections, 1 GB stored, 10 GB downloaded a month.
  A day game stores a 50-80 KB checkpoint (the mover rewrites it after each turn) plus ~0.4 KB
  per move; opening a game downloads the checkpoint and the moves since, then only new moves. A live game's host sends up to ~4 KB
  of presence several times a second while shells fly. Plenty for friends; delete finished day
  games to keep storage down.
- Only tested in Chromium. Phones, real GPUs, the Google Fonts and the audio haven't been checked
  on real hardware.
- No push notifications for "your turn".
