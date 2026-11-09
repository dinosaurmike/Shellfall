const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  let stuck = 0, total = 0;
  for (let r = 0; r < 10; r++) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
    pg.on('pageerror', e => console.log('ERR', e.message));
    await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 2 })); });
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(500);
    await pg.click('#btnPlay'); await pg.waitForTimeout(300);
    for (let k = 0; k < 300; k++) { const ok = await pg.evaluate(() => { const g = window.__shellfall; if (!(g.phase === 'aim' && g.cur === 0)) g.step(10); return g.phase === 'aim' && g.cur === 0; }); if (ok) break; }
    await pg.waitForTimeout(200);
    const res = [];
    for (const id of ['mvR', 'mvL']) {
      const x0 = await pg.evaluate(() => window.__shellfall.myTank() && window.__shellfall.myTank().x);
      const box = await pg.locator('#' + id).boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down(); await pg.waitForTimeout(550); await pg.mouse.up();
      await pg.waitForTimeout(100);
      const x1 = await pg.evaluate(() => window.__shellfall.myTank() && window.__shellfall.myTank().x);
      res.push(id + ' ' + Math.round(x0) + '->' + Math.round(x1));
      total++; if (x0 === x1) stuck++;
    }
    const why = await pg.evaluate(() => { const g = window.__shellfall, t = g.myTank(); if (!t) return 'no tank'; const W = g.W, x = Math.round(t.x); let s = ''; for (const dx of [-12, -10, 10, 12]) { let col = ''; for (let yy = t.y - 10; yy <= t.y + 1; yy++) col += g.grid[yy * W + x + dx] ? '#' : '.'; s += dx + ':' + col + ' '; } return s + ' fuel ' + t.fuel + ' locked ' + t.locked; });
    console.log(r, res.join(' | '), why);
    await pg.close();
  }
  console.log('stuck', stuck, 'of', total);
  await b.close();
})();
