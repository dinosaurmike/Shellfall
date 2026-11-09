const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = []; let sunkSelf = 0, sunkBy = 0, deaths = 0, rounds = 0;
  for (const theme of ['ruins', 'volcanic', 'temperate']) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
    pg.on('pageerror', e => errs.push(theme + ' ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join('|')));
    await pg.addInitScript(t => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ theme: t, abyss: 'auto', weather: 'changing', worm: 'bot', bots: 4, keep: false, mode: 'match', tide: 'water' })); }, theme);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(500);
    await pg.click('#btnPlay'); await pg.waitForTimeout(300);
    for (let i = 0; i < 160 && rounds < 6; i++) {
      const r = await pg.evaluate(() => { const g = window.__shellfall; g.allBots(); g.step(240); return { ph: g.phase }; });
      if (r.ph === 'killcam') await pg.evaluate(() => window.__shellfall.step(400));
      if (r.ph === 'roundover') {
        rounds++;
        const t = await pg.evaluate(() => window.__shellfall.tanks.map(t => ({ a: t.alive, s: !!t.sunk, by: t.lastHitBy, hit: t.hitAt })));
        for (const q of t) { if (!q.a) deaths++; if (q.s) { if (q.by == null) sunkSelf++; else sunkBy++; } } console.log(theme, 'round', rounds, JSON.stringify(t.map(q => (q.a ? 'alive' : q.s ? (q.by == null ? 'SELF-sunk' : 'sunk-by-' + q.by) : 'dead'))));
        if (rounds % 2 === 0) break;
        await pg.evaluate(() => window.__shellfall.nextRound());
      }
      if (errs.length) break;
    }
    await pg.close();
  }
  console.log({ rounds, deaths, sunkBy, sunkSelf });
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
