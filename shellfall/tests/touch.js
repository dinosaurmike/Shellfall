const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const [nm, vp, dpr] of [['iphone14', { width: 844, height: 390 }, 3], ['iphoneSE', { width: 667, height: 375 }, 2]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(nm + ' ' + e.message));
    await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 3, time: 'day' })); });
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(1200);
    await pg.tap('#btnPlay'); await pg.waitForTimeout(2500);
    const cdp = await ctx.newCDPSession(pg);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
    // layout numbers
    const lay = await pg.evaluate(() => {
      const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const small = [...document.querySelectorAll('#hudBottom button, #hudTop button')].filter(e => e.offsetParent && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect()).filter(b => b.width > 0 && (b.width < 40 || b.height < 40)).length;
      return { fire: r('btnFire'), move: r('grpMove'), angle: r('grpAngle'), power: r('grpPower'), pick: r('wpick'), small };
    });
    console.log(nm, 'layout', JSON.stringify(lay));
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `mt_${nm}_aim.png`) });
    // thumb-stick aim: drag up-right from the middle of the screen
    const a0 = await pg.evaluate(() => { const g = window.__shellfall.myTank(); return g && [g.angle, g.power]; });
    const cx = vp.width / 2, cy = vp.height / 2;
    await touch('touchStart', [[cx, cy]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[cx + k * 10, cy - k * 10]]); await pg.waitForTimeout(30); }
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `mt_${nm}_stick.png`) });
    await touch('touchEnd', []);
    const a1 = await pg.evaluate(() => { const g = window.__shellfall.myTank(); return g && [g.angle, g.power]; });
    console.log(nm, 'stick aim', JSON.stringify(a0), '->', JSON.stringify(a1));
    // pinch out with two fingers
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let k = 1; k <= 10; k++) { await touch('touchMove', [[cx - 40 - k * 12, cy], [cx + 40 + k * 12, cy]]); await pg.waitForTimeout(30); }
    await touch('touchEnd', []);
    await pg.waitForTimeout(300);
    const z = await pg.evaluate(() => window.__shellfall.camZ);
    const a2 = await pg.evaluate(() => { const g = window.__shellfall.myTank(); return g && [g.angle, g.power]; });
    console.log(nm, 'pinch zoom', z.toFixed(2), 'aim untouched by pinch', JSON.stringify(a2) === JSON.stringify(a1), 'fit button', await pg.evaluate(() => !document.getElementById('btnFit').hidden));
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `mt_${nm}_zoom.png`) });
    // weapon tray
    await pg.tap('#wpick'); await pg.waitForTimeout(300);
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `mt_${nm}_tray.png`) });
    const tray = await pg.evaluate(() => document.getElementById('hudBottom').classList.contains('tray'));
    await pg.evaluate(() => document.querySelectorAll('#wbtns .wbtn')[3].click()); await pg.waitForTimeout(200);
    console.log(nm, 'tray opened', tray, 'picked', await pg.evaluate(() => document.getElementById('wpickName').textContent), 'tray closed', await pg.evaluate(() => !document.getElementById('hudBottom').classList.contains('tray')));
    // double tap to fit
    await touch('touchStart', [[cx, cy + 20]]); await touch('touchEnd', []); await pg.waitForTimeout(80);
    await touch('touchStart', [[cx, cy + 20]]); await touch('touchEnd', []); await pg.waitForTimeout(2500);
    console.log(nm, 'after double-tap zoom target', await pg.evaluate(() => window.__shellfall.ucamZ));
    await ctx.close();
  }
  console.log('errors', errs);
  await b.close();
})();
