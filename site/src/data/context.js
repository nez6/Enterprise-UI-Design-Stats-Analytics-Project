// The dataset every lesson reads: the live class, the seeded benchmark, or both.
// Lessons call onData(render); render is called now and again whenever new tickets arrive.

import { loadLive, subscribe } from './store.js';
import { simulateClass } from './synthetic.js';

const params = new URLSearchParams(location.search);
export const SESSION = params.get('session') || 'pathfinders';

const bench = simulateClass(300, 42);
const state = { source: localStorage.getItem('snowlab.source') || 'benchmark', live: { rows: [], feedback: [] }, loading: false };
const renderers = new Set();

export const SOURCES = {
  live: 'Live class',
  benchmark: 'Benchmark (300 simulated)',
  both: 'Live + benchmark',
};

export function current() {
  if (state.source === 'live') return state.live;
  if (state.source === 'both') return { rows: [...bench.rows, ...state.live.rows], feedback: [...bench.feedback, ...state.live.feedback] };
  return bench;
}

export const source = () => state.source;
export const liveCount = () => new Set(state.live.rows.map((r) => r.participant_id)).size;

export function setSource(s) {
  state.source = s;
  try { localStorage.setItem('snowlab.source', s); } catch { /* ignore */ }
  emit();
}

function emit() {
  const data = current();
  renderers.forEach((fn) => fn(data));
  document.dispatchEvent(new CustomEvent('snowlab:data', { detail: { live: liveCount(), source: state.source } }));
}

export async function refresh() {
  state.loading = true;
  try { state.live = await loadLive(SESSION); } catch (e) { console.warn('Live data unavailable:', e.message); }
  state.loading = false;
  emit();
}

let timer = null;
subscribe(() => { clearTimeout(timer); timer = setTimeout(refresh, 400); });

export function onData(fn) {
  renderers.add(fn);
  fn(current());
  return () => renderers.delete(fn);
}

export function clearRenderers() { renderers.clear(); }
