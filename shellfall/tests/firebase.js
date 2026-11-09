// Online play on a self-hosted copy: the Firebase adapter against the local Firebase emulators.
// Needs the emulators running first (in another terminal):  npm run emulators
// The test loads database.rules.json into the emulator, then plays a live game and a day game
// between separate browsers (separate anonymous accounts), and checks the rules turn away cheats.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DB = process.env.FB_DB || '127.0.0.1:9000';
const AUTH = process.env.FB_AUTH || '127.0.0.1:9099';
const NS = 'demo-shellfall-default-rtdb';
const URL0 = (process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html';
const SDK_DIR = path.dirname(require.resolve('firebase/package.json'));
const CONFIG = { apiKey: 'demo-key', authDomain: 'demo-shellfall.firebaseapp.com', databaseURL: `https://${NS}.firebaseio.com`, projectId: 'demo-shellfall', appId: 'demo-app' };

const rest = async (method, p, body, token) => {
  // the owner token bypasses the rules; a user's ID token goes in ?auth= so the rules apply
  const r = await fetch(`http://${DB}/${p}.json?ns=${NS}` + (token ? '&auth=' + token : ''), { method, headers: token ? {} : { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
};
const anonToken = async () => {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"returnSecureToken":true}' });
  const j = await r.json(); return { token: j.idToken, uid: j.localId };
};

(async () => {
  try { await fetch(`http://${DB}/.json?ns=${NS}`); await fetch(`http://${AUTH}/`); }
  catch (e) { console.log('FAILED: the Firebase emulators are not running. Start them with: npm run emulators'); process.exit(1); }
  const rules = fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8');
  const put = await fetch(`http://${DB}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: rules });
  console.log('rules loaded', put.ok);
  await rest('DELETE', '');

  const b = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const errs = [];
  const newCtx = async (rulesPref) => {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
    // the page asks jsdelivr for the Firebase SDK; serve the same files from node_modules
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/firebase@[^/]+\/(.+\.js)$/, (route) => {
      const f = route.request().url().match(/firebase@[^/]+\/(.+\.js)$/)[1];
      route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK_DIR, f)) });
    });
    await ctx.addInitScript(([cfg, db, auth, rp]) => {
      const [host, port] = db.split(':');
      window.__sfFirebase = { config: cfg, emulator: { host, port: +port, auth: 'http://' + auth } };
      localStorage.setItem('shellfall-gl', 'off');
      localStorage.setItem('shellfall-rules', JSON.stringify(rp));
      localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, slowmo: false, sound: false, music: false }));
      window.__hashes = {}; window.__sfRecord = (n, h) => { window.__hashes[n] = h; };
    }, [CONFIG, DB, AUTH, rulesPref]);
    return ctx;
  };
  const watch = (nm, pg) => {
    pg.on('pageerror', e => errs.push(nm + ' PAGEERR ' + e.message));
    pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !t.includes('ERR_TUNNEL') && !t.includes('fonts.g')) || /permission_denied|PERMISSION_DENIED/.test(t)) errs.push(nm + ' ' + t.slice(0, 300)); });
    return pg;
  };
  const friends = pg => pg.evaluate(() => { const x = document.getElementById('friendsBox'); if (x.hidden) document.getElementById('btnFriends').click(); });

  // ---------------- live game: host and joiner in lockstep through room presence ----------------
  {
    const rp = { weather: 'rain', tide: 'water', worm: 'bot', keep: false, bots: 2, wind: 'changing', teams: '2', theme: 'random' };
    const A = watch('LA', await (await newCtx(rp)).newPage()), B = watch('LB', await (await newCtx(rp)).newPage());
    await A.goto(URL0); await B.goto(URL0); await A.waitForTimeout(500);
    await friends(A); await A.fill('#joinName', 'Hosty'); await A.click('#btnHost');
    let code = '';
    for (let i = 0; i < 40 && !code; i++) { await A.waitForTimeout(250); code = await A.evaluate(() => window.__shellfall.net.role === 'host' ? window.__shellfall.net.code : ''); }
    console.log('live code', code, 'invite link', await A.evaluate(() => document.getElementById('invLink').textContent));
    await A.click('#btnCloseInvite');
    await A.evaluate(() => { setInterval(() => window.__shellfall.allBots(), 200); });
    await friends(B); await B.fill('#joinCode', code); await B.fill('#joinName', 'Joiny'); await B.click('#btnJoin');
    await B.evaluate(() => {
      setInterval(() => {
        const g = window.__shellfall;
        if (g.phase === 'aim' && g.myTank && g.myTank() && !g.net.pending) {
          const plan = g.planBot(g.cur); const t = g.myTank(); t.angle = plan.a; t.power = plan.p; t.weapon = plan.w;
          g.fireMine(); window.__fired = (window.__fired || 0) + 1;
          setTimeout(() => { g.trySplit(); }, 700);
        }
      }, 900);
    });
    const t0 = Date.now();
    while (Date.now() - t0 < 70000) {
      await A.waitForTimeout(5000);
      const a = await A.evaluate(() => ({ ph: window.__shellfall.phase, n: window.__shellfall.turnNo, r: window.__shellfall.round }));
      const bb = await B.evaluate(() => ({ ph: window.__shellfall.phase, n: window.__shellfall.turnNo, role: window.__shellfall.net.role, fired: window.__fired || 0 }));
      console.log(Math.round((Date.now() - t0) / 1000) + 's A', JSON.stringify(a), 'B', JSON.stringify(bb));
      if (a.ph === 'roundover') await A.evaluate(() => window.__shellfall.nextRound());
      if (errs.length) break;
    }
    const ha = await A.evaluate(() => window.__hashes), hb = await B.evaluate(() => window.__hashes);
    let same = 0, diff = 0;
    for (const k of Object.keys(hb)) { if (ha[k] === undefined) continue; if (ha[k] === hb[k]) same++; else diff++; }
    const fired = await B.evaluate(() => window.__fired || 0);
    console.log('LIVE turn hashes: same', same, 'diff', diff, '| joiner shots', fired);
    const rooms = await rest('GET', 'rooms');
    console.log('LIVE peers in room', Object.keys((rooms.body || {})['sf-' + code] || {}).length);
    await A.evaluate(() => document.getElementById('btnPause') && 0);
    await B.close();
    await A.waitForTimeout(1500);
    const after = await rest('GET', 'rooms/sf-' + code);
    console.log('LIVE presence left after joiner closed its tab', Object.keys(after.body || {}).length, '(host only = 1)');
    await A.close();
  }

  // ---------------- day game: lobby, join, alternating turns, leave and come back ----------------
  const st = pg => pg.evaluate(() => { const g = window.__shellfall; return { ph: g.phase, turn: g.turnNo, cur: g.cur, hash: g.hash ? g.hash() : null, mine: g.phase === 'aim' && !!g.myTank(), curName: g.tanks[g.cur] && g.tanks[g.cur].name }; });
  const shoot = pg => pg.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.ctrl === 'bot') || g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x, foe.y - 5, 'shell'); g.fireMine(); });
  const rp = { weather: 'off', worm: 'off', bots: 2, abyss: 'off' };
  const cA = await newCtx(rp), cB = await newCtx(rp);
  const A = watch('DA', await cA.newPage());
  await A.goto(URL0); await A.waitForTimeout(600);
  await friends(A); await A.fill('#joinName', 'Alice'); await A.click('#btnDayNew');
  let code = '';
  for (let i = 0; i < 40 && !/^\d{4}$/.test(code); i++) { await A.waitForTimeout(250); code = await A.evaluate(() => document.getElementById('dayCode').textContent); }
  console.log('DAY code', code, 'lobby shown', await A.evaluate(() => !document.getElementById('dayModal').hidden));
  const B = watch('DB', await cB.newPage());
  await B.goto(URL0 + '#day-' + code); await B.waitForTimeout(1200);
  await B.fill('#joinName', 'Bob'); await B.click('#btnJoin'); await B.waitForTimeout(2000);
  console.log('DAY B in lobby', await B.evaluate(() => !document.getElementById('dayModal').hidden), 'players', await A.evaluate(() => document.getElementById('dayPlayers').textContent));
  await A.click('#btnDayStart'); await A.waitForTimeout(2000);
  const settle = async (P, Q) => { for (let i = 0; i < 100; i++) { const [a, bb] = [await st(P), await st(Q)]; if (a.ph === 'aim' && bb.ph === 'aim' && a.turn === bb.turn) return [a, bb]; if (a.ph === 'roundover' && bb.ph === 'roundover') return [a, bb]; await P.waitForTimeout(250); } return [await st(P), await st(Q)]; };
  let same = 0, diff = 0, humanShots = 0;
  for (let k = 0; k < 7; k++) {
    const [a, bb] = await settle(A, B);
    if (a.hash === bb.hash) same++; else { diff++; console.log('  HASH DIFF', JSON.stringify(a), JSON.stringify(bb)); }
    console.log('DAY turn', a.turn, 'cur', a.curName, 'A mine', a.mine, 'B mine', bb.mine, a.ph, bb.ph);
    if (a.ph === 'roundover') break;
    const mover = a.mine ? A : bb.mine ? B : null;
    if (mover) { await shoot(mover); humanShots++; }
    await A.waitForTimeout(1500);
  }
  console.log('DAY alternation: same', same, 'diff', diff, 'human shots', humanShots);
  await B.close();
  for (let i = 0; i < 8; i++) {
    const a = await st(A);
    if (a.ph === 'aim' && a.mine) { await shoot(A); await A.waitForTimeout(2500); continue; }
    if (a.ph === 'aim' && a.curName === 'Bob') { console.log('DAY A waits on Bob:', await A.evaluate(() => document.getElementById('noticeText').textContent)); break; }
    await A.waitForTimeout(1500);
  }
  const B2 = watch('DB2', await cB.newPage());
  await B2.goto(URL0); await B2.waitForTimeout(800);
  await friends(B2);
  let list = '';
  for (let i = 0; i < 20 && !list.includes(code); i++) { await B2.waitForTimeout(300); list = await B2.evaluate(() => document.getElementById('dayList').textContent); }
  console.log('DAY B2 list:', list.slice(0, 120));
  await B2.evaluate(() => document.querySelector('#dayList .dayrow').click()); await B2.waitForTimeout(300);
  await B2.click('#btnDayResume');
  let b2 = null, a2 = null;
  for (let i = 0; i < 30; i++) { await B2.waitForTimeout(300); b2 = await st(B2); a2 = await st(A); if (b2.ph === 'aim' && b2.turn === a2.turn) break; }
  console.log('DAY B2 loaded: turn', b2.turn, 'mine', b2.mine, 'hash match', b2.hash === a2.hash);
  if (b2.mine) {
    await shoot(B2);
    let x, y, done = false;
    for (let i = 0; i < 90 && !done; i++) { await A.waitForTimeout(400); [x, y] = [await st(A), await st(B2)]; if (x.turn > b2.turn && y.turn === x.turn && x.ph === y.ph && x.ph === 'aim') { console.log('DAY after Bob\'s return shot: turns', x.turn, y.turn, 'hash match', x.hash === y.hash); done = true; } }
    if (!done) console.log('DAY Bob\'s return shot did not settle:', JSON.stringify(x), JSON.stringify(y));
  }
  const ck = await rest('GET', 'state/' + code + '/ckpt');
  const moves = await rest('GET', 'moves/' + code, undefined);
  const card = await rest('GET', 'cards/' + code);
  const moveBytes = JSON.stringify(moves.body || {}).length;
  console.log('DAY stored: checkpoint bytes', ck.body ? JSON.stringify(ck.body).length : 0, '| moves', Object.keys(moves.body || {}).length, 'bytes', moveBytes, '| card bytes', JSON.stringify(card.body || {}).length);

  // ---------------- rules: what a stranger or a cheating player cannot do ----------------
  const eve = await anonToken();
  const someMove = Object.keys(moves.body || {})[0];
  const bobUid = await B2.evaluate(() => window.firebase.app('shellfall').auth().currentUser.uid).catch(() => null);
  const checks = [
    ['stranger reads a card (allowed)', (await rest('GET', 'cards/' + code, undefined, eve.token)).ok, true],
    ['no sign-in reads a card', (await fetch(`http://${DB}/cards/${code}.json?ns=${NS}`)).ok, false],
    ['stranger writes a move', (await rest('PUT', `moves/${code}/m999999`, { j: '{}', s: 999999, by: eve.uid }, eve.token)).ok, false],
    ['stranger overwrites the checkpoint', (await rest('PUT', `state/${code}/ckpt`, { j: 'x' }, eve.token)).ok, false],
    ['stranger writes presence under another uid', (await rest('PUT', 'rooms/sf-0000/someoneelse_abc', { j: '{}' }, eve.token)).ok, false],
    ['stranger writes own presence (allowed)', (await rest('PUT', `rooms/sf-0000/${eve.uid}_abc`, { j: '{}' }, eve.token)).ok, true],
    ['stranger writes someone else\'s kit', (await rest('PUT', `kits/${code}/${bobUid || 'x'}`, { j: '{}' }, eve.token)).ok, false],
    ['stranger reads someone else\'s game index', (await rest('GET', 'mine/' + (bobUid || 'x'), undefined, eve.token)).ok, false],
  ];
  // a player rewriting history: overwrite an existing move with different content
  const aliceTok = await A.evaluate(async () => { const a = window.firebase.app('shellfall').auth(); return { t: await a.currentUser.getIdToken(), uid: a.currentUser.uid }; });
  if (someMove) {
    const m = moves.body[someMove];
    checks.push(['player overwrites an earlier move', (await rest('PUT', `moves/${code}/${someMove}`, { ...m, j: m.j.replace('"s":', '"x":1,"s":'), by: aliceTok.uid }, aliceTok.t)).ok, false]);
  }
  let rulesOk = 0;
  for (const [what, got, want] of checks) { const ok = got === want; if (ok) rulesOk++; console.log(`RULE ${ok ? 'ok ' : 'BAD'} ${what}: ${got ? 'allowed' : 'denied'}`); }
  console.log('RULES', rulesOk + '/' + checks.length);

  // ---------------- manager: Bob leaves (bot takes over), Alice ends, then deletes everything ----------------
  // (by script: a round-over sheet may be up in front of the pause sheet)
  await B2.evaluate(() => document.getElementById('btnDayManage').click()); await B2.waitForTimeout(400);
  await B2.evaluate(() => { const x = document.getElementById('btnDayLeave'); x.click(); x.click(); }); await B2.waitForTimeout(2000);
  const cardAfterLeave = JSON.parse(((await rest('GET', 'cards/' + code)).body || {}).j || '{}');
  console.log('MANAGER after Bob left: players', (cardAfterLeave.players || []).map(p => p.name).join(','), 'status', cardAfterLeave.status);
  await B2.close();
  await A.evaluate(() => window.__shellfall.exitToMenu && window.__shellfall.exitToMenu());
  await A.goto(URL0); await A.waitForTimeout(800); await friends(A);
  list = '';
  for (let i = 0; i < 20 && !list.includes(code); i++) { await A.waitForTimeout(300); list = await A.evaluate(() => document.getElementById('dayList').textContent); }
  await A.evaluate(() => document.querySelector('#dayList .dayrow').click()); await A.waitForTimeout(300);
  await A.click('#btnDayEnd'); await A.click('#btnDayEnd'); await A.waitForTimeout(1500);
  console.log('MANAGER ended, status', JSON.parse(((await rest('GET', 'cards/' + code)).body || {}).j || '{}').status);
  await friends(A); await A.waitForTimeout(1200);
  await A.evaluate(() => { const t = [...document.querySelectorAll('#dayList .link')].find(x => /Finished/.test(x.textContent)); if (t) t.click(); }); await A.waitForTimeout(900);
  await A.evaluate(c => [...document.querySelectorAll('#dayList .dayrow')].find(r => r.textContent.includes(c)).click(), code); await A.waitForTimeout(300);
  const hasDel = await A.evaluate(() => !document.getElementById('btnDayDelete').hidden);
  if (hasDel) { await A.click('#btnDayDelete'); await A.click('#btnDayDelete'); }
  for (let i = 0; i < 40; i++) { await A.waitForTimeout(500); if (!(await rest('GET', 'cards/' + code)).body) break; }
  const left = {};
  for (const n of ['cards', 'moves', 'state', 'kits', 'lock']) { const r = await rest('GET', n + '/' + code); left[n] = r.body ? Object.keys(r.body).length : 0; }
  console.log('MANAGER delete button shown', hasDel, '| left after delete', JSON.stringify(left));
  console.log('errors', errs.slice(0, 8));
  await b.close();
})();
