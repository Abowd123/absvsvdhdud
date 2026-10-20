// Tests ZipManager path rules against the fixture ZIPs (entry lists are read with Python's zipfile).
// Usage: python3 tests/list-entries.py > /tmp/entries.json && node tests/zip-manager.mock.mjs /tmp/entries.json
import fs from 'fs';
const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
const g = (a, e) => { const i = html.indexOf(a); return html.slice(i, html.indexOf(e, i)); };
globalThis.document = { getElementById: () => null };
eval(g('const Utils = {', '/* ====') + ';globalThis.Utils=Utils;');
eval(g('class ZipManager {', '/* ====') + ';globalThis.ZipManager=ZipManager;');
const entries = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/entries.json', 'utf8'));
const mk = (list, opts = { stripRoot: true, includeHidden: true }) => {
  const zm = Object.create(ZipManager.prototype);
  zm.files = []; zm._renderSkipInfo = () => {}; zm.options = () => opts;
  zm.zip = { forEach: cb => list.forEach(e => cb(e.p, { dir: e.dir, date: new Date(), unixPermissions: e.perm, _data: { uncompressedSize: e.size } })) };
  zm._buildFileList(); return zm;
};
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', m); };
let z = mk(entries['02-root-junk-hidden.zip']);
const paths = z.files.map(f => f.path).sort();
ok(JSON.stringify(paths) === JSON.stringify(['.github/workflows/ci.yml', 'README.md', 'gradlew', 'src/.env.example']), '02: root stripped, junk removed, hidden kept → ' + paths.join(', '));
ok(z.files.find(f => f.path === 'gradlew').executable === true, '02: gradlew executable bit detected');
ok(z.skipped.junk === 3, '02: 3 junk files ignored');
z = mk(entries['02-root-junk-hidden.zip'], { stripRoot: false, includeHidden: false });
ok(z.files.every(f => f.path.startsWith('my-project-main/')) && z.files.length === 2, '02: options off → root kept, hidden excluded');
z = mk(entries['05-arabic-names.zip']);
ok(z.files.some(f => f.path === 'مستندات/ملاحظات.md') && z.files.length === 3, '05: Arabic names preserved');
z = mk(entries['06-unsafe-paths.zip']);
const p6 = z.files.map(f => f.path).sort();
ok(!p6.some(p => p.includes('..') || p.startsWith('.git/')), '06: ../ and .git blocked');
ok(p6.includes('win/style/path.txt') && p6.includes('a/b.txt'), '06: backslashes + double slashes normalized → ' + p6.join(', '));
z = mk(entries['08-large-60mb-and-110mb.zip']);
const big = z.files.find(f => f.path === 'blocked-110mb.bin'), warn = z.files.find(f => f.path === 'warn-60mb.bin');
ok(big.tooLarge && !big.selected, '08: >100MB file flagged and unselected');
ok(warn.large && !warn.tooLarge && warn.selected, '08: 60MB file warned but allowed');
z = mk(entries['03-many-files-1200.zip']);
ok(z.files.length === 1200 && z.files.every(f => f._data === null), '03: 1200 files listed without decompressing');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
