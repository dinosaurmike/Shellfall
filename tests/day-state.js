// Day-game state fixes (mock db):
//  - two friends joining a lobby moments apart both get a seat (short, retried locks)
//  - a database error during a bot's turn doesn't stop bots for good
//  - a checkpoint never reopens a game someone has ended
//  - managing another game (leave) never touches the game that's open
//  - Esc closes the day-game card instead of opening Settings behind it
//  - leaving the window lets go of fast-forward
//  - each exit button asks for itself before leaving an online game
const { chromium } = require('playwright');
const fs = require('fs');
const MOCK = fs.readFileSync(require('path').join(__dirname, 'mocks', 'mockdb.js'), 'utf8');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
  const errs = []; let bad = 0;
  const check = (label, ok, extra) => { console.log(label, ok ? 'ok' : 'FAILED', extra === undefined ? '' : JSON.stringify(extra)); if (!ok) bad++; };
  const open = async (uid, hash) => {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(uid + ' ' + e.message));
    await pg.addInitScript(([uid]) => { window.__mockUid = uid; localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, abyss: 'off' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, sound: false, music: false })); }, [uid]);
    await pg.addInitScript(MOCK);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html' + (hash || ''));
    await pg.waitForTimeout(800);
    return pg;
  };
  const card = (pg, code) => pg.evaluate(c => JSON.parse(localStorage.getItem('mdb:games/' + c)), code);

  // --- two joins in quick succession ---
  const A = await open('uA');
  await A.click('#btnFriends'); await A.fill('#joinName', 'Alice');
  await A.click('#btnDayNew'); await A.waitForTimeout(1500);
  const code = await A.evaluate(() => document.getElementById('dayCode').textContent);
  const B = await open('uB', '#day-' + code), C = await open('uC', '#day-' + code);
  await B.fill('#joinName', 'Bob'); await C.fill('#joinName', 'Cara');
  await Promise.all([B.click('#btnJoin'), C.click('#btnJoin')]);
  await A.waitForTimeout(9000);
  const g0 = await card(A, code);
  const errB = await B.evaluate(() => document.getElementById('netErr').textContent), errC = await C.evaluate(() => document.getElementById('netErr').textContent);
  check('two quick joins both seated:', g0.players.length === 3, { players: g0.players.map(p => p.name), errB, errC });

  // --- start, then a db error during a bot turn ---
  console.log('lobby open for Alice:', await A.evaluate(() => !document.getElementById('dayModal').hidden && !document.getElementById('btnDayStart').hidden));
  await A.click('#btnDayStart'); await A.waitForTimeout(2500);
  // make the next bot-turn read fail once
  const breakOnce = () => {
    const D = window.__shellfall.day, real = D.movesCol.bind(D);
    let failed = false;
    // the first read of a move document fails; everything else goes through untouched
    D.movesCol = code => { const col = real(code); const c2 = Object.create(col); c2.doc = id => { const d = col.doc(id); const d2 = Object.create(d); d2.get = async () => { if (!failed) { failed = true; throw new Error('simulated network error'); } return d.get(); }; return d2; }; return c2; };
    window.__failedOnce = () => failed;
  };
  for (const P of [A, B, C]) await P.evaluate(breakOnce);
  const anyFailed = async () => { for (const P of [A, B, C]) if (await P.evaluate(() => window.__failedOnce())) return true; return false; };
  // play until a bot turn has happened after the failure
  const turn0 = await A.evaluate(() => window.__shellfall.turnNo);
  let botMovedAfterFail = false;
  for (let k = 0; k < 30 && !botMovedAfterFail; k++) {
    const s = await A.evaluate(() => { const g = window.__shellfall; return { mine: g.phase === 'aim' && !!g.myTank(), bm: g.phase === 'aim' && g.tanks[g.cur] && g.tanks[g.cur].ctrl === 'bot', turn: g.turnNo }; });
    s.failed = await anyFailed();
    if (s.mine) await A.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x - 60, foe.y - 5, 'shell'); g.fireMine(); });
    for (const P of [B, C]) {
      const pm = await P.evaluate(() => { const g = window.__shellfall; return g.phase === 'aim' && !!g.myTank(); });
      if (pm) await P.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x - 60, foe.y - 5, 'shell'); g.fireMine(); });
    }
    if (s.failed && s.turn > turn0 + 2) botMovedAfterFail = true;
    await A.waitForTimeout(1500);
  }
  check('bots keep moving after a failed read:', botMovedAfterFail, await A.evaluate(t0 => { const g = window.__shellfall, D = g.day; return { t0, busy: D.botBusy, failed: window.__failedOnce(), ph: g.phase, turn: g.turnNo, cur: g.tanks[g.cur] && g.tanks[g.cur].ctrl, q: D.queue.length, pend: !!D.pending, writing: D.writing, applied: D.applied, status: D.meta && D.meta.status, ntanks: g.tanks.length }; }, turn0));

  // --- a checkpoint never reopens an ended game ---
  await B.evaluate(c => { const k = 'mdb:games/' + c; const d = JSON.parse(localStorage.getItem(k)); d.status = 'done'; localStorage.setItem(k, JSON.stringify(d)); }, code);
  for (let k = 0; k < 40; k++) { if (await A.evaluate(() => { const D = window.__shellfall.day; return !D.queue.length && !D.pending && !D.writing; })) break; await A.waitForTimeout(250); }
  const wrote = await A.evaluate(async () => { const D = window.__shellfall.day; D.mineToCkpt = true; await D.checkpoint(); return !D.mineToCkpt; });
  const g1 = await card(A, code);
  check('checkpoint leaves an ended game ended:', wrote && g1.status === 'done' && g1.turn === null, { wrote, status: g1.status, turn: g1.turn });

  // --- leaving another game keeps the open one ---
  const other = await A.evaluate(async () => { const D = window.__shellfall.day; return await D.create('Alice'); });
  const before = await A.evaluate(() => window.__shellfall.day.code);
  const lv = A.evaluate(c => window.__shellfall.day.leave(c), other);
  const during = await A.evaluate(() => window.__shellfall.day.code);
  await lv;
  check('leave(other game) never borrows the open game\'s code:', during === before && (await A.evaluate(() => window.__shellfall.day.code)) === before, { before, during });

  // --- each exit button asks for itself ---
  const S = await open('uS');
  await S.click('#btnPlay'); await S.waitForTimeout(600);
  // --- blur lets go of fast-forward ---
  await S.keyboard.down('f'); const held = await S.evaluate(() => window.__shellfall.ffHeld);
  await S.evaluate(() => window.dispatchEvent(new Event('blur')));
  const after = await S.evaluate(() => window.__shellfall.ffHeld); await S.keyboard.up('f');
  check('blur releases fast-forward:', held && !after, { held, after });

  await S.evaluate(() => { const N = window.__shellfall.net; N.role = 'host'; N.game = { peers: () => [], presence: async () => {}, leave: async () => {} }; });
  await S.keyboard.press('Escape'); await S.waitForTimeout(200);
  await S.click('#btnExit'); await S.waitForTimeout(100);
  const asked = await S.evaluate(() => document.getElementById('btnExit').textContent);
  await S.evaluate(() => { document.getElementById('settingsModal').hidden = true; document.getElementById('roundModal').hidden = false; });
  await S.click('#btnRoundExit'); await S.waitForTimeout(100);
  const st = await S.evaluate(() => ({ ph: window.__shellfall.phase, txt: document.getElementById('btnRoundExit').textContent }));
  check('first tap on the other exit button asks instead of leaving:', asked === 'Leave the online game?' && st.ph !== 'menu' && st.txt === 'Leave the online game?', { asked, ...st });
  await S.click('#btnRoundExit'); await S.waitForTimeout(200);
  check('second tap on the same button leaves:', (await S.evaluate(() => window.__shellfall.phase)) === 'menu');
  await S.evaluate(() => { window.__shellfall.net.role = 'solo'; });

  // --- Esc on the day-game card closes it ---
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  await A.click('#btnDayManage'); await A.waitForTimeout(200);
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  const esc = await A.evaluate(() => ({ day: document.getElementById('dayModal').hidden, set: document.getElementById('settingsModal').hidden }));
  check('Esc closes the day card, no Settings behind it:', esc.day && esc.set, esc);

  const pe = [];
  for (const pg of [A, B, C, S]) pe.push(...await pg.evaluate(() => window.__shellfall.phaseErrors));
  check('no illegal phase changes:', pe.length === 0, pe);
  console.log(bad ? 'FAILED ' + bad : 'all good');
  console.log('errors', errs.filter(e => !/simulated network error/.test(e)).slice(0, 5));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
