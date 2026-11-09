const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 650 } });
  await ctx.addInitScript(fs.readFileSync(require('path').join(__dirname, 'mocks', 'mockroom.js'), 'utf8'));
  await ctx.addInitScript(() => { localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'storm', tide: 'off', worm: 'off', keep: true, bots: 3, wind: 'gusty', theme: 'volcanic' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: true, slowmo: true, sound: false })); });
  await ctx.addInitScript(() => { window.__hashes = {}; window.__sfRecord = (n, h) => { window.__hashes[n] = h; }; });
  const errs = [];
  const A = await ctx.newPage();
  A.on('pageerror', e => errs.push('A ' + e.message));
  await A.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html');
  await A.evaluate(() => { const b = document.getElementById('friendsBox'); if (b.hidden) document.getElementById('btnFriends').click(); }); await A.click('#btnHost'); await A.waitForTimeout(500); await A.click('#btnCloseInvite');
  await A.evaluate(() => { setInterval(() => window.__shellfall.allBots(), 200); });
  const code = await A.evaluate(() => window.__shellfall.net.code);
  // let the host play alone for a while
  await A.waitForTimeout(75000);
  console.log('host after 75s', JSON.stringify(await A.evaluate(() => ({ seq: window.__shellfall.net.seq, n: window.__shellfall.turnNo, snapParts: window.__shellfall.net.snap && window.__shellfall.net.snap.parts.length }))));
  const B = await ctx.newPage();
  B.on('pageerror', e => errs.push('B ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join('|')));
  await B.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html#join-' + code);
  await B.waitForTimeout(400);
  console.log('prefilled code', await B.inputValue('#joinCode'));
  const tj = Date.now();
  await B.click('#btnJoin');
  let synced = false;
  for (let i = 0; i < 60; i++) {
    await B.waitForTimeout(500);
    const s = await B.evaluate(() => ({ ph: window.__shellfall.phase, st: window.__shellfall.net.statusText, syncing: window.__shellfall.net.syncing, applied: window.__shellfall.net.applied, t: window.__shellfall.tickN, mine: window.__shellfall.tanks.some(t => t.ctrl === window.__shellfall.net.cid) }));
    if (i % 2 === 0) console.log('B', JSON.stringify(s));
    if (!s.syncing && s.applied > 0 && s.ph !== 'wait') { synced = true; console.log('synced in', Date.now() - tj, 'ms'); break; }
  }
  await B.screenshot({ path: require('path').join(__dirname, 'output', 'late_B_synced.png') });
  await B.evaluate(() => {
    setInterval(() => {
      const g = window.__shellfall;
      if (g.phase === 'aim' && g.myTank && g.myTank() && !g.net.pending) { const plan = g.planBot(g.cur); const t = g.myTank(); t.angle = plan.a; t.power = plan.p; t.weapon = plan.w; g.fireMine(); window.__fired = (window.__fired || 0) + 1; }
    }, 900);
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 70000) {
    await A.waitForTimeout(5000);
    const a = await A.evaluate(() => ({ ph: window.__shellfall.phase, n: window.__shellfall.turnNo, r: window.__shellfall.round }));
    const bb = await B.evaluate(() => { const g = window.__shellfall; const me = g.tanks.find(t => t.ctrl === g.net.cid); return { ph: g.phase, n: g.turnNo, r: g.round, fired: window.__fired || 0, cur: g.cur, me: me ? me.name + ':' + me.alive + ':' + g.tanks.indexOf(me) : 'none', ctrls: g.tanks.map(t => t.ctrl.slice(0,4)).join(',') }; });
    console.log('A', JSON.stringify(a), 'B', JSON.stringify(bb));
    if (a.ph === 'roundover') await A.evaluate(() => window.__shellfall.nextRound());
  }
  const ha = await A.evaluate(() => window.__hashes), hb = await B.evaluate(() => window.__hashes);
  let same = 0, diff = 0;
  for (const k of Object.keys(hb)) { if (ha[k] === undefined) continue; if (ha[k] === hb[k]) same++; else { diff++; if (diff <= 2) console.log('DIFF', k, '\n A', ha[k].slice(0, 160), '\n B', hb[k].slice(0, 160)); } }
  console.log('compared same', same, 'diff', diff, 'maxPresence A', await A.evaluate(() => window.__maxPresence), 'B', await B.evaluate(() => window.__maxPresence));
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
