// Runs the browser test suite against a local server.
//   node tests/run.js           everything (slow: 20-40 minutes with software WebGL)
//   node tests/run.js quick     the core checks (about 6 minutes)
//   node tests/run.js day-game  one or more tests by name
//   node tests/run.js firebase  self-hosted online play (start the emulators first: npm run emulators)
// Each test prints what it measured; a run fails on page errors, sync mismatches or a crash.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS = [
  ['missions', 'All 8 missions can be solved at par', true],
  ['live-sync', 'Live online play: host and joiner stay in lockstep (mock room)', true],
  ['late-join', 'Joining a live game mid-round downloads the world and stays in sync', false],
  ['day-game', 'Day games: lobby, join, alternating turns, leave and come back later (mock db)', true],
  ['day-rounds', 'Day games: round over and the next round started by another player', false],
  ['day-manager', 'Day game manager: leave (bot takes over), end, hide, delete', true],
  ['firebase', 'Self-hosted online play on Firebase: live game, day game, manager and rules (needs npm run emulators)', false],
  ['touch', 'Phones in landscape: thumb-zone layout, thumb-stick aim, pinch zoom, weapon tray, double-tap', true],
  ['split-tap', 'Phones: field taps never split a shell, Split button does; full screen; app manifest', true],
  ['menu-flow', 'Title screen disclosure, pause, exit to menu and play again', true],
  ['drive', 'Tanks can drive both ways on many maps', true],
  ['ledge', 'Ledge warning stops once, the next push goes over', false],
  ['idle-tanks', 'Parked tanks never move or shake', false],
  ['debris', 'Shells pass through lone falling grains but burst on clumps', true],
  ['barrel-clearance', 'Shells never burst against something touching the barrel', false],
  ['abyss', 'Falling into the deadly floor kills and credits the shooter; gems pay', false],
  ['bots-abyss', 'Bots never drive into the abyss on their own', false],
  ['modes', 'King of the Hill, Demolition, highlight reel, photo mode', false],
  ['rematch', 'Rematch replays the same map', false],
  ['last-shot-trail', 'Ghost trail of your last shot, turn cue, no zoom', false],
  ['hover-and-order', 'Turn order strip and hover tooltips', false],
  ['sim-cost', 'Simulation cost per tick on a busy map', false],
  ['ui', 'Screenshots: desktop and phone layouts', false],
  ['look', 'Screenshots: every land, day and night', false],
];

const args = process.argv.slice(2);
// the Firebase test needs the emulators running, so it only runs when named
const pick = args.length === 0 ? TESTS.filter(t => t[0] !== 'firebase') : args[0] === 'quick' ? TESTS.filter(t => t[2]) : TESTS.filter(t => args.includes(t[0]));
const out = path.join(__dirname, 'output');
fs.mkdirSync(out, { recursive: true });

// start the static server unless one is already running
const url = process.env.SHELLFALL_URL || 'http://localhost:8765/';
let server = null;
async function ensureServer() {
  try { const r = await fetch(url + 'index.html'); if (r.ok) return; } catch (e) {}
  server = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'serve.js'), '8765'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); try { if ((await fetch(url + 'index.html')).ok) return; } catch (e) {} }
  throw new Error('Could not start the local server');
}

function runOne(name) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join(__dirname, name + '.js')], { cwd: out, env: process.env });
    let log = '';
    p.stdout.on('data', d => { log += d; });
    p.stderr.on('data', d => { log += d; });
    const kill = setTimeout(() => { p.kill('SIGKILL'); log += '\nTIMED OUT'; }, 6 * 60 * 1000);
    p.on('close', code => {
      clearTimeout(kill);
      const errs = /errors \[\s*\]/.test(log) || !/errors/.test(log);
      const diff = /diff [1-9]|HASH DIFF|hash match false|SYNTAX/.test(log);
      const ok = code === 0 && errs && !diff && !/TIMED OUT/.test(log);
      fs.writeFileSync(path.join(out, name + '.log'), log);
      resolve({ name, ok, secs: Math.round((Date.now() - t0) / 1000), tail: log.trim().split('\n').slice(-4).join('\n    ') });
    });
  });
}

(async () => {
  await ensureServer();
  const results = [];
  for (const [name, what] of pick) {
    process.stdout.write(`- ${name}: ${what} ... `);
    const r = await runOne(name);
    results.push(r);
    console.log(r.ok ? `ok (${r.secs}s)` : `FAILED (${r.secs}s)\n    ${r.tail}`);
  }
  if (server) server.kill();
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed. Logs and screenshots are in tests/output/.`);
  process.exit(bad.length ? 1 : 0);
})();
