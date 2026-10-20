// Copies third-party libs from node_modules into www/vendor so the APK works without CDN.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const nm = 'node_modules', out = join('www', 'vendor');
const files = [
  [join(nm, 'jszip/dist/jszip.min.js'), join(out, 'jszip.min.js')],
  [join(nm, 'crypto-js/crypto-js.js'), join(out, 'crypto-js.min.js')],
  [join(nm, '@fortawesome/fontawesome-free/css/all.min.css'), join(out, 'fontawesome/css/all.min.css')],
  [join(nm, '@fortawesome/fontawesome-free/webfonts'), join(out, 'fontawesome/webfonts')],
];
for (const [src, dst] of files) {
  if (!existsSync(src)) { console.error('Missing: ' + src + ' (run npm install)'); process.exit(1); }
  mkdirSync(join(dst, '..'), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('vendored', dst);
}
