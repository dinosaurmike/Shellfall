// Phones: tapping the field during flight never splits the shell; the Split button does, but not
// in the first moments of flight; the page goes full screen on a button tap; the app manifest loads.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = []; let bad = 0;
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, time: 'day', abyss: 'off' })); });
  const base = process.env.SHELLFALL_URL || 'http://localhost:8765/';
  await pg.goto(base + 'index.html'); await pg.waitForTimeout(1200);
  const man = await pg.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); const j = await r.json(); const i = await fetch(j.icons[0].src); return { display: j.display, orientation: j.orientation, icon: i.ok }; });
  console.log('manifest', JSON.stringify(man)); if (man.display !== 'fullscreen' || !man.icon) bad++;
  await pg.tap('#btnPlay'); await pg.waitForTimeout(1500);
  const fs = await pg.evaluate(() => !!document.fullscreenElement);
  console.log('full screen after tapping Play', fs); if (!fs) bad++;
  const cdp = await ctx.newCDPSession(pg);
  const tapAt = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const waitMyAim = async () => { for (let i = 0; i < 400; i++) { const ok = await pg.evaluate(() => { const g = window.__shellfall; if (g.phase === 'roundover') g.nextRound(); if (g.phase === 'killcam') g.step(400); return g.phase === 'aim' && !!g.myTank(); }); if (ok) return true; await pg.evaluate(() => window.__shellfall.step(30)); } return false; };
  const fireHigh = () => pg.evaluate(() => { const g = window.__shellfall.myTank(); g.angle = 70; g.power = 95; g.weapon = 0; window.__shellfall.fireMine(); });
  const waitFlight = async () => { for (let i = 0; i < 60; i++) { const ph = await pg.evaluate(() => window.__shellfall.phase); if (ph === 'flight') return true; await pg.waitForTimeout(25); } return false; };
  const state = () => pg.evaluate(() => { const g = window.__shellfall; return { ph: g.phase, split: !!(g.shot && (g.shot.splitTick || g.shot.splitAsked)), n: g.projs.filter(p => p.mode === 'fly').length }; });
  // 1. taps on the field during flight
  await waitMyAim(); await fireHigh(); await waitFlight();
  for (const [x, y] of [[422, 195], [200, 120], [700, 250], [430, 200]]) { await tapAt(x, y); await pg.waitForTimeout(120); }
  let s1 = await state(); console.log('field taps in flight', JSON.stringify(s1)); if (s1.split) bad++;
  // 2. Fire tapped twice fast: the second tap lands while the shell is at the barrel and must not split
  // 3. the Split button a moment later does split
  // (both wait inside the page on the shell's own flight time, so a slow browser can't skew them)
  const flightClick = (minAge, maxAge) => pg.evaluate(([lo, hi]) => new Promise(res => {
    const g = window.__shellfall, t0 = performance.now();
    const look = () => {
      const p = g.projs.find(p => p.primary && p.mode === 'fly');
      if (g.phase === 'flight' && p && p.age >= lo && p.age < hi) { document.getElementById('btnFire').click(); return setTimeout(() => res({ ph: g.phase, age: +p.age.toFixed(2), split: !!(g.shot && (g.shot.splitTick || g.shot.splitAsked)) }), 80); }
      if (performance.now() - t0 > 6000) return res({ timeout: true, ph: g.phase });
      requestAnimationFrame(look);
    };
    look();
  }), [minAge, maxAge]);
  let s2 = null, s3 = null;
  for (let tries = 0; tries < 4 && !(s2 && !s2.timeout && s3 && !s3.timeout); tries++) {
    await pg.evaluate(() => window.__shellfall.step(2000)); await waitMyAim();
    await pg.tap('#btnFire');
    s2 = await flightClick(0, 0.3);
    s3 = await flightClick(0.45, 9);
  }
  console.log('Fire double-tapped', JSON.stringify(s2)); if (!s2 || s2.timeout || s2.split) bad++;
  console.log('Split button later', JSON.stringify(s3)); if (!s3 || s3.timeout || !s3.split) bad++;
  // 4. desktop mouse click still splits
  const pd = await b.newPage({ viewport: { width: 1280, height: 760 } });
  pd.on('pageerror', e => errs.push('desk ' + e.message));
  await pd.addInitScript(() => { localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, time: 'day', abyss: 'off' })); });
  await pd.goto(base + 'index.html'); await pd.waitForTimeout(800); await pd.click('#btnPlay'); await pd.waitForTimeout(800);
  let s4 = false;
  for (let tries = 0; tries < 4 && !s4; tries++) {
    for (let i = 0; i < 400; i++) { const ok = await pd.evaluate(() => { const g = window.__shellfall; if (g.phase === 'roundover') g.nextRound(); if (g.phase === 'killcam') g.step(400); return g.phase === 'aim' && !!g.myTank(); }); if (ok) break; await pd.evaluate(() => window.__shellfall.step(30)); }
    await pd.evaluate(() => { const g = window.__shellfall.myTank(); g.angle = 70; g.power = 95; g.weapon = 0; window.__shellfall.fireMine(); });
    let ready = false;
    for (let i = 0; i < 300 && !ready; i++) { ready = await pd.evaluate(() => window.__shellfall.phase === 'flight' && window.__shellfall.projs.some(p => p.primary && p.mode === 'fly' && p.age >= 0.45)); if (!ready) await pd.waitForTimeout(10); }
    if (!ready) continue;
    await pd.mouse.click(640, 300); await pd.waitForTimeout(150);
    s4 = await pd.evaluate(() => !!(window.__shellfall.shot && (window.__shellfall.shot.splitTick || window.__shellfall.shot.splitAsked)));
    if (!s4) await pd.evaluate(() => window.__shellfall.step(2000));
  }
  console.log('desktop click splits', s4); if (!s4) bad++;
  console.log(bad ? 'FAILED ' + bad : 'all good');
  console.log('errors', errs.slice(0, 5));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
