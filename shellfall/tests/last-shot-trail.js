const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, time: 'day', theme: 'temperate' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(700);
  await pg.click('#btnPlay'); await pg.waitForTimeout(500);
  const waitMine = async () => { for (let k = 0; k < 600; k++) { const ok = await pg.evaluate(() => { const g = window.__shellfall; if (!(g.phase === 'aim' && g.cur === 0)) g.step(10); return g.phase === 'aim' && g.cur === 0; }); if (ok) return; } };
  await waitMine();
  let maxZ = 0;
  await pg.evaluate(() => { const g = window.__shellfall.myTank(); g.angle = g.x < 640 ? 50 : 130; g.power = 66; window.__shellfall.fireMine(); });
  await pg.waitForTimeout(250);
  await waitMine();
  for (let i = 0; i < 4; i++) { await pg.waitForTimeout(150); await pg.screenshot({ path: require('path').join(__dirname, 'output', 'cue' + i + '.png') }); }
  console.log('tankpos', JSON.stringify(await pg.evaluate(() => { const t = window.__shellfall.tanks[0], r = document.getElementById('view').getBoundingClientRect(); return { x: t.x, y: t.y, rx: r.x, ry: r.y, w: r.width, h: r.height }; })));
  for (let i = 0; i < 6; i++) { maxZ = Math.max(maxZ, await pg.evaluate(() => window.__shellfall.camZ || 0)); await pg.waitForTimeout(100); }
  await pg.screenshot({ path: require('path').join(__dirname, 'output', 'trail.png') });
  console.log('lastShot pts', await pg.evaluate(() => { const L = window.__shellfall.lastShotOf(0); return L ? L.pts.length / 2 + ' a ' + L.a + ' p ' + L.p : 'none'; }), 'maxZ', maxZ);
  await b.close();
})();
