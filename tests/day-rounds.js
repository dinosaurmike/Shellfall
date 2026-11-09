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
    await pg.addInitScript(([uid]) => { window.__mockUid = uid; localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 0, abyss: 'off' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, sound: false, music: false })); }, [uid]);
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
  // fight to the end of the round with big shells, then Bob starts round 2
  for (let k = 0; k < 30; k++) {
    const [a, bb] = await settle();
    if (a.ph === 'roundover' && bb.ph === 'roundover') { console.log('round over on both at turn', a.turn, 'hash match', a.hash === bb.hash); break; }
    const mover = a.mine ? A : bb.mine ? B : null;
    if (mover) await mover.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.id !== t.id); t.ammo[g.WI.breaker] = 1; g.aimAt(foe.x, foe.y - 5, 'breaker'); g.fireMine(); });
    await A.waitForTimeout(1200);
  }
  await B.evaluate(() => document.getElementById('btnNextRound').click());
  await A.waitForTimeout(2500);
  const [r2a, r2b] = await settle();
  console.log('round 2:', r2a.round, r2b.round, 'phase', r2a.ph, r2b.ph, 'hash match', r2a.hash === r2b.hash);
  const docs = await A.evaluate(() => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mdb:')) out[k.slice(4)] = localStorage.getItem(k).length; } return out; });
  const ck = Object.entries(docs).find(([k]) => k.endsWith('/state/ckpt'));
  console.log('docs', Object.keys(docs).length, 'checkpoint bytes', ck && ck[1]);
  console.log('errors', errs.slice(0, 6));
  await b.close();
})();
