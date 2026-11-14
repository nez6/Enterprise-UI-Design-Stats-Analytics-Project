// Copies the Streamlit lab into site/public/streamlit/ so Vite serves it at ./streamlit/
// (in dev) and ships it in the build. It runs in the browser via stlite.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'site', 'public', 'streamlit');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'legacy_lab'), { recursive: true });
cpSync(join(root, 'streamlit_app', 'web', 'index.html'), join(out, 'index.html'));
cpSync(join(root, 'streamlit_app', 'app.py'), join(out, 'app.py'));
for (const f of ['__init__.py', 'design.py', 'features.py', 'simulate.py']) {
  cpSync(join(root, 'streamlit_app', 'legacy_lab', f), join(out, 'legacy_lab', f));
}
console.log('Copied the Streamlit lab to site/public/streamlit/');
