// Keep index.html pure ASCII so no host ever mangles it:
// non-ASCII in the markup becomes &#N; and inside the script becomes \uXXXX.
// Usage: node tools/normalize.js [index.html]
const fs = require('fs');
const path = require('path');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const src = fs.readFileSync(file, 'utf8');
const at = src.indexOf('<script>\n(() => {');
if (at < 0) { console.error('Could not find the main script block.'); process.exit(1); }
const esc = (s, fn) => Array.from(s).map(c => (c.codePointAt(0) < 128 ? c : fn(c))).join('');
const head = esc(src.slice(0, at), c => `&#${c.codePointAt(0)};`);
const body = esc(src.slice(at), c => {
  const cp = c.codePointAt(0);
  if (cp <= 0xffff) return '\\u' + cp.toString(16).toUpperCase().padStart(4, '0');
  const h = Math.floor((cp - 0x10000) / 0x400) + 0xd800, l = ((cp - 0x10000) % 0x400) + 0xdc00;
  return '\\u' + h.toString(16).toUpperCase() + '\\u' + l.toString(16).toUpperCase();
});
fs.writeFileSync(file, head + body);

// and check the script still parses
const out = head + body;
const js = out.slice(out.lastIndexOf('<script>') + 8, out.lastIndexOf('</script>'));
try { new Function(js); console.log(`normalized ${path.basename(file)} (${(out.length / 1024).toFixed(0)} KB), script parses`); }
catch (e) { console.error('SYNTAX ERROR:', e.message); process.exit(1); }
