const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 4, time: 'day' })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(700);
  await pg.click('#btnPlay'); await pg.waitForTimeout(800);
  await pg.evaluate(() => window.__shellfall.camReset()); await pg.waitForTimeout(500);
  // hover a bot tank
  const pos = await pg.evaluate(() => { const g = window.__shellfall, t = g.tanks.find(q => q.ctrl === 'bot' && q.alive), r = document.getElementById('view').getBoundingClientRect(); const s = Math.min(r.width / g.W, r.height / g.H); return { x: r.x + (r.width - g.W * s) / 2 + t.x * s, y: r.y + (r.height - g.H * s) / 2 + (t.y - 5) * s }; });
  await pg.mouse.move(pos.x, pos.y); await pg.waitForTimeout(900);
  await pg.screenshot({ path: require('path').join(__dirname, 'output', 'qol.png') });
  console.log('order chips', await pg.evaluate(() => document.querySelectorAll('#order .o').length));
  console.log('errors', errs);
  await b.close();
})();
