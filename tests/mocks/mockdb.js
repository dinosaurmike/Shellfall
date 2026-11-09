// Stand-in for the claude.ai db + user capabilities, shared between tabs of one browser context.
// Documents live in localStorage under "mdb:<path>"; changes are announced on a BroadcastChannel.
(() => {
  const P = 'mdb:';
  const ch = new BroadcastChannel('mockdb');
  const listeners = new Set();
  const notify = () => { for (const f of listeners) setTimeout(f, 30 + Math.random() * 60); };
  ch.onmessage = () => notify();
  const changed = () => { ch.postMessage(1); notify(); };
  const read = path => { const v = localStorage.getItem(P + path); return v ? JSON.parse(v) : undefined; };
  const write = (path, v) => { if (v === undefined) localStorage.removeItem(P + path); else localStorage.setItem(P + path, JSON.stringify(v)); changed(); };
  const snapOf = (path, d) => ({ id: path.split('/').pop(), exists: d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
  const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') ? merge(a[k], b[k]) : b[k]; return o; };
  const wait = () => new Promise(r => setTimeout(r, 15 + Math.random() * 40));
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      async get() { await wait(); return snapOf(path, read(path)); },
      async set(d) { await wait(); write(path, JSON.parse(JSON.stringify(d))); },
      async update(d) { await wait(); const cur = read(path); if (cur === undefined) throw { code: 'invalid_argument', message: 'missing' }; write(path, merge(cur, JSON.parse(JSON.stringify(d)))); },
      async delete() { await wait(); write(path, undefined); },
      async acquire({ holder, ttlMs }) {
        await wait();
        const k = 'mdblock:' + path, now = Date.now(), cur = JSON.parse(localStorage.getItem(k) || 'null');
        if (cur && cur.exp > now && cur.holder !== holder) return { acquired: false, expiresAt: new Date(cur.exp).toISOString() };
        localStorage.setItem(k, JSON.stringify({ holder, exp: now + (ttlMs || 30000) }));
        return { acquired: true, version: 1, holder, expiresAt: new Date(now + (ttlMs || 30000)).toISOString() };
      },
      onSnapshot(next) {
        let last = '__none__';
        const f = () => { const raw = localStorage.getItem(P + path); if (raw === last) return; last = raw; next(snapOf(path, raw ? JSON.parse(raw) : undefined)); };
        listeners.add(f); setTimeout(f, 20);
        return () => listeners.delete(f);
      },
      collection(sub) { return collRef(path + '/' + sub); },
    };
  }
  function collRef(path, filters = [], order = null, lim = 1000) {
    const depth = path.split('/').length + 1;
    const run = () => {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith(P + path + '/')) continue;
        const p = k.slice(P.length);
        if (p.split('/').length !== depth) continue;
        const d = JSON.parse(localStorage.getItem(k));
        if (filters.every(([f, op, v]) => op === '>' ? d[f] > v : op === '==' ? d[f] === v : op === 'array-contains' ? Array.isArray(d[f]) && d[f].includes(v) : true)) out.push(snapOf(p, d));
      }
      if (order) out.sort((a, b) => (a.data()[order[0]] > b.data()[order[0]] ? 1 : -1) * (order[1] === 'desc' ? -1 : 1));
      else out.sort((a, b) => a.id < b.id ? -1 : 1);
      const docs = out.slice(0, lim);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      path,
      doc(id) { return docRef(path + '/' + (id || Math.random().toString(36).slice(2, 12))); },
      async add(d) { const r = this.doc(); await r.set(d); return r; },
      where(f, op, v) { return collRef(path, filters.concat([[f, op, v]]), order, lim); },
      orderBy(f, dir) { return collRef(path, filters, [f, dir], lim); },
      limit(n) { return collRef(path, filters, order, n); },
      async get() { await wait(); return run(); },
      onSnapshot(next) {
        let last = '';
        const f = () => { const r = run(); const key = r.docs.map(d => d.id + JSON.stringify(d.data())).join('|'); if (key === last) return; last = key; next(r); };
        listeners.add(f); setTimeout(f, 20);
        return () => listeners.delete(f);
      },
    };
  }
  const db = { doc: docRef, collection: p => collRef(p) };
  const uid = window.__mockUid || ('u' + Math.random().toString(36).slice(2, 8));
  const user = { id: async () => uid, me: async () => ({ id: uid }), isOwner: () => true, canEdit: () => true, can: () => true, profiles: async () => ({}) };
  const prev = window.claude && window.claude.use;
  window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : prev ? prev(n) : null };
})();
