const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 3, wind: 'off' })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(500);
  await pg.click('#btnPlay'); await pg.waitForTimeout(300);
  for (let r = 0; r < 24; r++) {
    for (let k = 0; k < 600; k++) { const ok = await pg.evaluate(() => { const g = window.__shellfall; g.step(10); return g.phase === 'aim' && g.cur === 0; }); if (ok) break; }
    const res = await pg.evaluate(() => {
      const g = window.__shellfall, me = g.myTank();
      if (!me || g.phase !== 'aim' || g.cur !== 0) return null;
      me.weapon = g.WI.lava; me.ammo[g.WI.lava] = 3; g.tanks[0].ammo[g.WI.lava] = 3;
      const hp0 = me.hp; g.fireMine(); return { x: me.x, y: me.y, hp0, th: g.S.theme, lm: g.landmark && g.landmark.kind };
    });
    if (!res) { await pg.evaluate(() => window.__shellfall.nextRound()); continue; }
    await pg.waitForTimeout(200);
    await pg.evaluate(() => window.__shellfall.step(20));
    const imp = await pg.evaluate(() => { const g = window.__shellfall; return g.shot && g.shot.impact; });
    await pg.evaluate(() => window.__shellfall.step(500));
    const after = await pg.evaluate(() => { const me = window.__shellfall.tanks[0]; return { hp: me.hp, alive: me.alive }; });
    const d = imp ? Math.round(Math.hypot(imp.x - res.x, imp.y - res.y)) : null;
    console.log(r, res.th, res.lm, 'impact dist', d, imp && Math.round(imp.x) + ',' + Math.round(imp.y), 'tank', Math.round(res.x) + ',' + res.y, 'hp', res.hp0, '->', Math.round(after.hp), after.alive ? '' : 'DEAD');
    await pg.evaluate(() => window.__shellfall.nextRound()); await pg.waitForTimeout(100);
  }
  console.log('errors', errs);
  await b.close();
})();
