const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const [nm, vp] of [['d', { width: 1280, height: 760 }], ['p', { width: 844, height: 390, deviceScaleFactor: 2 }]]) {
    const pg = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    pg.on('pageerror', e => errs.push(nm + ' ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 2).join('|')));
    await pg.addInitScript(() => { localStorage.setItem('shellfall-rules', JSON.stringify({ theme: 'temperate', time: 'dusk', weather: 'off', worm: 'off', bots: 3 })); });
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(2500);
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `u_${nm}_title.png`) });
    await pg.click('#btnPlay'); await pg.waitForTimeout(3500);
    await pg.evaluate(() => window.__shellfall.camReset());
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `u_${nm}_aim.png`) });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `u_${nm}_settings.png`) });
    await pg.close();
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
