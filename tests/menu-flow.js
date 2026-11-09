const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 2 })); });
  await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html'); await pg.waitForTimeout(700);
  const vis = id => pg.evaluate(i => !document.getElementById(i).hidden && getComputedStyle(document.getElementById(i)).display !== 'none', id);
  console.log('title: friends', await vis('friendsBox'), 'how', await vis('howBox'));
  await pg.screenshot({ path: require('path').join(__dirname, 'output', 'title_min.png') });
  await pg.click('#btnFriends'); await pg.click('#btnHow'); await pg.waitForTimeout(200);
  console.log('expanded: friends', await vis('friendsBox'), 'how', await vis('howBox'));
  await pg.screenshot({ path: require('path').join(__dirname, 'output', 'title_open.png') });
  await pg.click('#btnFriends'); await pg.click('#btnHow');
  await pg.click('#btnPlay'); await pg.waitForTimeout(400);
  console.log('playing phase', await pg.evaluate(() => window.__shellfall.phase));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  console.log('pause title', await pg.evaluate(() => document.getElementById('setTitle').textContent), 'exit visible', await vis('btnExit'));
  await pg.click('#btnExit'); await pg.waitForTimeout(300);
  console.log('after exit: phase', await pg.evaluate(() => window.__shellfall.phase), 'start visible', await vis('startModal'), 'settings visible', await vis('settingsModal'), 'tanks', await pg.evaluate(() => window.__shellfall.tanks.length));
  await pg.click('#btnPlay'); await pg.waitForTimeout(400);
  console.log('replay phase', await pg.evaluate(() => window.__shellfall.phase), 'round', await pg.evaluate(() => window.__shellfall.round));
  // fast-forward button exists in solo play
  console.log('ff visible', await vis('btnFF'));
  console.log('errors', errs);
  await b.close();
})();
