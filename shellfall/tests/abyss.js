// Gameplay: falling in kills with credit, gems pay, bots avoid the edge, and the run stays clean
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pg.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join('|')));
  pg.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push(m.text()); });
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ theme: 'volcanic', abyss: 'auto', weather: 'off', worm: 'off', bots: 3, keep: false, mode: 'match' })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(600);
  await pg.click('#btnPlay'); await pg.waitForTimeout(400);
  // 1. push a bot into the lava with a recent hit from the player
  const r1 = await pg.evaluate(() => {
    const g = window.__shellfall; const v = g.tanks[1], me = g.tanks[0];
    // find a chasm column
    let cx = -1, run = 0, best = 0; for (let x = 40; x < g.W - 40; x++) { let empty = true; for (let y = 100; y < g.abyssY; y++) if (g.grid[y * g.W + x]) { empty = false; break; } if (empty) { run++; if (run > best) { best = run; cx = x - (run >> 1); } } else run = 0; }
    const kills0 = g.scores[me.id].kills;
    v.lastHitBy = me.id; v.hitAt = g.tickN; v.x = cx; v.y = 150; v.air = true; v.vy = 0;
    g.step(200);
    return { cx, alive: v.alive, sunk: v.sunk, kills: g.scores[me.id].kills - kills0, abyss: g.abyssKind, y: v.y };
  });
  console.log('fall', JSON.stringify(r1));
  // 2. gems pay the shooter
  const r2 = await pg.evaluate(() => {
    const g = window.__shellfall; const me = g.tanks[0];
    let gi = -1; for (let i = 0; i < g.grid.length; i++) if (g.grid[i] === g.M.GEM) { gi = i; break; }
    const c0 = g.scores[me.id].cash;
    const x = gi % g.W, y = (gi / g.W) | 0;
    g.explodeAt ? g.explodeAt(x, y, 20, me.id) : null;
    return { gi, x, y, has: !!g.explodeAt, cash: g.scores[me.id].cash - c0 };
  });
  console.log('gems', JSON.stringify(r2));
  // 3. all bots for a while: no one should drive off on their own
  let selfSunk = 0, sunk = 0;
  for (let i = 0; i < 80; i++) {
    const r = await pg.evaluate(() => { const g = window.__shellfall; g.allBots(); g.step(240); return { ph: g.phase, t: g.tanks.map(t => [t.alive, !!t.sunk, t.lastHitBy]) }; });
    if (r.ph === 'killcam') await pg.evaluate(() => window.__shellfall.step(400));
    if (r.ph === 'roundover') { console.log('round over at', i, JSON.stringify(r.t)); break; }
  }
  const fin = await pg.evaluate(() => window.__shellfall.tanks.map(t => ({ n: t.name, alive: t.alive, sunk: !!t.sunk })));
  console.log('final', JSON.stringify(fin));
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
