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
    await pg.addInitScript(([uid]) => { window.__mockUid = uid; localStorage.setItem('shellfall-gl', 'off'); localStorage.setItem('shellfall-rules', JSON.stringify({ weather: 'off', worm: 'off', bots: 1, abyss: 'off' })); localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, sound: false, music: false })); }, [uid]);
    await pg.addInitScript(MOCK);
    await pg.goto((process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html' + (hash || ''));
    await pg.waitForTimeout(800);
    return pg;
  };
  const st = pg => pg.evaluate(() => { const g = window.__shellfall; return { ph: g.phase, turn: g.turnNo, mine: g.phase === 'aim' && !!g.myTank(), cur: g.tanks[g.cur] && g.tanks[g.cur].name }; });
  const fire = pg => pg.evaluate(() => { const g = window.__shellfall, t = g.myTank(); const foe = g.tanks.find(o => o.alive && o.ctrl === 'bot') || g.tanks.find(o => o.alive && o.id !== t.id); g.aimAt(foe.x, foe.y - 5, 'shell'); g.fireMine(); });
  const dbKeys = pg => pg.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mdb:')) o.push(k.slice(4)); } return o; });
  const A = await open('uA');
  await A.click('#btnFriends'); await A.fill('#joinName', 'Alice');
  await A.click('#btnDayNew'); await A.waitForTimeout(1500);
  const code = await A.evaluate(() => document.getElementById('dayCode').textContent);
  const B = await open('uB', '#day-' + code);
  await B.fill('#joinName', 'Bob'); await B.click('#btnJoin'); await B.waitForTimeout(1500);
  await A.click('#btnDayStart'); await A.waitForTimeout(2000);
  // one human turn each, so the game is under way
  for (let k = 0; k < 4; k++) { const [a, bb] = [await st(A), await st(B)]; if (a.mine) await fire(A); else if (bb.mine) await fire(B); await A.waitForTimeout(2500); }
  // Bob leaves from his list
  await B.evaluate(() => window.__shellfall && 0);
  await B.keyboard.press('Escape'); await B.waitForTimeout(200);
  await B.click('#btnExit'); await B.waitForTimeout(600);
  await B.click('#btnFriends'); await B.waitForTimeout(900);
  console.log('Bob list:', await B.evaluate(() => document.getElementById('dayList').textContent));
  await B.evaluate(() => document.querySelector('#dayList .dayrow').click()); await B.waitForTimeout(300);
  console.log('Bob card buttons:', await B.evaluate(() => [...document.querySelectorAll('#dayModal .btn')].filter(x => !x.hidden).map(x => x.textContent).join(' | ')));
  await B.click('#btnDayLeave'); await B.waitForTimeout(200);
  console.log('after one tap:', await B.evaluate(() => document.getElementById('btnDayLeave').textContent));
  await B.click('#btnDayLeave'); await B.waitForTimeout(1500);
  console.log('players after leave:', await A.evaluate(() => document.getElementById('dayPlayers') && window.__shellfall && JSON.stringify((JSON.parse(localStorage.getItem('mdb:games/' + document.getElementById('dayCode').textContent)) || {}).players)));
  // Alice keeps playing: Bob's tank must move on its own
  let passedBob = false;
  for (let k = 0; k < 10; k++) {
    const a = await st(A);
    if (a.ph === 'aim' && a.mine) await fire(A);
    if (a.cur === 'Bob') { await A.waitForTimeout(3500); const a2 = await st(A); if (a2.cur !== 'Bob' || a2.turn > a.turn) { passedBob = true; break; } }
    await A.waitForTimeout(2000);
  }
  console.log('Bob\'s tank played by a bot after he left:', passedBob);
  // Alice ends the game from the pause sheet
  await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  await A.click('#btnDayManage'); await A.waitForTimeout(300);
  await A.click('#btnDayEnd'); await A.click('#btnDayEnd'); await A.waitForTimeout(1500);
  console.log('Alice phase after ending', (await st(A)).ph);
  await A.waitForTimeout(900);
  console.log('Alice list:', await A.evaluate(() => document.getElementById('dayList').textContent));
  // a second game, ended and deleted
  await A.click('#btnDayNew'); await A.waitForTimeout(1500);
  const code2 = await A.evaluate(() => document.getElementById('dayCode').textContent);
  await A.click('#btnDayClose'); await A.waitForTimeout(500);
  if (await A.evaluate(() => document.getElementById('friendsBox').hidden)) await A.click('#btnFriends');
  await A.evaluate(() => refreshDayList ? 0 : 0).catch(() => {});
  await A.waitForTimeout(1200);
  await A.evaluate(c => [...document.querySelectorAll('#dayList .dayrow')].find(r => r.textContent.includes(c)).click(), code2); await A.waitForTimeout(300);
  await A.click('#btnDayEnd'); await A.click('#btnDayEnd'); await A.waitForTimeout(1200);
  await A.evaluate(() => { const t = [...document.querySelectorAll('#dayList .link')].find(x => /Finished/.test(x.textContent)); if (t) t.click(); }); await A.waitForTimeout(900);
  await A.evaluate(c => [...document.querySelectorAll('#dayList .dayrow')].find(r => r.textContent.includes(c)).click(), code2); await A.waitForTimeout(300);
  console.log('finished card buttons:', await A.evaluate(() => [...document.querySelectorAll('#dayModal .btn')].filter(x => !x.hidden).map(x => x.textContent).join(' | ')));
  await A.click('#btnDayDelete'); await A.click('#btnDayDelete'); await A.waitForTimeout(2000);
  console.log('docs left for deleted game', code2, (await dbKeys(A)).filter(k => k.includes('games/' + code2)).length);
  // hide the first one
  await A.evaluate(() => { const t = [...document.querySelectorAll('#dayList .link')].find(x => /Finished/.test(x.textContent)); if (t && /^Finished/.test(t.textContent)) t.click(); }); await A.waitForTimeout(900);
  await A.evaluate(c => { const r = [...document.querySelectorAll('#dayList .dayrow')].find(r => r.textContent.includes(c)); if (r) r.click(); }, code); await A.waitForTimeout(300);
  console.log('card open for', await A.evaluate(() => !document.getElementById('dayModal').hidden && document.getElementById('dayCode').textContent));
  await A.click('#btnDayHide'); await A.waitForTimeout(1500);
  console.log('note after hide', await A.evaluate(() => document.getElementById('dayNote').textContent), 'modal', await A.evaluate(() => !document.getElementById('dayModal').hidden), 'hiddenFor', await A.evaluate(c => (JSON.parse(localStorage.getItem('mdb:games/' + c)) || {}).hiddenFor, code));
  console.log('Alice list after hide:', JSON.stringify(await A.evaluate(() => document.getElementById('dayList').textContent)));
  console.log('errors', errs.slice(0, 6));
  await b.close();
})();
