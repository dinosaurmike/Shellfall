const { chromium } = require('playwright');
const cases = (process.argv[2] || 'temperate:day:vivid,volcanic:night:vivid,arctic:night:vivid,desert:dusk:vivid,swamp:night:vivid,ruins:day:vivid').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const cs of cases) {
    const [theme, time, palette, abyss, gl] = cs.split(':');
    const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
    pg.on('pageerror', e => errs.push(cs + ' ' + e.message));
    pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_TUNNEL')) errs.push(cs + ' ' + m.text().slice(0, 300)); });
    await pg.addInitScript(([theme, time, palette, abyss, gl]) => {
      if (gl === 'off') localStorage.setItem('shellfall-gl', 'off');
      localStorage.setItem('shellfall-rules', JSON.stringify({ theme, time, abyss: abyss || 'auto', weather: 'off', worm: 'off', bots: 3, keep: false, mode: 'match' }));
      localStorage.setItem('shellfall-prefs', JSON.stringify({ palette, music: false, sound: false, teamcol: palette === 'pastel' ? 'cb' : 'standard' }));
    }, [theme, time, palette, abyss, gl]);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(700);
    await pg.click('#btnPlay'); await pg.waitForTimeout(+(process.env.WAIT || 2500)); await pg.evaluate(() => window.__shellfall.camReset()); await pg.waitForTimeout(1500);
    const info = await pg.evaluate(() => { const g = window.__shellfall; let gems = 0, moss = 0; for (let i = 0; i < g.grid.length; i++) { if (g.grid[i] === g.M.GEM) gems++; } return { gl: g.gl, abyss: g.abyssKind, y: g.abyssY, gems, lm: g.landmark && g.landmark.kind }; });
    console.log(cs, JSON.stringify(info));
    await pg.screenshot({ path: require('path').join(__dirname, 'output', `look_${theme}_${time}_${palette}${abyss ? '_' + abyss : ''}${gl ? '_' + gl : ''}.png`) });
    await pg.close();
  }
  console.log('errors', errs.slice(0, 6));
  await b.close();
})();
