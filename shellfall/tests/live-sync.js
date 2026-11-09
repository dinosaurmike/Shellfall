const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 650 } });
  const mock = fs.readFileSync(require('path').join(__dirname, 'mocks', 'mockroom.js'), 'utf8');
  await ctx.addInitScript(mock);
  await ctx.addInitScript(() => { localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'rain', tide: 'water', worm: 'bot', keep: false, bots: 2, wind: 'changing', teams: '2', theme: 'random' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: true, slowmo: true, sound: false, music: false })); localStorage.setItem('shellfall-gl', 'off'); });
  await ctx.addInitScript(() => { window.__hashes = {}; window.__sfRecord = (n, h) => { window.__hashes[n] = h; }; });
  const errs = [];
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const [nm, p] of [['A', A], ['B', B]]) {
    p.on('pageerror', e => errs.push(nm + ' PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push(nm + ' ' + m.text()); });
  }
  await A.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html');
  await B.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html');
  await A.waitForTimeout(500);
  await A.evaluate(() => { const b = document.getElementById('friendsBox'); if (b.hidden) document.getElementById('btnFriends').click(); }); await A.fill('#joinName', 'Hosty');
  await A.evaluate(() => { const b = document.getElementById('friendsBox'); if (b.hidden) document.getElementById('btnFriends').click(); }); await A.click('#btnHost');
  await A.waitForTimeout(800);
  const code = await A.evaluate(() => window.__shellfall.net.code);
  console.log('code', code);
  await A.click('#btnCloseInvite');
  // host's own tank is played by a bot so the game runs by itself
  await A.evaluate(() => { setInterval(() => window.__shellfall.allBots(), 200); });
  await B.evaluate(() => { const b = document.getElementById('friendsBox'); if (b.hidden) document.getElementById('btnFriends').click(); }); await B.fill('#joinCode', code);
  await B.evaluate(() => { const b = document.getElementById('friendsBox'); if (b.hidden) document.getElementById('btnFriends').click(); }); await B.fill('#joinName', 'Joiny');
  await B.click('#btnJoin');
  // B plays its own turns automatically, and splits its shells
  await B.evaluate(() => {
    setInterval(() => {
      const g = window.__shellfall;
      if (g.phase === 'aim' && g.myTank && g.myTank() && !g.net.pending) {
        const plan = g.planBot(g.cur);
        const t = g.myTank(); t.angle = plan.a; t.power = plan.p; t.weapon = plan.w;
        g.fireMine();
        window.__fired = (window.__fired || 0) + 1;
        setTimeout(() => { g.trySplit(); }, 700);
      }
    }, 900);
  });
  const t0 = Date.now();
  let lastLog = 0;
  while (Date.now() - t0 < 80000) {
    await A.waitForTimeout(3000);
    const a = await A.evaluate(() => ({ ph: window.__shellfall.phase, n: window.__shellfall.turnNo, r: window.__shellfall.round, t: window.__shellfall.tickN, seats: window.__shellfall.tanks.map(t => t.name + ':' + t.ctrl.slice(0, 4)).join(',') }));
    const bb = await B.evaluate(() => ({ ph: window.__shellfall.phase, n: window.__shellfall.turnNo, r: window.__shellfall.round, t: window.__shellfall.tickN, st: window.__shellfall.net.statusText, applied: window.__shellfall.net.applied, fired: window.__fired || 0 }));
    console.log(Math.round((Date.now() - t0) / 1000) + 's', 'A', JSON.stringify(a), '\n     B', JSON.stringify(bb));
    if (a.ph === 'roundover') { await A.evaluate(() => window.__shellfall.nextRound()); }
    if (errs.length) break;
  }
  const ha = await A.evaluate(() => window.__hashes), hb = await B.evaluate(() => window.__hashes);
  let same = 0, diff = 0;
  for (const k of Object.keys(hb)) { if (ha[k] === undefined) continue; if (ha[k] === hb[k]) same++; else { diff++; if (diff <= 3) console.log('DIFF turn', k, '\n A', ha[k].slice(0, 200), '\n B', hb[k].slice(0, 200)); } }
  console.log('turn hashes compared: same', same, 'diff', diff, 'A turns', Object.keys(ha).length, 'B turns', Object.keys(hb).length);
  await A.screenshot({ path: require('path').join(__dirname, 'output', 'net_A.png') }); await B.screenshot({ path: require('path').join(__dirname, 'output', 'net_B.png') });
  console.log('errors', errs.slice(0, 6));
  await b.close();
})();
