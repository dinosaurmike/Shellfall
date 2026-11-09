const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'changing', tide: 'lava', worm: 'bot', bots: 5, theme: 'volcanic', keep: false })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, sound: false, music: false })); localStorage.setItem('shellfall-gl', 'off'); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(400);
  await pg.click('#btnPlay');
  const res = [];
  for (let i = 0; i < 30; i++) {
    const r = await pg.evaluate(() => { const g = window.__shellfall; g.allBots(); const t = performance.now(); g.step(120); const ms = (performance.now() - t) / 120; return { ms, ph: g.phase, deb: 0 }; });
    res.push(r.ms);
    if (r.ph === 'roundover') await pg.evaluate(() => window.__shellfall.nextRound());
  }
  res.sort((a, b) => a - b);
  console.log('sim ms/tick p50', res[15].toFixed(2), 'p90', res[27].toFixed(2), 'max', res[29].toFixed(2));
  console.log('errors', errs);
  await b.close();
})();
