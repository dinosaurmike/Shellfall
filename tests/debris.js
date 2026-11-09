// A shell passes through a lone grain of sand tumbling through the air, but still bursts on a clump.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, abyss: 'off' })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(600); await pg.click('#btnPlay'); await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => {
    const g = window.__shellfall, M = g.M, W = g.W;
    const out = {};
    for (const [name, place] of [['lone grain', [[0, 0]]], ['clump', [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1]]]]) {
      const x = 640; let y = 60;
      for (const [dx, dy] of place) g.grid[(y + 20 + dy) * W + x + dx] = M.SAND;
      g.shoot(x, y, 'shell');
      const p = g.projs[g.projs.length - 1];
      let burstAt = null;
      for (let i = 0; i < 20; i++) { g.step(1); if (!g.projs.includes(p) || p.dead) { burstAt = Math.round(p.y); break; } }
      out[name] = { burstAt, grainAt: 80, passed: burstAt === null || burstAt > 90 };
      for (const [dx, dy] of place) g.grid[(y + 20 + dy) * W + x + dx] = M.AIR;
      g.step(200);
    }
    return out;
  });
  console.log(JSON.stringify(r)); console.log('errors', errs); await b.close();
})();
