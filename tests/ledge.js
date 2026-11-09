const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, fuel: 'unlimited' })); });
  let ok = 0, bad = 0;
  for (let r = 0; r < 12; r++) {
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(400);
    await pg.click('#btnPlay'); await pg.waitForTimeout(200);
    for (let k = 0; k < 300; k++) { const okk = await pg.evaluate(() => { const g = window.__shellfall; if (!(g.phase === 'aim' && g.cur === 0)) g.step(10); return g.phase === 'aim' && g.cur === 0; }); if (okk) break; }
    for (const dir of [1, -1]) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const a = await pg.evaluate(d => { const g = window.__shellfall; const log = g.drive(d, 80); return { end: log[log.length - 1], lw: g.ledgeWarn, x: g.myTank().x }; }, dir);
        if (!a.lw || a.lw.dir !== dir || Math.abs(a.lw.x - a.x) > 2) break;
        await pg.waitForTimeout(320);
        const b2 = await pg.evaluate(d => { const g = window.__shellfall; const pr = g.probeStep(d); const log = g.drive(d, 6); return { pr, log }; }, dir);
        const moved = b2.log[b2.log.length - 1] !== a.end;
        if (moved) ok++; else { bad++; console.log('STUCK map', r, 'dir', dir, 'at', a.end, 'lw', a.lw.x, 'lipY', a.lw.lipY, 'drop', a.lw.drop, 'probe', JSON.stringify(b2.pr), 'raw', JSON.stringify(await pg.evaluate(() => window.__shellfall.ghostRaw()))); }
        if (!moved) break;
      }
    }
  }
  console.log('passed over', ok, 'stuck', bad);
  await b.close();
})();
