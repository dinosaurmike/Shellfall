const { chromium } = require('playwright');
const GL = process.argv[3] === 'gl', ONLY = process.argv[3] === 'start';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const mode of (process.argv[2] || 'koth,demolition').split(',')) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
    pg.on('pageerror', e => errs.push(mode + ' PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n').slice(0,3).join(' | ')));
    pg.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push(m.text()); });
    await pg.addInitScript(([mode, GL]) => { if (!GL) localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ mode, tide: 'off', worm: 'off', keep: false, bots: 3, teams: 'off', theme: 'temperate', director: true, abyss: 'auto' })); }, [mode, GL]);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html');
    await pg.waitForTimeout(600);
    await pg.click('#btnPlay');
    await pg.waitForTimeout(300);
    const info = await pg.evaluate(() => { const g = window.__shellfall; return { mode: g.mode, hill: g.hill, fort: g.fort && { ...g.fort }, tanks: g.tanks.map(t => [t.name, t.team, t.x, t.y]), S: { teams: g.S.teams, tide: g.S.tide } }; });
    console.log(mode, 'start', JSON.stringify(info));
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `m_${mode}_start${GL ? '_gl' : ''}.png`) });
    if (GL || ONLY) { console.log('after', await pg.evaluate(() => JSON.stringify(window.__shellfall.tanks.map(t => [t.name, t.x])))); await pg.close(); continue; }
    let over = false;
    for (let i = 0; i < 300 && !over; i++) {
      const r = await pg.evaluate(() => { const g = window.__shellfall; g.allBots(); g.step(240); return { ph: g.phase, turn: g.turnNo, alive: g.tanks.filter(t => t.alive).length, hill: g.hill && JSON.stringify(g.hill.pts), fort: g.fort && Math.round(100 * g.fort.left / g.fort.total), aby: g.abyssY, label: document.getElementById('roundLabel') ? document.getElementById('roundLabel').textContent : '' }; });
      if (i % 8 === 0) console.log(' ', i, JSON.stringify(r));
      if (r.ph === 'killcam') await pg.evaluate(() => window.__shellfall.step(400));
      if (r.ph === 'roundover') {
        over = true;
        console.log(mode, 'OVER', JSON.stringify(r), await pg.evaluate(() => document.getElementById('rmWinner').textContent + ' | ' + document.getElementById('rmShotText').textContent + ' | ' + document.getElementById('btnWatch').textContent + ' | hl ' + window.__shellfall.highlights.length));
        await pg.screenshot({ path: require('path').join(__dirname, 'output', `m_${mode}_over.png`) });
        // highlight reel
        const seen = [];
        await pg.evaluate(() => document.getElementById('btnWatch').click());
        for (let k = 0; k < 60; k++) {
          const q = await pg.evaluate(() => { window.__shellfall.step(60); return { ph: window.__shellfall.phase, n: document.getElementById('noticeText').textContent, modal: !document.getElementById('roundModal').hidden }; });
          if (!seen.includes(q.n)) seen.push(q.n);
          if (q.modal) break;
        }
        console.log(mode, 'reel notices', JSON.stringify(seen), 'back at modal', await pg.evaluate(() => window.__shellfall.phase));
      }
    }
    if (mode === 'koth') {
      // photo mode and thermal on a fresh round
      await pg.evaluate(() => window.__shellfall.nextRound()); await pg.waitForTimeout(300);
      await pg.keyboard.press('p');
      const ph = await pg.evaluate(() => ({ photo: !!window.__shellfall.photo, cls: document.getElementById('app').className, bar: !document.getElementById('photoBar').hidden }));
      await pg.mouse.move(640, 380); await pg.mouse.wheel(0, -600); await pg.waitForTimeout(400);
      await pg.keyboard.press('t'); await pg.waitForTimeout(300);
      await pg.screenshot({ path: require('path').join(__dirname, 'output', 'm_photo.png') });
      await pg.keyboard.press('Escape');
      const ph2 = await pg.evaluate(() => ({ photo: !!window.__shellfall.photo, cls: document.getElementById('app').className, therm: document.getElementById('btnThermal').getAttribute('aria-pressed') }));
      console.log('photo', JSON.stringify(ph), JSON.stringify(ph2));
    }
    await pg.close();
  }
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
