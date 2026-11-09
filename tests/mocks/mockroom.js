// Stand-in for the claude.ai room capability: presence shared across tabs with BroadcastChannel and some delay
(() => {
  const myPeer = 'p' + Math.random().toString(36).slice(2, 8);
  function makeNamed(name) {
    const ch = new BroadcastChannel('mock-' + name);
    const state = new Map(); // peer -> presence
    let mine = {};
    const listeners = new Set();
    let snap = Object.freeze([]);
    const rebuild = () => {
      const arr = [];
      arr.push(Object.freeze({ peer: myPeer, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze({ ...mine }), updatedAt: Date.now() }));
      for (const [p, pr] of state) arr.push(Object.freeze({ peer: p, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: pr, updatedAt: Date.now() }));
      snap = Object.freeze(arr);
      for (const f of listeners) setTimeout(() => f({ peers: snap, joined: [], left: [], updated: [] }), 0);
    };
    const delay = () => 40 + Math.random() * 80;
    ch.onmessage = e => {
      const m = e.data;
      setTimeout(() => {
        if (m.t === 'pres') { state.set(m.peer, Object.freeze(m.presence)); rebuild(); }
        else if (m.t === 'hello') { ch.postMessage({ t: 'pres', peer: myPeer, presence: mine }); }
        else if (m.t === 'bye') { state.delete(m.peer); rebuild(); }
      }, delay());
    };
    ch.postMessage({ t: 'hello' });
    let pending = null;
    return {
      name,
      emit: async () => {}, on: () => () => {},
      presence: async patch => {
        for (const k of Object.keys(patch)) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
        const size = new TextEncoder().encode(JSON.stringify(mine)).length; window.__maxPresence = Math.max(window.__maxPresence, size);
        if (size > 4096) throw Object.assign(new Error('too big ' + size), { code: 'invalid_argument' });
        if (!pending) pending = setTimeout(() => { pending = null; ch.postMessage({ t: 'pres', peer: myPeer, presence: JSON.parse(JSON.stringify(mine)) }); }, 33);
        rebuild();
      },
      peers: () => snap,
      onPeers: f => { listeners.add(f); setTimeout(() => f({ peers: snap, joined: snap, left: [], updated: [] }), 0); return () => listeners.delete(f); },
      connected: () => true, onConnection: f => { setTimeout(() => f(true), 0); return () => {}; },
      leave: async () => { ch.postMessage({ t: 'bye', peer: myPeer }); ch.close(); },
    };
  }
  const rooms = {};
  const room = { join: async name => (rooms[name] = rooms[name] || makeNamed(name)), connected: () => true };
  window.claude = { use: async n => n === 'room' ? room : null };
  window.__maxPresence = 0;
})();
