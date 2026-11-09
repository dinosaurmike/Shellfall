const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const theme of ['desert', 'arctic', 'desert', 'temperate', 'swamp', 'desert']) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
    await pg.addInitScript(t => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ theme: t, weather: 'changing', worm: 'off', bots: 4 })); }, theme);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(500);
    await pg.click('#btnPlay'); await pg.waitForTimeout(300);
    // let the world settle, then watch every tank while nobody fires (it is our turn)
    await pg.evaluate(() => window.__shellfall.step(240));
    const log = await pg.evaluate(() => {
      const g = window.__shellfall, out = g.tanks.map(() => ({ ys: new Set(), tilts: new Set(), air: 0, moves: 0, seq: [] }));
      const prev = g.tanks.map(t => t.y);
      for (let i = 0; i < 600; i++) {
        g.step(1);
        g.tanks.forEach((t, k) => { const o = out[k]; o.ys.add(t.y); if (o.seq.length < 70) o.seq.push((t.air ? 'a' : '') + t.y + (t.x !== o.lx ? '>' + Math.round(t.x) : '')); o.lx = t.x; if (t.air) o.air++; if (t.y !== prev[k]) o.moves++; prev[k] = t.y; o.tilts.add(Math.round(g.poseOf(k).tilt * 100)); });
      }
      return out.map((o, k) => ({ n: g.tanks[k].name, ys: [...o.ys].join('/'), moves: o.moves, air: o.air, tilts: [...o.tilts].join('/'), seq: o.moves ? o.seq.join(' ') : '', below: (() => { const t = g.tanks[k], x = Math.round(t.x), m = []; for (let dx = -8; dx <= 8; dx += 2) m.push(g.grid[(t.y + 1) * g.W + x + dx]); return m.join(','); })() }));
    });
    for (const o of log) if (o.moves) console.log(theme, o.n, 'moves', o.moves, 'air', o.air, 'below', o.below, '\n   ', o.seq);
    await pg.close();
  }
  await b.close();
})();
