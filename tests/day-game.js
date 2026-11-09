const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync(require('path').join(__dirname, 'mocks', 'mockdb.js'), 'utf8');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  const open = async (uid, hash) => {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(uid + ' ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join('|')));
    await pg.addInitScript(([uid]) => { window.__mockUid = uid; localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 2, abyss: 'off' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, sound: false, music: false })); }, [uid]);
    await pg.addInitScript(MOCK);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html' + (hash || ''));
    await pg.waitForTimeout(800);
    return pg;
  };
  const st = pg => pg.evaluate(() => { const g = window.__shellfall; return { ph: g.phase, turn: g.turnNo, cur: g.cur, round: g.round, hash: g.hash ? g.hash() : null, mine: g.phase === 'aim' && !!g.myTank(), curName: g.tanks[g.cur] && g.tanks[g.cur].name }; });
  const A = await open('uA');
  await A.click('#btnFriends'); await A.waitForTimeout(300);
  await A.fill('#joinName', 'Alice');
  await A.click('#btnDayNew'); await A.waitForTimeout(1500);
  const code = await A.evaluate(() => document.getElementById('dayCode').textContent);
  console.log('day game code', code, 'lobby shown', await A.evaluate(() => !document.getElementById('dayModal').hidden));
  const B = await open('uB', '#day-' + code);
  await B.fill('#joinName', 'Bob');
  await B.click('#btnJoin'); await B.waitForTimeout(1500);
  console.log('B in lobby', await B.evaluate(() => !document.getElementById('dayModal').hidden), 'players', await A.evaluate(() => document.getElementById('dayPlayers').textContent));
  await A.click('#btnDayStart'); await A.waitForTimeout(1500);
  const settle = async () => { for (let i = 0; i < 80; i++) { const [a, bb] = [await st(A), await st(B)]; if (a.ph === 'aim' && bb.ph === 'aim' && a.turn === bb.turn) return [a, bb]; if (a.ph === 'roundover' && bb.ph === 'roundover') return [a, bb]; await A.waitForTimeout(250); } return [await st(A), await st(B)]; };
  let same = 0, diff = 0;
  for (let k = 0; k < 6; k++) {
    const [a, bb] = await settle();
    if (a.hash === bb.hash) same++; else { diff++; console.log('  HASH DIFF', JSON.stringify(a), JSON.stringify(bb)); }
    console.log('turn', a.turn, 'cur', a.curName, 'A mine', a.mine, 'B mine', bb.mine, 'phase', a.ph, bb.ph);
    if (a.ph === 'roundover') break;
    const mover = a.mine ? A : bb.mine ? B : null;
    if (mover) { await mover.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.ctrl === 'bot') || g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x, foe.y - 5, 'shell'); g.fireMine(); }); }
    await A.waitForTimeout(1500);
  }
  console.log('live alternation: same', same, 'diff', diff);
  // B leaves; A carries on alone until it is B's turn
  await B.close();
  for (let i = 0; i < 6; i++) {
    const a = await st(A);
    if (a.ph === 'aim' && a.mine) { await A.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.ctrl === 'bot') || g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x, foe.y - 5, 'shell'); g.fireMine(); }); await A.waitForTimeout(2500); continue; }
    if (a.ph === 'aim' && a.curName === 'Bob') { console.log('A is waiting on Bob:', await A.evaluate(() => document.getElementById('noticeText').textContent)); break; }
    await A.waitForTimeout(1500);
  }
  // Bob comes back later in a fresh tab
  const B2 = await open('uB');
  await B2.click('#btnFriends'); await B2.waitForTimeout(800);
  console.log('B2 list:', await B2.evaluate(() => document.getElementById('dayList').textContent));
  await B2.evaluate(() => document.querySelector('#dayList .dayrow').click());
  await B2.waitForTimeout(300);
  console.log('B2 card button:', await B2.evaluate(() => document.getElementById('btnDayResume').textContent));
  await B2.click('#btnDayResume');
  await B2.waitForTimeout(2500);
  const b2 = await st(B2), a2 = await st(A);
  console.log('B2 loaded: turn', b2.turn, 'mine', b2.mine, 'hash match', b2.hash === a2.hash, b2.ph, a2.ph);
  if (b2.mine) {
    await B2.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.ctrl === 'bot') || g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x, foe.y - 5, 'shell'); g.fireMine(); });
    for (let i = 0; i < 30; i++) { await A.waitForTimeout(400); const [x, y] = [await st(A), await st(B2)]; if (x.turn > b2.turn && y.turn === x.turn && x.ph === y.ph) { console.log('after Bob\'s return shot: turns', x.turn, y.turn, 'hash match', x.hash === y.hash); break; } }
  }
  const docs = await A.evaluate(() => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mdb:')) out[k.slice(4)] = localStorage.getItem(k).length; } return out; });
  const ck = Object.entries(docs).find(([k]) => k.endsWith('/state/ckpt'));
  console.log('docs', Object.keys(docs).length, 'checkpoint bytes', ck && ck[1]);
  console.log('errors', errs.slice(0, 6));
  await b.close();
})();
