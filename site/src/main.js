import 'katex/dist/katex.min.css';
import './styles.css';

import { MODE } from './data/store.js';
import { SESSION, SOURCES, clearRenderers, liveCount, refresh, setSource, source } from './data/context.js';
import { renderPortal } from './pages/portal.js';
import { renderLesson1 } from './pages/lesson1.js';
import { renderLesson2 } from './pages/lesson2.js';
import { renderLesson3 } from './pages/lesson3.js';
import { renderLesson4 } from './pages/lesson4.js';
import { renderLesson5 } from './pages/lesson5.js';

const PAGES = [
  { path: 'portal', num: 1, label: 'Service Portal', render: renderPortal, theme: 'portal' },
  { path: 'noise', num: 2, label: 'The Shape of Noise', render: renderLesson1, theme: 'lesson' },
  { path: 'bayes', num: 3, label: 'Bayes & the Agent', render: renderLesson2, theme: 'lesson' },
  { path: 'testing', num: 4, label: 'Did It Work?', render: renderLesson3, theme: 'lesson' },
  { path: 'models', num: 5, label: 'Regression → ML', render: renderLesson4, theme: 'lesson' },
  { path: 'ai', num: 6, label: 'LLMs & the Playbook', render: renderLesson5, theme: 'lesson' },
];

const topbar = document.getElementById('topbar');
const app = document.getElementById('app');

function renderTopbar(active) {
  const isLesson = active.theme === 'lesson';
  topbar.className = isLesson ? 'topbar dark' : 'topbar';
  topbar.innerHTML = `
    <a class="brand" href="#/portal"><span class="brand-mark">◆</span> SNOW Stats Lab</a>
    <nav class="pages" aria-label="Pages">
      ${PAGES.map((p) => `<a href="#/${p.path}" class="${p === active ? 'active' : ''}"><span class="num">${p.num}</span>${p.label}</a>`).join('')}
    </nav>
    <div class="data-controls">
      ${isLesson ? `<label class="source">Data
        <select id="source-select">${Object.entries(SOURCES).map(([k, v]) => `<option value="${k}" ${k === source() ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>` : ''}
      <span class="live-pill" title="${MODE === 'supabase' ? 'Shared live database' : 'Demo mode: data stays in this browser'}">
        <span class="dot ${MODE}"></span><span id="live-count">${liveCount()}</span> live · ${SESSION}
      </span>
    </div>`;
  topbar.querySelector('#source-select')?.addEventListener('change', (e) => setSource(e.target.value));
}

document.addEventListener('snowlab:data', (e) => {
  const el = document.getElementById('live-count');
  if (el) el.textContent = e.detail.live;
});

function route() {
  const path = (location.hash.replace(/^#\/?/, '') || 'portal').split('?')[0];
  const page = PAGES.find((p) => p.path === path) || PAGES[0];
  clearRenderers();
  document.body.dataset.theme = page.theme;
  renderTopbar(page);
  app.innerHTML = '';
  app.className = page.theme;
  page.render(app);
  window.scrollTo(0, 0);
}

// Presenter keys: → / ↓ / PageDown / Space jump to the next scene, ← / ↑ / PageUp go back.
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const scenes = [...document.querySelectorAll('.scene')];
  if (!scenes.length) return;
  const fwd = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key), back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
  if (!fwd && !back) return;
  e.preventDefault();
  const y = window.scrollY + 80;
  const idx = scenes.findIndex((s, i) => s.offsetTop <= y && (i === scenes.length - 1 || scenes[i + 1].offsetTop > y));
  const target = scenes[Math.max(0, Math.min(scenes.length - 1, idx + (fwd ? 1 : -1)))];
  window.scrollTo({ top: target.offsetTop - 64, behavior: 'smooth' });
});

window.addEventListener('hashchange', route);
route();
refresh();
