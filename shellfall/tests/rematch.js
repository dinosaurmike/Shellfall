const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1 })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(500);
  await pg.click('#btnPlay'); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__shellfall.allBots());
  for (let i = 0; i < 300; i++) { const ph = await pg.evaluate(() => { window.__shellfall.step(200); return window.__shellfall.phase; }); if (ph === 'roundover') break; }
  const before = await pg.evaluate(() => ({ seed: window.__shellfall.worldSeed, th: window.__shellfall.TH.name, lm: window.__shellfall.landmark && window.__shellfall.landmark.x }));
  await pg.click('#btnRematch'); await pg.waitForTimeout(400);
  const after = await pg.evaluate(() => ({ seed: window.__shellfall.worldSeed, th: window.__shellfall.TH.name, lm: window.__shellfall.landmark && window.__shellfall.landmark.x, round: window.__shellfall.round, ph: window.__shellfall.phase }));
  console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));
  console.log('errors', errs);
  await b.close();
})();
