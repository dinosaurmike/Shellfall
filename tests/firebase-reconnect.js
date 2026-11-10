// Firebase: a player whose connection drops comes back into the room by themselves.
// Needs the emulators running first (in another terminal):  npm run emulators
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DB = process.env.FB_DB || '127.0.0.1:9000';
const AUTH = process.env.FB_AUTH || '127.0.0.1:9099';
const NS = 'demo-shellfall-default-rtdb';
const URL0 = (process.env.SHELLFALL_URL || 'http://localhost:8765/') + 'index.html';
const SDK_DIR = path.dirname(require.resolve('firebase/package.json'));
const CONFIG = { apiKey: 'demo-key', authDomain: 'demo-shellfall.firebaseapp.com', databaseURL: `https://${NS}.firebaseio.com`, projectId: 'demo-shellfall', appId: 'demo-app' };
const owner = async p => (await fetch(`http://${DB}/${p}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } })).json();

(async () => {
  try { await fetch(`http://${DB}/.json?ns=${NS}`); await fetch(`http://${AUTH}/`); }
  catch (e) { console.log('FAILED: the Firebase emulators are not running. Start them with: npm run emulators'); process.exit(1); }
  const rules = fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8');
  await fetch(`http://${DB}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: rules });
  const b = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const errs = []; let bad = 0;
  const check = (label, ok, extra) => { console.log(label, ok ? 'ok' : 'FAILED', extra === undefined ? '' : JSON.stringify(extra)); if (!ok) bad++; };
  const page = async nm => {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/firebase@[^/]+\/(.+\.js)$/, route => {
      const f = route.request().url().match(/firebase@[^/]+\/(.+\.js)$/)[1];
      route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK_DIR, f)) });
    });
    await ctx.addInitScript(([cfg, db, auth]) => {
      const [host, port] = db.split(':');
      window.__sfFirebase = { config: cfg, emulator: { host, port: +port, auth: 'http://' + auth } };
      localStorage.setItem('shellfall-gl', 'off');
      localStorage.setItem('shellfall-prefs', JSON.stringify({ killcam: false, sound: false, music: false }));
    }, [CONFIG, DB, AUTH]);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(nm + ' ' + e.message));
    await pg.goto(URL0); await pg.waitForTimeout(500);
    await pg.evaluate(() => { const x = document.getElementById('friendsBox'); if (x.hidden) document.getElementById('btnFriends').click(); });
    return pg;
  };
  const A = await page('A'), B = await page('B');
  await A.fill('#joinName', 'Hosty'); await A.click('#btnHost');
  let code = '';
  for (let i = 0; i < 40 && !code; i++) { await A.waitForTimeout(250); code = await A.evaluate(() => window.__shellfall.net.role === 'host' ? window.__shellfall.net.code : ''); }
  await B.fill('#joinCode', code); await B.fill('#joinName', 'Joiny'); await B.click('#btnJoin');
  await B.waitForTimeout(2500);
  const room = async () => Object.values((await owner('rooms/sf-' + code)) || {}).map(v => JSON.parse(v.j)).filter(p => p.role === 'player').length;
  const hostSees = () => A.evaluate(() => window.__shellfall.net.game.peers().filter(p => p.presence && p.presence.role === 'player').length);
  check('joiner is in the room:', (await room()) === 1 && (await hostSees()) === 1);
  // drop B's connection: the server removes B's presence
  await B.evaluate(() => window.firebase.apps.find(a => a.name === 'shellfall').database().goOffline());
  await B.waitForTimeout(2000);
  const offline = { server: await room(), host: await hostSees(), connected: await B.evaluate(() => window.__shellfall.net.game.connected()) };
  check('connection dropped: presence gone, joiner knows it is offline:', offline.server === 0 && offline.host === 0 && offline.connected === false, offline);
  // the connection comes back: B's presence must come back without B doing anything
  await B.evaluate(() => window.firebase.apps.find(a => a.name === 'shellfall').database().goOnline());
  await B.waitForTimeout(3000);
  const back = { server: await room(), host: await hostSees(), connected: await B.evaluate(() => window.__shellfall.net.game.connected()) };
  check('connection back: presence restored and seen by the host:', back.server === 1 && back.host === 1 && back.connected === true, back);
  const pe = [...await A.evaluate(() => window.__shellfall.phaseErrors), ...await B.evaluate(() => window.__shellfall.phaseErrors)];
  check('no illegal phase changes:', pe.length === 0, pe);
  console.log(bad ? 'FAILED ' + bad : 'all good');
  console.log('errors', errs.slice(0, 5));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
