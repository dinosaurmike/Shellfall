const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join('|')));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, slowmo: false, sound: false, music: false })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html');
  await pg.waitForTimeout(400);
  // each mission: list of [x, y, weapon] shots (targets by index or fixed points)
  const plans = [
    [['t1', 'shell'], ['t1', 'shell'], ['t1', 'shell']],
    [['t1', 'shell'], ['t1', 'shell'], ['t1', 'shell']],
    [['pt', 'shock', 700, 440]],
    [['t1a', 'avalanche', 0, -10]],
    [['pt', 'shell', 900, 398], ['pt', 'shell', 900, 398]],
    [['pt', 'shell', 700, 471], ['pt', 'shock', 700, 490]],
    [['pt', 'shell', 592, 412], ['pt', 'shell', 592, 412]],
    [['t1', 'quake'], ['t1', 'shell']],
  ];
  for (let i = 0; i < plans.length; i++) {
    await pg.evaluate(i => window.__shellfall.startMission(i), i);
    let res = null;
    for (const [kind, wk, px, py] of plans[i]) {
      const st = await pg.evaluate(() => ({ ph: window.__shellfall.phase, done: !document.getElementById('missionModal').hidden }));
      if (st.done) break;
      // wait for aim
      for (let k = 0; k < 40; k++) { const ph = await pg.evaluate(() => { window.__shellfall.step(15); return window.__shellfall.phase; }); if (ph === 'aim' || ph === 'roundover') break; }
      await pg.evaluate(([kind, wk, px, py]) => {
        const g = window.__shellfall;
        const t = g.tanks.find(q => q.ctrl === 'target' && q.alive) || g.tanks[1];
        let x = px, y = py;
        if (kind === 't1') { x = t.x; y = t.y - 5; }
        if (kind === 't1a') { x = t.x + (px || 0); y = t.y + (py || 0); }
        g.aimAt(x, y, wk); g.fireMine();
      }, [kind, wk, px, py]);
      await pg.waitForTimeout(220);
      for (let k = 0; k < 80; k++) { const ph = await pg.evaluate(() => { window.__shellfall.step(15); return window.__shellfall.phase; }); if (ph === 'aim' || ph === 'roundover') break; }
    }
    res = await pg.evaluate(() => ({ title: document.getElementById('mmTitle').textContent, shown: !document.getElementById('missionModal').hidden, text: document.getElementById('mmText').textContent, targets: window.__shellfall.tanks.filter(t => t.ctrl === 'target').map(t => t.name + ':' + Math.round(t.hp) + (t.alive ? '' : ':dead')).join(' ') }));
    console.log(i + 1, JSON.stringify(res));
    if (i === 4 || i === 6) await pg.screenshot({ path: require('path').join(__dirname, 'output', `m${i + 1}.png`) });
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
